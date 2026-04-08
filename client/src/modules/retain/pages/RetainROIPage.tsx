import { ROICalculator, SliderConfig } from "../../../shared/components/ROICalculator";
import { useRetainDashboard } from "../../../shared/hooks/useRetain";

import { fmtBRL } from "../../../shared/lib/format";
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtNum = (v: number) => v.toLocaleString("pt-BR");

const DEFAULT_CUSTOMERS = 250;
const DEFAULT_AVG_REVENUE = 5000;
const DEFAULT_CHURN_RATE = 5;

function buildSliders(customers: number, avgRevenue: number, churnRate: number): SliderConfig[] {
  return [
    { key: "customers", label: "Total de Empresas ativas", min: 50, max: 2000, step: 10, default: customers, format: fmtNum },
    { key: "avgRevenue", label: "Valor do Contrato médio/mês (R$)", min: 500, max: 50000, step: 500, default: avgRevenue, format: fmtBRL },
    { key: "churnRate", label: "Taxa de churn atual (%)", min: 1, max: 12, step: 0.5, default: churnRate, format: fmtPct },
    { key: "improvement", label: "Melhoria esperada com Retain Sense (%)", min: 5, max: 40, step: 5, default: 20, format: fmtPct },
    { key: "toolCost", label: "Custo mensal estimado da ferramenta (R$)", min: 1000, max: 20000, step: 500, default: 3000, format: fmtBRL },
  ];
}

const SCENARIOS = [
  { label: "Cenário Conservador", improvement: 0.6 },
  { label: "Cenário Esperado", improvement: 1.0, highlighted: true, badge: "Recomendado" },
  { label: "Cenário Otimista", improvement: 1.5 },
];

function calculate(values: Record<string, number>, scenarioMultiplier: number) {
  const effectiveImprovement = Math.min((values.improvement / 100) * scenarioMultiplier, 0.60);
  const monthlyChurning = Math.round(values.customers * (values.churnRate / 100));
  const retained = Math.round(monthlyChurning * effectiveImprovement);
  const revenueMonth = retained * values.avgRevenue;
  const revenueYear = revenueMonth * 12;
  const toolCostYear = values.toolCost * 12;
  const roi = toolCostYear > 0 ? Math.round(((revenueYear - toolCostYear) / toolCostYear) * 100) : 0;
  return {
    improvement: { label: "Redução de churn", value: `${Math.round(effectiveImprovement * 100)}%` },
    retained: { label: "Empresas retidas/mês", value: fmtNum(retained) },
    revenueMonth: { label: "Receita preservada/mês", value: fmtBRL(revenueMonth) },
    revenueYear: { label: "Receita preservada/ano", value: fmtBRL(revenueYear) },
    roi: { label: "ROI estimado", value: `${roi.toLocaleString("pt-BR")}%` },
  };
}

export default function RetainROIPage() {
  const { data: apiData, isLoading } = useRetainDashboard();

  const kpis = apiData?.kpis;
  const SLIDERS = buildSliders(
    kpis?.totalCustomers ?? DEFAULT_CUSTOMERS,
    kpis?.mrr ? Math.round(kpis.mrr / (kpis.totalCustomers || 1)) : DEFAULT_AVG_REVENUE,
    kpis?.churnRate ?? DEFAULT_CHURN_RATE,
  );

  return (
    <div className="space-y-6 w-full">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Simulador de ROI</h1>
          <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">Retain Sense</span>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">Calcule o impacto financeiro de reduzir o churn</p>
      </div>
      <ROICalculator
        sliders={SLIDERS}
        scenarios={SCENARIOS}
        calculateScenario={calculate}
        highlightText={(values, bestMultiplier) => {
          const effectiveImprovement = Math.min((values.improvement / 100) * bestMultiplier, 0.60);
          const churning = Math.round(values.customers * (values.churnRate / 100));
          const retained = Math.round(churning * effectiveImprovement);
          const revenue = retained * values.avgRevenue * 12;
          const fmt = revenue >= 1000000
            ? `R$ ${(revenue / 1000000).toFixed(1)}M`
            : `R$ ${(revenue / 1000).toFixed(0)}K`;
          return `Com o Retain Sense, você pode preservar até ${fmt} por ano retendo ${retained} empresas/mês`;
        }}
        variant="retain"
      />
    </div>
  );
}
