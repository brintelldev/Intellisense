import { funnelAlerts } from "../../../data/obtain-funnel";

const SEVERITY_CONFIG = {
  critical: { bg: "bg-red-50 border-red-200", dot: "bg-red-500", text: "text-red-800", icon: "text-red-500" },
  warning: { bg: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-500", text: "text-yellow-800", icon: "text-yellow-500" },
  info: { bg: "bg-blue-50 border-blue-200", dot: "bg-blue-400", text: "text-blue-800", icon: "text-blue-500" },
};

export function FunnelAlertCards() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {funnelAlerts.map((alert) => {
        const cfg = SEVERITY_CONFIG[alert.severity];
        return (
          <div key={alert.id} className={`rounded-xl p-4 border ${cfg.bg} flex gap-3`}>
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
            <p className={`text-sm ${cfg.text}`}>{alert.message}</p>
          </div>
        );
      })}
    </div>
  );
}
