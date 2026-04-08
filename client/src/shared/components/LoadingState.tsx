import { cn } from "../lib/utils";

interface Props {
  rows?: number;
  className?: string;
}

export function LoadingState({ rows = 5, className }: Props) {
  return (
    <div className={cn("space-y-3 animate-pulse", className)}>
      <div className="h-8 bg-slate-100 rounded-lg w-1/3" />
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-4 bg-slate-100 rounded w-1/4" />
            <div className="h-4 bg-slate-100 rounded w-1/3" />
            <div className="h-4 bg-slate-100 rounded w-1/5 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
