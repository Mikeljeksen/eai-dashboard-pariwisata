import "server-only";
import { createClient } from "@/lib/supabase/server";

/* Semua query dijalankan di server memakai sesi user (anon key + JWT user),
 * sehingga tunduk pada RLS. Service role key tidak pernah dipakai di web. */

export type Kpi = {
  tahun: number;
  total_wisman: number | null;
  total_wisnus: number | null;
  rata_tpk: number | null;
  bulan_wisman: number | null;
  bulan_wisnus: number | null;
  bulan_tpk: number | null;
  kamar_akomodasi: number | null;
  kamar_hotel_bintang: number | null;
  usaha_akomodasi: number | null;
  penerimaan_usd: number | null;
  kedatangan_wb: number | null;
  yoy_wisman: number | null;
  yoy_wisnus: number | null;
  delta_tpk_poin: number | null;
  yoy_kamar: number | null;
};

export type Tren = {
  waktu_id: number;
  tahun: number;
  bulan: number;
  label: string;
  wisman: number | null;
  wisnus: number | null;
  tpk: number | null;
};

export type Integrasi = {
  provinsi_kode: number;
  provinsi: string;
  pulau: string;
  region: string;
  kode_induk: number | null;
  tahun: number;
  wisnus: number | null;
  bulan_wisnus: number | null;
  tpk_rata: number | null;
  bulan_tpk: number | null;
  wisman_pintu_masuk: number | null;
  usaha_akomodasi: number | null;
  kamar_akomodasi: number | null;
  usaha_hotel_bintang: number | null;
  kamar_hotel_bintang: number | null;
  wisnus_per_kamar: number | null;
};

export type WbRow = {
  negara_iso3: string;
  negara_nama: string;
  waktu_id: number;
  indikator_kode: string;
  indikator_nama: string;
  satuan: string;
  nilai: number;
};

export type WismanRow = {
  pintu_masuk: string;
  jenis_pintu: string;
  provinsi_kode: number | null;
  waktu_id: number;
  jumlah_kunjungan: number;
};

/** PostgREST mengembalikan numeric sebagai string — ubah ke number. */
function numify<T>(rows: Record<string, unknown>[] | null): T[] {
  return (rows ?? []).map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      o[k] = typeof v === "string" && v !== "" && /^-?\d+(\.\d+)?$/.test(v) && !["label", "provinsi", "negara_iso3"].includes(k) ? Number(v) : v;
    }
    return o as T;
  });
}

async function sb() {
  return createClient();
}

export async function getKpi(): Promise<Kpi[]> {
  const { data, error } = await (await sb()).from("v_kpi_tahunan").select("*").order("tahun");
  if (error) throw new Error(error.message);
  return numify<Kpi>(data);
}

export async function getTren(): Promise<Tren[]> {
  const { data, error } = await (await sb()).from("v_tren_bulanan").select("*").order("waktu_id");
  if (error) throw new Error(error.message);
  return numify<Tren>(data);
}

export async function getIntegrasi(): Promise<Integrasi[]> {
  const { data, error } = await (await sb())
    .from("v_integrasi_provinsi_tahun").select("*").order("tahun").order("provinsi_kode").limit(1000);
  if (error) throw new Error(error.message);
  return numify<Integrasi>(data);
}

export async function getWorldBank(): Promise<WbRow[]> {
  const { data, error } = await (await sb()).from("fact_wb_pariwisata")
    .select("negara_iso3, negara_nama, waktu_id, indikator_kode, indikator_nama, satuan, nilai")
    .order("waktu_id").limit(1000);
  if (error) throw new Error(error.message);
  return numify<WbRow>(data);
}

export async function getWismanTahun(tahun: number): Promise<WismanRow[]> {
  const { data, error } = await (await sb()).from("fact_wisman")
    .select("pintu_masuk, jenis_pintu, provinsi_kode, waktu_id, jumlah_kunjungan")
    .gte("waktu_id", tahun * 100).lte("waktu_id", tahun * 100 + 12).limit(1000);
  if (error) throw new Error(error.message);
  return numify<WismanRow>(data);
}

export type SumberRingkas = {
  dataset: string;
  judul: string;
  penerbit: string;
  format: string;
  url: string;
  cakupan: string;
  tabel_fakta: string;
  deskripsi: string | null;
  baris_diekstrak: number | null;
  baris_ditransformasi: number | null;
  baris_dibuang: number | null;
  baris_dimuat: number | null;
  durasi_ms: number | null;
  alasan_dibuang: Record<string, number> | null;
  catatan_transformasi: string | null;
  sel_masuk: number | null;
};

export type EtlRun = {
  run_id: number;
  mulai: string;
  selesai: string | null;
  status: "running" | "success" | "failed";
  trigger: "manual" | "scheduled";
  catatan: string | null;
};

export type StepLog = {
  run_id: number;
  dataset: string;
  format_sumber: string;
  tahap: "E" | "T" | "L";
  baris_masuk: number;
  baris_keluar: number;
  baris_dibuang: number;
  alasan_dibuang: Record<string, number>;
  catatan_transformasi: string | null;
  durasi_ms: number;
};

export async function getPipeline() {
  const s = await sb();
  const [sumber, runs] = await Promise.all([
    s.from("v_etl_ringkasan_sumber").select("*").order("dataset"),
    s.from("etl_run").select("*").order("run_id", { ascending: false }).limit(15),
  ]);
  if (sumber.error) throw new Error(sumber.error.message);
  if (runs.error) throw new Error(runs.error.message);
  const runIds = (runs.data ?? []).map((r) => r.run_id);
  const steps = runIds.length
    ? await s.from("etl_step_log").select("run_id, dataset, format_sumber, tahap, baris_masuk, baris_keluar, baris_dibuang, alasan_dibuang, catatan_transformasi, durasi_ms")
        .in("run_id", runIds).order("log_id").limit(1000)
    : { data: [], error: null };
  if (steps.error) throw new Error(steps.error.message);
  return {
    sumber: numify<SumberRingkas>(sumber.data),
    runs: (runs.data ?? []) as EtlRun[],
    steps: (steps.data ?? []) as StepLog[],
  };
}
