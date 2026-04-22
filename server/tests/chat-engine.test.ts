/**
 * chat-engine.test.ts
 *
 * Testa o orquestrador chat-engine.ts mockando apenas o cliente OpenAI/OpenRouter.
 * As tools usam o DB real (tenant DCCO seedado em 00-seed.test.ts).
 *
 * Cobertura:
 *  - Loop tool-use: LLM pede tool → engine executa → responde → engine retorna texto
 *  - Paralelização de múltiplas tool calls na mesma iteração
 *  - Cadeia de fallback: primary 429 → fallback 1 sucesso
 *  - maxIterations honrado (não trava em loop infinito)
 *  - Eventos emitidos (tool_call_start/end, text_delta, done)
 */

import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { db } from "../src/db";
import { tenants } from "../../shared/schema";

// Mock do módulo llm-provider — substitui o cliente OpenAI real
const mockCreate = vi.fn();

vi.mock("../src/engine/llm-provider.js", async () => {
  const actual = await vi.importActual<typeof import("../src/engine/llm-provider.js")>(
    "../src/engine/llm-provider.js",
  );
  return {
    ...actual,
    getLLMClient: () => ({
      chat: { completions: { create: mockCreate } },
    }),
    getModelChain: () => ["model-a", "model-b", "model-c"],
  };
});

// Import DEPOIS do vi.mock — caso contrário a versão real é amarrada
const { runTurn } = await import("../src/engine/chat-engine");

// ─── Helpers para montar respostas falsas do LLM ────────────────────────────

function makeAssistantText(text: string): OpenAI.Chat.Completions.ChatCompletion {
  return {
    id: "cmpl-" + Math.random().toString(36).slice(2),
    object: "chat.completion",
    created: Date.now(),
    model: "model-a",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text, refusal: null },
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

function makeToolCall(
  toolName: string,
  args: Record<string, unknown>,
): OpenAI.Chat.Completions.ChatCompletion {
  return {
    id: "cmpl-" + Math.random().toString(36).slice(2),
    object: "chat.completion",
    created: Date.now(),
    model: "model-a",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          refusal: null,
          tool_calls: [
            {
              id: "call_" + Math.random().toString(36).slice(2),
              type: "function",
              function: { name: toolName, arguments: JSON.stringify(args) },
            },
          ],
        },
        finish_reason: "tool_calls",
        logprobs: null,
      },
    ],
    usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
  };
}

function makeMultipleToolCalls(
  calls: Array<{ name: string; args: Record<string, unknown> }>,
): OpenAI.Chat.Completions.ChatCompletion {
  return {
    id: "cmpl-" + Math.random().toString(36).slice(2),
    object: "chat.completion",
    created: Date.now(),
    model: "model-a",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          refusal: null,
          tool_calls: calls.map((c, i) => ({
            id: `call_${i}_${Math.random().toString(36).slice(2)}`,
            type: "function" as const,
            function: { name: c.name, arguments: JSON.stringify(c.args) },
          })),
        },
        finish_reason: "tool_calls",
        logprobs: null,
      },
    ],
    usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
  };
}

// ────────────────────────────────────────────────────────────────────────────

describe("chat-engine — loop tool-use", () => {
  let realTenantId: string;

  beforeAll(async () => {
    const [row] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.companyName, "DCCO Equipamentos"))
      .limit(1);
    if (!row) throw new Error("Tenant DCCO não encontrado — rode 00-seed.test.ts antes");
    realTenantId = row.id;
  });

  afterEach(() => {
    mockCreate.mockReset();
  });

  it("resposta direta sem tool call retorna texto final", async () => {
    mockCreate.mockResolvedValueOnce(makeAssistantText("Olá! Como posso ajudar?"));

    const result = await runTurn({
      history: [],
      userMessage: "oi",
      ctx: { tenantId: realTenantId },
    });

    expect(result.finalText).toBe("Olá! Como posso ajudar?");
    expect(result.toolCalls).toHaveLength(0);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("executa 1 tool call e retorna texto na iteração seguinte", async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolCall("get_overview_metrics", {}))
      .mockResolvedValueOnce(makeAssistantText("Você tem X clientes ativos."));

    const events: string[] = [];
    const result = await runTurn({
      history: [],
      userMessage: "quantos clientes tenho?",
      ctx: { tenantId: realTenantId },
      onEvent: (e) => events.push(e.type),
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("get_overview_metrics");
    expect(result.toolCalls[0].error).toBeUndefined();
    expect(result.finalText).toMatch(/clientes ativos/);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(events).toContain("tool_call_start");
    expect(events).toContain("tool_call_end");
    expect(events).toContain("done");
  });

  it("executa múltiplas tool calls em paralelo na mesma iteração", async () => {
    mockCreate
      .mockResolvedValueOnce(
        makeMultipleToolCalls([
          { name: "get_overview_metrics", args: {} },
          { name: "list_customers_at_risk", args: { limit: 3 } },
        ]),
      )
      .mockResolvedValueOnce(makeAssistantText("Resposta combinada."));

    const result = await runTurn({
      history: [],
      userMessage: "overview + top 3 em risco",
      ctx: { tenantId: realTenantId },
    });

    expect(result.toolCalls).toHaveLength(2);
    const names = result.toolCalls.map((t) => t.name).sort();
    expect(names).toEqual(["get_overview_metrics", "list_customers_at_risk"]);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("injeta tenantId no contexto — tool NUNCA recebe tenantId do LLM", async () => {
    // LLM tenta passar um tenantId malicioso — deve ser ignorado (Zod strict)
    mockCreate
      .mockResolvedValueOnce(
        makeToolCall("list_customers_at_risk", {
          limit: 5,
          // Simulando LLM malicioso tentando injetar tenantId via args — Zod
          // ignora (campo não existe no schema) e o ToolContext server-side
          // é o único tenantId que o handler enxerga.
          tenantId: "00000000-0000-0000-0000-000000000000",
        }),
      )
      .mockResolvedValueOnce(makeAssistantText("Feito."));

    const result = await runTurn({
      history: [],
      userMessage: "liste",
      ctx: { tenantId: realTenantId },
    });

    // Se o tenantId do LLM tivesse vindo, a tool retornaria 0 clientes.
    // Como usamos o tenantId real do contexto, tem que retornar dados.
    const toolResult = result.toolCalls[0].result as { count: number };
    expect(toolResult.count).toBeGreaterThan(0);
  });

  it("faz fallback para model-b quando model-a retorna 429", async () => {
    const rateLimitError = new OpenAI.APIError(
      429,
      { error: { message: "rate limited" } },
      "rate limited",
      undefined,
    );
    mockCreate
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce(makeAssistantText("Respondido pelo fallback."));

    const events: Array<{ type: string; [k: string]: unknown }> = [];
    const result = await runTurn({
      history: [],
      userMessage: "teste fallback",
      ctx: { tenantId: realTenantId },
      onEvent: (e) => events.push(e as never),
    });

    expect(result.finalText).toBe("Respondido pelo fallback.");
    // 2 model_attempt events: model-a tentado e falhou, model-b tentado e sucesso
    const attempts = events.filter((e) => e.type === "model_attempt");
    expect(attempts.length).toBe(2);
    expect((attempts[0] as unknown as { model: string }).model).toBe("model-a");
    expect((attempts[1] as unknown as { model: string }).model).toBe("model-b");
  });

  it("NÃO faz fallback em erro 400 (prompt malformado)", async () => {
    const badRequest = new OpenAI.APIError(
      400,
      { error: { message: "invalid prompt" } },
      "bad request",
      undefined,
    );
    mockCreate.mockRejectedValueOnce(badRequest);

    await expect(
      runTurn({
        history: [],
        userMessage: "x",
        ctx: { tenantId: realTenantId },
      }),
    ).rejects.toThrow();

    expect(mockCreate).toHaveBeenCalledTimes(1); // não tentou fallback
  });

  it("respeita maxIterations — para mesmo se LLM ficar pedindo tools", async () => {
    // LLM pede tool infinitamente
    mockCreate.mockImplementation(async () =>
      makeToolCall("get_overview_metrics", {}),
    );

    const result = await runTurn({
      history: [],
      userMessage: "loop",
      ctx: { tenantId: realTenantId },
      maxIterations: 3,
    });

    // Chamou 3 vezes (limite), e caiu no fallback text "não consegui consolidar"
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(result.finalText).toMatch(/não consegui|reformular/i);
    expect(result.toolCalls.length).toBe(3);
  });

  it("acumula tokensIn/tokensOut ao longo das iterações", async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolCall("get_overview_metrics", {}))
      .mockResolvedValueOnce(makeAssistantText("ok"));

    const result = await runTurn({
      history: [],
      userMessage: "t",
      ctx: { tenantId: realTenantId },
    });

    // Iteração 1: 120 in / 40 out (tool call) + iteração 2: 100 in / 50 out (resposta)
    expect(result.tokensIn).toBe(220);
    expect(result.tokensOut).toBe(90);
  });
});
