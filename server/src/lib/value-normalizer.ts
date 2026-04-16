// ─── Value Normalizer ────────────────────────────────────────────────────────
// Handles Brazilian number formats, NPS scale detection, dates, booleans.

// ── Number / Currency ────────────────────────────────────────────────────────

/**
 * Parses a number that may be in BR format (R$ 1.234,56) or US format (1234.56).
 * Returns null for empty / non-numeric strings.
 */
export function parseNumber(raw: string | undefined | null): number | null {
  if (raw == null || raw.trim() === "") return null;

  let s = raw.trim();

  // Strip currency symbols and whitespace
  s = s.replace(/R\$|\$|USD|€/gi, "").trim();

  // Detect BR format: has dots as thousands separator + comma as decimal
  // Pattern: digits, optional (dot + 3 digits)+, comma, digits
  const brPattern = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s);
  // Also matches values like "1.234" (could be BR thousands OR US decimal ambiguous)
  const dotOnlyPattern = /^\d+\.\d+$/.test(s);

  if (brPattern) {
    // BR format: remove dots (thousands), replace comma with dot (decimal)
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",") && s.includes(".")) {
    // Mixed: e.g. "1,234.56" US thousands — strip commas
    s = s.replace(/,/g, "");
  } else if (s.includes(",") && !s.includes(".")) {
    // Pure comma decimal: "1234,56" → "1234.56"
    s = s.replace(",", ".");
  }
  // else: plain number, US decimal — use as-is

  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ── NPS / Satisfaction Scale Detection ──────────────────────────────────────

export type NpsScale = "likert-5" | "nps-10" | "percent-100";

export interface ScaleDetection {
  scale: NpsScale;
  normalizedValue: number; // 0-100
}

/**
 * Detects the scale of a satisfaction value and normalizes it to 0-100.
 * Rules:
 *   - max ≤ 5  → Likert 1-5  (multiply by 20)
 *   - max ≤ 10 → NPS 0-10    (multiply by 10)
 *   - else     → percent 0-100 (keep as-is)
 */
export function detectScaleAndNormalize(
  values: (number | null)[],
  rawValue: number,
): ScaleDetection {
  const validValues = values.filter((v): v is number => v != null);
  const max = validValues.length > 0 ? Math.max(...validValues) : rawValue;

  if (max <= 5) {
    return { scale: "likert-5", normalizedValue: Math.min(rawValue * 20, 100) };
  }
  if (max <= 10) {
    return { scale: "nps-10", normalizedValue: Math.min(rawValue * 10, 100) };
  }
  return { scale: "percent-100", normalizedValue: Math.min(Math.max(rawValue, 0), 100) };
}

/**
 * Detect scale from a sample of raw string values.
 * Returns the scale label and a normalizer function for use in the upload pipeline.
 */
export function detectSatisfactionScale(
  rawValues: (string | undefined | null)[],
): { scale: NpsScale; normalize: (v: number) => number } {
  const nums = rawValues
    .map((v) => parseNumber(v))
    .filter((n): n is number => n != null);

  const max = nums.length > 0 ? Math.max(...nums) : 100;
  const min = nums.length > 0 ? Math.min(...nums) : 0;

  if (max <= 5 && min >= 0) {
    return { scale: "likert-5", normalize: (v) => Math.min(v * 20, 100) };
  }
  if (max <= 10 && min >= 0) {
    return { scale: "nps-10", normalize: (v) => Math.min(v * 10, 100) };
  }
  return { scale: "percent-100", normalize: (v) => Math.min(Math.max(v, 0), 100) };
}

// ── Date Parsing ────────────────────────────────────────────────────────────

/**
 * Parses dates in multiple formats:
 *   DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY
 * Returns a Date object or null.
 */
export function parseDate(raw: string | undefined | null): Date | null {
  if (raw == null || raw.trim() === "") return null;
  const s = raw.trim();

  // YYYY-MM-DD (ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00Z");
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or DD-MM-YYYY (Brazil/Europe)
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const d = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // MM/DD/YYYY (US)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, mm, dd, yyyy] = mdy;
    const candidate = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T00:00:00Z`);
    // Only treat as MM/DD if day > 12 (otherwise ambiguous, prefer DD/MM)
    if (!isNaN(candidate.getTime()) && parseInt(dd) > 12) {
      return candidate;
    }
  }

  return null;
}

/**
 * Given a date, calculate how many days remain from today.
 * Positive = future, negative = past (contract already expired).
 */
export function daysFromToday(d: Date): number {
  const now = Date.now();
  return Math.round((d.getTime() - now) / (1000 * 60 * 60 * 24));
}

// ── Boolean Parsing ─────────────────────────────────────────────────────────

const TRUTHY = new Set(["sim", "s", "yes", "y", "true", "1", "ativo", "active"]);
const FALSY = new Set(["não", "nao", "n", "no", "false", "0", "inativo", "inactive"]);

/**
 * Parses boolean-like strings to true/false/null (null = unrecognized).
 */
export function parseBoolean(raw: string | undefined | null): boolean | null {
  if (raw == null || raw.trim() === "") return null;
  const s = raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (TRUTHY.has(s)) return true;
  if (FALSY.has(s)) return false;
  return null;
}

// ── Combined Row Normalizer ──────────────────────────────────────────────────

export interface NormalizationMeta {
  satisfactionScale: NpsScale | null;
  currencyDetected: boolean;
  dateColumnsDetected: string[];
  missingDimensions: string[];
}

/**
 * Scans a column of raw satisfaction values and returns normalization context.
 * Call once per upload before processing individual rows.
 */
export function buildSatisfactionNormalizer(
  rawValues: (string | undefined | null)[],
): { scale: NpsScale | null; normalize: (v: number) => number } {
  const nonEmpty = rawValues.filter((v) => v != null && v.trim() !== "");
  if (nonEmpty.length === 0) return { scale: null, normalize: (v) => v };
  return detectSatisfactionScale(nonEmpty);
}
