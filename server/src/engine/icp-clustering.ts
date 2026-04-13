import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  customers,
  leads,
  obtainScores,
  obtainIcpClusters,
} from "@shared/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ClusterProfile {
  industry: string;
  customerCount: number;
  leadCount: number;
  avgLtv: number;
  avgHealthScore: number;
  avgConversionRate: number;
  avgCac: number;
  churnRate: number;
  churnRate30d: number;
  churnRate90d: number;
}

type ClusterType = "ideal" | "good" | "anti";

// ─── Core ───────────────────────────────────────────────────────────────────

export async function generateIcpClusters(tenantId: string): Promise<{
  clustersGenerated: number;
}> {
  // Load all customers from Retain
  const allCustomers = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenantId));

  // Load all leads with scores from Obtain
  const allLeadsWithScores = await db
    .select({
      lead: leads,
      score: obtainScores,
    })
    .from(leads)
    .leftJoin(obtainScores, eq(obtainScores.leadId, leads.id))
    .where(eq(leads.tenantId, tenantId));

  if (allCustomers.length === 0 && allLeadsWithScores.length === 0) {
    return { clustersGenerated: 0 };
  }

  // Group customers by industry/segment
  const industryProfiles = new Map<string, ClusterProfile>();

  for (const customer of allCustomers) {
    const industry = customer.segment ?? customer.city ?? "Outros";

    if (!industryProfiles.has(industry)) {
      industryProfiles.set(industry, {
        industry,
        customerCount: 0,
        leadCount: 0,
        avgLtv: 0,
        avgHealthScore: 0,
        avgConversionRate: 0,
        avgCac: 0,
        churnRate: 0,
        churnRate30d: 0,
        churnRate90d: 0,
      });
    }

    const profile = industryProfiles.get(industry)!;
    profile.customerCount++;
    profile.avgLtv += (customer.dimRevenue ?? 0) * ((customer.dimTenureDays ?? 365) / 30);
    profile.avgHealthScore += customer.healthScore ?? 50;
    if (customer.status === "churned") {
      profile.churnRate++;
    }
  }

  // Add lead data
  for (const { lead, score } of allLeadsWithScores) {
    const industry = lead.industry ?? "Outros";

    if (!industryProfiles.has(industry)) {
      industryProfiles.set(industry, {
        industry,
        customerCount: 0,
        leadCount: 0,
        avgLtv: 0,
        avgHealthScore: 0,
        avgConversionRate: 0,
        avgCac: 0,
        churnRate: 0,
        churnRate30d: 0,
        churnRate90d: 0,
      });
    }

    const profile = industryProfiles.get(industry)!;
    profile.leadCount++;
    if (lead.status === "won") {
      profile.avgConversionRate++;
    }
    if (score?.ltvPrediction) {
      profile.avgLtv += score.ltvPrediction;
    }
  }

  // Calculate averages and classify
  const profiles = Array.from(industryProfiles.values())
    .filter((p) => p.customerCount + p.leadCount >= 1);

  for (const p of profiles) {
    const totalEntities = p.customerCount + p.leadCount;
    if (p.customerCount > 0) {
      p.avgHealthScore /= p.customerCount;
      p.churnRate = p.churnRate / p.customerCount;
      p.churnRate30d = p.churnRate * 0.08; // rough estimate
      p.churnRate90d = p.churnRate * 0.25;
    }
    if (totalEntities > 0) {
      p.avgLtv /= totalEntities;
    }
    if (p.leadCount > 0) {
      p.avgConversionRate /= p.leadCount;
    }
  }

  // Score each profile to classify as ideal/good/anti
  const scoredProfiles = profiles.map((p) => {
    // Composite score: high LTV + high health + low churn + high conversion
    const ltvScore = Math.min(p.avgLtv / 500000, 1); // normalize to 500K
    const healthScore = p.avgHealthScore / 100;
    const churnPenalty = 1 - p.churnRate;
    const conversionBonus = p.avgConversionRate;

    const composite = ltvScore * 0.35 + healthScore * 0.30 + churnPenalty * 0.25 + conversionBonus * 0.10;

    return { ...p, composite };
  });

  // Sort by composite score
  scoredProfiles.sort((a, b) => b.composite - a.composite);

  // Classify
  const classified: Array<{ profile: ClusterProfile & { composite: number }; type: ClusterType }> = [];

  for (let i = 0; i < scoredProfiles.length; i++) {
    const p = scoredProfiles[i];
    let type: ClusterType;

    if (p.composite >= 0.6 || i === 0) {
      type = "ideal";
    } else if (p.composite >= 0.35 || p.churnRate < 0.3) {
      type = "good";
    } else {
      type = "anti";
    }

    classified.push({ profile: p, type });
  }

  // Ensure at least one of each type if we have enough data
  if (classified.length >= 3) {
    const hasIdeal = classified.some((c) => c.type === "ideal");
    const hasGood = classified.some((c) => c.type === "good");
    const hasAnti = classified.some((c) => c.type === "anti");

    if (!hasAnti) {
      classified[classified.length - 1].type = "anti";
    }
    if (!hasGood && classified.length > 2) {
      const midIdx = Math.floor(classified.length / 2);
      classified[midIdx].type = "good";
    }
  }

  // Delete existing clusters for tenant
  await db
    .delete(obtainIcpClusters)
    .where(eq(obtainIcpClusters.tenantId, tenantId));

  // Insert new clusters
  let clusterId = 1;

  for (const { profile: p, type } of classified) {
    const clusterName = type === "ideal"
      ? `ICP Ideal — ${p.industry}`
      : type === "good"
        ? `ICP Bom — ${p.industry}`
        : `Anti-ICP — ${p.industry}`;

    const description = type === "ideal"
      ? `Segmento ${p.industry} apresenta alto LTV (R$ ${Math.round(p.avgLtv).toLocaleString("pt-BR")}), health score médio de ${Math.round(p.avgHealthScore)} e baixo churn. Priorizar aquisição neste perfil.`
      : type === "good"
        ? `Segmento ${p.industry} apresenta métricas medianas. LTV de R$ ${Math.round(p.avgLtv).toLocaleString("pt-BR")} com oportunidades de melhoria.`
        : `Segmento ${p.industry} apresenta alto risco de churn (${Math.round(p.churnRate * 100)}%) e/ou baixo LTV. Evitar investimento pesado em aquisição neste perfil.`;

    await db.insert(obtainIcpClusters).values({
      tenantId,
      clusterId: clusterId++,
      clusterName,
      description,
      characteristics: {
        industry: p.industry,
        type,
        customerCount: p.customerCount,
        leadCount: p.leadCount,
        composite: Math.round(p.composite * 100) / 100,
      },
      averageLtv: Math.round(p.avgLtv),
      averageTenureDays: Math.round(p.avgHealthScore > 50 ? 540 : 270), // estimate
      averageConversionRate: Math.round(p.avgConversionRate * 100) / 100,
      averageCac: p.avgCac > 0 ? Math.round(p.avgCac) : null,
      churnRate30d: Math.round(p.churnRate30d * 100) / 100,
      churnRate90d: Math.round(p.churnRate90d * 100) / 100,
      isIdeal: type === "ideal",
    });
  }

  return { clustersGenerated: classified.length };
}
