/**
 * Runtime join between leads (Obtain) and customers (Retain) — no DB migration required.
 *
 * Match strategy (in order of priority):
 *   1. leads.email = customers.email  (case-insensitive, exact)
 *   2. leads.industry = customers.segment  (aggregate fallback)
 *
 * Returns maps used by the /campaigns and /funnel handlers.
 */

import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { leads, customers } from "@shared/schema.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BridgeCustomer {
  id: string;
  name: string;
  email: string | null;
  segment: string | null;
  dimRevenue: number;
  dimTenureDays: number;
  healthScore: number;
  riskLevel: string;
  status: string;
}

export interface SourceBridge {
  customers: BridgeCustomer[];
  verifiedSampleSize: number;
  avgLtvVerified: number;
  avgTenureDays: number;
  healthyCount: number;
  atRiskCount: number;
  churnedCount: number;
  postSaleChurnRate: number;
  ltvChurnAdjusted: number | null;
}

export interface FunnelRetainFeedback {
  wonLeadsMatched: number;
  becameHealthy: number;
  becameAtRisk: number;
  churnedAfterWon: number;
  avgTenureDays: number;
  topChurningSegment: string | null;
}

export interface BridgeResult {
  bySource: Map<string, SourceBridge>;
  funnelFeedback: FunnelRetainFeedback;
  totalMatched: number;
}

// ─── Empty result helper ─────────────────────────────────────────────────────

function emptyResult(): BridgeResult {
  return {
    bySource: new Map(),
    funnelFeedback: {
      wonLeadsMatched: 0,
      becameHealthy: 0,
      becameAtRisk: 0,
      churnedAfterWon: 0,
      avgTenureDays: 0,
      topChurningSegment: null,
    },
    totalMatched: 0,
  };
}

// ─── Core ────────────────────────────────────────────────────────────────────

export async function resolveWonLeadCustomerLinks(tenantId: string): Promise<BridgeResult> {
  // Load won leads (only fields needed for matching)
  const wonLeads = await db.select({
    id: leads.id,
    name: leads.name,
    email: leads.email,
    source: leads.source,
    industry: leads.industry,
  }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "won")));

  if (wonLeads.length === 0) return emptyResult();

  // Load all customers
  const allCustomers = await db.select({
    id: customers.id,
    name: customers.name,
    email: customers.email,
    segment: customers.segment,
    city: customers.city,
    dimRevenue: customers.dimRevenue,
    dimTenureDays: customers.dimTenureDays,
    healthScore: customers.healthScore,
    riskLevel: customers.riskLevel,
    status: customers.status,
  }).from(customers).where(eq(customers.tenantId, tenantId));

  if (allCustomers.length === 0) return emptyResult();

  // Build lookup maps
  const emailToCustomer = new Map<string, typeof allCustomers[0]>();
  const segmentToCustomers = new Map<string, (typeof allCustomers[0])[]>();

  for (const c of allCustomers) {
    if (c.email) emailToCustomer.set(c.email.toLowerCase().trim(), c);
    const segKey = (c.segment ?? c.city ?? "outros").toLowerCase();
    if (!segmentToCustomers.has(segKey)) segmentToCustomers.set(segKey, []);
    segmentToCustomers.get(segKey)!.push(c);
  }

  // Match won leads → customers (per source)
  const sourceCustomerSets = new Map<string, Set<typeof allCustomers[0]>>();
  const emailMatchedCustomers: typeof allCustomers[0][] = [];

  for (const lead of wonLeads) {
    const source = lead.source ?? "other";
    if (!sourceCustomerSets.has(source)) sourceCustomerSets.set(source, new Set());

    // Primary: email match
    if (lead.email) {
      const match = emailToCustomer.get(lead.email.toLowerCase().trim());
      if (match) {
        sourceCustomerSets.get(source)!.add(match);
        emailMatchedCustomers.push(match);
        continue;
      }
    }

    // Fallback: industry → segment match (adds segment pool once per source/industry combo)
    if (lead.industry) {
      const segKey = lead.industry.toLowerCase();
      const segCustomers = segmentToCustomers.get(segKey) ?? [];
      for (const c of segCustomers) {
        sourceCustomerSets.get(source)!.add(c);
      }
    }
  }

  // Compute per-source aggregates
  const resultBySource = new Map<string, SourceBridge>();

  for (const [source, custSet] of sourceCustomerSets.entries()) {
    const custs = Array.from(custSet) as BridgeCustomer[];
    const n = custs.length;
    if (n === 0) continue;

    const avgLtvVerified = Math.round(
      custs.reduce((s, c) => s + (c.dimRevenue ?? 0) * ((c.dimTenureDays ?? 30) / 30), 0) / n,
    );
    const churnedCount    = custs.filter(c => c.status === "churned").length;
    const healthyCount    = custs.filter(c => (c.healthScore ?? 0) >= 70).length;
    const atRiskCount     = custs.filter(c => ["medium", "high", "critical"].includes(c.riskLevel ?? "")).length;
    const avgTenureDays   = Math.round(custs.reduce((s, c) => s + (c.dimTenureDays ?? 0), 0) / n);
    const postSaleChurnRate = Math.round((churnedCount / n) * 100) / 100;
    const ltvChurnAdjusted = n >= 3 && avgLtvVerified > 0
      ? Math.round(avgLtvVerified * (1 - postSaleChurnRate)) : null;

    resultBySource.set(source, {
      customers: custs,
      verifiedSampleSize: n,
      avgLtvVerified,
      avgTenureDays,
      healthyCount,
      atRiskCount,
      churnedCount,
      postSaleChurnRate,
      ltvChurnAdjusted,
    });
  }

  // Aggregate funnel feedback across all email-matched customers
  const dedupMatched = Array.from(
    new Map(emailMatchedCustomers.map(c => [c.id, c])).values(),
  ) as BridgeCustomer[];

  const becameHealthy   = dedupMatched.filter(c => (c.healthScore ?? 0) >= 70).length;
  const becameAtRisk    = dedupMatched.filter(c => ["medium", "high", "critical"].includes(c.riskLevel ?? "")).length;
  const churnedAfterWon = dedupMatched.filter(c => c.status === "churned").length;
  const avgTenureDays   = dedupMatched.length > 0
    ? Math.round(dedupMatched.reduce((s, c) => s + (c.dimTenureDays ?? 0), 0) / dedupMatched.length)
    : 0;

  // topChurningSegment: segment with highest churn rate (min 3 customers)
  const segChurn = new Map<string, { churned: number; total: number }>();
  for (const c of dedupMatched) {
    const seg = c.segment ?? "outros";
    if (!segChurn.has(seg)) segChurn.set(seg, { churned: 0, total: 0 });
    const e = segChurn.get(seg)!;
    e.total++;
    if (c.status === "churned") e.churned++;
  }
  let topChurningSegment: string | null = null;
  let maxRate = 0;
  for (const [seg, d] of segChurn.entries()) {
    if (d.total >= 3 && d.churned / d.total > maxRate) {
      maxRate = d.churned / d.total;
      topChurningSegment = seg;
    }
  }

  return {
    bySource: resultBySource,
    funnelFeedback: {
      wonLeadsMatched: dedupMatched.length,
      becameHealthy,
      becameAtRisk,
      churnedAfterWon,
      avgTenureDays,
      topChurningSegment,
    },
    totalMatched: dedupMatched.length,
  };
}
