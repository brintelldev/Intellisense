import { useState } from "react";
import { useRetainAlerts } from "../../shared/hooks/useRetain";
import { useObtainAlerts } from "../../shared/hooks/useObtain";

export function AlertBadge() {
  const [open, setOpen] = useState(false);
  const { data: retainAlerts } = useRetainAlerts({ isRead: "false" });
  const { data: obtainAlerts } = useObtainAlerts({ isRead: "false" });

  const allAlerts = [
    ...(retainAlerts ?? []).map((a: any) => ({ ...a, module: "retain" as const })),
    ...(obtainAlerts ?? []).map((a: any) => ({ ...a, module: "obtain" as const })),
  ].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 5);

  const count = allAlerts.length;
  const hasCritical = allAlerts.some((a) => a.severity === "critical");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
        title="Alertas"
      >
        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] font-bold text-white rounded-full flex items-center justify-center ${hasCritical ? "bg-red-500 animate-pulse" : "bg-red-500"}`}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-slate-100 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Alertas Recentes</h3>
              {count > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                  {count} não lido{count !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {allAlerts.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-slate-500">Nenhum alerta pendente</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                {allAlerts.map((alert: any) => (
                  <div key={alert.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${alert.severity === "critical" ? "bg-red-500" : alert.severity === "high" ? "bg-orange-400" : "bg-amber-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 line-clamp-2">{alert.message}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${alert.module === "retain" ? "bg-[#293b83]/10 text-[#293b83]" : "bg-[#10B981]/10 text-[#10B981]"}`}>
                            {alert.module === "retain" ? "Retain" : "Obtain"}
                          </span>
                          {alert.timeAgo && <span className="text-[10px] text-slate-400">{alert.timeAgo}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
