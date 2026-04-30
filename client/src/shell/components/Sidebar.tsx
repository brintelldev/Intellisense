import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard, Shield, BrainCircuit, SearchCode, Users, Upload,
  TrendingUp, Target, Fingerprint, GitBranch, DollarSign, Settings, LogOut,
  ChevronLeft, ChevronRight, BarChart3, MessageSquareHeart,
} from "lucide-react";
import { useAuthContext } from "../contexts/AuthContext";
import { useLogout } from "../../shared/hooks/useAuth";

const RETAIN_ITEMS = [
  { icon: Upload, label: "Upload de Dados", path: "/retain/upload" },
  { icon: Shield, label: "Dashboard Executivo", path: "/retain" },
  { icon: BrainCircuit, label: "Predições de Churn", path: "/retain/predictions" },
  { icon: SearchCode, label: "Causas Raiz", path: "/retain/root-causes" },
  { icon: BarChart3, label: "Revenue Analytics", path: "/retain/revenue" },
  { icon: Users, label: "Empresas", path: "/retain/customers" },
  { icon: MessageSquareHeart, label: "Voz do Cliente", path: "/retain/voz-do-cliente" },
];

const OBTAIN_ITEMS = [
  { icon: Upload, label: "Upload de Dados", path: "/obtain/upload" },
  { icon: TrendingUp, label: "Dashboard Executivo", path: "/obtain" },
  { icon: Target, label: "Lead Scoring", path: "/obtain/leads" },
  { icon: Fingerprint, label: "ICP & Lookalike", path: "/obtain/icp" },
  { icon: GitBranch, label: "Funil & Gargalos", path: "/obtain/funnel" },
  { icon: DollarSign, label: "CAC vs LTV", path: "/obtain/cac-ltv" },
];

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  active: boolean;
  collapsed: boolean;
  accentColor: string;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, active, collapsed, accentColor, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
        active
          ? "bg-white/10 text-white"
          : "text-white/70 hover:bg-white/5 hover:text-white"
      }`}
      style={active ? { borderLeft: `3px solid ${accentColor}` } : { borderLeft: "3px solid transparent" }}
    >
      <span className="flex-shrink-0"><Icon className="w-4 h-4" /></span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [location, navigate] = useLocation();
  const { user, deactivateDemo } = useAuthContext();
  const logout = useLogout();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setCollapsed(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = async () => {
    deactivateDemo();
    await logout.mutateAsync();
    navigate("/login");
  };

  const initials = (user?.name ?? "D")
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");

  return (
    <aside
      className="flex flex-col h-screen bg-[#0f172a] border-r border-white/5 transition-all duration-200 flex-shrink-0"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        {!collapsed && (
          <div>
            <div className="text-base font-bold">
              <span className="text-[#293b83]">Intelli</span>
              <span className="text-[#67b4b0]">Sense</span>
            </div>
            <div className="text-xs text-slate-500 truncate max-w-[160px]">
              {user?.tenant?.companyName ?? "DCCO Distribuição"}
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white transition-colors p-1 rounded"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft className="w-4 h-4" />
          }
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {/* Ciclo de Vida */}
        <NavItem
          icon={LayoutDashboard}
          label="Ciclo de Vida"
          path="/"
          active={location === "/"}
          collapsed={collapsed}
          accentColor="#67b4b0"
          onClick={() => navigate("/")}
        />

        {/* Retain */}
        {!collapsed && (
          <div className="px-3 py-2 mt-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#293b83] flex-shrink-0" />
            <span className="text-[10px] font-semibold tracking-widest text-[#293b83] uppercase">Retain Sense</span>
          </div>
        )}
        {collapsed && <div className="my-2 border-t border-white/10" />}
        {RETAIN_ITEMS.map((item) => (
          <NavItem
            key={item.path}
            {...item}
            active={location === item.path}
            collapsed={collapsed}
            accentColor="#293b83"
            onClick={() => navigate(item.path)}
          />
        ))}

        {/* Obtain */}
        {!collapsed && (
          <div className="px-3 py-2 mt-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981] flex-shrink-0" />
            <span className="text-[10px] font-semibold tracking-widest text-[#10B981] uppercase">Obtain Sense</span>
          </div>
        )}
        {collapsed && <div className="my-2 border-t border-white/10" />}
        {OBTAIN_ITEMS.map((item) => (
          <NavItem
            key={item.path}
            {...item}
            active={location === item.path}
            collapsed={collapsed}
            accentColor="#10B981"
            onClick={() => navigate(item.path)}
          />
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/10 px-2 py-3 space-y-1">
        <NavItem
          icon={Settings}
          label="Configurações"
          path="/settings"
          active={location === "/settings"}
          collapsed={collapsed}
          accentColor="#67b4b0"
          onClick={() => navigate("/settings")}
        />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/5 hover:text-red-400 transition-all"
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 pt-2">
            <div className="w-7 h-7 brand-gradient rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-300 font-medium truncate">{user?.name ?? "Demo"}</div>
              <div className="text-[11px] text-slate-500 truncate">{user?.email ?? "demo@dcco.com.br"}</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
