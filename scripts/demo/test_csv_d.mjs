/**
 * test_csv_d.mjs
 * Testa o upload end-to-end do CSV D (Latin-1 + ';' + R$ BR + DD/MM/YYYY)
 * Verifica cada camada do Block 1.5:
 *   - Encoding Latin-1 detectado
 *   - Delimiter ';' detectado
 *   - Moeda BR normalizada
 *   - NPS escala 0-10 detectada
 *   - Datas DD/MM/YYYY reconhecidas
 *   - Mapping memory (campos mapeados com memória do tenant)
 *   - Preview interpretado
 *   - Commit: 20 updated / 0 created
 *
 * Uso: node scripts/demo/test_csv_d.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import iconv from "iconv-lite";

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3001";

const CSV_D_PATH = join(__dir, "csv_d_retain_corporativo_latin1.csv");

// Mapping for CSV D (corporate headers → dimensions)
const MAPPING_D = {
  name:                "Razão Social",
  email:               "E-mail Corporativo",
  revenue:             "Receita Recorrente Mensal",
  recencyDays:         "Inatividade (dias)",
  usageIntensity:      "Score de Engajamento",
  paymentRegularity:   "Índice de Adimplência",
  satisfaction:        "Net Promoter Score",
  nps_verbatim:        "Feedback Aberto",
  supportVolume:       "Tickets Abertos",
  tickets_tema:        "Categoria do Ticket",
  tenureDays:          "Vigência Contratual (meses)",
  contractRemainingDays: "Data Limite de Contrato",
  // CNPJ, Observações do AM, Segmento Fiscal → not mapped (triggers "ignored columns" chip)
};

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@dcco.com.br", password: "Demo@2026" }),
  });
  const cookie = res.headers.get("set-cookie");
  const data = await res.json();
  console.log(`✓ Login — ${data.user?.email} | tenant: ${data.tenant?.id?.slice(0, 8)}`);
  return cookie;
}

function parseLatinCSV(buffer) {
  // Decode Latin-1 and parse
  const text = iconv.decode(buffer, "latin1");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const sep = ";";

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

  const headers = parseRow(lines[0]);
  const sampleRows = [];
  for (let i = 1; i < Math.min(lines.length, 4); i++) {
    const vals = parseRow(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    sampleRows.push(row);
  }
  return { headers, sampleRows };
}

async function testSuggestMapping(cookie, headers, sampleRows) {
  const res = await fetch(`${BASE}/api/retain/upload/suggest-mapping`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ headers, sampleRows }),
  });
  const suggestions = await res.json();
  const historical = suggestions.filter(s => s.source === "historical");
  const highConf = suggestions.filter(s => s.confidence === "high" && s.suggestedDimension);
  console.log(`  Mapping memory: ${historical.length} colunas do histórico do tenant | ${highConf.length} high-confidence total`);
  suggestions.forEach(s => {
    const icon = s.source === "historical" ? "📚" : s.confidence === "high" ? "✓" : "?";
    const dim = s.suggestedDimension ?? "(ignored)";
    console.log(`    ${icon} "${s.csvColumn}" → ${dim} (${s.confidence})`);
  });
  return suggestions;
}

async function testPreview(cookie, mapping, sampleRows) {
  const res = await fetch(`${BASE}/api/retain/upload/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ mapping, sampleRows }),
  });
  const data = await res.json();
  if (data.error) { console.error(`  ✗ Preview error: ${data.error}`); return; }

  console.log(`  Scale: ${data.satisfactionScale} | Mapped: ${data.mappedDimensions}/${data.totalDimensions}`);
  console.log(`  Date format: ${data.dateFormatDetected ?? "não detectado"}`);
  if (data.missingDimensions?.length > 0) {
    console.log(`  Missing dimensions: [${data.missingDimensions.join(", ")}]`);
  }
  console.log(`  Preview rows:`);
  (data.previewRows ?? []).forEach((row, i) => {
    console.log(`    [${i+1}] ${row.name} | rev=${row.revenue} | nps=${row.satisfaction} | contract=${row.contractRemainingDays}d`);
  });
  return data;
}

async function uploadCSVD(cookie) {
  const fileBuffer = readFileSync(CSV_D_PATH);

  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: "text/csv" }), "csv_d_retain_corporativo_latin1.csv");
  form.append("mapping", JSON.stringify(MAPPING_D));

  const res = await fetch(`${BASE}/api/retain/uploads`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const data = await res.json();
  if (data.error) {
    console.error(`  ✗ Upload error: ${data.error}`);
    return null;
  }
  return data;
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log("\n════════════════════════════════════════════");
console.log("  IntelliSense — CSV D Test (WOW moment #3)");
console.log("════════════════════════════════════════════\n");

const cookie = await login();
console.log();

// Read CSV D (Latin-1 encoded)
const fileBuffer = readFileSync(CSV_D_PATH);
const { headers, sampleRows } = parseLatinCSV(fileBuffer);
console.log(`CSV D headers (${headers.length}): ${headers.slice(0,5).join(" | ")} ...`);
console.log(`Sample row 1: receita="${sampleRows[0]["Receita Recorrente Mensal"]}" | data="${sampleRows[0]["Data Limite de Contrato"]}" | nps="${sampleRows[0]["Net Promoter Score"]}"`);
console.log();

// 1. Test suggest-mapping (should use memory from CSV A upload)
console.log("--- 1. Suggest-mapping CSV D (com memória do tenant) ---");
await testSuggestMapping(cookie, headers, sampleRows);
console.log();

// 2. Test preview
console.log("--- 2. Preview CSV D (normalização BR) ---");
await testPreview(cookie, MAPPING_D, sampleRows);
console.log();

// 3. Upload
console.log("--- 3. Upload CSV D ---");
const result = await uploadCSVD(cookie);
if (result) {
  console.log(`  ✓ created=${result.rowsCreated} updated=${result.rowsUpdated} skipped=${result.rowsSkipped}`);
  console.log(`  encoding=${result.detectedEncoding} delimiter='${result.detectedDelimiter}' scale=${result.satisfactionScale}`);
  console.log(`  predictions=${result.predictionsGenerated} alerts=${result.alertsGenerated}`);

  // Verify the wow moment
  const isLatin1 = ["latin1", "ISO-8859-1", "iso-8859-1", "latin-1"].includes(result.detectedEncoding ?? "");
  const isWow = result.rowsCreated === 0 && result.rowsUpdated === 20 && isLatin1;
  console.log(`\n  ${isWow ? "🎉 WOW MOMENT VERIFICADO!" : "⚠️  Verificar manualmente"}`);
  if (result.rowsUpdated === 20 && result.rowsCreated === 0) {
    console.log("  → '20 updated, 0 created' — Mesmo base detectada!");
  }
  if (isLatin1) {
    console.log(`  → Encoding ${result.detectedEncoding} (Latin-1) detectado e normalizado`);
  }
  if (result.detectedDelimiter === ";") {
    console.log("  → Delimitador ';' detectado automaticamente");
  }
  if (result.satisfactionScale) {
    console.log(`  → NPS scale detectada: ${result.satisfactionScale}`);
  }
}

console.log("\n════════════════════════════════════════════\n");
