// server/src/engine/chat-engine.ts
//
// Orquestrador do chatbot. Loop tool-use:
//   1. Envia mensagens + tools para o LLM (via OpenRouter)
//   2. Se o LLM pedir tool calls, executa em paralelo (tenant-safe)
//   3. Envia resultados de volta como `role: "tool"`
//   4. Repete até `finish_reason = "stop"` ou atingir `maxIterations`
//
// Não-streaming nesta versão (T6). O streaming do TEXTO para o cliente é feito
// no route handler (T7) que emite eventos SSE conforme o engine avança.
//
// Fallback: se o primary retornar 429/5xx/timeout, tenta o próximo modelo da cadeia.

import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import OpenAI from "openai";

import {
  DEFAULT_LLM_CONFIG,
  getLLMClient,
  getModelChain,
  isRetryableLLMError,
} from "./llm-provider.js";
import { executeTool, getToolDefinitions, type ToolContext } from "./chat-tools.js";
import { buildSystemPrompt } from "./chat-prompts.js";

// ────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ────────────────────────────────────────────────────────────────────────────

/** Registro de uma tool call executada (persistido em chatMessages.toolCalls). */
export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  durationMs: number;
}

/** Eventos emitidos durante a execução do turno (o route handler stream via SSE). */
export type ChatEngineEvent =
  | { type: "model_attempt"; model: string; attempt: number }
  | { type: "tool_call_start"; id: string; name: string; arguments: Record<string, unknown> }
  | { type: "tool_call_end"; id: string; name: string; ok: boolean; durationMs: number; error?: string }
  | { type: "text_delta"; delta: string }
  | { type: "done"; finalText: string; toolCalls: ToolCallRecord[]; model: string; tokensIn: number; tokensOut: number }
  | { type: "error"; message: string };

export interface RunTurnParams {
  /** Histórico atual da conversa (sem o system prompt — esse é injetado aqui). */
  history: ChatCompletionMessageParam[];
  /** Pergunta do usuário para este turno. */
  userMessage: string;
  /** Contexto server-side (tenantId). */
  ctx: ToolContext;
  /** Nome amigável do tenant (vai pro system prompt). */
  tenantName?: string;
  /** Página atual do cliente (Fase 3, opcional). */
  pageContext?: string;
  /** Callback de evento — use para SSE. */
  onEvent?: (evt: ChatEngineEvent) => void;
  /** Sobrescrever configs default. */
  maxIterations?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface RunTurnResult {
  finalText: string;
  toolCalls: ToolCallRecord[];
  model: string;
  tokensIn: number;
  tokensOut: number;
  /** Histórico completo pós-turno (inclui a mensagem do usuário, assistant e tool messages). */
  messages: ChatCompletionMessageParam[];
}

// ────────────────────────────────────────────────────────────────────────────
// Util
// ────────────────────────────────────────────────────────────────────────────

function safeParseJSON(raw: string): Record<string, unknown> {
  if (!raw || raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Chamada ao LLM com cadeia de fallback
// ────────────────────────────────────────────────────────────────────────────

interface CallLLMArgs {
  client: OpenAI;
  models: string[];
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
  maxTokens: number;
  temperature: number;
  onEvent?: (evt: ChatEngineEvent) => void;
}

interface CallLLMResult {
  completion: OpenAI.Chat.Completions.ChatCompletion;
  model: string;
}

/**
 * Tenta cada modelo da cadeia até um responder. Só faz fallback em erros
 * claramente transitórios (429/408/5xx/network). Erros 400 (prompt inválido)
 * não fazem fallback — isso quebraria em qualquer modelo.
 */
async function callLLMWithFallback(args: CallLLMArgs): Promise<CallLLMResult> {
  const { client, models, messages, tools, maxTokens, temperature, onEvent } = args;

  let lastError: unknown = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    onEvent?.({ type: "model_attempt", model, attempt: i + 1 });

    try {
      const completion = await client.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: maxTokens,
        temperature,
        // stream: false — o streaming de texto para o cliente é feito pelo chunking
        // no route handler (via onEvent text_delta após o engine concluir).
        // Streaming granular token-a-token fica para uma evolução futura, quando
        // implementarmos parsing de stream do SDK com tool_calls parciais.
        stream: false,
      });
      return { completion, model };
    } catch (err) {
      lastError = err;
      if (!isRetryableLLMError(err)) {
        // Erro não-recuperável (ex: 400 prompt inválido) — não vale tentar próximo modelo
        throw err;
      }
      // Continue para o próximo modelo da cadeia
      // eslint-disable-next-line no-console
      console.warn(
        `[chat-engine] Modelo "${model}" falhou (${err instanceof Error ? err.message : "?"}). Tentando próximo...`,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Todos os modelos da cadeia falharam sem erro identificável.");
}

// ────────────────────────────────────────────────────────────────────────────
// Loop tool-use
// ────────────────────────────────────────────────────────────────────────────

/**
 * Executa um turno completo da conversa. Retorna o texto final + histórico
 * atualizado + registro de tool calls. Emite eventos via onEvent.
 */
export async function runTurn(params: RunTurnParams): Promise<RunTurnResult> {
  const {
    history,
    userMessage,
    ctx,
    tenantName,
    pageContext,
    onEvent,
    maxIterations = DEFAULT_LLM_CONFIG.maxIterations,
    maxTokens = DEFAULT_LLM_CONFIG.maxTokens,
    temperature = DEFAULT_LLM_CONFIG.temperature,
  } = params;

  const client = getLLMClient();
  const models = getModelChain();
  const tools = getToolDefinitions();

  const systemPrompt = buildSystemPrompt({ tenantName, pageContext });

  // Monta o array completo de mensagens. O system prompt é sempre injetado no
  // começo — não persistimos ele no banco para evitar duplicação.
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  const toolCallRecords: ToolCallRecord[] = [];
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let finalText = "";
  let lastModel = models[0];

  for (let iter = 0; iter < maxIterations; iter++) {
    const { completion, model } = await callLLMWithFallback({
      client,
      models,
      messages,
      tools,
      maxTokens,
      temperature,
      onEvent,
    });
    lastModel = model;

    totalTokensIn += completion.usage?.prompt_tokens ?? 0;
    totalTokensOut += completion.usage?.completion_tokens ?? 0;

    const choice = completion.choices[0];
    if (!choice) {
      throw new Error("LLM retornou sem nenhuma choice.");
    }

    const assistantMsg = choice.message;
    const toolCalls = assistantMsg.tool_calls ?? [];

    // Adiciona sempre a mensagem assistant ao histórico (com ou sem tool_calls)
    messages.push({
      role: "assistant",
      content: assistantMsg.content ?? null,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    } as ChatCompletionMessageParam);

    // Caso 1: sem tool calls → é a resposta final
    if (toolCalls.length === 0) {
      finalText = assistantMsg.content ?? "";
      if (finalText) {
        onEvent?.({ type: "text_delta", delta: finalText });
      }
      break;
    }

    // Caso 2: tool calls → executa em paralelo e envia resultados de volta
    const toolResults = await Promise.all(
      toolCalls.map(async (tc): Promise<{ tc: ChatCompletionMessageToolCall; record: ToolCallRecord }> => {
        // Apenas function calls são suportados (nossa única modalidade)
        if (tc.type !== "function") {
          const record: ToolCallRecord = {
            id: tc.id,
            name: "unknown",
            arguments: {},
            error: `Tipo de tool call não suportado: ${tc.type}`,
            durationMs: 0,
          };
          return { tc, record };
        }

        const name = tc.function.name;
        const args = safeParseJSON(tc.function.arguments);
        onEvent?.({ type: "tool_call_start", id: tc.id, name, arguments: args });

        const start = Date.now();
        const res = await executeTool(name, args, ctx);
        const durationMs = Date.now() - start;

        const record: ToolCallRecord = res.ok
          ? { id: tc.id, name, arguments: args, result: res.result, durationMs }
          : { id: tc.id, name, arguments: args, error: res.error, durationMs };

        onEvent?.({
          type: "tool_call_end",
          id: tc.id,
          name,
          ok: res.ok,
          durationMs,
          error: res.ok ? undefined : res.error,
        });

        return { tc, record };
      }),
    );

    for (const { tc, record } of toolResults) {
      toolCallRecords.push(record);

      const toolContent = record.error
        ? JSON.stringify({ error: record.error })
        : JSON.stringify(record.result ?? null);

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: toolContent,
      } as ChatCompletionMessageParam);
    }

    // Loop continua: próxima iteração enviará os tool results de volta ao LLM
  }

  // Se saímos sem gerar texto final, significa que atingimos maxIterations
  if (!finalText) {
    finalText =
      "Ainda não consegui consolidar uma resposta completa. Pode reformular ou me dar um ponto de partida mais específico?";
    onEvent?.({ type: "text_delta", delta: finalText });
  }

  onEvent?.({
    type: "done",
    finalText,
    toolCalls: toolCallRecords,
    model: lastModel,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
  });

  return {
    finalText,
    toolCalls: toolCallRecords,
    model: lastModel,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    messages,
  };
}
