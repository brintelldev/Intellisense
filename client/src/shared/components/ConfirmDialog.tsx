import { ReactNode, useEffect, useRef } from "react";
import { cn } from "../lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onCancel();
    };
    document.addEventListener("keydown", handleKey);
    // Focus the cancel button by default (safer for destructive actions)
    cancelRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, isPending, onCancel]);

  if (!open) return null;

  const confirmClasses =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-slate-900 hover:bg-slate-800 text-white";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => {
          if (!isPending) onCancel();
        }}
      />
      {/* Card */}
      <div
        className={cn(
          "relative w-full max-w-md bg-white rounded-xl shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-150"
        )}
      >
        <div className="px-6 pt-5 pb-4">
          <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <div className="mt-3 text-sm text-slate-600 leading-relaxed">{message}</div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 rounded-b-xl border-t border-slate-100">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors",
              confirmClasses
            )}
          >
            {isPending ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
