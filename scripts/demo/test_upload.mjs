/**
 * Demo upload test script — uses Node.js native fetch + FormData
 * to properly test the full upload pipeline with correct UTF-8 encoding.
 *
 * Usage: node scripts/demo/test_upload.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3001";

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@dcco.com.br", password: "Demo@2026" }),
    credentials: "include",
  });
  const cookie = res.headers.get("set-cookie");
  const data = await res.json();
  console.log("✓ Login —", data.user?.email, "| tenant:", data.tenant?.id?.slice(0, 8));
  return cookie;
}

async function uploadCSV(cookie, csvPath, mapping, label) {
  const fileBuffer = readFileSync(csvPath);
  const filename = csvPath.split(/[\\/]/).pop();

  const form = new FormData();
  form.append("mapping", JSON.stringify(mapping));
  form.append("file", new Blob([fileBuffer], { type: "text/csv" }), filename);

  const res = await fetch(`${BASE}/api/retain/uploads`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const data = await res.json();
  if (data.error) {
    console.error(`✗ ${label}:`, data.error);
    return null;
  }
  console.log(`✓ ${label}: created=${data.rowsCreated} updated=${data.rowsUpdated} skipped=${data.rowsSkipped}`);
  console.log(`  predictions=${data.predictionsGenerated} alerts=${data.alertsGenerated}`);
  console.log(`  encoding=${data.detectedEncoding} delimiter='${data.detectedDelimiter}' scale=${data.satisfactionScale}`);
  return data;
}

async function testSuggestMapping(cookie, headers, sampleRows, label) {
  const res = await fetch(`${BASE}/api/retain/upload/suggest-mapping`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ headers, sampleRows }),
  });
  const suggestions = await res.json();
  const highConf = suggestions.filter(s => s.confidence === "high" && s.suggestedDimension);
  const historical = suggestions.filter(s => s.source === "historical");
  console.log(`✓ ${label}: ${highConf.length} high-confidence | ${historical.length} from memory`);
  suggestions.forEach(s => {
    const icon = s.source === "historical" ? "📚" : s.confidence === "high" ? "✓" : "?";
    console.log(`  ${icon} "${s.csvColumn}" → ${s.suggestedDimension ?? "null"} (${s.confidence})`);
  });
  return suggestions;
}

async function testPreview(cookie, mapping, sampleRows, label) {
  const res = await fetch(`${BASE}/api/retain/upload/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ mapping, sampleRows }),
  });
  const data = await res.json();
  if (data.error) { console.error(`✗ ${label}:`, data.error); return; }
  console.log(`✓ ${label}: scale=${data.satisfactionScale} mapped=${data.mappedDimensions}/${data.totalDimensions}`);
  console.log(`  date=${data.dateFormatDetected} missing=[${data.missingDimensions.join(",")}]`);
  data.previewRows?.forEach((row, i) =>
    console.log(`  row${i+1}: ${row.name} | rev=${row.revenue} | nps=${row.satisfaction} | contract=${row.contractRemainingDays}`)
  );
  return data;
}

async function checkVoc(cookie) {
  const res = await fetch(`${BASE}/api/retain/voc`, { headers: { cookie } });
  const data = await res.json();
  console.log(`✓ VOC: NPS=${data.nps} total=${data.npsDistribution?.total} P=${data.npsDistribution?.promoters} N=${data.npsDistribution?.neutrals} D=${data.npsDistribution?.detractors}`);
  console.log(`  Receita em risco: R$ ${data.totalDetractorRevenue?.toLocaleString("pt-BR")}`);
  if (data.ticketThemes?.length) console.log(`  Themes: ${data.ticketThemes.map(t => `${t.theme}:${t.count}`).join(", ")}`);
  if (data.detractorsByRevenue?.length) {
    console.log(`  Top detractor: ${data.detractorsByRevenue[0]?.name} R$${data.detractorsByRevenue[0]?.revenue} sat=${data.detractorsByRevenue[0]?.satisfaction}`);
  }
}

async function readCSVSample(csvPath) {
  const text = readFileSync(csvPath, "utf-8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  // Detect delimiter from first line
  const firstLine = lines[0];
  const sep = firstLine.includes(";") ? ";" : ",";
  // Handle quoted fields
  const parseRow = (line) => {
    const result = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; continue; }
      if (line[i] === sep && !inQ) { result.push(cur.trim()); cur = ""; continue; }
      cur += line[i];
    }
    result.push(cur.trim());
    return result;
  };
  const headers = parseRow(firstLine);
  const sampleRows = [];
  for (let i = 1; i < Math.min(lines.length, 4); i++) {
    const vals = parseRow(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    sampleRows.push(row);
  }
  return { headers, sampleRows };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const CSV_A = join(__dir, "csv_a_retain_coloquial.csv");
const CSV_C = join(__dir, "csv_c_retain_corporativo.csv");

console.log("\n════════════════════════════════════════════");
console.log("  IntelliSense — Demo Upload Test");
console.log("════════════════════════════════════════════\n");

const cookie = await login();
console.log();

// ── Mapping for CSV A (coloquial format) ──────────────────────────────────
const MAPPING_A = {
  id: "Código",
  name: "Cliente",
  email: "Email",
  revenue: "Valor mensal",
  recencyDays: "Dias sem contato",
  usageIntensity: "Frequência de uso (%)",
  paymentRegularity: "Adimplência (%)",
  satisfaction: "Satisfação NPS",
  supportVolume: "Chamados abertos",
  tenureDays: "Meses de contrato",
  contractRemainingDays: "Contrato termina em",
};

// ── Test suggest-mapping for CSV A (before upload, no memory) ─────────────
console.log("--- 1. Suggest-mapping CSV A (sem memória) ---");
const { headers: headersA, sampleRows: samplesA } = await readCSVSample(CSV_A);
await testSuggestMapping(cookie, headersA, samplesA, "CSV A suggest");
console.log();

// ── Test preview ──────────────────────────────────────────────────────────
console.log("--- 2. Preview CSV A ---");
await testPreview(cookie, MAPPING_A, samplesA, "CSV A preview");
console.log();

// ── Upload CSV A ──────────────────────────────────────────────────────────
console.log("--- 3. Upload CSV A (80 clientes) ---");
await uploadCSV(cookie, CSV_A, MAPPING_A, "CSV A upload");
console.log();

// ── Check VOC after CSV A ─────────────────────────────────────────────────
console.log("--- 4. Voz do Cliente após CSV A ---");
await checkVoc(cookie);
console.log();

// ── Test mapping memory: suggest for CSV C (same tenant, different headers) ─
console.log("--- 5. Suggest-mapping CSV C (com memória do tenant) ---");
const { headers: headersC, sampleRows: samplesC } = await readCSVSample(CSV_C);
await testSuggestMapping(cookie, headersC, samplesC, "CSV C suggest (memory)");
console.log();

// ── Upload CSV C (corporate format, semicolon, same 20 customers) ─────────
console.log("--- 6. Upload CSV C (formato corporativo, Latin-1 emulado, ';') ---");
const MAPPING_C = {
  id: "Código",          // no — CSV C uses "Razão Social" as identifier (no code col)
  name: "Razão Social",
  email: "E-mail corporativo",
  revenue: "Receita Recorrente Mensal",
  recencyDays: "Inatividade (dias)",
  usageIntensity: "Score de Engajamento",
  paymentRegularity: "Índice de Adimplência",
  satisfaction: "Net Promoter Score",
  supportVolume: "Tickets Abertos",
  tenureDays: "Vigência Contratual (meses)",
  contractRemainingDays: "Data Limite de Contrato",
};
await uploadCSV(cookie, CSV_C, MAPPING_C, "CSV C upload");
console.log();

// ── Final VOC check ───────────────────────────────────────────────────────
console.log("--- 7. Voz do Cliente após CSV C (upsert) ---");
await checkVoc(cookie);

console.log("\n════════════════════════════════════════════");
console.log("  Smoke test completo!");
console.log("════════════════════════════════════════════\n");
