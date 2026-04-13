import { useLocation } from "wouter";

interface Alert {
  id: string;
  customerId: string;
  customerName: string;
  message: string;
  severity: "critical" | "high" | "medium";
  timeAgo: string;
}

const SEVERITY_CONFIG = {
  critical: { dot: "bg-red-500", bg: "bg-red-50" },
  high: { dot: "bg-orange-400", bg: "bg-orange-50" },
  medium: { dot: "bg-amber-400", bg: "bg-amber-50" },
};

interface Props {
  alerts: Alert[];
}

export function AlertsList({ alerts }: Props) {
  const [, navigate] = useLocation();

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-4">Alertas Recentes</h3>
        <p className="text-sm text-slate-500">Nenhum alerta</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Alertas Recentes</h3>
        <span className="bg-red-100 text-red-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
          {alerts.filter(a => a.severity === "critical").length} críticos
        </span>
      </div>
      <div className="space-y-2">
        {alerts.map((alert) => {
          const cfg = SEVERITY_CONFIG[alert.severity];
          return (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${cfg.bg}`}
              onClick={() => navigate("/retain/predictions")}
            >
              <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{alert.customerName}</p>
                <p className="text-xs text-slate-600">{alert.message}</p>
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">{alert.timeAgo}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
