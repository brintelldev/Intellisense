import { useLocation } from "wouter";

interface Alert {
  id: string;
  customerId: string;
  customerName: string;
  type?: string;
  message: string;
  severity: "critical" | "high" | "medium";
  timeAgo: string;
}

interface Props {
  alerts: Alert[];
}

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2 } as const;

const SEVERITY_CONFIG = {
  critical: { dot: "bg-red-500", bg: "bg-red-50", badge: "bg-red-100 text-red-600" },
  high:     { dot: "bg-orange-400", bg: "bg-orange-50", badge: "bg-orange-100 text-orange-600" },
  medium:   { dot: "bg-amber-400", bg: "bg-amber-50", badge: "bg-amber-100 text-amber-600" },
};

const TYPE_LABELS: Record<string, string> = {
  churn_risk:        "Risco churn",
  contract_expiring: "Contrato",
  payment_delayed:   "Pagamento",
  health_drop:       "Health baixo",
};

const MAX_VISIBLE = 5;

export function AlertsList({ alerts }: Props) {
  const [, navigate] = useLocation();

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Alertas Recentes</h3>
            <p className="text-xs text-slate-500">Clientes com sinais de risco</p>
          </div>
        </div>
        <div className="p-5"><p className="text-sm text-slate-500">Nenhum alerta ativo</p></div>
      </div>
    );
  }

  // ── Group by customer, keep worst severity as the "lead" alert ────────────
  const grouped = new Map<string, { lead: Alert; types: string[]; count: number }>();
  for (const a of alerts) {
    const existing = grouped.get(a.customerId);
    if (!existing) {
      grouped.set(a.customerId, { lead: a, types: a.type ? [a.type] : [], count: 1 });
    } else {
      existing.count++;
      if (a.type && !existing.types.includes(a.type)) existing.types.push(a.type);
      if (SEVERITY_RANK[a.severity] < SEVERITY_RANK[existing.lead.severity]) {
        existing.lead = a;
      }
    }
  }

  // Sort groups: critical first, then by count desc
  const rows = [...grouped.values()].sort((a, b) => {
    const sd = SEVERITY_RANK[a.lead.severity] - SEVERITY_RANK[b.lead.severity];
    return sd !== 0 ? sd : b.count - a.count;
  });

  const visible = rows.slice(0, MAX_VISIBLE);
  const totalAlerts = alerts.length;
  const criticalCount = alerts.filter(a => a.severity === "critical").length;
  const hiddenCompanies = rows.length - MAX_VISIBLE;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col">
      <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-800">Alertas Recentes</h3>
          <p className="text-xs text-slate-500">{rows.length} empresa{rows.length !== 1 ? "s" : ""} com alertas ativos</p>
        </div>
        {criticalCount > 0 && (
          <span className="bg-red-100 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">
            {criticalCount} crítico{criticalCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {visible.map(({ lead, types, count }) => {
          const cfg = SEVERITY_CONFIG[lead.severity];
          return (
            <div
              key={lead.customerId}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${cfg.bg}`}
              onClick={() => navigate("/retain/predictions")}
            >
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{lead.customerName}</p>
                <p className="text-xs text-slate-500 truncate">{lead.message}</p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Type tags — show up to 3 */}
                {types.slice(0, 3).map(t => (
                  <span key={t} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.badge}`}>
                    {TYPE_LABELS[t] ?? t}
                  </span>
                ))}
                {count > 1 && types.length <= 1 && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.badge}`}>
                    +{count - 1} alerta{count - 1 !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <span className="text-xs text-slate-400 flex-shrink-0 ml-1">{lead.timeAgo}</span>
            </div>
          );
        })}
      </div>

      {/* Footer: hidden count + link */}
      {(hiddenCompanies > 0 || totalAlerts > MAX_VISIBLE) && (
        <button
          onClick={() => navigate("/retain/predictions")}
          className="mt-3 w-full text-xs text-[#293b83] font-medium hover:underline text-center py-1"
        >
          {hiddenCompanies > 0
            ? `Ver mais ${hiddenCompanies} empresa${hiddenCompanies !== 1 ? "s" : ""} (${totalAlerts} alertas no total) →`
            : `Ver todos os ${totalAlerts} alertas →`}
        </button>
      )}
    </div>
  );
}
