// client/src/shell/components/ChatLauncher.tsx
//
// Botão flutuante (bottom-right) + atalho Cmd/Ctrl+K que abre o ChatSheet.
// Montado uma única vez no AppShell para ficar disponível em toda página protegida.

import { useCallback, useEffect, useState } from "react";
import { ChatSheet } from "../../shared/components/chat/ChatSheet";

export default function ChatLauncher() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  // Atalho: Cmd+K (mac) / Ctrl+K (win/linux)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 group flex items-center gap-2 h-12 pl-3 pr-4 rounded-full bg-gradient-to-br from-[#293b83] to-[#67b4b0] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          title="Abrir copilot (Ctrl+K)"
        >
          <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8-1.25 0-2.44-.226-3.52-.632L3 21l1.7-4.22C3.62 15.55 3 13.83 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="text-sm font-medium">Copiloto</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono bg-white/15 px-1.5 py-0.5 rounded">
            Ctrl+K
          </kbd>
        </button>
      )}

      <ChatSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
