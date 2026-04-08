import { Download } from "lucide-react";
import { icpClusters as mockICPClusters } from "../../../data/obtain-icp-clusters";
import { ClusterRadarChart } from "../components/ClusterRadarChart";
import { useObtainICPClusters } from "../../../shared/hooks/useObtain";

const fmtBRL = (v: number) => v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : `R$ ${(v / 1000).toFixed(0)}K`;

const TYPE_CONFIG = {
  ideal: { label: "ICP Ideal", border: "border-[#10B981]", bg: "bg-[#10B981]/5", badge: "bg-[#10B981] text-white", dot: "bg-[#10B981]", barColor: "#10B981" },
  good: { label: "ICP Bom", border: "border-[#293b83]", bg: "bg-[#293b83]/5", badge: "bg-[#293b83] text-white", dot: "bg-[#293b83]", barColor: "#293b83" },
  anti: { label: "Anti-ICP", border: "border-red-400", bg: "bg-red-50", badge: "bg-red-500 text-white", dot: "bg-red-400", barColor: "#ef4444" },
};

export default function ObtainICPPage() {
  const { data: apiClusters, isLoading } = useObtainICPClusters();
  const icpClusters = apiClusters ?? mockICPClusters;


  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Perfis de ICP</h1>
        <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">Obtain Sense</span>
      </div>

      {/* Cluster cards */}
      <div className="grid grid-cols-3 gap-4">
        {icpClusters.map((cluster) => {
          const cfg = TYPE_CONFIG[cluster.type as keyof typeof TYPE_CONFIG];
          return (
            <div key={cluster.id} className={`rounded-xl p-5 border-l-4 ${cfg.border} ${cfg.bg} border border-slate-100`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                <span className="text-sm font-bold text-slate-700">{cluster.leadsInFunnel} leads</span>
              </div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">{cluster.name}</h3>
              <p className="text-xs text-slate-500 mb-4">{cluster.description}</p>

              {/* 2x3 metrics grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                  <p className="text-xs text-slate-400">LTV Médio</p>
                  <p className="text-sm font-bold text-slate-800">{fmtBRL(cluster.avgLtv)}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                  <p className="text-xs text-slate-400">CAC</p>
                  <p className="text-sm font-bold text-slate-800">{fmtBRL(cluster.avgCac)}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                  <p className="text-xs text-slate-400">Conversão</p>
                  <p className="text-sm font-bold text-slate-800">{(cluster.avgConversionRate * 100).toFixed(0)}%</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                  <p className="text-xs text-slate-400">Churn</p>
                  <p className={`text-sm font-bold ${cluster.type === "anti" ? "text-red-600" : "text-slate-800"}`}>{(cluster.churnRate * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                  <p className="text-xs text-slate-400">Leads no funil</p>
                  <p className="text-sm font-bold text-slate-800">{cluster.leadsInFunnel}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                  <p className="text-xs text-slate-400">% da base</p>
                  <p className="text-sm font-bold text-slate-800">{(cluster.budgetShare * 100).toFixed(0)}%</p>
                </div>
              </div>

              {/* Lead share bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Participação no funil</span>
                  <span>{(cluster.budgetShare * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${cluster.budgetShare * 100}%`, backgroundColor: cfg.barColor }}
                  />
                </div>
              </div>

              {cluster.type === "anti" && (
                <div className="mt-3 flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <p className="text-xs text-red-700">Consome <strong>23% do budget</strong> mas gera apenas <strong>8% da receita retida</strong>. Evitar prospecção ativa — ROI negativo histórico.</p>
                </div>
              )}

              {/* Exportar Lookalike button */}
              <button className="mt-4 w-full flex items-center justify-center gap-2 h-8 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                <Download className="w-3.5 h-3.5" />
                Exportar Audiência Lookalike
              </button>
            </div>
          );
        })}
      </div>

      {/* Radar chart */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-1">Comparativo de Perfis — Radar de Atributos</h3>
        <p className="text-xs text-slate-500 mb-4">Pontuação relativa de 0–100 em cada dimensão de qualidade de cliente</p>
        <ClusterRadarChart clusters={icpClusters} />
      </div>

      {/* Insight card */}
      <div className="bg-gradient-to-r from-[#10B981]/10 to-[#293b83]/5 rounded-xl p-5 border border-[#10B981]/20">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-[#10B981]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
          <h4 className="font-semibold text-slate-800">Recomendação de Alocação de Budget</h4>
          <span className="ml-auto text-xs bg-[#293b83] text-white px-2 py-0.5 rounded-full">Dados do Retain Sense</span>
        </div>
        <p className="text-sm text-slate-600">
          O ICP Ideal (Mineradoras Mid-Market) tem <strong>3.2× mais LTV</strong> que o Anti-ICP (R$ 1,08M vs R$ 85K).
          Leads deste cluster adquiridos via <strong>LinkedIn Ads</strong> têm churn <strong>62% menor</strong> que a média.
          Realocar 30% do budget de Google Ads para LinkedIn pode aumentar o ROI em <strong>+45%</strong>.
        </p>
      </div>
    </div>
  );
}
