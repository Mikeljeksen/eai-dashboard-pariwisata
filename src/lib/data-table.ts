import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DATASETS = [
  "D1 TPK Hotel Bintang",
  "D2 Wisatawan Nusantara",
  "D3 Wisatawan Mancanegara",
  "D4 World Bank",
  "D5 Akomodasi (PDF)",
] as const;

export const SORTABLE = ["dataset", "wilayah", "tahun", "bulan", "metrik", "nilai"] as const;
export type SortKey = (typeof SORTABLE)[number];

export type DataFilters = {
  q?: string;
  dataset?: string;
  provinsi?: string;
  tahun?: string;
  sort: SortKey;
  dir: "asc" | "desc";
};

export function parseFilters(sp: Record<string, string | undefined>): DataFilters {
  const sort = (SORTABLE as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as SortKey) : "tahun";
  return {
    q: sp.q?.trim().slice(0, 80) || undefined,
    dataset: DATASETS.includes(sp.dataset as (typeof DATASETS)[number]) ? sp.dataset : undefined,
    provinsi: /^\d{1,2}$/.test(sp.provinsi ?? "") ? sp.provinsi : undefined,
    tahun: /^\d{4}$/.test(sp.tahun ?? "") ? sp.tahun : undefined,
    sort,
    dir: sp.dir === "asc" ? "asc" : "desc",
  };
}

/** Membangun query PostgREST terfilter untuk v_data_terintegrasi. */
export function buildQuery(sb: SupabaseClient, f: DataFilters, opts: { count?: boolean } = {}) {
  let q = sb
    .from("v_data_terintegrasi")
    .select("dataset, format, wilayah, provinsi_kode, tahun, bulan, periode, metrik, satuan, nilai", opts.count ? { count: "exact" } : undefined);
  if (f.dataset) q = q.eq("dataset", f.dataset);
  if (f.provinsi) q = q.eq("provinsi_kode", Number(f.provinsi));
  if (f.tahun) q = q.eq("tahun", Number(f.tahun));
  if (f.q) {
    const s = f.q.replace(/[%,()*]/g, " ");
    q = q.or(`wilayah.ilike.*${s}*,metrik.ilike.*${s}*,periode.ilike.*${s}*`);
  }
  q = q.order(f.sort, { ascending: f.dir === "asc", nullsFirst: false });
  if (f.sort !== "wilayah") q = q.order("wilayah", { ascending: true });
  if (f.sort !== "bulan") q = q.order("bulan", { ascending: true });
  return q;
}
