/** fmtBRL: exact value with pt-BR locale, e.g. "R$ 156.800" */
export const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

/** fmtBRLShort: compact notation for large numbers, e.g. "R$ 1,2M", "R$ 890K" */
export const fmtBRLShort = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
    ? `R$ ${(v / 1_000).toFixed(0)}K`
    : `R$ ${v}`;
