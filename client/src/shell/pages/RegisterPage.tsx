import { useState } from "react";
import { useLocation } from "wouter";
import { useRegister } from "../../shared/hooks/useAuth";

const SECTORS = [
  { value: "industrial_b2b", label: "Industrial B2B" },
  { value: "telecom", label: "Telecom" },
  { value: "fintech", label: "Fintech" },
  { value: "saas", label: "SaaS" },
  { value: "health", label: "Saúde" },
  { value: "education", label: "Educação" },
  { value: "retail", label: "Varejo" },
  { value: "other", label: "Outro" },
];

interface Props {
  onBack: () => void;
}

export default function RegisterPage({ onBack }: Props) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", companyName: "", sector: "industrial_b2b" });
  const [, navigate] = useLocation();
  const register = useRegister();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return;
    try {
      await register.mutateAsync({ name: form.name, email: form.email, password: form.password, companyName: form.companyName, sector: form.sector });
      navigate("/");
    } catch {}
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm p-8 w-full max-w-[420px] space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-slate-800">Criar conta</h1>
          <p className="text-sm text-slate-500">Preencha os dados para começar</p>
        </div>

        {register.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {register.error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Nome completo", key: "name", type: "text", placeholder: "Seu nome" },
            { label: "E-mail", key: "email", type: "email", placeholder: "seu@email.com" },
            { label: "Nome da empresa", key: "companyName", type: "text", placeholder: "Empresa Ltda." },
            { label: "Senha", key: "password", type: "password", placeholder: "••••••••" },
            { label: "Confirmar senha", key: "confirmPassword", type: "password", placeholder: "••••••••" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="text-sm font-medium text-slate-700">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={set(key)}
                placeholder={placeholder}
                className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#67b4b0]/30 focus:border-[#67b4b0] focus:outline-none"
                required
              />
            </div>
          ))}

          <div>
            <label className="text-sm font-medium text-slate-700">Setor da empresa</label>
            <select
              value={form.sector}
              onChange={set("sector")}
              className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#67b4b0]/30 focus:outline-none"
            >
              {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <button
            type="submit"
            disabled={register.isPending || form.password !== form.confirmPassword}
            className="w-full h-12 brand-gradient text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            {register.isPending ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <button onClick={onBack} className="w-full text-center text-sm text-[#67b4b0] hover:underline">
          Já tem conta? Entrar
        </button>

        <p className="text-center text-xs text-[#b4b4b4]">Powered by Brintell</p>
      </div>
    </div>
  );
}
