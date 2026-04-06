import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { users, tenants } from "../../../shared/schema.js";
import { eq } from "drizzle-orm";

export const authRouter = Router();

// Register
authRouter.post("/register", async (req, res) => {
  try {
    const { email, password, name, companyName, sector } = req.body;

    if (!email || !password || !name || !companyName) {
      return res.status(400).json({ error: "Campos obrigatórios: email, password, name, companyName" });
    }

    // Check if user exists
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email já cadastrado" });
    }

    // Create tenant
    const sectorConfigs: Record<string, any> = {
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
      health: {
        customerLabel: "Beneficiário",
        customersLabel: "Beneficiários",
        revenueLabel: "Mensalidade",
        engagementLabel: "Consultas/Mês",
        ticketLabel: "Reclamações",
        tenureLabel: "Tempo de Plano",
        segments: ["Individual", "Familiar", "Empresarial"],
        currency: "BRL",
      },
      education: {
        customerLabel: "Aluno",
        customersLabel: "Alunos",
        revenueLabel: "Mensalidade",
        engagementLabel: "Presença",
        ticketLabel: "Ocorrências",
        tenureLabel: "Tempo de Matrícula",
        segments: ["Infantil", "Fundamental", "Médio", "Superior", "Pós-Graduação"],
        currency: "BRL",
      },
      other: {
        customerLabel: "Cliente",
        customersLabel: "Clientes",
        revenueLabel: "Receita Mensal",
        engagementLabel: "Engajamento",
        ticketLabel: "Tickets de Suporte",
        tenureLabel: "Tempo de Relacionamento",
        segments: [],
        currency: "BRL",
      },
    };

    const sectorConfig = sectorConfigs[sector || "other"] || sectorConfigs.other;

    const [tenant] = await db
      .insert(tenants)
      .values({
        companyName,
        sector: sector || "other",
        sectorConfig,
      })
      .returning();

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email,
        passwordHash,
        name,
        role: "admin",
      })
      .returning();

    // Set session
    req.session.userId = user.id;
    req.session.tenantId = tenant.id;

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tenant: { id: tenant.id, companyName: tenant.companyName, sector: tenant.sector, sectorConfig: tenant.sectorConfig },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Erro ao criar conta" });
  }
});

// Login
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha obrigatórios" });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    // Get tenant
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);

    // Set session
    req.session.userId = user.id;
    req.session.tenantId = user.tenantId;

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tenant: { id: tenant.id, companyName: tenant.companyName, sector: tenant.sector, sectorConfig: tenant.sectorConfig },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Erro ao fazer login" });
  }
});

// Logout
authRouter.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Erro ao fazer logout" });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logout realizado" });
  });
});

// Get current user
authRouter.get("/me", async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1);
    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tenant: { id: tenant.id, companyName: tenant.companyName, sector: tenant.sector, sectorConfig: tenant.sectorConfig },
    });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ error: "Erro ao buscar usuário" });
  }
});
