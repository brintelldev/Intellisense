// server/src/routes/chat.ts
//
// Endpoints do chatbot IntelliSense.
//
//   POST /api/chat/stream                    — envia mensagem e recebe SSE com tokens/tools
//   GET  /api/chat/conversations             — lista conversas do tenant atual
//   GET  /api/chat/conversations/:id         — detalhe + mensagens da conversa
//   POST /api/chat/conversations/:id/rename  — renomeia conversa
//   DELETE /api/chat/conversations/:id       — deleta conversa (cascata em mensagens)
//
// Toda query usa `req.tenantId` (injetado pelo tenantMiddleware). O LLM nunca
// vê o tenantId — ele é passado para o engine via ToolContext.

import { Router } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { db } from "../db.js";
import {
  chatConversations,
  chatMessages,
  tenants,
  type ChatToolCall,
} from "../../../shared/schema.js";
import { runTurn, type ChatEngineEvent } from "../engine/chat-engine.js";
import { isChatEnabled } from "../engine/llm-provider.js";

export const chatRouter = Router();

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Gera título curto a partir da primeira pergunta do usuário. */
function titleFromFirstMessage(msg: string): string {
  const clean = msg.trim().replace(/\s+/g, " ");
  if (clean.length <= 60) return clean;
  return clean.slice(0, 57).trimEnd() + "...";
}

/** Converte mensagens do banco em formato OpenAI para enviar ao LLM. */
function dbMessagesToLLM(
  rows: Array<{
    role: "user" | "assistant" | "tool";
    content: string;
    toolCalls: ChatToolCall[] | null;
  }>,
): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [];

  for (const row of rows) {
    if (row.role === "user") {
      out.push({ role: "user", content: row.content });
    } else if (row.role === "assistant") {
      // Se houve tool calls, reconstrói o formato esperado
      const tc = row.toolCalls ?? [];
      if (tc.length > 0) {
        out.push({
          role: "assistant",
          content: row.content || null,
          tool_calls: tc.map((t) => ({
            id: t.id,
            type: "function" as const,
            function: { name: t.name, arguments: JSON.stringify(t.arguments) },
          })),
        } as ChatCompletionMessageParam);

        // E em seguida as mensagens `tool` com os resultados
        for (const t of tc) {
          out.push({
            role: "tool",
            tool_call_id: t.id,
            content: t.error
              ? JSON.stringify({ error: t.error })
              : JSON.stringify(t.result ?? null),
          } as ChatCompletionMessageParam);
        }
      } else {
        out.push({ role: "assistant", content: row.content });
      }
    }
    // role "tool" no banco nunca é reemitido standalone — já foi expandido acima
  }

  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/chat/stream — envia mensagem, recebe SSE
// Body: { conversationId?: string; message: string; pageContext?: string }
// ────────────────────────────────────────────────────────────────────────────
chatRouter.post("/stream", async (req, res) => {
  if (!isChatEnabled()) {
    return res.status(503).json({ error: "Chat desabilitado neste ambiente" });
  }

  const tenantId = req.tenantId!;
  const userId = req.session.userId!;
  const { conversationId: inputConversationId, message, pageContext } = req.body ?? {};

  if (typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Campo `message` é obrigatório" });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: "Mensagem excede 4000 caracteres" });
  }

  // Resolve ou cria conversa
  let conversationId: string;
  let isNewConversation = false;

  if (inputConversationId) {
    const existing = await db
      .select()
      .from(chatConversations)
      .where(
        and(
          eq(chatConversations.id, inputConversationId),
          eq(chatConversations.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Conversa não encontrada" });
    }
    conversationId = existing[0].id;
  } else {
    const [created] = await db
      .insert(chatConversations)
      .values({
        tenantId,
        userId,
        title: titleFromFirstMessage(message),
      })
      .returning();
    conversationId = created.id;
    isNewConversation = true;
  }

  // Carrega histórico da conversa (exceto a mensagem atual — ela ainda não foi gravada)
  const historyRows = await db
    .select({
      role: chatMessages.role,
      content: chatMessages.content,
      toolCalls: chatMessages.toolCalls,
    })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conversationId),
        eq(chatMessages.tenantId, tenantId),
      ),
    )
    .orderBy(asc(chatMessages.createdAt));

  const history = dbMessagesToLLM(historyRows);

  // Resolve nome do tenant (para o system prompt)
  const [tenantRow] = await db
    .select({ companyName: tenants.companyName })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  // ─── Abre SSE ─────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // nginx: desabilita buffering
  res.flushHeaders?.();

  const sse = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Aviso inicial: envia o conversationId (cliente guarda para próximas msgs)
  sse("conversation", { conversationId, isNewConversation });

  let clientAborted = false;
  req.on("close", () => {
    clientAborted = true;
  });

  try {
    // Persiste a mensagem do usuário ANTES de chamar o LLM (mesmo que o LLM falhe, a pergunta fica registrada)
    await db.insert(chatMessages).values({
      conversationId,
      tenantId,
      role: "user",
      content: message,
    });

    const result = await runTurn({
      history,
      userMessage: message,
      ctx: { tenantId },
      tenantName: tenantRow?.companyName,
      pageContext: typeof pageContext === "string" ? pageContext : undefined,
      onEvent: (evt: ChatEngineEvent) => {
        if (clientAborted) return;
        sse(evt.type, evt);
      },
    });

    // Persiste resposta do assistant (com tool calls embutidas no JSON)
    await db.insert(chatMessages).values({
      conversationId,
      tenantId,
      role: "assistant",
      content: result.finalText,
      toolCalls: result.toolCalls.length > 0 ? result.toolCalls : null,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      model: result.model,
    });

    // Atualiza updatedAt da conversa
    await db
      .update(chatConversations)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId));

    sse("finished", {
      conversationId,
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
    res.end();
  } catch (err) {
    console.error("[chat/stream] Erro no turno:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    sse("error", {
      message: `Desculpe, encontrei um problema ao processar sua pergunta. (${message})`,
    });
    // Persiste uma mensagem de erro do assistente para manter o histórico consistente
    try {
      await db.insert(chatMessages).values({
        conversationId,
        tenantId,
        role: "assistant",
        content: `[erro] ${message}`,
      });
    } catch {
      /* swallow */
    }
    res.end();
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/chat/conversations — lista conversas do tenant
// ────────────────────────────────────────────────────────────────────────────
chatRouter.get("/conversations", async (req, res) => {
  const tenantId = req.tenantId!;

  const rows = await db
    .select({
      id: chatConversations.id,
      title: chatConversations.title,
      createdAt: chatConversations.createdAt,
      updatedAt: chatConversations.updatedAt,
    })
    .from(chatConversations)
    .where(eq(chatConversations.tenantId, tenantId))
    .orderBy(desc(chatConversations.updatedAt))
    .limit(50);

  res.json({ conversations: rows });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/chat/conversations/:id — detalhe + mensagens
// ────────────────────────────────────────────────────────────────────────────
chatRouter.get("/conversations/:id", async (req, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  const [conv] = await db
    .select()
    .from(chatConversations)
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.tenantId, tenantId)),
    )
    .limit(1);

  if (!conv) {
    return res.status(404).json({ error: "Conversa não encontrada" });
  }

  const messages = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      toolCalls: chatMessages.toolCalls,
      model: chatMessages.model,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, id),
        eq(chatMessages.tenantId, tenantId),
      ),
    )
    .orderBy(asc(chatMessages.createdAt));

  res.json({
    conversation: {
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    },
    messages,
  });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/chat/conversations/:id/rename
// ────────────────────────────────────────────────────────────────────────────
chatRouter.post("/conversations/:id/rename", async (req, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;
  const { title } = req.body ?? {};

  if (typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({ error: "Campo `title` é obrigatório" });
  }
  if (title.length > 255) {
    return res.status(400).json({ error: "Título excede 255 caracteres" });
  }

  const result = await db
    .update(chatConversations)
    .set({ title: title.trim(), updatedAt: new Date() })
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.tenantId, tenantId)),
    )
    .returning();

  if (result.length === 0) {
    return res.status(404).json({ error: "Conversa não encontrada" });
  }

  res.json({ conversation: result[0] });
});

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/chat/conversations/:id
// ────────────────────────────────────────────────────────────────────────────
chatRouter.delete("/conversations/:id", async (req, res) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  const result = await db
    .delete(chatConversations)
    .where(
      and(eq(chatConversations.id, id), eq(chatConversations.tenantId, tenantId)),
    )
    .returning({ id: chatConversations.id });

  if (result.length === 0) {
    return res.status(404).json({ error: "Conversa não encontrada" });
  }

  res.json({ ok: true });
});
