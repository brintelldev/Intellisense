import { Route, Switch } from "wouter";

// Shell pages
import LoginPage from "./shell/pages/LoginPage";

// Placeholder for routes not yet implemented
function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        <p className="text-slate-500 mt-2">Em construção</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/login" component={LoginPage} />

      {/* Shell */}
      <Route path="/">
        <Placeholder title="Ciclo de Vida do Cliente" />
      </Route>

      {/* Retain Sense */}
      <Route path="/retain">
        <Placeholder title="Dashboard Executivo — Retain Sense" />
      </Route>
      <Route path="/retain/predictions">
        <Placeholder title="Predições de Churn" />
      </Route>
      <Route path="/retain/root-causes">
        <Placeholder title="Causas Raiz" />
      </Route>
      <Route path="/retain/roi">
        <Placeholder title="Simulador ROI — Retenção" />
      </Route>
      <Route path="/retain/customers">
        <Placeholder title="Clientes" />
      </Route>
      <Route path="/retain/upload">
        <Placeholder title="Upload de Dados — Retain" />
      </Route>

      {/* Obtain Sense */}
      <Route path="/obtain">
        <Placeholder title="Dashboard Executivo — Obtain Sense" />
      </Route>
      <Route path="/obtain/leads">
        <Placeholder title="Lead Scoring Preditivo" />
      </Route>
      <Route path="/obtain/icp">
        <Placeholder title="ICP & Lookalike" />
      </Route>
      <Route path="/obtain/funnel">
        <Placeholder title="Funil & Gargalos" />
      </Route>
      <Route path="/obtain/cac-ltv">
        <Placeholder title="CAC vs LTV" />
      </Route>
      <Route path="/obtain/roi">
        <Placeholder title="Simulador ROI — Aquisição" />
      </Route>
      <Route path="/obtain/upload">
        <Placeholder title="Upload de Dados — Obtain" />
      </Route>

      {/* Settings */}
      <Route path="/settings">
        <Placeholder title="Configurações" />
      </Route>

      {/* 404 */}
      <Route>
        <Placeholder title="Página não encontrada" />
      </Route>
    </Switch>
  );
}
