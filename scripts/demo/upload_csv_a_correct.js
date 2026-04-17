#!/usr/bin/env node
/**
 * Upload CSV A with correct mapping keys (using native FormData).
 * Use this script if you ever need to re-seed CSV A from scratch.
 *
 * Mapping keys follow the server's handler (bare keys, not dim-prefixed).
 * The server also accepts dim-prefixed keys and normalizes them.
 */
const fs = require("fs");
const path = require("path");

const API = "http://localhost:3001";
const CSV_PATH = path.join(__dirname, "csv_a_retain_coloquial.csv");

// Bare keys (what the server's get() helper uses directly)
const MAPPING = {
  id: "Código",
  name: "Cliente",
  email: "Email",
  segment: "Segmento",
  revenue: "Valor mensal",
  recencyDays: "Dias sem contato",
  usageIntensity: "Frequência de uso (%)",
  paymentRegularity: "Adimplência (%)",
  satisfaction: "Satisfação NPS",
  nps_verbatim: "Comentário NPS",
  supportVolume: "Chamados abertos",
  tickets_tema: "Tema do chamado",
  tenureDays: "Meses de contrato",
  contractRemainingDays: "Contrato termina em",
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
  console.log("2. Uploading CSV A...");
  const fileBuffer = fs.readFileSync(CSV_PATH);
  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: "text/csv" }), "csv_a_retain_coloquial.csv");
  form.append("mapping", JSON.stringify(MAPPING));

  const uploadRes = await fetch(`${API}/api/retain/uploads`, {
    method: "POST",
    headers: { Cookie: cookies },
    body: form,
  });

  const text = await uploadRes.text();
  let data;
  try { data = JSON.parse(text); } catch { console.error("Non-JSON:", text.slice(0, 500)); process.exit(1); }

  if (!uploadRes.ok) {
    console.error("Upload failed:", uploadRes.status, JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log("   Result:", JSON.stringify({
    status: data.status, created: data.rowsCreated, updated: data.rowsUpdated,
    encoding: data.detectedEncoding, delimiter: data.detectedDelimiter,
    satisfactionScale: data.satisfactionScale, errors: data.errors?.length ?? 0,
  }, null, 2));

  // 3. Verify DB
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: "postgresql://intellisense:intellisense_dev@localhost:5433/intellisense" });
  const r = await pool.query(`
    SELECT COUNT(*) total, COUNT(dim_satisfaction) with_sat, AVG(health_score)::numeric(5,1) avg_health,
    COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) critical,
    COUNT(CASE WHEN risk_level = 'high' THEN 1 END) high,
    COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) medium,
    COUNT(CASE WHEN risk_level = 'low' THEN 1 END) low
    FROM customers WHERE customer_code LIKE 'RET-%'
  `);
  console.log("\n3. DB verification:", JSON.stringify(r.rows[0], null, 2));
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
