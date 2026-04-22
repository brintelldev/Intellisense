// client/src/shared/components/chat/ChatInput.tsx

import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface ChatInputProps {
  onSend: (msg: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onCancel,
  disabled,
  isStreaming,
  placeholder = "Pergunte sobre seus dados — ex: 'quantos clientes em risco crítico?'",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize vertical até 5 linhas
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia, Shift+Enter quebra linha, Cmd/Ctrl+Enter também envia
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-slate-100 bg-white px-4 py-3">
      <div
        className={cn(
          "flex items-end gap-2 rounded-xl border px-3 py-2 transition-colors",
          "border-slate-200 focus-within:border-[#67b4b0] focus-within:ring-2 focus-within:ring-[#67b4b0]/20",
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 resize-none outline-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 disabled:opacity-50 leading-relaxed"
          style={{ maxHeight: 140 }}
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex-shrink-0 h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors"
            title="Cancelar geração"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || value.trim().length === 0}
            className="flex-shrink-0 h-8 w-8 rounded-lg bg-[#293b83] hover:bg-[#1e2d6b] disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-colors"
            title="Enviar (Enter)"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-[10px] text-slate-400 mt-1.5 pl-1">
        Enter envia · Shift+Enter quebra linha · Respostas baseadas nos seus dados
      </p>
    </div>
  );
}
