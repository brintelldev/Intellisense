import { createContext, useCallback, useContext, ReactNode } from "react";
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

  const activateDemo = useCallback(() => {
    // Older builds used client-only demo mode. Clear it so protected API calls
    // always rely on a real backend session.
    sessionStorage.removeItem("is-demo");
    localStorage.removeItem("is-demo");
  }, []);

  const deactivateDemo = useCallback(() => {
    sessionStorage.removeItem("is-demo");
    localStorage.removeItem("is-demo");
  }, []);

  const isDemoMode = false;
  const effectiveUser = user ?? null;
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
