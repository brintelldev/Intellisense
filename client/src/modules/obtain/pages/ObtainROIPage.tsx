import { ROICalculator, SliderConfig } from "../../../shared/components/ROICalculator";

const SLIDERS: SliderConfig[] = [
  { key: "leadsPerMonth", label: "Leads qualificados/mês", min: 10, max: 500, step: 5, default: 80, format: (v) => `${v}` },
  { key: "conversionRate", label: "Taxa de conversão (%)", min: 2, max: 25, step: 1, default: 8, format: (v) => `${v}%` },
  { key: "avgLtv", label: "LTV médio por cliente (R$K)", min: 20, max: 500, step: 10, default: 120, format: (v) => `R$${v}K` },
  { key: "cac", label: "CAC por lead qualificado (R$)", min: 500, max: 15000, step: 500, default: 2500, format: (v) => `R$${(v / 1000).toFixed(1)}K` },
  { key: "budgetMonthly", label: "Budget mensal de marketing (R$K)", min: 5, max: 200, step: 5, default: 40, format: (v) => `R$${v}K` },
  { key: "improvement", label: "Melhoria esperada com Obtain Sense (%)", min: 10, max: 60, step: 5, default: 25, format: (v) => `${v}%` },
  { key: "toolCost", label: "Custo mensal estimado da ferramenta (R$)", min: 1000, max: 20000, step: 500, default: 3000, format: (v) => `R$${(v / 1000).toFixed(1)}K` },
];

const SCENARIOS = [
  { label: "Conservador", improvement: 0.6 },
  { label: "Esperado", improvement: 1.0, highlighted: true, badge: "Recomendado" },
  { label: "Otimista", improvement: 1.5 },
];

function formatRevenue(v: number) {
  return v >= 1000000
    ? `R$ ${(v / 1000000).toFixed(1)}M`
    : `R$ ${(v / 1000).toFixed(0)}K`;
}

function calculateScenario(sliders: Record<string, number>, scenarioMultiplier: number) {
  const improvementPct = (sliders.improvement / 100) * scenarioMultiplier;

  // A ferramenta melhora conversão e reduz CAC
  const conversionBoost = 1 + improvementPct * 0.6;
  const cacReduction = 1 - improvementPct * 0.3;

  const effectiveConversion = Math.min(sliders.conversionRate * conversionBoost, 40) / 100;
  const effectiveCac = sliders.cac * Math.max(cacReduction, 0.5);
  const avgLtv = sliders.avgLtv * 1000;

  const newCustomersMonth = Math.round(sliders.leadsPerMonth * effectiveConversion);
  const revenueLtv = newCustomersMonth * avgLtv;
  const costYear = (sliders.leadsPerMonth * effectiveCac * 12) + (sliders.budgetMonthly * 1000 * 12) + (sliders.toolCost * 12);
  const roi = costYear > 0 ? Math.round(((revenueLtv - costYear) / costYear) * 100) : 0;
  const monthlyRevenue = revenueLtv / 12;
  const paybackMonths = monthlyRevenue > 0 ? Math.max(1, Math.round(costYear / monthlyRevenue)) : 99;

  return {
    improvement: { label: "Melhoria efetiva", value: `${Math.round(improvementPct * 100)}%` },
    newCustomers: { label: "Novos clientes/mês", value: `${newCustomersMonth}` },
    annualRevenue: { label: "Receita (LTV total)", value: formatRevenue(revenueLtv) },
    roi: { label: "ROI sobre investimento", value: `${roi.toLocaleString("pt-BR")}%` },
    payback: { label: "Payback", value: `${paybackMonths} meses` },
  };
}

function highlightText(sliders: Record<string, number>, bestMultiplier: number) {
  // Baseline sem ferramenta (0% melhoria)
  const baseConversion = sliders.conversionRate / 100;
  const baseCustomers = Math.round(sliders.leadsPerMonth * baseConversion);
  const baseRevenue = baseCustomers * sliders.avgLtv * 1000;

  // Com ferramenta no cenário recomendado
  const best = calculateScenario(sliders, bestMultiplier);
  const improvementPct = (sliders.improvement / 100) * bestMultiplier;
  const boostedConversion = Math.min(sliders.conversionRate * (1 + improvementPct * 0.6), 40) / 100;
  const bestCustomers = Math.round(sliders.leadsPerMonth * boostedConversion);
  const bestRevenue = bestCustomers * sliders.avgLtv * 1000;

  const gain = bestRevenue - baseRevenue;
  const gainFmt = formatRevenue(Math.abs(gain));
  return `Com o Obtain Sense, você gera +${gainFmt} em receita incremental (LTV) — ${best.newCustomers.value} novos clientes/mês vs ${baseCustomers} sem a ferramenta`;
}

export default function ObtainROIPage() {
  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Simulador ROI de Aquisição</h1>
        <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">Obtain Sense</span>
      </div>
      <ROICalculator
        sliders={SLIDERS}
        scenarios={SCENARIOS}
        calculateScenario={calculateScenario}
        highlightText={highlightText}
        variant="obtain"
      />
    </div>
  );
}
