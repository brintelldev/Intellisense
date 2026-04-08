import { cn } from "../lib/utils";

interface Props {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({
  title = "Nenhum resultado encontrado",
  description = "Tente ajustar os filtros ou importar novos dados.",
  action,
  className,
}: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-700">{title}</h3>
      <p className="text-sm text-slate-400 mt-1 max-w-xs">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-[#293b83] text-white text-sm font-medium rounded-lg hover:bg-[#1e2d6b] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
