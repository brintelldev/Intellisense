// client/src/shared/components/chat/ChatMessage.tsx

import ReactMarkdown from "react-markdown";
import { cn } from "../../lib/utils";
import type { ChatMessage as ChatMessageType } from "../../hooks/useChatStream";
import { ToolCallChip } from "./ToolCallChip";

interface ChatMessageProps {
  message: ChatMessageType;
  currentToolCallId?: string | null;
}

export function ChatMessage({ message, currentToolCallId }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full gap-3 px-4 py-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <img
          src="/icone.png"
          alt="IS"
          className="flex-shrink-0 w-7 h-7 rounded-full object-contain"
        />
      )}

      <div
        className={cn(
          "max-w-[85%] space-y-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        {/* Tool call chips (acima do conteúdo, em linha) */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.toolCalls.map((tc) => (
              <ToolCallChip
                key={tc.id}
                toolCall={tc}
                running={currentToolCallId === tc.id}
              />
            ))}
          </div>
        )}

        {/* Bubble com o conteúdo */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-[#293b83] text-white rounded-br-sm"
              : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm",
          )}
        >
          {message.streaming && !message.content ? (
            <div className="flex items-center gap-1.5 text-slate-400 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:300ms]" />
            </div>
          ) : isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[11px] font-semibold">
          EU
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Markdown renderer com estilos inline — evita depender de tailwind typography.
// ────────────────────────────────────────────────────────────────────────────

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc ml-5 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ml-5 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => <h1 className="text-base font-semibold text-slate-900 mt-1 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold text-slate-900 mt-1 mb-1.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-800 mt-1 mb-1">{children}</h3>,
          code: ({ children }) => (
            <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-800 text-[12px] font-mono">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 p-2.5 rounded-lg bg-slate-900 text-slate-100 text-[12px] overflow-x-auto">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full text-[12px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-slate-200 px-2 py-1 text-left font-semibold text-slate-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-200 px-2 py-1 text-slate-700">{children}</td>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#67b4b0] underline">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
