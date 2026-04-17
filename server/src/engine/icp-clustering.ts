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
  avgTenureDays: number;
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

  // Require BOTH customers (Retain) AND leads (Obtain) to generate meaningful ICP clusters.
  // With only one side, the clustering would produce misleading profiles: no conversion data
  // without leads, and no health/churn data without customers.
  if (allCustomers.length === 0 || allLeadsWithScores.length === 0) {
    // Clear any stale clusters so the ICP page shows an empty state.
    await db.delete(obtainIcpClusters).where(eq(obtainIcpClusters.tenantId, tenantId));
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
        avgTenureDays: 0,
      });
    }

    const profile = industryProfiles.get(industry)!;
    profile.customerCount++;
    profile.avgLtv += (customer.dimRevenue ?? 0) * ((customer.dimTenureDays ?? 365) / 30);
    profile.avgHealthScore += customer.healthScore ?? 50;
    profile.avgTenureDays += customer.dimTenureDays ?? 0;
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
        avgTenureDays: 0,
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
      p.avgTenureDays /= p.customerCount;
      p.churnRate = p.churnRate / p.customerCount;
      // 30d/90d churn: scale the annual churn rate to those windows
      p.churnRate30d = 1 - Math.pow(1 - p.churnRate, 1 / 12);   // monthly equivalent
      p.churnRate90d = 1 - Math.pow(1 - p.churnRate, 3 / 12);   // quarterly equivalent
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

  // Classify using forced tertile distribution when N >= 3
  // This ensures visible tier diversity regardless of how close composite scores are
  const classified: Array<{ profile: ClusterProfile & { composite: number }; type: ClusterType }> = [];
  const n = scoredProfiles.length;

  if (n >= 3) {
    // Tertile: top 1/3 = ideal, middle 1/3 = good, bottom 1/3 = anti
    const topCut = Math.ceil(n / 3);
    const midCut = Math.ceil(n * 2 / 3);
    for (let i = 0; i < n; i++) {
      const type: ClusterType = i < topCut ? "ideal" : i < midCut ? "good" : "anti";
      classified.push({ profile: scoredProfiles[i], type });
    }
  } else if (n === 2) {
    classified.push({ profile: scoredProfiles[0], type: "ideal" });
    classified.push({ profile: scoredProfiles[1], type: "anti" });
  } else if (n === 1) {
    classified.push({ profile: scoredProfiles[0], type: "ideal" });
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
      averageTenureDays: Math.round(p.avgTenureDays),
      averageConversionRate: Math.round(p.avgConversionRate * 100) / 100,
      averageCac: p.avgCac > 0 ? Math.round(p.avgCac) : null,
      churnRate30d: Math.round(p.churnRate30d * 100) / 100,
      churnRate90d: Math.round(p.churnRate90d * 100) / 100,
      isIdeal: type === "ideal",
    });
  }

  return { clustersGenerated: classified.length };
}
