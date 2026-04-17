/**
 * seed-historical.mjs
 * Populates customerScoreHistory (90 days × all customers) and
 * retainAnalytics (12 monthly snapshots) for the DCCO demo tenant.
 *
 * Usage:   node scripts/demo/seed-historical.mjs
 * Prereq:  Server must NOT be running (or it doesn't matter — direct DB access).
 *          The demo tenant must already exist (run upload_csv_a_correct.js first).
 */

import pg from "pg";

const { Pool } = pg;

const DB_URL = "postgresql://intellisense:intellisense_dev@localhost:5433/intellisense";
const pool = new Pool({ connectionString: DB_URL });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function noise(range) {
  // Simple deterministic-ish noise
  return (Math.random() - 0.5) * 2 * range;
}

function healthToRisk(health) {
  if (health < 35) return "critical";
  if (health < 55) return "high";
  if (health < 70) return "medium";
  return "low";
}

function healthToChurn(health) {
  // Rough inverse mapping with some spread
  const base = clamp((100 - health) / 100 * 1.15, 0.02, 0.97);
  return Math.round(base * 100) / 100;
}

/**
 * Given a customer's CURRENT healthScore and riskLevel,
 * returns an array of 13 weekly snapshots going from 12 weeks ago → today.
 * Each snapshot: { weekOffset: 0..12, healthScore, churnProbability, riskLevel }
 * weekOffset=0 → today, weekOffset=12 → 12 weeks ago.
 */
function buildTrajectory(currentHealth, currentRisk) {
  const snapshots = [];
  let startHealth;
  let trend;

  if (currentRisk === "critical") {
    // Declining from healthier state
    startHealth = clamp(currentHealth + 35 + noise(10), 45, 75);
    trend = "declining";
  } else if (currentRisk === "high") {
    startHealth = clamp(currentHealth + 20 + noise(8), 45, 72);
    trend = "declining";
  } else if (currentRisk === "medium") {
    startHealth = clamp(currentHealth + noise(8), 45, 75);
    trend = "stable";
  } else {
    // low risk — stable or slightly improving
    startHealth = clamp(currentHealth - 5 + noise(5), 55, 95);
    trend = "improving";
  }

  const totalWeeks = 12; // 13 points: week 12 → week 0

  for (let w = totalWeeks; w >= 0; w--) {
    // w=12 → oldest, w=0 → current
    const progress = (totalWeeks - w) / totalWeeks; // 0 at oldest, 1 at current

    let health;
    if (trend === "declining") {
      // Interpolate from startHealth → currentHealth (declining)
      health = startHealth + (currentHealth - startHealth) * progress;
    } else if (trend === "improving") {
      health = startHealth + (currentHealth - startHealth) * progress;
    } else {
      // stable — fluctuate around a mean
      const mean = (startHealth + currentHealth) / 2;
      health = mean + noise(7);
    }

    // Add small week-to-week noise
    health = clamp(health + noise(3), 5, 98);
    health = Math.round(health * 10) / 10;

    snapshots.push({
      weekOffset: w,
      healthScore: health,
      churnProbability: healthToChurn(health),
      riskLevel: healthToRisk(health),
    });
  }

  // Force the latest snapshot (w=0) to exactly match current data
  snapshots[snapshots.length - 1].healthScore = currentHealth;
  snapshots[snapshots.length - 1].churnProbability = healthToChurn(currentHealth);
  snapshots[snapshots.length - 1].riskLevel = currentRisk;

  return snapshots;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n════════════════════════════════════════════");
  console.log("  IntelliSense — Seed Historical Data");
  console.log("════════════════════════════════════════════\n");

  // 1. Find demo tenant
  const tenantRes = await pool.query(
    `SELECT id, company_name FROM tenants WHERE company_name = 'DCCO Equipamentos' ORDER BY created_at DESC LIMIT 1`
  );
  if (tenantRes.rows.length === 0) {
    console.error("✗ Tenant 'DCCO Equipamentos' não encontrado. Execute o upload do CSV A primeiro.");
    process.exit(1);
  }
  const { id: tenantId, company_name } = tenantRes.rows[0];
  console.log(`✓ Tenant encontrado: ${company_name} (${tenantId.slice(0, 8)}...)`);

  // 2. Get all customers
  const custRes = await pool.query(
    `SELECT id, health_score, churn_probability, risk_level, name
     FROM customers WHERE tenant_id = $1 AND status != 'churned'
     ORDER BY health_score ASC`,
    [tenantId]
  );
  const customers = custRes.rows;
  console.log(`✓ Clientes encontrados: ${customers.length}`);

  if (customers.length === 0) {
    console.error("✗ Nenhum cliente encontrado. Execute o upload do CSV A primeiro.");
    process.exit(1);
  }

  // 3. Clear existing history for this tenant
  const delHistRes = await pool.query(
    `DELETE FROM customer_score_history
     WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = $1)`,
    [tenantId]
  );
  console.log(`✓ customerScoreHistory limpo: ${delHistRes.rowCount} registros removidos`);

  // 4. Generate and insert customerScoreHistory (13 weekly points per customer)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalInserted = 0;
  const batchSize = 200;
  let batch = [];

  for (const c of customers) {
    const health = parseFloat(c.health_score) || 50;
    const risk = c.risk_level || healthToRisk(health);
    const trajectory = buildTrajectory(health, risk);

    for (const snap of trajectory) {
      const snapshotDate = new Date(today);
      snapshotDate.setDate(today.getDate() - snap.weekOffset * 7);
      const dateStr = snapshotDate.toISOString().split("T")[0];

      batch.push({
        tenantId,
        customerId: c.id,
        healthScore: snap.healthScore,
        churnProbability: snap.churnProbability,
        riskLevel: snap.riskLevel,
        snapshotDate: dateStr,
      });

      if (batch.length >= batchSize) {
        await flushBatch(batch);
        totalInserted += batch.length;
        batch = [];
      }
    }
  }

  if (batch.length > 0) {
    await flushBatch(batch);
    totalInserted += batch.length;
  }

  console.log(`✓ customerScoreHistory inserido: ${totalInserted} registros (${customers.length} clientes × 13 semanas)`);

  // 5. Calculate current MRR from customers (to anchor analytics data)
  const mrrRes = await pool.query(
    `SELECT COALESCE(SUM(dim_revenue), 0)::float AS current_mrr,
            COUNT(*)::int AS total,
            COUNT(CASE WHEN status = 'at_risk' THEN 1 END)::int AS at_risk,
            AVG(health_score)::float AS avg_health
     FROM customers WHERE tenant_id = $1 AND status != 'churned'`,
    [tenantId]
  );
  const { current_mrr, total: totalCustomers, at_risk: atRisk, avg_health } = mrrRes.rows[0];
  const currentMrr = parseFloat(current_mrr) || 3_250_000;
  const currentAvgHealth = parseFloat(avg_health) || 58;

  console.log(`  MRR atual: R$ ${currentMrr.toLocaleString("pt-BR")} | ${totalCustomers} clientes | health médio: ${Math.round(currentAvgHealth)}`);

  // 6. Clear existing retainAnalytics for this tenant
  const delAnalRes = await pool.query(
    `DELETE FROM retain_analytics WHERE tenant_id = $1`,
    [tenantId]
  );
  console.log(`✓ retainAnalytics limpo: ${delAnalRes.rowCount} registros removidos`);

  // 7. Generate 12 monthly snapshots (May 2025 → April 2026)
  // MRR grows from ~85% of current → current over 12 months (with 1-2 dips)
  const startMrr = currentMrr * 0.855;
  const analyticsRows = [];

  // MRR curve: dip in Q2-Q3/25, recovery from Q4/25, strong Q1/26
  // This creates NRR story: "dipped to ~98% in Aug-Sep/25, recovered to 104% by Mar/26"
  const mrrCurve = [0, 1.5, 0.8, -0.2, -1.5, 0.5, 2.5, 5.0, 7.5, 10.0, 12.5, 14.5, 14.5];
  // Index 0 = May/25 (baseline), index 3 = Aug/25 (dip begins), index 4 = Sep/25 (worst),
  // index 5 = Oct/25 (recovery starts), index 11 = Apr/26 (current)

  const churnRateCurve = [3.2, 3.5, 4.0, 4.5, 4.8, 4.2, 3.6, 2.8, 2.2, 1.9, 1.8, 1.7];
  const healthCurve   = [50,  49,  48,  47,  46,  49,  52,  54,  55,  56,  57,  Math.round(currentAvgHealth)];

  for (let i = 0; i < 12; i++) {
    // Month date: May 2025 = 11 months ago, April 2026 = last month
    const d = new Date(2025, 4 + i, 1); // May 2025 = index 0
    const snapshotDate = d.toISOString().split("T")[0];

    const growthFraction = mrrCurve[i] / mrrCurve[12]; // 0 → ~1
    const mrr = Math.round(startMrr + (currentMrr - startMrr) * growthFraction);

    const churnRate = churnRateCurve[i] + (Math.random() - 0.5) * 0.3;
    const churnedCustomers = Math.max(1, Math.round(totalCustomers * churnRate / 100));
    const activeCustomers = totalCustomers - atRisk - churnedCustomers;

    // Revenue at risk oscillates — higher when more customers at risk
    const churnRateNormalized = churnRate / 4; // 0..1 range
    const revenueAtRisk = Math.round(mrr * (0.12 + churnRateNormalized * 0.15 + (Math.random() - 0.5) * 0.04));

    analyticsRows.push({
      tenantId,
      snapshotDate,
      totalCustomers,
      activeCustomers: Math.max(0, activeCustomers),
      churnedCustomers,
      atRiskCustomers: atRisk,
      churnRate: Math.round(churnRate * 10) / 10,
      mrr,
      revenueAtRisk,
      avgHealthScore: healthCurve[i],
    });
  }

  for (const row of analyticsRows) {
    await pool.query(
      `INSERT INTO retain_analytics
         (id, tenant_id, snapshot_date, total_customers, active_customers, churned_customers,
          at_risk_customers, churn_rate, mrr, revenue_at_risk, avg_health_score)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        row.tenantId, row.snapshotDate, row.totalCustomers, row.activeCustomers,
        row.churnedCustomers, row.atRiskCustomers, row.churnRate,
        row.mrr, row.revenueAtRisk, row.avgHealthScore,
      ]
    );
  }

  console.log(`✓ retainAnalytics inserido: ${analyticsRows.length} snapshots mensais`);
  console.log(`  MRR: R$ ${analyticsRows[0].mrr.toLocaleString("pt-BR")} (mai/25) → R$ ${analyticsRows[11].mrr.toLocaleString("pt-BR")} (abr/26)`);
  console.log(`  Churn rate: ${analyticsRows[0].churnRate}% → ${analyticsRows[11].churnRate}%`);

  // 8. Backdate customer created_at (so GRR calc works: most customers existed before previous snapshot)
  // 90% of customers are "long-standing" (created 6–24 months ago), 10% are recent (last 2 months)
  const allCustRes = await pool.query(
    `SELECT id FROM customers WHERE tenant_id = $1 ORDER BY id`,
    [tenantId]
  );
  const allCusts = allCustRes.rows;
  for (let i = 0; i < allCusts.length; i++) {
    const isRecent = (i % 10 === 0); // every 10th customer is "new"
    const d = new Date(today);
    if (isRecent) {
      // Created 0–45 days ago (after previous snapshot)
      d.setDate(today.getDate() - Math.floor(Math.random() * 40));
    } else {
      // Created 180–730 days ago (well before any snapshot)
      d.setDate(today.getDate() - (180 + Math.floor(Math.random() * 550)));
    }
    await pool.query(
      `UPDATE customers SET created_at = $1 WHERE id = $2`,
      [d.toISOString(), allCusts[i].id]
    );
  }
  console.log(`✓ created_at retroativos aplicados: ${allCusts.length} clientes (${Math.round(allCusts.length*0.1)} novos, ${Math.round(allCusts.length*0.9)} antigos)`);

  // 9. Populate leadScoreHistory (6 monthly snapshots per lead)
  const leadRes = await pool.query(
    `SELECT l.id, s.score, s.risk_tier
     FROM leads l
     JOIN obtain_scores s ON s.lead_id = l.id
     WHERE l.tenant_id = $1`,
    [tenantId]
  );

  const delLshRes = await pool.query(
    `DELETE FROM lead_score_history
     WHERE lead_id IN (SELECT id FROM leads WHERE tenant_id = $1)`,
    [tenantId]
  );
  console.log(`✓ leadScoreHistory limpo: ${delLshRes.rowCount} registros removidos`);

  const MONTHS_BACK = 6;
  const PT_MONTH = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const tierOrder = { hot: 3, warm: 2, cold: 1, disqualified: 0 };
  let lshTotal = 0;
  let lshBatch = [];

  for (const lead of leadRes.rows) {
    const currentScore = parseInt(lead.score) || 50;
    const currentTier = lead.risk_tier || "warm";
    const currentTierVal = tierOrder[currentTier] ?? 1;

    for (let m = MONTHS_BACK - 1; m >= 0; m--) {
      // m=5 → 5 months ago, m=0 → this month
      const d = new Date(today);
      d.setDate(1);
      d.setMonth(today.getMonth() - m);
      const snapshotDate = d.toISOString().split("T")[0];

      // Score trends slightly lower in the past
      const progress = (MONTHS_BACK - 1 - m) / (MONTHS_BACK - 1); // 0 → oldest, 1 → current
      let score;
      if (currentTier === "hot" || currentTier === "warm") {
        // Improving over time
        score = Math.round(Math.max(20, currentScore - (1 - progress) * 15 + noise(5)));
      } else {
        // Stable
        score = Math.round(clamp(currentScore + noise(6), 5, 95));
      }

      // Derive tier from score
      const tier = score >= 75 ? "hot" : score >= 50 ? "warm" : score >= 30 ? "cold" : "disqualified";

      lshBatch.push({ tenantId, leadId: lead.id, score, tier, snapshotDate });

      if (lshBatch.length >= 300) {
        await flushLshBatch(lshBatch);
        lshTotal += lshBatch.length;
        lshBatch = [];
      }
    }
  }
  if (lshBatch.length > 0) {
    await flushLshBatch(lshBatch);
    lshTotal += lshBatch.length;
  }

  console.log(`✓ leadScoreHistory inserido: ${lshTotal} registros (${leadRes.rows.length} leads × ${MONTHS_BACK} meses)`);

  // 10. Summary
  console.log("\n════════════════════════════════════════════");
  console.log("  Seed histórico concluído!");
  console.log(`  • ${totalInserted} pontos de score history (${customers.length} clientes × 13 semanas)`);
  console.log(`  • 12 snapshots mensais de analytics (mai/25 → abr/26)`);
  console.log(`  • ${lshTotal} pontos de lead score history (${leadRes.rows.length} leads × ${MONTHS_BACK} meses)`);
  console.log(`  • MRR growing ${Math.round((currentMrr / analyticsRows[0].mrr - 1) * 100)}% over 12 months`);
  console.log("════════════════════════════════════════════\n");

  await pool.end();
}

async function flushLshBatch(batch) {
  const values = batch.map((r, i) => {
    const base = i * 5;
    return `(gen_random_uuid(), $${base+1}, $${base+2}, $${base+3}, $${base+4}::score_tier, $${base+5})`;
  }).join(",\n  ");
  const params = batch.flatMap(r => [r.tenantId, r.leadId, r.score, r.tier, r.snapshotDate]);
  await pool.query(
    `INSERT INTO lead_score_history (id, tenant_id, lead_id, score, score_tier, snapshot_date)
     VALUES ${values} ON CONFLICT DO NOTHING`,
    params
  );
}

async function flushBatch(batch) {
  const values = batch.map((r, i) => {
    const base = i * 6;
    return `(gen_random_uuid(), $${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}::risk_level, $${base+6})`;
  }).join(",\n  ");

  const params = batch.flatMap(r => [
    r.tenantId, r.customerId, r.healthScore, r.churnProbability, r.riskLevel, r.snapshotDate,
  ]);

  await pool.query(
    `INSERT INTO customer_score_history
       (id, tenant_id, customer_id, health_score, churn_probability, risk_level, snapshot_date)
     VALUES ${values}
     ON CONFLICT DO NOTHING`,
    params
  );
}

main().catch(e => { console.error("Erro:", e); process.exit(1); });
