import { Route, Switch, Redirect } from "wouter";

// Shell
import { AuthProvider, useAuthContext } from "./shell/contexts/AuthContext";
import AppShell from "./shell/components/AppShell";
import LoginPage from "./shell/pages/LoginPage";
import LifecyclePage from "./shell/pages/LifecyclePage";
import SettingsPage from "./shell/pages/SettingsPage";

// Retain Sense
import RetainDashboardPage from "./modules/retain/pages/RetainDashboardPage";
import RetainPredictionsPage from "./modules/retain/pages/RetainPredictionsPage";
import RetainRootCausesPage from "./modules/retain/pages/RetainRootCausesPage";
import RetainROIPage from "./modules/retain/pages/RetainROIPage";
import RetainCustomersPage from "./modules/retain/pages/RetainCustomersPage";
import RetainRevenueAnalyticsPage from "./modules/retain/pages/RetainRevenueAnalyticsPage";
import RetainUploadPage from "./modules/retain/pages/RetainUploadPage";
import RetainVozDoClientePage from "./modules/retain/pages/RetainVozDoClientePage";

// Obtain Sense
import ObtainDashboardPage from "./modules/obtain/pages/ObtainDashboardPage";
import ObtainLeadsPage from "./modules/obtain/pages/ObtainLeadsPage";
import ObtainICPPage from "./modules/obtain/pages/ObtainICPPage";
import ObtainFunnelPage from "./modules/obtain/pages/ObtainFunnelPage";
import ObtainCACLTVPage from "./modules/obtain/pages/ObtainCACLTVPage";
import ObtainROIPage from "./modules/obtain/pages/ObtainROIPage";
import ObtainUploadPage from "./modules/obtain/pages/ObtainUploadPage";

function NotFound() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <p className="text-4xl font-bold text-slate-200 mb-2">404</p>
        <h1 className="text-lg font-semibold text-slate-700">Página não encontrada</h1>
        <a href="/" className="text-sm text-[#293b83] mt-2 inline-block hover:underline">Voltar ao início</a>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthContext();
  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <>{children}</>;
}

function AuthenticatedRoutes() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={LifecyclePage} />

        {/* Retain Sense */}
        <Route path="/retain" component={RetainDashboardPage} />
        <Route path="/retain/predictions" component={RetainPredictionsPage} />
        <Route path="/retain/root-causes" component={RetainRootCausesPage} />
        <Route path="/retain/roi" component={RetainROIPage} />
        <Route path="/retain/revenue" component={RetainRevenueAnalyticsPage} />
        <Route path="/retain/customers" component={RetainCustomersPage} />
        <Route path="/retain/voz-do-cliente" component={RetainVozDoClientePage} />
        <Route path="/retain/upload" component={RetainUploadPage} />

        {/* Obtain Sense */}
        <Route path="/obtain" component={ObtainDashboardPage} />
        <Route path="/obtain/leads" component={ObtainLeadsPage} />
        <Route path="/obtain/icp" component={ObtainICPPage} />
        <Route path="/obtain/funnel" component={ObtainFunnelPage} />
        <Route path="/obtain/cac-ltv" component={ObtainCACLTVPage} />
        <Route path="/obtain/roi" component={ObtainROIPage} />
        <Route path="/obtain/upload" component={ObtainUploadPage} />

        {/* Settings */}
        <Route path="/settings" component={SettingsPage} />

        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route component={() => <RequireAuth><AuthenticatedRoutes /></RequireAuth>} />
      </Switch>
    </AuthProvider>
  );
}
