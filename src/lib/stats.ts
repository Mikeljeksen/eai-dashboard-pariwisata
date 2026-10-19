/** Korelasi Pearson; mengembalikan null bila n < 3. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

/** Koefisien Gini (0 = merata sempurna, 1 = terkonsentrasi penuh). */
export function gini(values: number[]): number | null {
  const v = values.filter((x) => x >= 0).sort((a, b) => a - b);
  const n = v.length;
  const sum = v.reduce((a, b) => a + b, 0);
  if (n < 2 || sum === 0) return null;
  let cum = 0;
  v.forEach((x, i) => (cum += (i + 1) * x));
  return (2 * cum) / (n * sum) - (n + 1) / n;
}

export function rDescription(r: number | null): string {
  if (r == null) return "tidak cukup data";
  const a = Math.abs(r);
  const s = a >= 0.7 ? "kuat" : a >= 0.4 ? "sedang" : a >= 0.2 ? "lemah" : "sangat lemah";
  return `${r >= 0 ? "positif" : "negatif"} ${s}`;
}
