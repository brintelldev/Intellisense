// server/src/engine/llm-provider.ts
//
// Thin abstração sobre o SDK da OpenAI apontando para o OpenRouter.
// O OpenRouter expõe uma API 100% compatível com a da OpenAI, então
// continuamos usando o `openai` SDK mas trocando `baseURL` e `apiKey`.
//
// Trocar de provedor/modelo em produção é apenas mudar variáveis de ambiente:
//
//   OPENROUTER_API_KEY            — chave do OpenRouter
//   CHAT_MODEL_PRIMARY            — modelo principal (ex: minimax/minimax-m2.5:free)
//   CHAT_MODEL_FALLBACK_1         — fallback em caso de 429/5xx
//   CHAT_MODEL_FALLBACK_2         — último fallback
//
// Se quisermos migrar direto para Anthropic/OpenAI no futuro, basta trocar
// o `baseURL` e o valor de `CHAT_MODEL_*` — o resto do código continua igual.

import OpenAI from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

let cachedClient: OpenAI | null = null;

/**
 * Retorna um cliente OpenAI configurado para o OpenRouter.
 * Singleton para aproveitar keep-alive de conexões HTTP.
 */
export function getLLMClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY não configurada. Adicione ao .env para habilitar o chatbot."
    );
  }

  cachedClient = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      // OpenRouter recomenda estes headers para atribuição e métricas
      "HTTP-Referer": process.env.APP_PUBLIC_URL ?? "https://intellisense.app",
      "X-Title": "IntelliSense Chatbot",
    },
  });

  return cachedClient;
}

/**
 * Retorna a cadeia de modelos a tentar em ordem.
 * O chat-engine.ts usa isso para fallback automático em caso de
 * rate limit (429) ou erro 5xx do provedor.
 */
export function getModelChain(): string[] {
  const chain = [
    process.env.CHAT_MODEL_PRIMARY,
    process.env.CHAT_MODEL_FALLBACK_1,
    process.env.CHAT_MODEL_FALLBACK_2,
  ].filter((m): m is string => typeof m === "string" && m.length > 0);

  if (chain.length === 0) {
    // Default de dev: 3 modelos gratuitos aprovados
    return [
      "minimax/minimax-m2.5:free",
      "qwen/qwen3-coder:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
    ];
  }

  return chain;
}

/**
 * Retorna true se o erro do SDK é recuperável com fallback
 * (rate limit do OpenRouter, 5xx do provider upstream, timeout).
 */
export function isRetryableLLMError(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 0;
    // 429 = rate limit, 408 = timeout, 5xx = provider error
    return status === 429 || status === 408 || (status >= 500 && status < 600);
  }
  // Network errors, AbortError, etc.
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("econnreset") ||
      msg.includes("network") ||
      msg.includes("fetch failed")
    );
  }
  return false;
}

/**
 * Config de geração default. O chat-engine pode sobrescrever.
 */
export const DEFAULT_LLM_CONFIG = {
  maxTokens: parseInt(process.env.CHAT_MAX_TOKENS ?? "2000", 10),
  maxIterations: parseInt(process.env.CHAT_MAX_ITERATIONS ?? "5", 10),
  temperature: 0.3, // baixo: queremos respostas factuais
};

export function isChatEnabled(): boolean {
  return process.env.CHAT_ENABLED !== "false";
}
