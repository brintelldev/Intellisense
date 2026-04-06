import { Router } from "express";
import { db } from "../db.js";
import { tenants } from "../../../shared/schema.js";
import { eq } from "drizzle-orm";

export const tenantsRouter = Router();

// Get current tenant
tenantsRouter.get("/current", async (req, res) => {
  try {
    const tenantId = req.session?.tenantId;
    if (!tenantId) return res.status(403).json({ error: "Tenant não configurado" });

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });

    res.json(tenant);
  } catch (err) {
    console.error("Get tenant error:", err);
    res.status(500).json({ error: "Erro ao buscar tenant" });
  }
});

// Update tenant sector config
tenantsRouter.patch("/current/sector-config", async (req, res) => {
  try {
    const tenantId = req.session?.tenantId;
    if (!tenantId) return res.status(403).json({ error: "Tenant não configurado" });

    const { sectorConfig, sector } = req.body;

    const updates: any = {};
    if (sectorConfig) updates.sectorConfig = sectorConfig;
    if (sector) updates.sector = sector;

    const [updated] = await db.update(tenants).set(updates).where(eq(tenants.id, tenantId)).returning();
    res.json(updated);
  } catch (err) {
    console.error("Update sector config error:", err);
    res.status(500).json({ error: "Erro ao atualizar configuração" });
  }
});
