#!/usr/bin/env node
/**
 * Generates CSV C: "formato corporativo + armadilhas de formato"
 * - Delimiter: semicolon (;)
 * - Encoding: Latin-1 (ISO-8859-1)
 * - Revenue: R$ 22.000,00 (BR format)
 * - Dates: DD/MM/YYYY
 * - Headers: completely different from CSV A
 * - Same 20 customers by email (→ upsert demo: 20 updated, 0 created)
 * - Two unmapped columns: "Observações do AM", "Segmento Fiscal"
 */
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");

// Helper: format number as BR currency
function brCurrency(n) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Data: top 20 customers by revenue from DB (copied from query results)
const customers = [
  { code:"RET-017", name:"Mineração Vale do Rio", email:"pedro.vale@mineracaovrio.com.br", setor:"Extração Mineral", rev:22000, recency:5, usage:91, payment:99, nps:10, feedback:"Plataforma incrível. Ajuda muito na tomada de decisão", tickets:0, tema:"", tenure:48, contract:"03/03/2027" },
  { code:"RET-071", name:"Petroquímica Refino Norte", email:"ana.barros@refinonorte.com.br", setor:"Petroquímica", rev:20500, recency:55, usage:18, payment:68, nps:3, feedback:"suporte demorou 5 dias para responder e perdemos um cliente por isso", tickets:10, tema:"Suporte técnico", tenure:24, contract:"07/03/2026" },
  { code:"RET-054", name:"Exportações Grão Nacional", email:"isabel.menezes@graonacional.com.br", setor:"Agronegócio", rev:19500, recency:6, usage:90, payment:100, nps:10, feedback:"Plataforma indispensável. Resultados acima do esperado", tickets:0, tema:"", tenure:48, contract:"03/06/2027" },
  { code:"RET-009", name:"Agro Cerrado Exportações", email:"thiago.oliveira@agrocerrado.com.br", setor:"Agronegócio", rev:18700, recency:7, usage:90, payment:98, nps:10, feedback:"Excelente ferramenta para gestão de carteira", tickets:1, tema:"Capacitação", tenure:36, contract:"22/11/2026" },
  { code:"RET-075", name:"Geração de Energia Renov", email:"adriano.queiroz@renovenerg.com.br", setor:"Energia", rev:18300, recency:68, usage:10, payment:66, nps:3, feedback:"suporte demorou 5 dias para responder. Situação insustentável", tickets:9, tema:"Suporte técnico", tenure:24, contract:"01/07/2026" },
  { code:"RET-026", name:"Equipamentos Pesados NS", email:"juliana.ribeiro@nsequipamentos.com.br", setor:"Metalurgia", rev:17300, recency:6, usage:87, payment:99, nps:10, feedback:"Excelente! Melhor ferramenta que já usamos", tickets:0, tema:"", tenure:36, contract:"01/12/2026" },
  { code:"RET-035", name:"Transportadora Rápida São Paulo", email:"maurício.fernandes@rapidasp.com.br", setor:"Logística", rev:16500, recency:7, usage:88, payment:99, nps:10, feedback:"Excelente ferramenta de gestão. Muito satisfeitos!", tickets:0, tema:"", tenure:48, contract:"20/06/2026" },
  { code:"RET-049", name:"Distribuição Farmacêutica Faro", email:"fábio.cunha@farofarma.com.br", setor:"Farmácia", rev:16200, recency:7, usage:87, payment:99, nps:10, feedback:"Plataforma de excelência. Equipe fantástica", tickets:0, tema:"", tenure:36, contract:"14/12/2026" },
  { code:"RET-005", name:"Logística Expresso Verde", email:"roberto.santos@expressoverde.com.br", setor:"Logística", rev:15000, recency:6, usage:88, payment:99, nps:10, feedback:"Plataforma top de linha. Melhorou muito nosso controle", tickets:0, tema:"", tenure:6, contract:"14/05/2026" },
  { code:"RET-046", name:"Telecomunicações Conectar", email:"lúcia.vieira@conectartelco.com.br", setor:"Telecom", rev:14900, recency:5, usage:89, payment:100, nps:10, feedback:"Sistema robusto. A melhor decisão que tomamos", tickets:0, tema:"", tenure:48, contract:"27/08/2026" },
  { code:"RET-073", name:"Siderúrgica Aços do Sul", email:"débora.matos@acosdosul.com.br", setor:"Siderurgia", rev:14800, recency:48, usage:22, payment:70, nps:4, feedback:"não temos acompanhamento do nosso AM há mais de 2 meses", tickets:12, tema:"Acompanhamento comercial", tenure:36, contract:"30/05/2026" },
  { code:"RET-016", name:"Química Nordeste Industrial", email:"claudia.teixeira@quimicanordeste.com.br", setor:"Química", rev:14500, recency:8, usage:86, payment:100, nps:9, feedback:"Ótimo investimento. Retorno visível em 3 meses", tickets:0, tema:"", tenure:36, contract:"17/10/2026" },
  { code:"RET-032", name:"Automação Predial Smart", email:"celeste.araújo@automacaosmart.com.br", setor:"Construção", rev:13700, recency:8, usage:84, payment:100, nps:10, feedback:"Sistema muito bom. Integração perfeita com nosso ERP", tickets:0, tema:"", tenure:36, contract:"30/01/2027" },
  { code:"RET-011", name:"Solução IT Partners", email:"gustavo.nunes@solutionit.com.br", setor:"Tecnologia", rev:13200, recency:6, usage:84, payment:100, nps:10, feedback:"Plataforma robusta e time de CS excepcional", tickets:0, tema:"", tenure:30, contract:"18/09/2026" },
  { code:"RET-043", name:"Metalúrgica Estrela do Norte", email:"paulo.rezende@estrelametais.com.br", setor:"Metalurgia", rev:12500, recency:6, usage:85, payment:99, nps:10, feedback:"Ferramenta excelente para nosso setor", tickets:0, tema:"", tenure:36, contract:"18/10/2026" },
  { code:"RET-002", name:"Transportes Rota Sul S.A.", email:"fernanda.costa@rotasul.com.br", setor:"Logística", rev:12000, recency:5, usage:85, payment:100, nps:10, feedback:"Superou todas as expectativas. Recomendo muito!", tickets:1, tema:"Capacitação", tenure:24, contract:"30/09/2026" },
  { code:"RET-020", name:"Farmacêutica Saúde Plena", email:"tatiana.gomes@saudeplena.com.br", setor:"Farmácia", rev:11800, recency:7, usage:83, payment:98, nps:9, feedback:"Muito contentes com o resultado. Renovaremos com certeza", tickets:0, tema:"", tenure:36, contract:"20/02/2027" },
  { code:"RET-077", name:"Insumos Agrícolas Plantio Certo", email:"celso.guerra@plantiocerto.com.br", setor:"Agronegócio", rev:11600, recency:44, usage:20, payment:68, nps:2, feedback:"não temos acompanhamento do nosso AM. Contrato vence em breve", tickets:7, tema:"Acompanhamento comercial", tenure:36, contract:"14/04/2026" },
  { code:"RET-007", name:"Distribuidora Nordeste Atacado", email:"marcos.ferreira@nordesteatacado.com.br", setor:"Distribuição", rev:11500, recency:9, usage:82, payment:100, nps:10, feedback:"Recomendo a todas as empresas do setor", tickets:0, tema:"", tenure:48, contract:"01/04/2028" },
  { code:"RET-038", name:"Consultoria Empresarial Apex", email:"tatiane.neves@apexconsultoria.com.br", setor:"Consultoria", rev:11200, recency:8, usage:83, payment:98, nps:10, feedback:"Solução completa. Atendemos melhor nossos clientes", tickets:0, tema:"", tenure:36, contract:"07/11/2026" },
];

// Corporate headers (radically different from CSV A)
const header = [
  "Código Interno",
  "Razão Social",
  "E-mail corporativo",
  "Setor de Atuação",
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
  "Observações do AM",      // ← unmapped column 1
  "Segmento Fiscal",        // ← unmapped column 2
].join(";");

const rows = customers.map((c) => {
  const fields = [
    c.code,
    c.name,
    c.email,
    c.setor,
    brCurrency(c.rev),
    c.recency,
    c.usage,
    c.payment,
    c.nps,
    c.feedback,
    c.tickets,
    c.tema,
    c.tenure,
    c.contract,
    "",  // Observações do AM — empty
    c.setor.toUpperCase().slice(0, 4),  // Segmento Fiscal — random short code (unrelated)
  ];
  // Escape fields that contain semicolons or quotes
  return fields.map((f) => {
    const s = String(f ?? "");
    if (s.includes(";") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(";");
});

const csvContent = [header, ...rows].join("\n");

// Encode as Latin-1
const latin1Buffer = iconv.encode(csvContent, "ISO-8859-1");

const outPath = path.join(__dirname, "csv_c_retain_corporativo.csv");
fs.writeFileSync(outPath, latin1Buffer);
console.log(`Written ${latin1Buffer.length} bytes (Latin-1) to ${outPath}`);
console.log(`Rows: ${rows.length} customers`);
console.log(`First row: ${rows[0]}`);
