const id = "id-ID";

export const fmtInt = (v: number | null | undefined) =>
  v == null ? "–" : new Intl.NumberFormat(id, { maximumFractionDigits: 0 }).format(v);

export const fmtDec = (v: number | null | undefined, d = 1) =>
  v == null ? "–" : new Intl.NumberFormat(id, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

/** 15.386.646 -> "15,4 jt"; 1.200.332.559 -> "1,20 M" */
export function fmtCompact(v: number | null | undefined): string {
  if (v == null) return "–";
  const a = Math.abs(v);
  if (a >= 1e12) return `${fmtDec(v / 1e12, 2)} T`;
  if (a >= 1e9) return `${fmtDec(v / 1e9, 2)} M`;
  if (a >= 1e6) return `${fmtDec(v / 1e6, 1)} jt`;
  if (a >= 1e3) return `${fmtDec(v / 1e3, 1)} rb`;
  return fmtInt(v);
}

export const fmtPct = (v: number | null | undefined, d = 1) => (v == null ? "–" : `${fmtDec(v, d)}%`);

export const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
