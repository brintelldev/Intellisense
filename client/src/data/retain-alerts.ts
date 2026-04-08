import { Alert } from "./types";

export const alerts: Alert[] = [
  { id: "a1", customerId: "c1", customerName: "Mineradora Vale Norte Ltda", message: "Churn probability subiu para 89%", severity: "critical", timeAgo: "há 2h" },
  { id: "a2", customerId: "c4", customerName: "Construtora Horizonte SA", message: "Contrato vence em 7 dias, sem renovação sinalizada", severity: "critical", timeAgo: "há 5h" },
  { id: "a3", customerId: "c5", customerName: "AgroPlan Mecanização", message: "3 chamados técnicos abertos esta semana", severity: "high", timeAgo: "há 1d" },
  { id: "a4", customerId: "c2", customerName: "Terraplenagem Tocantins SA", message: "Health score caiu de 45 para 22", severity: "critical", timeAgo: "há 1d" },
  { id: "a5", customerId: "c9", customerName: "Pedreira Goiás Central", message: "NPS caiu para 4 (detrator)", severity: "high", timeAgo: "há 2d" },
];
