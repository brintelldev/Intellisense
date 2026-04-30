export type NumericLike = number | string | null | undefined;

export const toNumber = (value: NumericLike): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;

  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  const normalized = comma > dot
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  const numeric = Number(normalized);

  return Number.isFinite(numeric) ? numeric : null;
};

/** fmtBRL: exact value with pt-BR locale, e.g. "R$ 156.800" */
export const fmtBRL = (v: NumericLike) => {
  const value = toNumber(v);
  return value != null ? `R$ ${value.toLocaleString("pt-BR")}` : "-";
};

/** fmtBRLShort: compact notation for large numbers, e.g. "R$ 1,2M", "R$ 890K" */
export const fmtBRLShort = (v: NumericLike) => {
  const value = toNumber(v);
  if (value == null) return "-";
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return `R$ ${value.toFixed(0)}`;
};
