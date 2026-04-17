# Plano de Implementação — Demo Sexta (2026-04-17)

> Companion técnico do plano estratégico em `C:\Users\caiol\.claude\plans\prancy-moseying-catmull.md`. Este documento quebra cada bloco em passos executáveis, arquivos afetados, snippets de código e critérios de aceitação.

**Timeline:** Quarta 2026-04-15 (Dia 1) + Quinta 2026-04-16 (Dia 2) → Demo Sexta 2026-04-17

**Convenções:**
- `[BACKEND]` = arquivo em `server/src/`
- `[FRONT]` = arquivo em `client/src/`
- `[SHARED]` = arquivo em `shared/`
- ✅ = critério de aceitação obrigatório
- ⚠️ = risco conhecido / rollback

---

## Pré-voo (5 min)

Antes de começar qualquer bloco, garantir ambiente:

```bash
cd "E:/Users/caiol/Documents/Projetos/IntelliSense"

# 1. Confirmar que o docker-compose sobe o Postgres
docker-compose up -d db

# 2. Aplicar schema
npm run db:push

# 3. Iniciar server + client em background
npm run dev   # roda em localhost:3001 (server) e 5173 (client)
```

✅ `curl http://localhost:3001/api/health` retorna OK
✅ Abrir `http://localhost:5173` no browser mostra tela de login

---

## Bloco 1 — Smoke test honesto do pipeline (30min–1h)

**Objetivo:** Exercitar o fluxo completo com o seed existente (`/api/seed/dcco`) antes de mexer em qualquer código. Catalogar todos os bugs visíveis.

### 1.1 Rodar seed DCCO
```bash
curl -X POST http://localhost:3001/api/seed/dcco
```
✅ Retorna `{ ok: true, tenantId, customers: 20, ... }` sem erro 500

### 1.2 Login e tour manual
Login: `demo@dcco.com.br` / `Demo@2026`

Percorrer na ordem, anotando qualquer feiúra:

| Rota | O que verificar |
|---|---|
| `/` (Lifecycle) | KPIs não zerados, gráficos renderizam |
| `/retain` | Health gauge, risk distribution, at-risk list, renovações |
| `/retain/predictions` | Lista de 20 clientes com SHAP no drawer |
| `/retain/revenue` | MRR waterfall, NRR/GRR |
| `/retain/root-causes` | Causas agregadas |
| `/retain/roi` | Sliders funcionam |
| `/retain/customers` | Lista + filtros |
| `/retain/upload` | Upload wizard abre |
| `/obtain` | KPIs de aquisição |
| `/obtain/leads` | Lista de leads |
| `/obtain/icp` | Clusters radar |
| `/obtain/cac-ltv` | Matrix |
| `/obtain/funnel` | Funnel stages |
| `/settings` | Scoring Config tab presente |

### 1.3 Catalogar bugs
Criar arquivo `docs/DEMO_SEXTA_BUGS.md` com cada bug no formato:
```
- [ ] [CRIT/MAJ/MIN] página: descrição breve | arquivo suspeito
```

⚠️ **Stop-the-line:** Qualquer bug `CRIT` vira prioridade imediata antes do Bloco 1.5.

---

## Bloco 1.5 — Endurecer a cadeia de confiança (5–7h)

### Bloco 1.5.a — Parsing bruto robusto (1h)

**Objetivo:** Aceitar Latin-1, `;`, datas BR/ISO, milhar com ponto, moeda BR.

**Arquivos afetados:**
- [BACKEND] `server/src/routes/retain/index.ts` (linhas 340–503 — função POST /uploads)
- [BACKEND] `server/src/routes/obtain/index.ts` (rota similar de upload)
- [BACKEND] novo: `server/src/lib/csv-reader.ts`

#### Passo 1: Instalar `chardet` (auto-detect encoding)
```bash
cd "E:/Users/caiol/Documents/Projetos/IntelliSense"
npm install chardet iconv-lite
```

#### Passo 2: Criar util `csv-reader.ts`
```typescript
// server/src/lib/csv-reader.ts
import fs from "fs";
import chardet from "chardet";
import iconv from "iconv-lite";
import Papa from "papaparse";

export interface CsvReadResult<T = Record<string, string>> {
  rows: T[];
  headers: string[];
  detectedEncoding: string;
  detectedDelimiter: string;
  errors: Papa.ParseError[];
}

export function readCsvFile<T = Record<string, string>>(filePath: string): CsvReadResult<T> {
  const buffer = fs.readFileSync(filePath);

  // Detect encoding (UTF-8, Latin-1, Windows-1252)
  const detected = chardet.detect(buffer) || "UTF-8";
  const normalizedEncoding =
    detected.toUpperCase().includes("ISO-8859") || detected.toUpperCase().includes("WINDOWS-1252")
      ? "latin1"
      : "utf8";

  const csvText = iconv.decode(buffer, normalizedEncoding);

  // Parse with auto delimiter
  const parsed = Papa.parse<T>(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: "", // auto-detect comma vs semicolon vs tab
    transformHeader: (h) => h.trim(),
  });

  return {
    rows: parsed.data,
    headers: parsed.meta.fields ?? [],
    detectedEncoding: normalizedEncoding,
    detectedDelimiter: parsed.meta.delimiter ?? ",",
    errors: parsed.errors,
  };
}
```

#### Passo 3: Substituir leitura no endpoint de upload
Em `server/src/routes/retain/index.ts` linhas 361–366:

```typescript
// ANTES:
const csvText = fs.readFileSync(file.path, "utf-8");
const parsed = Papa.parse<Record<string, string>>(csvText, { ... });

// DEPOIS:
import { readCsvFile } from "../../lib/csv-reader.js";
// ...
const csvResult = readCsvFile(file.path);
const parsed = { data: csvResult.rows, errors: csvResult.errors };
```

Guardar `detectedEncoding` e `detectedDelimiter` para o retorno JSON e para logs.

#### Passo 4: Testar com arquivo Latin-1 + `;`
```bash
# Criar CSV de teste em Latin-1
printf "Razão Social;E-mail;Receita\nAção SA;teste@x.com;1234,56" | iconv -f UTF-8 -t ISO-8859-1 > /tmp/test-latin1.csv

# Upload via curl (precisa estar logado — ver seed user)
```

✅ Parser retorna 1 linha com `Razão Social: "Ação SA"` (com acentos corretos)
✅ `detectedDelimiter` = `;`
✅ `detectedEncoding` = `latin1`

⚠️ **Rollback:** se `chardet` der problema no Windows, cair para `iconv-lite.decode(buffer, "utf8")` e tentar `"latin1"` como fallback se o UTF-8 produzir caracteres inválidos (heurística: count de `�`).

---

### Bloco 1.5.b — Range detection e normalização de valores (2h)

**Objetivo:** NPS em qualquer escala (0–5/0–10/0–100) vira 0–100 internamente. Moeda BR `"R$ 1.234,56"` vira `1234.56`. Datas BR `"15/04/2026"` viram Date válida.

**Arquivos afetados:**
- [BACKEND] novo: `server/src/lib/value-normalizer.ts`
- [BACKEND] `server/src/routes/retain/index.ts` (usar os novos helpers no lugar de `toFloat`/`toInt`)

#### Passo 1: Criar util `value-normalizer.ts`
```typescript
// server/src/lib/value-normalizer.ts

export type ScaleDetection = "likert-5" | "score-10" | "percent-100" | "raw" | null;

export interface NumericNormalization {
  value: number | null;
  original: string;
  detectedFormat: "br" | "us" | "plain" | null;
  hadCurrency: boolean;
}

/**
 * Parse number accepting BR ("1.234,56" → 1234.56), US ("1,234.56" → 1234.56),
 * plain ("1234.56"), and currency prefixes ("R$ 1.234,56").
 */
export function parseNumber(raw: string | undefined | null): NumericNormalization {
  if (raw == null) return { value: null, original: "", detectedFormat: null, hadCurrency: false };
  const original = String(raw);
  let s = original.trim();
  if (s === "") return { value: null, original, detectedFormat: null, hadCurrency: false };

  const hadCurrency = /R\$|USD|\$|€|£/.test(s);
  s = s.replace(/R\$|USD|\$|€|£|\s/g, "");

  // Detect BR vs US by position of last comma/dot
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let detectedFormat: "br" | "us" | "plain" | null = null;

  if (lastComma === -1 && lastDot === -1) {
    detectedFormat = "plain";
  } else if (lastComma > lastDot) {
    // BR: comma is decimal, dot is thousands
    detectedFormat = "br";
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // US: dot is decimal, comma is thousands
    detectedFormat = "us";
    s = s.replace(/,/g, "");
  }

  const n = parseFloat(s);
  if (isNaN(n)) return { value: null, original, detectedFormat, hadCurrency };
  return { value: n, original, detectedFormat, hadCurrency };
}

/**
 * Detect scale of a numeric column by inspecting max value.
 * Used for NPS/satisfaction/score columns.
 */
export function detectScale(values: Array<number | null>): ScaleDetection {
  const valid = values.filter((v): v is number => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  const max = Math.max(...valid);
  if (max <= 5.5) return "likert-5";
  if (max <= 10.5) return "score-10";
  if (max <= 100) return "percent-100";
  return "raw";
}

/**
 * Normalize a value from its detected scale to 0-100.
 */
export function normalizeToHundred(value: number, scale: ScaleDetection): number {
  if (scale === "likert-5") return Math.round((value / 5) * 100);
  if (scale === "score-10") return Math.round((value / 10) * 100);
  if (scale === "percent-100") return Math.round(value);
  return Math.round(value);
}

/**
 * Parse date accepting DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY, and Excel serial.
 */
export function parseDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s === "") return null;

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // BR: DD/MM/YYYY
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (brMatch) {
    const [, dd, mm, yy] = brMatch;
    const year = yy.length === 2 ? 2000 + parseInt(yy, 10) : parseInt(yy, 10);
    const d = new Date(year, parseInt(mm, 10) - 1, parseInt(dd, 10));
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback to Date constructor
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parse boolean accepting sim/não, yes/no, true/false, 1/0.
 */
export function parseBoolean(raw: string | undefined | null): boolean | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (["sim", "s", "yes", "y", "true", "1", "verdadeiro"].includes(s)) return true;
  if (["não", "nao", "n", "no", "false", "0", "falso"].includes(s)) return false;
  return null;
}
```

#### Passo 2: Usar helpers no upload endpoint
Em `server/src/routes/retain/index.ts` linhas 380–384, substituir:

```typescript
// ANTES:
const toFloat = (v: string | undefined) => {
  if (!v) return null;
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? null : n;
};

// DEPOIS:
import { parseNumber, detectScale, normalizeToHundred, parseDate } from "../../lib/value-normalizer.js";

const toFloat = (v: string | undefined) => parseNumber(v).value;
```

#### Passo 3: Detectar escala de `dimSatisfaction` antes de inserir
Imediatamente antes do loop de linhas (linha ~407):

```typescript
// Detect satisfaction scale from all rows upfront
const satisfactionCol = mapping["dimSatisfaction"];
let satisfactionScale: ScaleDetection = "percent-100";
if (satisfactionCol) {
  const allValues = parsed.data
    .map((row) => parseNumber(row[satisfactionCol]).value);
  satisfactionScale = detectScale(allValues);
}
```

Depois no loop, ao setar `dimSatisfaction`:

```typescript
dimSatisfaction: (() => {
  const raw = parseNumber(get(row, "dimSatisfaction")).value;
  if (raw == null) return null;
  return normalizeToHundred(raw, satisfactionScale);
})(),
```

#### Passo 4: Retornar metadata de normalização no JSON de resposta
Em `res.status(201).json({ ... })` (linha 485), adicionar:

```typescript
normalizationInfo: {
  encoding: csvResult.detectedEncoding,
  delimiter: csvResult.detectedDelimiter,
  satisfactionScale,
  detectedCurrencyFormat: "br" | "us" | "plain", // do parseNumber
},
```

#### Passo 5: Testes unitários mínimos (30min)
Criar `server/src/lib/__tests__/value-normalizer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseNumber, detectScale, normalizeToHundred, parseDate, parseBoolean } from "../value-normalizer";

describe("parseNumber", () => {
  it("parses BR format", () => {
    expect(parseNumber("R$ 1.234,56").value).toBe(1234.56);
    expect(parseNumber("1.234,56").detectedFormat).toBe("br");
  });
  it("parses US format", () => {
    expect(parseNumber("$1,234.56").value).toBe(1234.56);
    expect(parseNumber("1,234.56").detectedFormat).toBe("us");
  });
  it("parses plain", () => {
    expect(parseNumber("1234.56").value).toBe(1234.56);
    expect(parseNumber("7").value).toBe(7);
  });
  it("handles null/empty", () => {
    expect(parseNumber("").value).toBe(null);
    expect(parseNumber(null).value).toBe(null);
  });
});

describe("detectScale", () => {
  it("detects likert-5", () => {
    expect(detectScale([1, 2, 3, 4, 5])).toBe("likert-5");
  });
  it("detects score-10 (NPS)", () => {
    expect(detectScale([0, 3, 7, 10])).toBe("score-10");
  });
  it("detects percent-100", () => {
    expect(detectScale([20, 50, 80, 100])).toBe("percent-100");
  });
});

describe("normalizeToHundred", () => {
  it("scales likert-5 to 100", () => {
    expect(normalizeToHundred(4, "likert-5")).toBe(80);
  });
  it("scales NPS 7 to 70", () => {
    expect(normalizeToHundred(7, "score-10")).toBe(70);
  });
});

describe("parseDate", () => {
  it("parses DD/MM/YYYY", () => {
    expect(parseDate("15/04/2026")?.getFullYear()).toBe(2026);
  });
  it("parses ISO", () => {
    expect(parseDate("2026-04-15")?.getFullYear()).toBe(2026);
  });
});

describe("parseBoolean", () => {
  it("parses sim/não", () => {
    expect(parseBoolean("sim")).toBe(true);
    expect(parseBoolean("não")).toBe(false);
  });
});
```

Rodar: `npm run test -- value-normalizer`

✅ Todos os testes passam
✅ Upload de CSV com `"R$ 1.234,56"` em `dimRevenue` resulta em customer com `dimRevenue = 1234.56`
✅ Upload de CSV com NPS 0–10 em `dimSatisfaction` resulta em valores 0–100 no banco
✅ Upload de CSV com datas `DD/MM/YYYY` não quebra

---

### Bloco 1.5.c — Preview interpretado antes do commit (2–3h) — KILLER FEATURE

**Objetivo:** Novo step no wizard: antes de commitar, mostrar 5 linhas já parseadas e normalizadas + chips de detecção.

**Arquivos afetados:**
- [BACKEND] `server/src/routes/retain/index.ts` — novo endpoint `POST /retain/upload/preview`
- [FRONT] `client/src/modules/retain/pages/RetainUploadPage.tsx` — novo step entre mapping e commit
- [FRONT] `client/src/shared/components/ColumnMapper.tsx` — integrar chamada ao preview

#### Passo 1: Criar endpoint `POST /retain/upload/preview`
Em `server/src/routes/retain/index.ts`, adicionar após o `suggest-mapping`:

```typescript
retainRouter.post("/upload/preview", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Arquivo não enviado" });

  try {
    let mapping: Record<string, string> = {};
    try { mapping = JSON.parse(req.body.mapping ?? "{}"); } catch {}

    const csvResult = readCsvFile(file.path);
    const sampleRows = csvResult.rows.slice(0, 5);

    // Detect satisfaction scale on the full dataset
    const satisfactionCol = mapping["dimSatisfaction"];
    let satisfactionScale: ScaleDetection = "percent-100";
    if (satisfactionCol) {
      const all = csvResult.rows
        .map((r) => parseNumber(r[satisfactionCol]).value);
      satisfactionScale = detectScale(all);
    }

    // Interpret each sample row using the mapping
    const interpretedRows = sampleRows.map((row) => {
      const get = (key: string) => {
        const col = mapping[key];
        return col ? row[col] : undefined;
      };

      const revenueParsed = parseNumber(get("dimRevenue"));
      const rawSatisfaction = parseNumber(get("dimSatisfaction")).value;

      return {
        name: get("name") ?? Object.values(row)[0],
        email: get("email") ?? null,
        revenue: revenueParsed.value,
        revenueFormatted: revenueParsed.value != null
          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(revenueParsed.value)
          : null,
        satisfaction: rawSatisfaction != null && satisfactionScale
          ? normalizeToHundred(rawSatisfaction, satisfactionScale)
          : null,
        satisfactionLabel: rawSatisfaction != null
          ? `${rawSatisfaction} → ${normalizeToHundred(rawSatisfaction, satisfactionScale)}/100`
          : null,
        supportVolume: parseNumber(get("dimSupportVolume")).value,
        contractEnd: parseDate(get("dimContractRemainingDays")),
      };
    });

    // Count available dimensions (mapped and non-empty in sample)
    const allDims = [
      "dimSatisfaction", "dimPaymentRegularity", "dimUsageIntensity",
      "dimInteractionFrequency", "dimContractRemainingDays",
      "dimSupportVolume", "dimRecencyDays", "dimTenureDays", "dimRevenue",
    ];
    const availableDims = allDims.filter((d) => {
      if (!mapping[d]) return false;
      return sampleRows.some((r) => {
        const v = r[mapping[d]];
        return v != null && String(v).trim() !== "";
      });
    });
    const missingDims = allDims.filter((d) => !availableDims.includes(d));

    res.json({
      totalRows: csvResult.rows.length,
      sampleRows: interpretedRows,
      detection: {
        encoding: csvResult.detectedEncoding,
        delimiter: csvResult.detectedDelimiter,
        satisfactionScale,
        currencyFormat: interpretedRows.find((r) => r.revenue != null)
          ? "br" // simplificado; detectar no parseNumber
          : null,
      },
      dimensions: {
        available: availableDims,
        missing: missingDims,
        coverage: `${availableDims.length} de ${allDims.length}`,
      },
      unmappedColumns: csvResult.headers.filter(
        (h) => !Object.values(mapping).includes(h),
      ),
    });
  } catch (err: any) {
    console.error("Preview error:", err);
    res.status(500).json({ error: "Erro ao gerar preview" });
  } finally {
    if (file?.path) fs.unlink(file.path, () => {});
  }
});
```

#### Passo 2: Adicionar step "preview" no ColumnMapper
Em `client/src/shared/components/ColumnMapper.tsx`, mudar os steps:

```typescript
// ANTES:
type Step = "upload" | "mapping" | "processing" | "done";

// DEPOIS:
type Step = "upload" | "mapping" | "preview" | "processing" | "done";
```

Adicionar estado `previewData` e função `handlePreview()` que chama `POST /retain/upload/preview` com o mapping atual.

Transição: após usuário confirmar mapping na step `mapping`, chamar `handlePreview()` → vai para step `preview`. Da step `preview`, dois botões: "Voltar" (volta para mapping) e "Confirmar e processar" (vai para processing e chama upload real).

#### Passo 3: Renderizar step "preview"
Componente novo `<PreviewStep>` dentro do ColumnMapper:

```tsx
{step === "preview" && previewData && (
  <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary">{previewData.totalRows} linhas detectadas</Badge>
      <Badge variant="secondary">Encoding: {previewData.detection.encoding}</Badge>
      <Badge variant="secondary">Delimitador: "{previewData.detection.delimiter}"</Badge>
      {previewData.detection.satisfactionScale && (
        <Badge variant="secondary">
          NPS normalizado de {previewData.detection.satisfactionScale}
        </Badge>
      )}
      <Badge variant="outline">
        {previewData.dimensions.coverage} dimensões disponíveis
      </Badge>
    </div>

    {previewData.dimensions.missing.length > 0 && (
      <Alert>
        <AlertDescription>
          Dimensões ausentes: {previewData.dimensions.missing.join(", ")}.
          O Health Score será calculado com as disponíveis.
        </AlertDescription>
      </Alert>
    )}

    <table className="w-full text-sm">
      <thead>
        <tr>
          <th>Empresa</th>
          <th>Email</th>
          <th>Receita</th>
          <th>Satisfação</th>
          <th>Chamados</th>
        </tr>
      </thead>
      <tbody>
        {previewData.sampleRows.map((row, i) => (
          <tr key={i}>
            <td>{row.name}</td>
            <td>{row.email}</td>
            <td>{row.revenueFormatted ?? "—"}</td>
            <td>{row.satisfactionLabel ?? "—"}</td>
            <td>{row.supportVolume ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="flex justify-between">
      <Button variant="ghost" onClick={() => setStep("mapping")}>
        ← Voltar e ajustar mapping
      </Button>
      <Button onClick={handleCommit}>
        Confirmar e processar
      </Button>
    </div>
  </div>
)}
```

#### Passo 4: Frontend precisa manter o `File` em memória entre mapping e preview
O arquivo atualmente é enviado só no commit. Precisa ser enviado no preview também.

**Solução simples:** enviar o arquivo no preview endpoint (multer já aceita), e enviar de novo no commit. Reenviar é OK para arquivo < 50MB.

✅ Upload de CSV → mapping → ao clicar "próximo", chama preview → mostra 5 linhas normalizadas com chips
✅ Botão "Voltar" funciona
✅ Botão "Confirmar" faz o upload de verdade
✅ Chip "6 de 9 dimensões" aparece quando o CSV não tem todas as dims

⚠️ **Se endpoint preview falhar:** cair para fluxo antigo (pula preview step) via feature flag local.

---

### Bloco 1.5.d — Chip "X de 9 dimensões" + redistribuição de pesos (1h)

**Objetivo:** Quando uma dim está ausente, não falseie com 0.5 neutro — redistribua o peso proporcionalmente.

**Arquivo afetado:**
- [BACKEND] `server/src/engine/retain-scoring.ts` linhas 116–136 (função `calcHealthScore`)

#### Passo 1: Ajustar `calcHealthScore` para skipar dims ausentes
```typescript
// ANTES (linhas 116–136):
export function calcHealthScore(dims, weights = DEFAULT_WEIGHTS): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const meta of DIM_META) {
    const weight = weights[meta.key] ?? 0;
    if (weight <= 0) continue;
    const normalized = normalizeDimension(dims[meta.key] ?? null, meta);
    weightedSum += normalized * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 50;
  const score = (weightedSum / totalWeight) * 100;
  return Math.round(Math.min(Math.max(score, 0), 100));
}

// DEPOIS:
export function calcHealthScore(dims, weights = DEFAULT_WEIGHTS): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const meta of DIM_META) {
    const weight = weights[meta.key] ?? 0;
    if (weight <= 0) continue;
    const rawValue = dims[meta.key];
    if (rawValue == null) continue; // SKIP missing, redistribui peso automaticamente
    const normalized = normalizeDimension(rawValue, meta);
    weightedSum += normalized * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 50;
  const score = (weightedSum / totalWeight) * 100;
  return Math.round(Math.min(Math.max(score, 0), 100));
}
```

**Efeito:** Se um cliente tem só 5 de 8 dims, o peso das 5 é normalizado entre elas (soma dos pesos das disponíveis vira 100% local). Mais honesto que fingir que "satisfação é 50" quando não há dado.

#### Passo 2: Expor no SHAP quais dims foram usadas
Na função `calcShapValues` (buscar por "calcShap" ou "runRetainPredictions"), marcar dims ausentes como `"n/a"` em vez de incluí-las com valor neutro.

⚠️ **Atenção:** Se a função SHAP também fizer o mesmo fallback, atualizar também. Senão o drawer mostra "Satisfação: 0.5 (neutro)" quando deveria mostrar "Satisfação: não fornecida".

#### Passo 3: Card de cobertura no dashboard
Em `client/src/modules/retain/pages/RetainDashboardPage.tsx`, adicionar um card pequeno:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-sm">Cobertura de dados</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{coverage}/9</div>
    <p className="text-xs text-muted-foreground">
      dimensões disponíveis no último upload
    </p>
    {missing.length > 0 && (
      <p className="text-xs mt-2">
        Adicione <strong>{missing.join(", ")}</strong> para precisão máxima.
      </p>
    )}
  </CardContent>
</Card>
```

Dados vêm do último `retainUploads` (endpoint já existe via `/retain/uploads`).

✅ Cliente com 5 de 8 dims tem health score calculado razoável (não artificial 50)
✅ Dashboard mostra card "X/9 dimensões"
✅ SHAP no drawer mostra "n/a" para dims ausentes

---

### Bloco 1.5.e — Mapping memory por tenant (1h)

**Objetivo:** Segundo upload do mesmo tenant reutiliza o mapping do anterior com confidence "historical" = high.

**Arquivos afetados:**
- [BACKEND] `server/src/routes/retain/index.ts` endpoint `suggest-mapping`
- [BACKEND] `server/src/engine/column-mapper.ts` (opcional — adicionar source field)

#### Passo 1: Query do último mapping bem-sucedido
No `suggest-mapping`, antes de chamar `suggestMapping(headers, ...)`, consultar:

```typescript
retainRouter.post("/upload/suggest-mapping", async (req, res) => {
  try {
    const { headers, sampleRows } = req.body;
    if (!headers || !Array.isArray(headers)) {
      return res.status(400).json({ error: "headers é obrigatório" });
    }
    const tenantId = req.tenantId!;

    // Fetch last successful mapping for this tenant
    const [lastUpload] = await db
      .select({ columnMapping: retainUploads.columnMapping })
      .from(retainUploads)
      .where(and(
        eq(retainUploads.tenantId, tenantId),
        eq(retainUploads.status, "completed"),
      ))
      .orderBy(desc(retainUploads.uploadedAt))
      .limit(1);

    const historical: Record<string, string> = lastUpload?.columnMapping ?? {};

    // Get base suggestions
    const suggestions = suggestMapping(headers, sampleRows ?? [], "retain");

    // Override with historical matches
    const enriched = suggestions.map((s) => {
      // historical is { dimension: csvColumn }
      // check if current csvColumn matches a historical csvColumn for the same dimension
      for (const [dim, histCol] of Object.entries(historical)) {
        if (histCol === s.csvColumn) {
          return {
            ...s,
            suggestedDimension: dim,
            confidence: "high" as const,
            confidenceScore: 0.98,
            reason: `Histórico do tenant: já mapeado anteriormente`,
            source: "historical",
          };
        }
      }
      return { ...s, source: "heuristic" };
    });

    res.json(enriched);
  } catch (err) {
    console.error("Suggest mapping error:", err);
    res.status(500).json({ error: "Erro ao sugerir mapeamento" });
  }
});
```

#### Passo 2: UI mostra badge "Histórico"
Em `ColumnMapper.tsx`, quando `suggestion.source === "historical"`, mostrar badge especial "📚 Do último upload" em vez de "Alta confiança".

✅ Primeiro upload: fuzzy match normal
✅ Segundo upload do mesmo tenant: colunas iguais ao anterior aparecem com "📚 Do último upload"
✅ Segundo upload com CSV C (headers diferentes): fuzzy match padrão, sem histórico

---

## Bloco 2 — Gerar os 3 CSVs-herói (2h)

**Objetivo:** Datasets fictícios mas críveis que exercitam todas as cenas do roteiro.

**Arquivos novos:**
- `scripts/demo/csv-a-retain-coloquial.csv` (UTF-8, `,`, 80 linhas)
- `scripts/demo/csv-b-obtain-coloquial.csv` (UTF-8, `,`, 60 linhas)
- `scripts/demo/csv-c-retain-corporativo.csv` (Latin-1, `;`, 20 linhas)
- `scripts/demo/generate-csvs.ts` (script opcional para gerar)

#### Passo 1: Estrutura das distribuições

**CSV A — 80 clientes, setor "Serviços Industriais B2B":**
- 55 saudáveis (health 70–95, NPS 8–10, uso 70–95%, chamados 0–2)
- 15 risco médio (health 40–70, NPS 6–8, uso 50–70%, chamados 2–4)
- 8 críticos (health 15–40, NPS 0–5, uso 10–40%, chamados 5–12)
- 2 já churned
- **1 crítico com receita alta (~R$ 180.000/mês)** — estrela de predictions e Voz do Cliente
- Contratos vencendo: 3 em 30 dias, 4 em 60 dias, 5 em 90 dias
- Temas de chamado concentrados: "Performance" (30%), "Suporte lento" (25%), "Faturamento" (25%), "Onboarding" (20%)
- Verbatims nos detratores

**CSV B — 60 leads:**
- 20 hot leads (score 70–100)
- 20 warm (40–70)
- 15 cold (10–40)
- 5 disqualified
- Canais: "Indicação" (30%, CAC baixo), "Google Ads" (25%, CAC médio), "LinkedIn" (15%, CAC baixo), "Evento" (20%, CAC médio), **"Outbound Frio" (10%, CAC alto, LTV baixo — canal sangrando)**

**CSV C — 20 clientes (subset do A):**
- Mesmos customer codes do CSV A linhas 1–20 (para upsert funcionar)
- Headers radicalmente diferentes (ver plano)
- Latin-1 + `;` + R$ BR + datas DD/MM/YYYY
- 2 colunas sem match: `Observações do AM`, `Segmento Fiscal`

#### Passo 2: Gerador determinístico
```typescript
// scripts/demo/generate-csvs.ts
import fs from "fs";
import path from "path";
import iconv from "iconv-lite";

// Seeded random for reproducibility
function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rng = seedRandom(2026);
const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
const range = (min: number, max: number) => Math.round(min + rng() * (max - min));

// Banco de empresas fictícias
const empresas = [
  "Acme Construtora SA", "Beta Logística Ltda", "Gamma Mineração",
  "Delta Agroindústria", "Epsilon Serviços Técnicos",
  // ... 80 nomes
];

const temasTicket = ["Performance", "Suporte lento", "Faturamento", "Onboarding"];
const verbatimsDetratores = [
  "suporte demorou 5 dias pra responder",
  "sistema travou na virada de mês",
  "falta de acompanhamento do nosso AM",
  "fatura veio com valor errado 3 meses seguidos",
  "treinamento prometido nunca aconteceu",
];

// Gerar CSV A
const linhasA: string[] = [];
linhasA.push([
  "Cliente", "Email", "Valor mensal", "Dias desde último contato",
  "Frequência de uso", "Pagamentos em dia (%)", "Satisfação NPS",
  "Comentário NPS", "Chamados abertos", "Tema do chamado",
  "Tempo de contrato (meses)", "Contrato termina em"
].join(","));

for (let i = 0; i < 80; i++) {
  // ... lógica de distribuição
}

fs.writeFileSync("scripts/demo/csv-a-retain-coloquial.csv", linhasA.join("\n"));

// CSV C com encoding Latin-1
const linhasC: string[] = [];
linhasC.push([
  "Razão Social", "E-mail corporativo", "Receita Recorrente Mensal",
  "Inatividade (dias)", "Score de Engajamento", "Índice de Adimplência",
  "Net Promoter Score", "Feedback Aberto", "Tickets Abertos",
  "Categoria do Ticket", "Vigência Contratual (meses)",
  "Data Limite de Contrato", "Observações do AM", "Segmento Fiscal"
].join(";"));

// ... gerar 20 linhas referenciando subset do CSV A
// Formatar receita como "R$ 12.500,00"
// Datas como "DD/MM/YYYY"
// NPS 2 clientes com valor 11 (fora da escala) para exercitar detector

const latin1Buffer = iconv.encode(linhasC.join("\n"), "latin1");
fs.writeFileSync("scripts/demo/csv-c-retain-corporativo.csv", latin1Buffer);
```

Rodar: `npx tsx scripts/demo/generate-csvs.ts`

✅ `file scripts/demo/csv-c-retain-corporativo.csv` reporta charset ISO-8859
✅ CSV A abre no Excel com acentos corretos
✅ Upload manual do CSV A produz dashboard povoado
✅ Upload do CSV C após o A produz `20 updated, 0 created`

---

## Bloco 3 — Estados vazios e edge cases (1–2h)

**Objetivo:** Nenhum `undefined`, `NaN`, ou componente vazio em nenhuma rota.

#### Passo 1: Checklist manual com tenant zerado
Criar tenant novo sem nenhum customer e percorrer TODAS as rotas. Criar arquivo `docs/DEMO_SEXTA_VAZIO_CHECKLIST.md`:

```
- [ ] /retain — dashboard com 0 customers
- [ ] /retain/predictions — lista vazia mostra CTA "Faça upload"
- [ ] /retain/revenue — waterfall não quebra
- [ ] /retain/root-causes — estado vazio educado
- [ ] /retain/renewals — "Nenhum contrato vencendo"
- [ ] ... (todas as rotas)
```

#### Passo 2: Fixar cada item encontrado
Padrão de estado vazio:
```tsx
{data.length === 0 ? (
  <EmptyState
    icon={<Upload />}
    title="Nenhum dado ainda"
    description="Faça upload do seu primeiro CSV para ver inteligência aqui."
    action={<Button asChild><Link to="/retain/upload">Fazer upload</Link></Button>}
  />
) : (
  /* render normal */
)}
```

Componente `EmptyState` já deve existir em `client/src/shared/components/`. Se não existir, criar.

✅ Nenhuma rota mostra `undefined` ou erro no console com tenant vazio

---

## Bloco 4 — Página Voz do Cliente (3–4h)

**Objetivo:** Nova página dentro de Retain Sense que vira a cena CX do roteiro.

**Arquivos novos/afetados:**
- [BACKEND] `server/src/routes/retain/index.ts` — novo endpoint `GET /retain/voc`
- [FRONT] novo `client/src/modules/retain/pages/RetainVozDoClientePage.tsx`
- [FRONT] `client/src/App.tsx` — registrar rota
- [FRONT] `client/src/shell/components/Sidebar.tsx` — adicionar item
- [FRONT] `client/src/shared/hooks/useRetain.ts` — novo hook

#### Passo 1: Endpoint `GET /retain/voc`
```typescript
retainRouter.get("/voc", async (req, res) => {
  try {
    const tenantId = req.tenantId!;

    // Fetch all active customers with dimSatisfaction
    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        dimRevenue: customers.dimRevenue,
        dimSatisfaction: customers.dimSatisfaction,
        dimSupportVolume: customers.dimSupportVolume,
        healthScore: customers.healthScore,
        rawData: customers.rawData, // contains nps_verbatim, tickets_tema
      })
      .from(customers)
      .where(and(
        eq(customers.tenantId, tenantId),
        eq(customers.isActive, true),
      ));

    // Compute NPS (dimSatisfaction is 0-100, map back to 0-10 for NPS bucket)
    const total = rows.length;
    const promoters = rows.filter((r) => (r.dimSatisfaction ?? 0) >= 90).length;
    const passives = rows.filter((r) => {
      const s = r.dimSatisfaction ?? 0;
      return s >= 70 && s < 90;
    }).length;
    const detractors = rows.filter((r) => (r.dimSatisfaction ?? 100) < 70 && r.dimSatisfaction != null).length;
    const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

    // Detractors ordered by revenue
    const detractorsList = rows
      .filter((r) => (r.dimSatisfaction ?? 100) < 70 && r.dimSatisfaction != null)
      .sort((a, b) => (b.dimRevenue ?? 0) - (a.dimRevenue ?? 0))
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        name: r.name,
        revenue: r.dimRevenue,
        satisfaction: r.dimSatisfaction,
        supportVolume: r.dimSupportVolume,
        healthScore: r.healthScore,
        verbatim: (r.rawData as any)?.["Comentário NPS"] ?? (r.rawData as any)?.["Feedback Aberto"] ?? null,
      }));

    // Revenue at risk (sum of detractors' revenue)
    const revenueAtRisk = detractorsList.reduce((s, r) => s + (r.revenue ?? 0), 0);

    // Ticket themes from rawData
    const themeCount: Record<string, number> = {};
    for (const r of rows) {
      const tema = (r.rawData as any)?.["Tema do chamado"] ?? (r.rawData as any)?.["Categoria do Ticket"];
      if (tema) themeCount[tema] = (themeCount[tema] ?? 0) + 1;
    }
    const ticketThemes = Object.entries(themeCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Verbatims mural (top 10 most recent)
    const verbatims = rows
      .map((r) => ({
        name: r.name,
        satisfaction: r.dimSatisfaction,
        text: (r.rawData as any)?.["Comentário NPS"] ?? (r.rawData as any)?.["Feedback Aberto"],
      }))
      .filter((v) => v.text && String(v.text).trim() !== "")
      .slice(0, 10);

    res.json({
      nps,
      total,
      distribution: { promoters, passives, detractors },
      detractorsList,
      revenueAtRisk,
      ticketThemes,
      verbatims,
    });
  } catch (err) {
    console.error("VoC error:", err);
    res.status(500).json({ error: "Erro ao buscar Voz do Cliente" });
  }
});
```

#### Passo 2: Hook e página
```typescript
// client/src/shared/hooks/useRetain.ts — adicionar
export function useVoC() {
  return useQuery({
    queryKey: ["retain", "voc"],
    queryFn: () => api.get("/retain/voc").then((r) => r.data),
  });
}
```

```tsx
// client/src/modules/retain/pages/RetainVozDoClientePage.tsx
import { useVoC } from "@/shared/hooks/useRetain";

export default function RetainVozDoClientePage() {
  const { data, isLoading } = useVoC();
  if (isLoading) return <Spinner />;
  if (!data) return <EmptyState ... />;

  return (
    <div className="space-y-6">
      <PageHeader title="Voz do Cliente" subtitle="Como seus clientes se sentem — traduzido em R$" />

      {/* NPS grande */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">NPS</CardTitle></CardHeader>
          <CardContent>
            <div className="text-5xl font-bold">{data.nps}</div>
            <p className="text-xs mt-2">
              {data.distribution.promoters} promotores · {data.distribution.passives} neutros · {data.distribution.detractors} detratores
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Receita em risco</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.revenueAtRisk)}
            </div>
            <p className="text-xs mt-2">de clientes detratores</p>
          </CardContent>
        </Card>
        {/* +2 cards... */}
      </div>

      {/* Detratores por receita */}
      <Card>
        <CardHeader>
          <CardTitle>Detratores ordenados por receita</CardTitle>
          <CardDescription>Ligue primeiro para quem mais dói perder</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Receita</th>
                <th>NPS</th>
                <th>Chamados</th>
                <th>Último comentário</th>
              </tr>
            </thead>
            <tbody>
              {data.detractorsList.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{formatCurrency(d.revenue)}</td>
                  <td><Badge variant="destructive">{d.satisfaction}</Badge></td>
                  <td>{d.supportVolume}</td>
                  <td className="italic text-muted-foreground">"{d.verbatim ?? "—"}"</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Mural de verbatims */}
      <Card>
        <CardHeader><CardTitle>Voz crua do cliente</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {data.verbatims.map((v, i) => (
              <blockquote key={i} className="border-l-4 border-red-500 pl-3 italic">
                "{v.text}"
                <footer className="text-xs mt-1 not-italic">— {v.name}</footer>
              </blockquote>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Temas de ticket */}
      <Card>
        <CardHeader><CardTitle>O que mais incomoda</CardTitle></CardHeader>
        <CardContent>
          {data.ticketThemes.map((t) => (
            <div key={t.name} className="flex items-center gap-2 mb-2">
              <div className="w-32">{t.name}</div>
              <div className="flex-1 bg-gray-200 h-6 rounded">
                <div
                  className="bg-blue-500 h-6 rounded"
                  style={{ width: `${(t.count / data.ticketThemes[0].count) * 100}%` }}
                />
              </div>
              <div className="w-8 text-right text-sm">{t.count}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Passo 3: Registrar rota e sidebar
```tsx
// App.tsx
<Route path="/retain/voz-do-cliente" element={<RetainVozDoClientePage />} />

// Sidebar.tsx — dentro do grupo Retain Sense
{ label: "Voz do Cliente", to: "/retain/voz-do-cliente", icon: <Heart /> }
```

✅ Página acessível no menu
✅ Com dados do CSV A mostra NPS, detratores com receita, verbatims, temas
✅ Sem dados mostra estado vazio educado

⚠️ **Critério de corte 13h quinta:** se endpoint não retorna dados corretos, simplificar para mostrar só NPS + lista de detratores. Verbatims e temas viram opcionais.

⚠️ **Critério de corte 15h quinta:** se página inteira estiver quebrada, remover do sidebar + remover a cena do roteiro. Demo cai para 13min.

---

## Bloco 5 — Dramatizar o momento upload (1h)

**Objetivo:** Upload é a cena de abertura — precisa ter impacto visual.

#### Passo 1: Contadores grandes na tela de sucesso
Em `RetainUploadPage.tsx` step "done", mudar os números pequenos para cards coloridos:

```tsx
<div className="grid grid-cols-5 gap-4">
  <MetricCard
    icon={<Users />}
    label="Clientes analisados"
    value={result.rowsCreated + result.rowsUpdated}
    color="blue"
  />
  <MetricCard
    icon={<Brain />}
    label="Predições geradas"
    value={result.predictionsGenerated}
    color="navy"
  />
  <MetricCard
    icon={<AlertTriangle />}
    label="Alertas criados"
    value={result.alertsGenerated}
    color="amber"
  />
  <MetricCard
    icon={<TrendingDown />}
    label="Em risco crítico"
    value={criticalCount}
    color="red"
  />
  <MetricCard
    icon={<DollarSign />}
    label="Receita sob risco"
    value={formatCurrency(revenueAtRisk)}
    color="red"
  />
</div>

<div className="mt-6 text-center">
  <Button size="lg" onClick={() => navigate("/retain")}>
    Ver inteligência completa →
  </Button>
</div>
```

Valores `criticalCount` e `revenueAtRisk` precisam ser incluídos no JSON do upload (linha 485 do backend).

#### Passo 2: Toast dramático
Após upload, antes do redirect:
```tsx
toast({
  title: "✨ Inteligência gerada",
  description: `${rowsCreated + rowsUpdated} clientes analisados. ${criticalCount} em risco crítico. ${formatCurrency(revenueAtRisk)} em jogo.`,
  duration: 5000,
});
```

#### Passo 3: Auto-redirect ao dashboard
Botão "Ver inteligência completa" ou após 3s de auto-timer, redirecionar para `/retain` com dados já carregados (React Query invalidate).

✅ Tela de sucesso com 5 cards grandes e coloridos
✅ Toast aparece com resumo
✅ Botão de redirect leva ao dashboard com dados frescos

---

## Bloco 6 — Validar feedback loop e Scoring Config (1h)

**Objetivo:** Garantir que as 2 cenas wow funcionam no ao vivo.

#### 6.1 Feedback loop Retain→Obtain
1. Upload CSV A no Retain → predictions geradas
2. Upload CSV B no Obtain → ICP clusters iniciais gerados
3. Em `/retain/customers`, clicar no cliente crítico de maior receita → menu "Marcar como churned"
4. Backend deve chamar `generateIcpClusters(tenantId)` automaticamente
5. Abrir `/obtain/icp` → cluster afetado deve mostrar mudança
6. Abrir `/obtain/cac-ltv` → canal de origem do cliente churnado deve aparecer marcado

**Se não funcionar:** debugar em `server/src/engine/icp-clustering.ts`. Esse é o ÚNICO bug que justifica mexer em código complexo.

✅ Após churn, ICP mostra cluster mudando visualmente
✅ CAC×LTV marca canal afetado

#### 6.2 Scoring Config ao vivo
1. Abrir `/settings` → aba "Scoring Config"
2. Slider de `dimSatisfaction`: 20 → 28
3. Slider de `dimPaymentRegularity`: 18 → 10 (soma = 100)
4. Clicar "Salvar e Recalcular"
5. Ir para `/retain/predictions` → ordem deve mudar visivelmente

✅ Predictions reordenam após recalcular
✅ SHAP no drawer reflete novos pesos

---

## Bloco 7 — Ensaio cronometrado (1–2h)

**Objetivo:** Rodar o roteiro de 15 min 2x do início ao fim, em estado limpo.

#### Checklist pré-ensaio
- [ ] `docker-compose down -v && docker-compose up -d` (banco limpo)
- [ ] `npm run db:push`
- [ ] `npm run dev`
- [ ] Browser em modo incognito (sem cache)
- [ ] CSVs A, B, C prontos em `~/Desktop/demo/`
- [ ] Credenciais de login coladas em editor lateral

#### Ensaio 1
Rodar seguindo o roteiro minuto a minuto do arquivo de plano. Anotar:
- Tempo real de cada cena
- Onde travou
- Onde o fluxo não bateu com o roteiro

#### Correções pontuais
Não refatorar — apenas fixar o que trava o ensaio.

#### Ensaio 2
Rodar novamente, focando no tempo (alvo: ≤15 min).

✅ Ensaio 2 roda em ≤15 min sem erros
✅ Zero erro no console do browser
✅ Zero erro no log do server

---

## Bloco 8 — Plano B / resiliência (1h)

**Objetivo:** Garantir que o demo sobrevive a qualquer imprevisto.

#### 8.1 Snapshot SQL
```bash
# Após Bloco 2 (dados-herói carregados)
docker-compose exec -T db pg_dump -U intellisense intellisense > scripts/demo/snapshot.sql

# Restore em 30s:
docker-compose exec -T db psql -U intellisense intellisense < scripts/demo/snapshot.sql
```

Criar script `scripts/demo/restore-snapshot.sh`:
```bash
#!/bin/bash
set -e
docker-compose exec -T db psql -U intellisense -c "DROP DATABASE IF EXISTS intellisense;"
docker-compose exec -T db psql -U intellisense -c "CREATE DATABASE intellisense;"
docker-compose exec -T db psql -U intellisense intellisense < scripts/demo/snapshot.sql
echo "✅ Snapshot restored"
```

#### 8.2 CSVs em múltiplos locais
- `scripts/demo/*.csv` (repo)
- `~/Desktop/demo/*.csv` (local, para arrastar facilmente)
- Backup em pendrive

#### 8.3 Rodar 100% local
- `docker-compose up -d` → Postgres local
- `npm run dev` → frontend+backend local
- Testar com Wi-Fi desligado → tudo funciona

#### 8.4 Checklist de remoção gradual
Se algo quebrar no último momento, ordem de cortes:
1. Remover WOW 3 (CSV C) → demo cai para 14 min
2. Remover cena CX Voz do Cliente → demo cai para 13 min
3. Remover Scoring Config ao vivo → demo cai para 12 min
4. Último recurso: rodar só Lifecycle + CSV A + feedback loop (8 min)

✅ Snapshot restaura em <1 min
✅ Demo roda offline
✅ Fallback plans documentados

---

## Verificação final (quinta à noite)

Rodar em ordem:

```bash
# 1. Ambiente limpo
docker-compose down -v
docker-compose up -d
sleep 5
npm run db:push

# 2. Server + client
npm run dev &
sleep 10

# 3. Smoke do seed
curl -X POST http://localhost:3001/api/seed/dcco

# 4. Testes unitários
npm run test

# 5. Type check
npm run check
```

Abrir browser e rodar manualmente:
- [ ] Upload CSV A → dashboard povoado
- [ ] Preview interpretado mostra chips corretos
- [ ] Voz do Cliente mostra NPS, detratores, verbatims
- [ ] Upload CSV C → `20 updated, 0 created`
- [ ] Feedback loop: churn → ICP muda
- [ ] Scoring Config: slider → predictions reordenam
- [ ] Ensaio completo ≤ 15 min
- [ ] Snapshot restore ≤ 1 min

**Se QUALQUER item falhar:** cortar escopo usando a ordem do Bloco 8.4. Nunca chegar em sexta com algo quebrado.

---

## Bugs críticos já identificados (antes do smoke test)

Estes precisam ser fixados no Bloco 1.5 mesmo que não apareçam no smoke test:

1. **`server/src/routes/retain/index.ts:361`** — `fs.readFileSync(file.path, "utf-8")` hardcoded → quebra Latin-1. **Fix:** Bloco 1.5.a
2. **`server/src/routes/retain/index.ts:380-384`** — `toFloat` faz `replace(",", ".")` simples → `"R$ 1.234,56"` vira `NaN`. **Fix:** Bloco 1.5.b
3. **`server/src/routes/retain/index.ts:443`** — Upsert só por `customerCode`. Se CSV C não tem a mesma coluna id, os 20 clientes duplicam. **Fix:** adicionar fallback por email no Bloco 1.5.b/2 (mitigar gerando CSV C com a mesma coluna de código)
4. **`server/src/engine/retain-scoring.ts:127`** — `normalizeDimension(null)` retorna 0.5 (neutral falso) → dims ausentes falseiam health score. **Fix:** Bloco 1.5.d
5. **`server/src/engine/retain-scoring.ts:80`** — `dimSatisfaction.maxRef = 100` assume 0-100. NPS 0-10 sem normalizar vira score de 7%. **Fix:** Bloco 1.5.b (normalizar no parse, não no scoring)
