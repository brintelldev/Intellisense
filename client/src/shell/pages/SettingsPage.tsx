import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../shared/components/ui/tabs";
import { useAuthContext } from "../contexts/AuthContext";
import { SECTOR_PRESETS } from "../../shared/lib/sector-presets";
import { SectorConfig } from "../../shared/hooks/useAuth";
import {
  useScoringConfig, useSaveScoringConfig,
  useRecalculateRetain, useRecalculateObtain,
} from "../../shared/hooks/useRetain";

const SECTOR_OPTIONS = [
  { value: "industrial_b2b", label: "Industrial B2B" },
  { value: "telecom", label: "Telecom" },
  { value: "fintech", label: "Fintech" },
  { value: "saas", label: "SaaS" },
  { value: "saude", label: "Saúde" },
  { value: "educacao", label: "Educação" },
  { value: "varejo", label: "Varejo" },
];

const DEMO_USERS = [
  { name: "Caio Ferreira", email: "caio@dcco.com.br", role: "Admin" },
  { name: "Ana Costa", email: "ana@dcco.com.br", role: "Operador" },
  { name: "Pedro Santos", email: "pedro@dcco.com.br", role: "Visualizador" },
];

function SectorConfigEditor({ config, onChange }: { config: SectorConfig; onChange: (c: SectorConfig) => void }) {
  const [saved, setSaved] = useState(false);
  const [newSegment, setNewSegment] = useState("");

  const handlePreset = (sector: string) => {
    const preset = SECTOR_PRESETS[sector];
    if (preset) onChange(preset);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const setField = (key: keyof SectorConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...config, [key]: e.target.value });

  const addSegment = () => {
    const val = newSegment.trim();
    if (!val || config.segments?.includes(val)) return;
    onChange({ ...config, segments: [...(config.segments ?? []), val] });
    setNewSegment("");
  };

  const removeSegment = (seg: string) => {
    onChange({ ...config, segments: (config.segments ?? []).filter(s => s !== seg) });
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Editor */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">Setor (pré-configurações)</label>
          <select
            onChange={(e) => handlePreset(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            {SECTOR_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {([
          { key: "customerLabel", label: "Label para 'cliente' (singular)" },
          { key: "customersLabel", label: "Label para 'clientes' (plural)" },
          { key: "revenueLabel", label: "Label para 'receita'" },
          { key: "engagementLabel", label: "Label para 'engajamento'" },
          { key: "ticketLabel", label: "Label para 'tickets/chamados'" },
          { key: "tenureLabel", label: "Label para 'tempo de parceria'" },
        ] as { key: keyof SectorConfig; label: string }[]).map(({ key, label }) => (
          <div key={key as string}>
            <label className="text-sm font-medium text-slate-700 mb-1 block">{label}</label>
            <input
              type="text"
              value={config[key] as string}
              onChange={setField(key)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#67b4b0]"
            />
          </div>
        ))}

        {/* Editable segments */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Segmentos</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(config.segments ?? []).map(seg => (
              <span key={seg} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                {seg}
                <button onClick={() => removeSegment(seg)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSegment}
              onChange={(e) => setNewSegment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSegment()}
              placeholder="Novo segmento..."
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#67b4b0]"
            />
            <button
              onClick={addSegment}
              className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              + Adicionar
            </button>
          </div>
        </div>

        {/* Currency */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">Moeda</label>
          <select
            value={config.currency ?? "BRL"}
            onChange={setField("currency")}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="BRL">BRL — Real Brasileiro (R$)</option>
            <option value="USD">USD — Dólar Americano ($)</option>
            <option value="EUR">EUR — Euro (€)</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          className="w-full h-10 bg-[#293b83] text-white rounded-lg text-sm font-semibold hover:bg-[#1e2d6b] transition-colors"
        >
          {saved ? "✓ Salvo!" : "Salvar configuração"}
        </button>
      </div>

      {/* Live preview */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Preview em tempo real</p>
        <div className="space-y-3">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs text-slate-400">Card de KPI</p>
            <p className="text-xs text-slate-500 mt-1">{config.customersLabel} Ativos</p>
            <p className="text-2xl font-bold text-slate-900">482</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs text-slate-400">Coluna da tabela</p>
            <p className="text-xs text-slate-500 mt-1">{config.revenueLabel}</p>
            <p className="text-sm font-semibold text-slate-800">{config.currency === "USD" ? "$" : config.currency === "EUR" ? "€" : "R$"} 156.800</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs text-slate-400">Filtros</p>
            <div className="flex gap-2 mt-1 flex-wrap">
              {config.segments?.map(seg => (
                <span key={seg} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{seg}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const RETAIN_DIMENSION_LABELS: Record<string, string> = {
  dimSatisfaction: "Satisfacao do Cliente",
  dimPaymentRegularity: "Regularidade de Pagamento",
  dimUsageIntensity: "Intensidade de Uso",
  dimInteractionFrequency: "Frequencia de Interacao",
  dimContractRemainingDays: "Tempo Restante de Contrato",
  dimSupportVolume: "Volume de Chamados",
  dimRecencyDays: "Dias Sem Interacao",
  dimTenureDays: "Tempo de Relacionamento",
};

const OBTAIN_DIMENSION_LABELS: Record<string, string> = {
  industryFit: "Fit de Industria",
  companySizeFit: "Porte da Empresa",
  revenuePotential: "Potencial de Receita",
  sourceQuality: "Qualidade da Origem",
  engagementLevel: "Nivel de Engajamento",
  geographicFit: "Fit Geografico",
};

function ScoringConfigTab() {
  const [activeModule, setActiveModule] = useState<"retain" | "obtain">("retain");
  const { data: configData, isLoading } = useScoringConfig(activeModule);
  const saveMutation = useSaveScoringConfig();
  const recalcRetain = useRecalculateRetain();
  const recalcObtain = useRecalculateObtain();
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (configData?.weights) {
      setWeights(configData.weights);
    }
  }, [configData]);

  const labels = activeModule === "retain" ? RETAIN_DIMENSION_LABELS : OBTAIN_DIMENSION_LABELS;
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const isSaving = saveMutation.isPending || recalcRetain.isPending || recalcObtain.isPending;

  const handleSaveAndRecalculate = async () => {
    setSuccessMsg("");
    const configType = activeModule === "retain" ? "health_score" : "lead_score";
    await saveMutation.mutateAsync({ module: activeModule, configType, weights });

    if (activeModule === "retain") {
      const result = await recalcRetain.mutateAsync();
      setSuccessMsg(`Recalculado: ${result.predictionsGenerated} predicoes, ${result.alertsGenerated} alertas gerados.`);
    } else {
      const result = await recalcObtain.mutateAsync();
      setSuccessMsg(`Recalculado: ${result.scoresGenerated} scores, ${result.alertsGenerated} alertas gerados.`);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setActiveModule("retain")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeModule === "retain" ? "bg-[#293b83] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Retain
        </button>
        <button
          onClick={() => setActiveModule("obtain")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeModule === "obtain" ? "bg-[#293b83] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Obtain
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="space-y-4 max-w-lg">
          {Object.keys(labels).map((key) => (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-slate-700">{labels[key]}</span>
                <span className="text-slate-500 font-mono">{weights[key] ?? 0}</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={weights[key] ?? 0}
                onChange={(e) => setWeights({ ...weights, [key]: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#293b83]"
              />
            </div>
          ))}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Soma total dos pesos</span>
            <span className={`text-sm font-bold ${totalWeight === 100 ? "text-green-600" : "text-amber-600"}`}>{totalWeight}</span>
          </div>

          <button
            onClick={handleSaveAndRecalculate}
            disabled={isSaving}
            className="w-full h-10 bg-[#293b83] text-white rounded-lg text-sm font-semibold hover:bg-[#1e2d6b] transition-colors disabled:opacity-50"
          >
            {isSaving ? "Processando..." : "Salvar e Recalcular"}
          </button>

          {successMsg && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              {successMsg}
            </div>
          )}

          {(saveMutation.isError || recalcRetain.isError || recalcObtain.isError) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              Erro ao salvar ou recalcular. Tente novamente.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user, sectorConfig } = useAuthContext();
  const [config, setConfig] = useState<SectorConfig>(sectorConfig);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie sua conta e preferências da plataforma</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="company">Empresa</TabsTrigger>
          <TabsTrigger value="sector">Setor</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-4 max-w-md">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 brand-gradient rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                {(user?.name ?? "D").charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{user?.name ?? "Demo"}</p>
                <p className="text-sm text-slate-500">{user?.email ?? "demo@dcco.com.br"}</p>
              </div>
            </div>
            {[
              { label: "Nome completo", value: user?.name ?? "Caio Ferreira" },
              { label: "E-mail", value: user?.email ?? "caio@dcco.com.br" },
            ].map(f => (
              <div key={f.label}>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{f.label}</label>
                <input defaultValue={f.value} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#67b4b0]" />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Nova senha</label>
              <input type="password" placeholder="••••••••" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#67b4b0]" />
            </div>
            <button className="h-10 px-6 bg-[#293b83] text-white rounded-lg text-sm font-semibold hover:bg-[#1e2d6b]">
              Salvar perfil
            </button>
          </div>
        </TabsContent>

        <TabsContent value="company">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-4 max-w-md">
            {[
              { label: "Nome da empresa", value: user?.tenant?.companyName ?? "DCCO Distribuição" },
              { label: "CNPJ", value: "12.345.678/0001-90" },
              { label: "Endereço", value: "Goiânia, GO" },
            ].map(f => (
              <div key={f.label}>
                <label className="text-sm font-medium text-slate-700 mb-1 block">{f.label}</label>
                <input defaultValue={f.value} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#67b4b0]" />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Plano atual</label>
              <div className="flex items-center gap-2">
                <span className="bg-[#293b83] text-white text-xs px-3 py-1 rounded-full font-semibold">Premium</span>
                <span className="text-xs text-slate-500">Renova em 01/01/2027</span>
              </div>
            </div>
            <button className="h-10 px-6 bg-[#293b83] text-white rounded-lg text-sm font-semibold hover:bg-[#1e2d6b]">
              Salvar empresa
            </button>
          </div>
        </TabsContent>

        <TabsContent value="sector">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-5">Configuração de Labels do Setor</h3>
            <SectorConfigEditor config={config} onChange={setConfig} />
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Usuários do tenant</h3>
              <button className="h-9 px-4 bg-[#293b83] text-white rounded-lg text-sm font-medium hover:bg-[#1e2d6b]">
                + Convidar usuário
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Nome", "E-mail", "Função", "Ações"].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {DEMO_USERS.map(u => (
                  <tr key={u.email} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-800">{u.name}</td>
                    <td className="px-6 py-3 text-slate-500">{u.email}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${u.role === "Admin" ? "bg-[#293b83]/10 text-[#293b83]" : "bg-slate-100 text-slate-600"}`}>{u.role}</span>
                    </td>
                    <td className="px-6 py-3">
                      <button className="text-xs text-slate-400 hover:text-red-500">Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="scoring">
          <ScoringConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
