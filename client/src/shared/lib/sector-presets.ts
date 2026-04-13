import { SectorConfig } from "../hooks/useAuth";

export const SECTOR_PRESETS: Record<string, SectorConfig> = {
  industrial_b2b: {
    customerLabel: "Empresa",
    customersLabel: "Empresas",
    revenueLabel: "Valor do Contrato",
    engagementLabel: "Utilização de Equipamentos",
    ticketLabel: "Chamados Técnicos",
    tenureLabel: "Tempo de Parceria",
    segments: ["Mineração", "Construção Civil", "Agropecuária", "Industrial"],
    currency: "BRL",
  },
  telecom: {
    customerLabel: "Assinante",
    customersLabel: "Assinantes",
    revenueLabel: "Mensalidade",
    engagementLabel: "Logins no Portal",
    ticketLabel: "Tickets de Suporte",
    tenureLabel: "Tempo de Assinatura",
    segments: ["Residencial Básico", "Residencial Premium", "PME", "Corporate"],
    currency: "BRL",
  },
  fintech: {
    customerLabel: "Cliente",
    customersLabel: "Clientes",
    revenueLabel: "Receita Mensal",
    engagementLabel: "Transações/Mês",
    ticketLabel: "Chamados",
    tenureLabel: "Tempo de Conta",
    segments: ["PF Básico", "PF Premium", "PJ Micro", "PJ PME", "PJ Corporate"],
    currency: "BRL",
  },
  saas: {
    customerLabel: "Conta",
    customersLabel: "Contas",
    revenueLabel: "MRR",
    engagementLabel: "DAU/MAU",
    ticketLabel: "Tickets",
    tenureLabel: "Tempo no Plano",
    segments: ["Starter", "Growth", "Enterprise"],
    currency: "BRL",
  },
};

export const DEFAULT_SECTOR_CONFIG = SECTOR_PRESETS.industrial_b2b;
