import { useRetainVoc } from "../../../shared/hooks/useRetain";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useLocation } from "wouter";

function EmptyVoc() {
  const [, navigate] = useLocation();
  return (
    <div className="bg-white rounded-xl p-12 border border-slate-100 text-center space-y-3">
      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <p className="font-semibold text-slate-700">Nenhum dado de satisfação ainda</p>
      <p className="text-sm text-slate-400 max-w-sm mx-auto">
        Faça upload de um CSV com a coluna de NPS ou Satisfação mapeada para ver a Voz do Cliente.
      </p>
      <button
        onClick={() => navigate("/retain/upload")}
        className="mt-2 h-9 px-5 bg-[#293b83] text-white text-sm rounded-lg font-semibold hover:bg-[#1e2d6b]"
      >
        Ir para Upload
      </button>
    </div>
  );
}

function NpsGauge({ nps }: { nps: number }) {
  const color = nps >= 50 ? "#22c55e" : nps >= 0 ? "#f59e0b" : "#ef4444";
  const label = nps >= 50 ? "Excelente" : nps >= 30 ? "Bom" : nps >= 0 ? "Regular" : "Crítico";
  return (
    <div className="text-center">
      <div
        className="text-6xl font-black tabular-nums"
        style={{ color }}
      >
        {nps > 0 ? "+" : ""}{nps}
      </div>
      <div
        className="text-xs font-semibold mt-1 px-3 py-1 rounded-full inline-block"
        style={{ backgroundColor: color + "20", color }}
      >
        {label}
      </div>
    </div>
  );
}

export default function RetainVozDoClientePage() {
  const { data, isLoading, error } = useRetainVoc();

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Voz do Cliente</h1>
        <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">Retain Sense</span>
      </div>

      {isLoading && <LoadingState rows={4} />}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          Erro ao carregar dados. Tente recarregar a página.
        </div>
      )}

      {!isLoading && !error && data?.nps === null && data?.npsDistribution?.total === 0 && (
        <EmptyVoc />
      )}

      {!isLoading && !error && data && data.npsDistribution.total > 0 && (
        <>
          {/* ── Row 1: NPS big number + distribution ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* NPS Score card */}
            <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2">
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">NPS da Base</p>
              {data.nps !== null
                ? <NpsGauge nps={data.nps} />
                : <p className="text-slate-400 text-sm">Sem dados de satisfação</p>
              }
              <p className="text-xs text-slate-400 mt-1">{data.npsDistribution.total} clientes avaliados</p>
            </div>

            {/* NPS Distribution */}
            <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
              <p className="text-sm font-semibold text-slate-700 mb-4">Distribuição NPS</p>
              <div className="space-y-3">
                {/* Promoters */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Promotores <span className="text-slate-400">(NPS ≥ 70)</span></span>
                    <span className="font-semibold text-green-600">{data.npsDistribution.promoters} ({data.npsDistribution.promotersPct}%)</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${data.npsDistribution.promotersPct}%` }} />
                  </div>
                </div>
                {/* Neutrals */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Neutros <span className="text-slate-400">(50–69)</span></span>
                    <span className="font-semibold text-amber-600">{data.npsDistribution.neutrals} ({data.npsDistribution.neutralsPct}%)</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${data.npsDistribution.neutralsPct}%` }} />
                  </div>
                </div>
                {/* Detractors */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Detratores <span className="text-slate-400">(&lt; 50)</span></span>
                    <span className="font-semibold text-red-600">{data.npsDistribution.detractors} ({data.npsDistribution.detractorsPct}%)</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${data.npsDistribution.detractorsPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 2: Detractors by revenue ──────────────────────────────────── */}
          {data.detractorsByRevenue.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">Detratores por Receita</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Clientes insatisfeitos ordenados pelo impacto financeiro</p>
                </div>
                {data.totalDetractorRevenue > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-right">
                    <p className="text-xs text-red-500 font-medium">Receita em risco</p>
                    <p className="text-lg font-bold text-red-600">
                      {data.totalDetractorRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Empresa", "Segmento", "Receita Mensal", "Satisfação", "Ação"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.detractorsByRevenue.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{c.name}</p>
                        {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{c.segment ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800 tabular-nums">
                        {c.revenue != null
                          ? c.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                          {c.satisfactionLabel ?? `${Math.round(c.satisfaction ?? 0)}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/retain/customers`}
                          className="text-xs text-[#293b83] hover:underline font-medium"
                        >
                          Ver cliente →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Row 3: Ticket themes + Verbatims ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Ticket themes */}
            {data.ticketThemes.length > 0 && (
              <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-4">Temas mais frequentes</h3>
                <div className="space-y-3">
                  {data.ticketThemes.map(({ theme, count }: { theme: string; count: number }, i: number) => {
                    const max = data.ticketThemes[0].count;
                    const pct = Math.round((count / max) * 100);
                    return (
                      <div key={theme}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-700 font-medium">{theme}</span>
                          <span className="text-slate-500 tabular-nums">{count}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"][i % 5],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Verbatims */}
            {data.verbatims && data.verbatims.length > 0 && (
              <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-4">Voz real dos clientes</h3>
                <div className="space-y-3">
                  {data.verbatims.map((v: any, i: number) => (
                    <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <p className="text-sm text-slate-700 italic">"{v.text}"</p>
                      <p className="text-xs text-slate-400 mt-1.5">— {v.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fallback when no verbatims */}
            {(!data.verbatims || data.verbatims.length === 0) && data.ticketThemes.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col items-center justify-center text-center gap-2">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-sm text-slate-500 font-medium">Sem verbatims ainda</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Adicione uma coluna "Comentário NPS" ou "Feedback Aberto" no seu CSV para ver a voz literal dos clientes aqui.
                </p>
              </div>
            )}
          </div>

          {/* ── Row 4: Open actions for detractors ───────────────────────────── */}
          {data.detractorActions && data.detractorActions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">Ações abertas para detratores</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tarefas pendentes para clientes insatisfeitos</p>
              </div>
              <div className="divide-y divide-slate-50">
                {data.detractorActions.map((a: any) => (
                  <div key={a.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        a.priority === "urgent" ? "bg-red-500" :
                        a.priority === "high" ? "bg-amber-500" :
                        "bg-slate-300"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{a.description ?? a.type}</p>
                        <p className="text-xs text-slate-400">{a.customerName} · {a.type}</p>
                      </div>
                    </div>
                    {a.customerRevenue != null && (
                      <span className="text-xs text-slate-500 flex-shrink-0 ml-3">
                        {a.customerRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
