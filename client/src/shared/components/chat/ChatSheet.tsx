// client/src/shared/components/chat/ChatSheet.tsx
//
// Painel lateral direito (drawer) com o chat.
// Usa o mesmo padrão visual do DetailDrawer para consistência.

import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { useChatStream } from "../../hooks/useChatStream";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

interface ChatSheetProps {
  open: boolean;
  onClose: () => void;
  pageContext?: string;
}

const SUGGESTED_PROMPTS = [
  "Quantos clientes em risco crítico eu tenho?",
  "Qual receita está em risco este mês?",
  "Compare meus canais de aquisição",
  "Quais as principais causas de churn?",
];

export function ChatSheet({ open, onClose, pageContext }: ChatSheetProps) {
  const {
    messages,
    isStreaming,
    error,
    currentToolCall,
    send,
    cancel,
    reset,
  } = useChatStream();

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ESC fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-scroll ao receber mensagem nova
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, currentToolCall]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-full md:w-[520px] bg-[#f8fafc] shadow-xl flex flex-col overflow-hidden",
          "animate-in slide-in-from-right duration-200",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <img
              src="/icone.png"
              alt="IntelliSense"
              className="w-8 h-8 rounded-lg object-contain"
            />
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Copiloto IntelliSense</h2>
              <p className="text-[11px] text-slate-500">
                {isStreaming ? "Pensando..." : "Pergunte sobre seus dados"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={reset}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Nova conversa"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Fechar (Esc)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-8 text-center">
              <img
                src="/icone.png"
                alt="IntelliSense"
                className="w-14 h-14 rounded-2xl object-contain mb-4"
              />
              <h3 className="text-base font-semibold text-slate-800 mb-1.5">
                Como posso te ajudar hoje?
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
                Pergunte sobre clientes em risco, causas de churn, canais de aquisição,
                leads ou qualquer métrica da sua base. Sempre cito de onde vem cada número.
              </p>
              <div className="w-full max-w-sm space-y-1.5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-left px-1">
                  Sugestões
                </p>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => send(prompt, { pageContext })}
                    disabled={isStreaming}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-[#67b4b0] hover:bg-[#67b4b0]/5 text-xs text-slate-700 transition-colors disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-2">
              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  currentToolCallId={currentToolCall?.id ?? null}
                />
              ))}
            </div>
          )}

          {error && !isStreaming && (
            <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSend={(msg) => send(msg, { pageContext })}
          onCancel={cancel}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
