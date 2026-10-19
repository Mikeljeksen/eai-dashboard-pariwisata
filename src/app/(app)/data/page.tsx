import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Table2 } from "lucide-react";
import { ParamSelect } from "@/components/filters";
import { SearchInput } from "@/components/search-input";
import { Badge, CardHeader, EmptyState, GlassCard, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DATASETS, buildQuery, parseFilters, type SortKey } from "@/lib/data-table";
import { fmtDec, fmtInt } from "@/lib/format";

export const metadata: Metadata = { title: "Tabel Data" };

const PAGE_SIZE = 25;
const FORMAT_TONE = { XLSX: "violet", CSV: "blue", JSON: "amber", PDF: "green" } as const;

type Row = {
  dataset: string; format: string; wilayah: string; provinsi_kode: number | null; tahun: number;
  bulan: number; periode: string; metrik: string; satuan: string; nilai: number | string | null;
};

export default async function DataPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  const [{ data, count, error }, prov] = await Promise.all([
    buildQuery(supabase, f, { count: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from("dim_provinsi").select("kode_bps, nama").order("nama"),
  ]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v != null) as [string, string][]);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    return `?${next.toString()}`;
  };
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v != null && k !== "page") as [string, string][]).toString();

  const SortHead = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => {
    const active = f.sort === k;
    const Icon = !active ? ArrowUpDown : f.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th scope="col" aria-sort={active ? (f.dir === "asc" ? "ascending" : "descending") : "none"} className={`px-3 py-3 ${align === "right" ? "text-right" : ""}`}>
        <Link href={qs({ sort: k, dir: active && f.dir === "desc" ? "asc" : "desc", page: undefined })} scroll={false}
              className={`inline-flex items-center gap-1 hover:text-fg ${active ? "text-fg" : ""}`}>
          {label}<Icon className="size-3" aria-hidden />
        </Link>
      </th>
    );
  };

  const fmtVal = (r: Row) => {
    const v = r.nilai == null ? null : Number(r.nilai);
    if (v == null) return "–";
    return r.satuan === "%" ? `${fmtDec(v, 2)}%` : fmtInt(v);
  };

  return (
    <>
      <PageHeader eyebrow="Tabel Data" title="Hasil integrasi dalam satu tabel"
        description="Semua tabel fakta digabung dalam format panjang (dataset, wilayah, periode, metrik, nilai) lewat view v_data_terintegrasi. Filter dijalankan di server dan export CSV mengikuti filter yang aktif.">
        <a href={`/api/export?${exportQs}`}
           className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-blue-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110">
          <Download className="size-4" aria-hidden /> Export CSV ({fmtInt(total)} baris)
        </a>
      </PageHeader>

      <GlassCard>
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1.3fr_1.3fr_0.8fr]">
          <SearchInput initial={f.q ?? ""} />
          <ParamSelect name="dataset" label="Dataset" value={f.dataset ?? ""} resetPage
            options={[{ value: "", label: "Semua dataset" }, ...DATASETS.map((d) => ({ value: d, label: d }))]} />
          <ParamSelect name="provinsi" label="Provinsi" value={f.provinsi ?? ""} resetPage
            options={[{ value: "", label: "Semua wilayah" }, ...(prov.data ?? []).map((p) => ({ value: String(p.kode_bps), label: p.nama }))]} />
          <ParamSelect name="tahun" label="Tahun" value={f.tahun ?? ""} resetPage
            options={[{ value: "", label: "Semua" }, ...Array.from({ length: 16 }, (_, i) => 2025 - i).map((y) => ({ value: String(y), label: String(y) }))]} />
        </div>

        <CardHeader icon={Table2} title={`${fmtInt(total)} baris`} subtitle={`Halaman ${page} dari ${pages}. Klik judul kolom untuk mengurutkan.`} />

        {rows.length === 0 ? (
          <EmptyState title="Tidak ada data yang cocok" message="Ubah kata kunci atau filter untuk melihat data." />
        ) : (
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-y border-white/10 bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                <tr>
                  <SortHead k="dataset" label="Dataset" />
                  <SortHead k="wilayah" label="Wilayah" />
                  <SortHead k="tahun" label="Periode" />
                  <SortHead k="metrik" label="Metrik" />
                  <SortHead k="nilai" label="Nilai" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.07]">
                {rows.map((r, i) => (
                  <tr key={i} className="transition hover:bg-white/[0.04]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Badge tone={FORMAT_TONE[r.format as keyof typeof FORMAT_TONE] ?? "slate"}>{r.format}</Badge>
                        <span className="text-xs text-fg-muted">{r.dataset}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{r.wilayah}</td>
                    <td className="px-3 py-2.5 tabular-nums text-fg-muted">{r.periode}</td>
                    <td className="px-3 py-2.5 text-fg-muted">{r.metrik}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                      {fmtVal(r)} <span className="text-[11px] font-normal text-fg-subtle">{r.satuan !== "%" ? r.satuan : ""}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <nav aria-label="Paginasi" className="mt-5 flex items-center justify-between gap-3 text-sm">
          <p className="text-xs text-fg-muted">
            {total ? `${fmtInt((page - 1) * PAGE_SIZE + 1)}–${fmtInt(Math.min(page * PAGE_SIZE, total))} dari ${fmtInt(total)}` : "0 baris"}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={qs({ page: String(page - 1) })} scroll={false} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 ring-1 ring-white/15 hover:bg-white/8">
                <ChevronLeft className="size-4" aria-hidden /> Sebelumnya
              </Link>
            ) : <span className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-fg-subtle ring-1 ring-white/8"><ChevronLeft className="size-4" aria-hidden /> Sebelumnya</span>}
            {page < pages ? (
              <Link href={qs({ page: String(page + 1) })} scroll={false} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 ring-1 ring-white/15 hover:bg-white/8">
                Berikutnya <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : <span className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-fg-subtle ring-1 ring-white/8">Berikutnya <ChevronRight className="size-4" aria-hidden /></span>}
          </div>
        </nav>
      </GlassCard>
    </>
  );
}
