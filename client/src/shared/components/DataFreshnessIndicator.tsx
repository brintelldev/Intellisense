interface DataFreshnessIndicatorProps {
  lastUploadAt: string | null;
  totalRecords?: number;
}

function getRelativeTime(dateStr: string): { text: string; color: string } {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  let text: string;
  if (diffMinutes < 5) text = "agora mesmo";
  else if (diffMinutes < 60) text = `há ${diffMinutes} min`;
  else if (diffHours < 24) text = `há ${diffHours}h`;
  else if (diffDays === 1) text = "ontem";
  else text = `há ${diffDays} dias`;

  let color: string;
  if (diffDays <= 3) color = "text-green-600";
  else if (diffDays <= 7) color = "text-amber-600";
  else if (diffDays <= 30) color = "text-orange-600";
  else color = "text-red-600";

  return { text, color };
}

export function DataFreshnessIndicator({ lastUploadAt, totalRecords }: DataFreshnessIndicatorProps) {
  if (!lastUploadAt) {
    return (
      <span className="text-xs text-slate-400">
        Nenhum upload realizado
      </span>
    );
  }

  const { text, color } = getRelativeTime(lastUploadAt);
  const fullDate = new Date(lastUploadAt).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <span className={`text-xs ${color} inline-flex items-center gap-1.5`} title={`${fullDate} — ${totalRecords ?? 0} registros`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      Atualizado {text}
      {totalRecords != null && <span className="text-slate-400">({totalRecords} registros)</span>}
    </span>
  );
}
