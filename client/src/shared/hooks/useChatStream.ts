// client/src/shared/hooks/useChatStream.ts
//
// Hook que encapsula o streaming SSE do chatbot.
//
// Contrato com o backend (POST /api/chat/stream):
//   event: conversation       { conversationId, isNewConversation }
//   event: model_attempt      { model, attempt }
//   event: tool_call_start    { id, name, arguments }
//   event: tool_call_end      { id, name, ok, durationMs, error? }
//   event: text_delta         { delta }
//   event: done               { finalText, toolCalls, model, tokensIn, tokensOut }
//   event: finished           { conversationId, model, tokensIn, tokensOut }
//   event: error              { message }
//
// Como fetch() retorna um stream, usamos `eventsource-parser` para extrair
// os events/data de forma robusta (não dá pra usar `EventSource` nativo porque
// esse só aceita GET e não manda cookies cross-origin sem CORS perfeito).

import { useCallback, useEffect, useRef, useState } from "react";
import { createParser, type EventSourceMessage } from "eventsource-parser";

// ────────────────────────────────────────────────────────────────────────────
// Tipos (espelham ChatToolCall do backend)
// ────────────────────────────────────────────────────────────────────────────

export interface ChatToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  durationMs?: number;
}

export interface ChatMessage {
  id: string; // id local (nanoid-like) até ser persistido
  role: "user" | "assistant";
  content: string;
  toolCalls?: ChatToolCall[];
  /** Durante o streaming, marca que ainda está recebendo tokens. */
  streaming?: boolean;
  model?: string;
  createdAt: string; // ISO
}

export interface UseChatStreamState {
  messages: ChatMessage[];
  isStreaming: boolean;
  conversationId: string | null;
  error: string | null;
  /** Tool call atualmente em execução (para mostrar chip "consultando..."). */
  currentToolCall: { id: string; name: string } | null;
}

export interface UseChatStreamApi extends UseChatStreamState {
  send: (message: string, opts?: { pageContext?: string }) => Promise<void>;
  cancel: () => void;
  reset: () => void;
  loadConversation: (conversationId: string) => Promise<void>;
  setConversationId: (id: string | null) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Util
// ────────────────────────────────────────────────────────────────────────────

function makeId(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    "-" +
    Date.now().toString(36)
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Hook principal
// ────────────────────────────────────────────────────────────────────────────

export function useChatStream(): UseChatStreamApi {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentToolCall, setCurrentToolCall] = useState<UseChatStreamState["currentToolCall"]>(null);

  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setCurrentToolCall(null);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, [cancel]);

  // Cleanup ao desmontar
  useEffect(() => () => abortRef.current?.abort(), []);

  const loadConversation = useCallback(async (id: string) => {
    cancel();
    setError(null);
    try {
      const res = await fetch(`/api/chat/conversations/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const loaded: ChatMessage[] = (data.messages ?? [])
        .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
        .map((m: {
          id: string;
          role: "user" | "assistant";
          content: string;
          toolCalls: ChatToolCall[] | null;
          model: string | null;
          createdAt: string;
        }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls ?? undefined,
          model: m.model ?? undefined,
          createdAt: m.createdAt,
        }));
      setMessages(loaded);
      setConversationId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar conversa");
    }
  }, [cancel]);

  const send = useCallback(
    async (userMessage: string, opts?: { pageContext?: string }) => {
      if (!userMessage.trim() || isStreaming) return;

      cancel();
      setError(null);

      // 1. Adiciona mensagem do usuário no estado imediatamente
      const userMsg: ChatMessage = {
        id: makeId(),
        role: "user",
        content: userMessage,
        createdAt: new Date().toISOString(),
      };
      // 2. Cria placeholder do assistant (vazio, com streaming: true)
      const assistantId = makeId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolCalls: [],
        streaming: true,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({
            conversationId,
            message: userMessage,
            pageContext: opts?.pageContext,
          }),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(errJson.error ?? `HTTP ${res.status}`);
        }

        if (!res.body) {
          throw new Error("Resposta sem body (streaming indisponível)");
        }

        // ─── Handler dos eventos SSE ────────────────────────────────────
        const onEvent = (ev: EventSourceMessage) => {
          const eventName = ev.event || "message";
          let data: Record<string, unknown> = {};
          try {
            data = ev.data ? (JSON.parse(ev.data) as Record<string, unknown>) : {};
          } catch {
            return;
          }

          switch (eventName) {
            case "conversation": {
              const convId = data.conversationId as string | undefined;
              if (convId) setConversationId(convId);
              break;
            }
            case "tool_call_start": {
              const id = data.id as string;
              const name = data.name as string;
              const args = (data.arguments ?? {}) as Record<string, unknown>;
              setCurrentToolCall({ id, name });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolCalls: [...(m.toolCalls ?? []), { id, name, arguments: args }],
                      }
                    : m,
                ),
              );
              break;
            }
            case "tool_call_end": {
              const id = data.id as string;
              const ok = data.ok as boolean;
              const durationMs = data.durationMs as number;
              const errMsg = data.error as string | undefined;
              setCurrentToolCall((cur) => (cur?.id === id ? null : cur));
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolCalls: (m.toolCalls ?? []).map((tc) =>
                          tc.id === id ? { ...tc, durationMs, error: ok ? undefined : errMsg } : tc,
                        ),
                      }
                    : m,
                ),
              );
              break;
            }
            case "text_delta": {
              const delta = data.delta as string;
              if (!delta) break;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + delta } : m,
                ),
              );
              break;
            }
            case "done": {
              const model = data.model as string | undefined;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, streaming: false, model } : m,
                ),
              );
              break;
            }
            case "finished": {
              setIsStreaming(false);
              setCurrentToolCall(null);
              break;
            }
            case "error": {
              const msg = (data.message as string) ?? "Erro desconhecido";
              setError(msg);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, streaming: false, content: m.content || `⚠️ ${msg}` }
                    : m,
                ),
              );
              setIsStreaming(false);
              setCurrentToolCall(null);
              break;
            }
            default:
              break;
          }
        };

        const parser = createParser({ onEvent });
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.feed(decoder.decode(value, { stream: true }));
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // cancelamento esperado
        } else {
          const msg = err instanceof Error ? err.message : "Erro desconhecido";
          setError(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, streaming: false, content: m.content || `⚠️ ${msg}` }
                : m,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        setCurrentToolCall(null);
        abortRef.current = null;
      }
    },
    [conversationId, isStreaming, cancel],
  );

  return {
    messages,
    isStreaming,
    conversationId,
    error,
    currentToolCall,
    send,
    cancel,
    reset,
    loadConversation,
    setConversationId,
  };
}
