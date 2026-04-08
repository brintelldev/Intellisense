import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { useAuth, User, SectorConfig } from "../../shared/hooks/useAuth";

// DCCO demo sectorConfig fallback
export const DCCO_SECTOR_CONFIG: SectorConfig = {
  customerLabel: "Empresa",
  customersLabel: "Empresas",
  revenueLabel: "Valor do Contrato",
  engagementLabel: "Utilização de Equipamentos",
  ticketLabel: "Chamados Técnicos",
  tenureLabel: "Tempo de Parceria",
  segments: ["Mineração", "Construção Civil", "Agropecuária", "Industrial"],
  currency: "BRL",
};

const DEMO_USER: User = {
  id: "demo",
  name: "Caio Ferreira",
  email: "caio@dcco.com.br",
  role: "admin",
  tenantId: "demo",
  tenant: {
    id: "demo",
    companyName: "DCCO Distribuição",
    sector: "industrial_b2b",
    sectorConfig: DCCO_SECTOR_CONFIG,
    plan: "enterprise",
  },
};

interface AuthContextValue {
  user: User | null;
  sectorConfig: SectorConfig;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  activateDemo: () => void;
  deactivateDemo: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  sectorConfig: DCCO_SECTOR_CONFIG,
  isAuthenticated: false,
  isLoading: true,
  isDemoMode: false,
  activateDemo: () => {},
  deactivateDemo: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useAuth();

  // Demo mode is opt-in — state initialized from localStorage for persistence across reloads
  const [demoActive, setDemoActive] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("is-demo") === "true"
  );

  const activateDemo = useCallback(() => {
    localStorage.setItem("is-demo", "true");
    setDemoActive(true);
  }, []);

  const deactivateDemo = useCallback(() => {
    localStorage.removeItem("is-demo");
    setDemoActive(false);
  }, []);

  const isDemoMode = !isLoading && !user && demoActive;
  const effectiveUser = user ?? (isDemoMode ? DEMO_USER : null);
  const sectorConfig = effectiveUser?.tenant?.sectorConfig ?? DCCO_SECTOR_CONFIG;

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        sectorConfig,
        isAuthenticated: !!effectiveUser,
        isLoading,
        isDemoMode,
        activateDemo,
        deactivateDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
