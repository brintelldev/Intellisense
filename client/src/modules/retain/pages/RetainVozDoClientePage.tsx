import { useRetainVoc } from "../../../shared/hooks/useRetain";
import { LoadingState } from "../../../shared/components/LoadingState";
import { VerbatimCarousel } from "../components/VerbatimCarousel";
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
          {/* ── Row 1: NPS score + distribution + verbatims carousel ─────────── */}
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
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Distribuição NPS</p>
                  <p className="text-xs text-slate-500">Promotores, neutros e detratores</p>
                </div>
              </div>
              <div className="p-6">
              <div className="space-y-3">
                {/* Promoters */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Promotores <span className="text-slate-400">(≥ 70)</span></span>
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

            {/* Verbatims carousel */}
            {data.verbatims && data.verbatims.length > 0
              ? <VerbatimCarousel verbatims={data.verbatims} />
              : (
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col items-center justify-center text-center gap-2">
                  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="text-sm text-slate-500 font-medium">Sem verbatims ainda</p>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Adicione uma coluna "Comentário NPS" no seu CSV para ver a voz literal dos clientes aqui.
                  </p>
                </div>
              )
            }
          </div>

          {/* ── Row 2: Detractors by revenue ──────────────────────────────────── */}
          {data.detractorsByRevenue.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Detratores por Receita</h3>
                    <p className="text-xs text-slate-500">
                      {data.detractorsByRevenue.length} clientes insatisfeitos · ordenados pelo impacto financeiro
                    </p>
                  </div>
                </div>
                {data.totalDetractorRevenue > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-2 text-right flex-shrink-0">
                    <p className="text-[11px] text-red-400 font-medium uppercase tracking-wide">Receita em risco</p>
                    <p className="text-xl font-bold text-red-600 tabular-nums">
                      {data.totalDetractorRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                )}
              </div>

              {/* Column labels */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                <span className="col-span-4">Empresa</span>
                <span className="col-span-2">Segmento</span>
                <span className="col-span-2 text-right">Receita/mês</span>
                <span className="col-span-2 text-center">Satisfação</span>
                <span className="col-span-2 text-right">Risco receita</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-50">
                {data.detractorsByRevenue.map((c: any, i: number) => {
                  const satScore = c.satisfaction ?? 0;
                  const satColor = satScore < 25 ? "bg-red-100 text-red-700" : satScore < 40 ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700";
                  const revenueShare = data.totalDetractorRevenue > 0
                    ? Math.round(((c.revenue ?? 0) / data.totalDetractorRevenue) * 100)
                    : 0;

                  return (
                    <div
                      key={c.id}
                      className="grid grid-cols-12 gap-2 px-5 py-3.5 items-center hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Company */}
                      <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                        <div className="w-1 h-8 rounded-full bg-red-200 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                          {c.email && <p className="text-xs text-slate-400 truncate">{c.email}</p>}
                        </div>
                      </div>

                      {/* Segment */}
                      <div className="col-span-2">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {c.segment ?? "—"}
                        </span>
                      </div>

                      {/* Revenue */}
                      <div className="col-span-2 text-right">
                        <p className="text-sm font-semibold text-slate-800 tabular-nums">
                          {c.revenue != null
                            ? c.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : "—"}
                        </p>
                      </div>

                      {/* Satisfaction */}
                      <div className="col-span-2 flex justify-center">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${satColor}`}>
                          {c.satisfactionLabel ?? `${Math.round(satScore)}`}
                        </span>
                      </div>

                      {/* Revenue share bar */}
                      <div className="col-span-2 flex items-center gap-2 justify-end">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[60px]">
                          <div className="h-full bg-red-400 rounded-full" style={{ width: `${revenueShare}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-500 tabular-nums w-8 text-right">{revenueShare}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Row 3: Ticket themes ─────────────────────────────────────────── */}
          {data.ticketThemes.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Temas mais frequentes</h3>
                  <p className="text-xs text-slate-500">Assuntos recorrentes nos feedbacks dos clientes</p>
                </div>
              </div>
              <div className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-3">
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
            </div>
          )}

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
