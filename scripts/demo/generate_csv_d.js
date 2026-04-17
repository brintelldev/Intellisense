/**
 * generate_csv_d.js
 * Gera CSV D: encoding Latin-1 + delimitador ';' + R$ BR + DD/MM/YYYY
 * Usa os mesmos emails dos 20 primeiros clientes do tenant demo para forçar upsert.
 *
 * Uso: node scripts/demo/generate_csv_d.js
 */
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");

const DB_URL = "postgresql://intellisense:intellisense_dev@localhost:5433/intellisense";
const OUT_PATH = path.join(__dirname, "csv_d_retain_corporativo_latin1.csv");

function fmtBRL(value) {
  // Format as "R$ 12.500,00"
  if (!value && value !== 0) return "R$ 0,00";
  const v = parseFloat(value);
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(value) {
  // Format as DD/MM/YYYY from days offset (today + value days)
  const today = new Date();
  const target = new Date(today.getTime() + (value || 0) * 24 * 60 * 60 * 1000);
  const day = String(target.getDate()).padStart(2, "0");
  const month = String(target.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${target.getFullYear()}`;
}

function fakeZipCode(i) {
  // Generate fake Brazilian CNPJ-like code (just for the demo)
  const n = String(10000000 + i * 987654).padStart(8, "0");
  return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/0001-99`;
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL });

  // Get 20 customers with emails from the demo tenant
  // Use health_score to derive NPS (more reliable than dim_satisfaction after multiple uploads)
  const res = await pool.query(`
    SELECT c.name, c.email, c.segment, c.dim_revenue, c.dim_recency_days,
           c.dim_usage_intensity, c.dim_payment_regularity, c.health_score,
           c.dim_support_volume, c.dim_tenure_days, c.dim_contract_remaining_days
    FROM customers c
    JOIN tenants t ON t.id = c.tenant_id AND t.company_name = 'DCCO Equipamentos'
    WHERE c.email IS NOT NULL AND c.email != ''
    ORDER BY c.dim_revenue DESC NULLS LAST
    LIMIT 20
  `);
  await pool.end();

  const customers = res.rows;
  if (customers.length === 0) {
    console.error("Nenhum cliente com email encontrado. Execute o upload do CSV A primeiro.");
    process.exit(1);
  }

  // CSV D headers (radicalmente diferentes do CSV A)
  const HEADERS = [
    "Razão Social",
    "CNPJ",
    "E-mail Corporativo",
    "Receita Recorrente Mensal",
    "Inatividade (dias)",
    "Score de Engajamento",
    "Índice de Adimplência",
    "Net Promoter Score",
    "Feedback Aberto",
    "Tickets Abertos",
    "Categoria do Ticket",
    "Vigência Contratual (meses)",
    "Data Limite de Contrato",
    "Observações do AM",      // ← coluna sem match (ignorada)
    "Segmento Fiscal",        // ← coluna sem match (ignorada)
  ];

  const FEEDBACK_SAMPLES = [
    "Sistema travou na virada do m\xeas",       // Latin-1 ê
    "Suporte demorou 5 dias para retornar",
    "Excelente atendimento, muito satisfeito",
    "Falta de acompanhamento do gerente de conta",
    "Produto entregue antes do prazo, \xf3timo!", // Latin-1 ó
    "Precisa melhorar o tempo de resposta",
    "Boa rela\xe7\xe3o custo-benef\xeacio",        // Latin-1 çãi
    "Nenhum problema at\xe9 o momento",           // Latin-1 é
    "Interface poderia ser mais intuitiva",
    "Processo de faturamento demorado",
    "Suporte t\xe9cnico muito eficiente",          // Latin-1 é
    "Esperamos uma expans\xe3o dos servi\xe7os",   // Latin-1 ã ç
    "Muito satisfeito com a qualidade",
    "Equipamentos com problemas freq\xfcentes",   // Latin-1 ü
    "Atendimento profissional e \xe1gil",          // Latin-1 á
    "Contrato renovado sem problemas",
    "Sistema estável e confiável",
    "Aguardamos melhoria no suporte",
    "Excelente custo-benef\xeacio",               // Latin-1 í
    "Esperamos upgrades nos equipamentos",
  ];

  const TICKET_CATEGORIES = [
    "Performance", "Suporte lento", "Faturamento", "Onboarding",
    "Performance", "Suporte lento", "T\xe9cnico",  // Latin-1 é
    "Performance", "Faturamento", "Manuten\xe7\xe3o", // Latin-1 çã
    "Performance", "Suporte lento", "Faturamento", "Onboarding",
    "Performance", "T\xe9cnico", "Faturamento",
    "Performance", "Onboarding", "T\xe9cnico",
  ];

  const OBS_AM = [
    "Revisar contrato em maio",
    "Cliente VIP — priorizar atendimento",
    "Aguardando aprova\xe7\xe3o do board",     // Latin-1 ção
    "Proposta de expans\xe3o em andamento",    // Latin-1 ã
    "Contato semanal recomendado",
    "Hist\xf3rico de atrasos — monitorar",    // Latin-1 ó
    "Cliente em fase de decis\xe3o",          // Latin-1 ão
    "Alta satisfa\xe7\xe3o — oportunidade upsell", // Latin-1 çã
    "Renovar em 30 dias",
    "Acompanhar implementa\xe7\xe3o",         // Latin-1 ção
    "Sinaliza interesse em novos m\xf3dulos", // Latin-1 ó
    "Perfil ICP ideal — pr\xeamio",           // Latin-1 ê
    "Negocia\xe7\xe3o em andamento",          // Latin-1 çã
    "Avalia\xe7\xe3o positiva recente",       // Latin-1 ção
    "Aguardar retorno do financeiro",
    "Potencial de churnar em 90 dias",
    "Cliente satisfeito",
    "Precisa de treinamento adicional",
    "Contato mensal suficiente",
    "Bom pagador, f\xeadelo",                 // Latin-1 í
  ];

  const SEG_FISCAL = [
    "Lucro Real", "Lucro Presumido", "Simples Nacional",
    "Lucro Real", "Lucro Real", "Lucro Presumido",
    "Simples Nacional", "Lucro Real", "Lucro Presumido", "Lucro Real",
    "Lucro Real", "Simples Nacional", "Lucro Real", "Lucro Presumido",
    "Lucro Real", "Simples Nacional", "Lucro Real", "Lucro Presumido",
    "Lucro Real", "Simples Nacional",
  ];

  const rows = customers.map((c, i) => {
    // NPS: derive from health_score (0-100) to NPS scale 0-10
    // - Healthy (health > 70): NPS 7-10 (promoter zone)
    // - Medium (40-70): NPS 5-7 (neutral zone)
    // - At-risk (< 40): NPS 0-4 (detractor zone)
    // This ensures clear 0-10 scale detection and realistic distribution
    const health = parseFloat(c.health_score) || 50;
    let nps;
    if (health >= 70) {
      nps = 7 + Math.floor(((health - 70) / 30) * 3.9); // 7-10
    } else if (health >= 40) {
      nps = 5 + Math.floor(((health - 40) / 30) * 2); // 5-6
    } else {
      nps = Math.floor((health / 40) * 4); // 0-4
    }
    nps = Math.min(10, Math.max(0, nps)); // ensure 0-10

    const tenureMonths = Math.round((c.dim_tenure_days ?? 12) / 30);

    return [
      c.name,
      fakeZipCode(i),
      c.email,
      fmtBRL(c.dim_revenue),
      String(c.dim_recency_days ?? 10),
      String(c.dim_usage_intensity ?? 50),
      String(c.dim_payment_regularity ?? 90),
      String(nps),
      FEEDBACK_SAMPLES[i % FEEDBACK_SAMPLES.length],
      String(c.dim_support_volume ?? 0),
      TICKET_CATEGORIES[i % TICKET_CATEGORIES.length],
      String(tenureMonths),
      fmtDate(c.dim_contract_remaining_days ?? 90),
      OBS_AM[i % OBS_AM.length],
      SEG_FISCAL[i % SEG_FISCAL.length],
    ];
  });

  // Build CSV content as a Latin-1 encoded string
  // Use BOM for Latin-1 is not standard, but we'll include a note in the header
  const sep = ";";
  const lines = [HEADERS.join(sep), ...rows.map(r => r.join(sep))];
  const csvContent = lines.join("\r\n") + "\r\n";

  // Encode as Latin-1 (ISO-8859-1)
  const encoded = iconv.encode(csvContent, "latin1");
  fs.writeFileSync(OUT_PATH, encoded);

  console.log(`✓ CSV D gerado: ${OUT_PATH}`);
  console.log(`  Encoding: Latin-1 (ISO-8859-1)`);
  console.log(`  Delimiter: ';'`);
  console.log(`  Linhas: ${rows.length} (+ header)`);
  console.log(`  Colunas: ${HEADERS.length} (13 mapeáveis + 2 ignoradas)`);
  console.log(`  NPS em escala 0-10: ${rows.slice(0,5).map(r=>r[7]).join(', ')} ...`);
  console.log(`  Receitas em formato BR: ${fmtBRL(customers[0]?.dim_revenue)}, ${fmtBRL(customers[1]?.dim_revenue)}, ...`);
  console.log(`  Datas em DD/MM/YYYY: ${fmtDate(customers[0]?.dim_contract_remaining_days)}, ...`);
  console.log(`  Emails para upsert: ${customers.slice(0,3).map(c=>c.email).join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
