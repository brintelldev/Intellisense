/** fmtBRL: exact value with pt-BR locale, e.g. "R$ 156.800" */
export const fmtBRL = (v: number | null | undefined) =>
  v != null ? `R$ ${v.toLocaleString("pt-BR")}` : "—";

/** fmtBRLShort: compact notation for large numbers, e.g. "R$ 1,2M", "R$ 890K" */
export const fmtBRLShort = (v: number | null | undefined) => {
  if (v == null) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v}`;
};
