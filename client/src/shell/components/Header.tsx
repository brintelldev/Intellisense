import { useState } from "react";
import { useLocation } from "wouter";
import { useAuthContext } from "../contexts/AuthContext";
import { useLogout } from "../../shared/hooks/useAuth";
import { AlertBadge } from "./AlertBadge";

const ROUTE_LABELS: Record<string, string[]> = {
  "/": ["Ciclo de Vida"],
  "/retain": ["Retain Sense", "Dashboard Executivo"],
  "/retain/predictions": ["Retain Sense", "Predições de Churn"],
  "/retain/root-causes": ["Retain Sense", "Causas Raiz"],
  "/retain/roi": ["Retain Sense", "Simulador ROI"],
  "/retain/revenue": ["Retain Sense", "Revenue Analytics"],
  "/retain/renewals": ["Retain Sense", "Renovações"],
  "/retain/customers": ["Retain Sense", "Empresas"],
  "/retain/voz-do-cliente": ["Retain Sense", "Voz do Cliente"],
  "/retain/upload": ["Retain Sense", "Upload de Dados"],
  "/obtain": ["Obtain Sense", "Dashboard Executivo"],
  "/obtain/leads": ["Obtain Sense", "Lead Scoring"],
  "/obtain/icp": ["Obtain Sense", "ICP & Lookalike"],
  "/obtain/funnel": ["Obtain Sense", "Funil & Gargalos"],
  "/obtain/cac-ltv": ["Obtain Sense", "CAC vs LTV"],
  "/obtain/roi": ["Obtain Sense", "Simulador ROI"],
  "/obtain/upload": ["Obtain Sense", "Upload de Leads"],
  "/settings": ["Configurações"],
};

export default function Header() {
  const [location, navigate] = useLocation();
  const { user } = useAuthContext();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  const crumbs = ROUTE_LABELS[location] ?? ["Página"];

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate("/login");
  };

  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-6 flex-shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-300">›</span>}
            <span className={i === crumbs.length - 1 ? "text-slate-800 font-medium" : "text-slate-400"}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <AlertBadge />
        {/* Avatar */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-2 py-1 transition-colors"
          >
            <div className="w-8 h-8 brand-gradient rounded-full flex items-center justify-center text-white text-xs font-bold">
              {(user?.name ?? "D").charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-slate-700 font-medium hidden sm:block">
              {user?.name ?? "Demo"}
            </span>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-100 rounded-lg shadow-lg z-50 py-1">
              <div className="px-4 py-2 border-b border-slate-100">
                <div className="text-sm font-medium text-slate-800">{user?.name ?? "Demo"}</div>
                <div className="text-xs text-slate-500">{user?.email ?? "demo@dcco.com.br"}</div>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate("/settings"); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Perfil
              </button>
              <button
                onClick={() => { setMenuOpen(false); navigate("/settings"); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Configurações
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
