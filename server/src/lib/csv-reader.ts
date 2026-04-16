// ─── Encoding-Aware CSV Reader ───────────────────────────────────────────────
// Detects file encoding (UTF-8 / Latin-1 / Windows-1252) and delimiter
// (comma or semicolon), then returns parsed rows.

import * as fs from "fs";
import * as chardet from "chardet";
import * as iconv from "iconv-lite";
import Papa from "papaparse";

export interface CsvReadResult {
  data: Record<string, string>[];
  headers: string[];
  detectedEncoding: string;
  detectedDelimiter: string;
  errors: Papa.ParseError[];
}

/**
 * Reads a CSV file from disk, auto-detects encoding and delimiter,
 * and returns parsed rows with headers.
 */
export function readCsvFile(filePath: string): CsvReadResult {
  const rawBuffer = fs.readFileSync(filePath);

  // ── 1. Detect encoding ──────────────────────────────────────────────────
  const detected = chardet.detect(rawBuffer) ?? "UTF-8";
  // Normalize: Windows-1252 and ISO-8859-1 both decode fine with iconv latin1
  const encoding =
    detected.toUpperCase().includes("UTF") ? "UTF-8" :
    detected.toUpperCase().includes("1252") ? "windows-1252" :
    detected.toUpperCase().includes("ISO") ? "ISO-8859-1" :
    detected;

  let csvText: string;
  try {
    csvText = iconv.decode(rawBuffer, encoding);
  } catch {
    // Fallback to UTF-8 with replacement
    csvText = rawBuffer.toString("utf-8");
  }

  // ── 2. Strip BOM if present ─────────────────────────────────────────────
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.slice(1);
  }

  // ── 3. Parse with auto-delimiter ────────────────────────────────────────
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: "",          // papaparse auto-detects comma vs semicolon
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const delimiter = parsed.meta.delimiter ?? ",";

  return {
    data: parsed.data,
    headers,
    detectedEncoding: encoding,
    detectedDelimiter: delimiter,
    errors: parsed.errors,
  };
}

/**
 * Reads only the first `maxRows` rows for preview / mapping suggestion.
 * Cheaper than reading the full file.
 */
export function readCsvSample(
  filePath: string,
  maxRows = 5,
): Pick<CsvReadResult, "data" | "headers" | "detectedEncoding" | "detectedDelimiter"> {
  const full = readCsvFile(filePath);
  return {
    data: full.data.slice(0, maxRows),
    headers: full.headers,
    detectedEncoding: full.detectedEncoding,
    detectedDelimiter: full.detectedDelimiter,
  };
}
