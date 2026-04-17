#!/usr/bin/env node
/**
 * Upload CSV C (Latin-1, semicolon, BR currency, corporate headers)
 * Uses native Node.js 22 fetch + FormData (avoids form-data npm package issues).
 */
const fs = require("fs");
const path = require("path");

const API = "http://localhost:3001";
const CSV_PATH = path.join(__dirname, "csv_c_retain_corporativo.csv");

// Mapping using dim-prefixed keys (as ColumnMapper would return them).
// The upload handler's normalization strips "dim" prefix and maps customerCode → id.
const MAPPING = {
  customerCode: "Código Interno",
  name: "Razão Social",
  email: "E-mail corporativo",
  segment: "Setor de Atuação",
  dimRevenue: "Receita Recorrente Mensal",
  dimRecencyDays: "Inatividade (dias)",
  dimUsageIntensity: "Score de Engajamento",
  dimPaymentRegularity: "Índice de Adimplência",
  dimSatisfaction: "Net Promoter Score",
  nps_verbatim: "Feedback Aberto",
  dimSupportVolume: "Tickets Abertos",
  tickets_tema: "Categoria do Ticket",
  dimTenureDays: "Vigência Contratual (meses)",
  dimContractRemainingDays: "Data Limite de Contrato",
};

async function main() {
  // 1. Login
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@dcco.com.br", password: "Demo@2026" }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
  const cookies = loginRes.headers.get("set-cookie");
  console.log("1. Logged in.");

  // 2. Upload using native FormData + Blob
  console.log("2. Uploading CSV C (Latin-1, semicolons, BR currency)...");
  const fileBuffer = fs.readFileSync(CSV_PATH);
  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: "text/csv" }), "csv_c_retain_corporativo.csv");
  form.append("mapping", JSON.stringify(MAPPING));

  const uploadRes = await fetch(`${API}/api/retain/uploads`, {
    method: "POST",
    headers: { Cookie: cookies },
    body: form,
  });

  const text = await uploadRes.text();
  let data;
  try { data = JSON.parse(text); } catch { console.error("Non-JSON response:", text.slice(0, 500)); process.exit(1); }

  if (!uploadRes.ok) {
    console.error("Upload failed:", uploadRes.status, JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log("   Upload result:", JSON.stringify({
    status: data.status,
    created: data.rowsCreated,
    updated: data.rowsUpdated,
    skipped: data.rowsSkipped,
    encoding: data.detectedEncoding,
    delimiter: data.detectedDelimiter,
    satisfactionScale: data.satisfactionScale,
    errors: data.errors?.length ?? 0,
  }, null, 2));

  // 3. Verify DB
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: "postgresql://intellisense:intellisense_dev@localhost:5433/intellisense" });

  const r1 = await pool.query(`
    SELECT name, dim_satisfaction, dim_revenue, dim_usage_intensity, dim_payment_regularity, health_score, risk_level, segment
    FROM customers WHERE email IN ('ana.barros@refinonorte.com.br', 'pedro.vale@mineracaovrio.com.br', 'débora.matos@acosdosul.com.br')
    ORDER BY dim_revenue DESC
  `);
  console.log("\n3. Spot-check 3 customers:");
  r1.rows.forEach(r => console.log(`   ${r.name}: sat=${r.dim_satisfaction}, rev=${r.dim_revenue}, usage=${r.dim_usage_intensity}, payment=${r.dim_payment_regularity}, health=${r.health_score}, segment=${r.segment}`));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
