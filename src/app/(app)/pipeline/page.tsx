import type { Metadata } from "next";
import {
  ArrowDown, ArrowRight, Braces, CheckCircle2, Clock, Database, ExternalLink, FileSpreadsheet, FileText,
  FileType2, History, LayoutDashboard, ListChecks, RefreshCw, Sheet, Waves, XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, CardHeader, EmptyState, GlassCard, PageHeader } from "@/components/ui";
import { RowFlowSankey } from "@/components/charts/pipeline-charts";
import { fmtInt } from "@/lib/format";
import { getPipeline } from "@/lib/queries";

export const metadata: Metadata = { title: "Data Pipeline ETL" };

const FORMAT_ICON: Record<string, LucideIcon> = { XLSX: FileSpreadsheet, CSV: Sheet, JSON: Braces, PDF: FileText };
const FORMAT_TONE = { XLSX: "violet", CSV: "blue", JSON: "amber", PDF: "green" } as const;

const TRANSFORMS = [
  { t: "Wide → long", d: "Kolom Januari–Desember pada tabel BPS diubah menjadi baris (entitas, bulan, nilai) agar sesuai tabel fakta.", ds: "D1 D2 D3" },
  { t: "Standardisasi nama provinsi", d: "'KEP. RIAU', 'Kepulauan Riau', dan 'Kep Riau' dinormalisasi lalu dicocokkan ke kode BPS lewat kolom alias di dim_provinsi.", ds: "D1 D2 D5" },
  { t: "Pemetaan pintu masuk → provinsi", d: "26 bandara/pelabuhan/PLBN dipetakan ke provinsi lokasi lewat tabel referensi; baris 'Lainnya' disimpan dengan provinsi NULL.", ds: "D3" },
  { t: "Normalisasi angka", d: "Format Indonesia '1.412' (titik = ribuan) dibedakan dari '49.17' (titik = desimal) sesuai konfigurasi per sumber.", ds: "D1 D5" },
  { t: "Nilai kosong BPS → NULL", d: "'-', '…', 'NA', dan karakter '—' yang rusak (U+FFFD) diubah menjadi NULL, lalu dibuang dari fakta beserta alasannya.", ds: "Semua" },
  { t: "Pembersihan artefak PDF", d: "Huruf watermark diagonal dan superskrip catatan kaki yang menempel di angka difilter berdasarkan ukuran font.", ds: "D5" },
  { t: "Penyeragaman periode", d: "Semua periode menjadi waktu_id = tahun×100 + bulan (00 untuk data tahunan) yang merujuk ke dim_waktu.", ds: "Semua" },
  { t: "Buang subtotal & validasi silang", d: "Baris 'Total'/'Jumlah' dan kolom 'Tahunan' tidak dimuat (dihitung ulang di view) tetapi dipakai untuk mengecek Σdetail = total.", ds: "D2 D3" },
  { t: "Deduplikasi & validasi rentang", d: "Kunci ganda dibuang (versi terakhir disimpan). TPK harus 0–100, jumlah ≥ 0, dan kamar ≥ usaha.", ds: "Semua" },
  { t: "Load idempoten (upsert)", d: "COPY ke tabel sementara lalu INSERT … ON CONFLICT DO UPDATE, sehingga menjalankan ulang ETL tidak menggandakan data.", ds: "Semua" },
];

function FlowNode({ icon: Icon, title, sub, tone }: { icon: LucideIcon; title: string; sub: string; tone: string }) {
  return (
    <div className={`glass flex min-w-0 flex-1 items-center gap-3 !rounded-2xl p-3.5 ring-1 ${tone}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/8"><Icon className="size-5" aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-[11px] leading-snug text-fg-muted">{sub}</p>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex shrink-0 items-center justify-center text-fg-subtle" aria-hidden>
      <ArrowRight className="hidden size-5 lg:block" />
      <ArrowDown className="size-5 lg:hidden" />
    </div>
  );
}

const fmtTime = (s: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(s));

export default async function PipelinePage() {
  const { sumber, runs, steps } = await getPipeline();
  const lastOk = runs.find((r) => r.status === "success");
  const lastSteps = steps.filter((s) => s.run_id === lastOk?.run_id);

  const flow = sumber.map((s) => ({
    dataset: s.dataset.replace(/^d(\d)_/, "D$1 "),
    format: s.format,
    masuk: s.sel_masuk ?? 0,
    dimuat: s.baris_dimuat ?? 0,
    alasan: s.alasan_dibuang ?? {},
  }));
  const totalIn = lastSteps.filter((s) => s.tahap === "T").reduce((a, s) => a + s.baris_masuk, 0);
  const totalLoad = lastSteps.filter((s) => s.tahap === "L").reduce((a, s) => a + s.baris_keluar, 0);
  const totalDrop = lastSteps.filter((s) => s.tahap === "T").reduce((a, s) => a + s.baris_dibuang, 0);

  return (
    <>
      <PageHeader
        eyebrow="Data Pipeline ETL"
        title="Dari 5 sumber heterogen ke satu hub integrasi"
        description="Dashboard tidak pernah membaca file mentah. Setiap sumber melalui tahap Extract → Transform → Load ke Supabase Postgres, lalu website hanya membaca dari database tersebut. Sinkronisasinya satu arah: dari sumber ke hub."
      />

      {/* Diagram alur */}
      <GlassCard>
        <CardHeader icon={Waves} title="Arsitektur data-level EAI" subtitle="Alur extract → process → update. Data mengalir satu arah dari sumber ke hub, dijalankan manual atau terjadwal mingguan lewat GitHub Actions." />
        <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
          <div className="grid flex-[1.3] grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-1">
            {sumber.map((s) => {
              const Icon = FORMAT_ICON[s.format] ?? FileType2;
              return (
                <div key={s.dataset} className="flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-2 text-xs ring-1 ring-white/10">
                  <Icon className="size-4 shrink-0 text-violet-300" aria-hidden />
                  <span className="truncate font-semibold">{s.dataset.replace(/^d(\d)_/, "D$1 ")}</span>
                  <span className="ml-auto text-[10px] font-bold text-fg-subtle">{s.format}</span>
                </div>
              );
            })}
          </div>
          <Arrow />
          <FlowNode icon={FileType2} title="Extract" sub="1 modul per format: csv, xlsx, json, pdf (pdfplumber)" tone="ring-violet-400/30" />
          <Arrow />
          <FlowNode icon={RefreshCw} title="Transform" sub="Wide→long, alias provinsi, angka, NULL, validasi" tone="ring-blue-400/30" />
          <Arrow />
          <FlowNode icon={Database} title="Load → Hub" sub="Upsert idempoten ke Supabase Postgres (star schema)" tone="ring-emerald-400/30" />
          <Arrow />
          <FlowNode icon={LayoutDashboard} title="Dashboard" sub="Next.js membaca view, RLS: authenticated SELECT" tone="ring-cyan-400/30" />
        </div>
      </GlassCard>

      {!sumber.length || !lastOk ? (
        <GlassCard className="mt-4"><EmptyState title="Belum ada run ETL" message="Jalankan python -m etl.run_etl untuk mengisi log pipeline." /></GlassCard>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { l: "Sel data diproses (run terakhir)", v: totalIn, c: "text-violet-200" },
              { l: "Baris dimuat ke hub", v: totalLoad, c: "text-emerald-200" },
              { l: "Baris dibuang (+ alasan)", v: totalDrop, c: "text-rose-200" },
            ].map((x) => (
              <div key={x.l} className="glass p-5">
                <p className="text-xs font-semibold text-fg-muted">{x.l}</p>
                <p className={`mt-2 text-3xl font-extrabold tracking-tight ${x.c}`}>{fmtInt(x.v)}</p>
                <p className="mt-1 text-[11px] text-fg-subtle">Run #{lastOk.run_id} · {fmtTime(lastOk.mulai)} · {lastOk.trigger}</p>
              </div>
            ))}
          </div>

          <GlassCard className="mt-4">
            <CardHeader icon={Waves} title="Aliran baris per sumber" subtitle="Lebar pita = jumlah baris. Setiap baris yang dibuang dicatat beserta alasannya (lihat juga data/rejected/*.csv)." />
            <RowFlowSankey rows={flow} />
          </GlassCard>

          <h2 className="mt-8 mb-3 text-lg font-bold tracking-tight">Kartu sumber</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {sumber.map((s) => {
              const Icon = FORMAT_ICON[s.format] ?? FileType2;
              return (
                <GlassCard key={s.dataset} as="article" className="flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-white/8 ring-1 ring-white/12"><Icon className="size-5 text-violet-300" aria-hidden /></span>
                    <Badge tone={FORMAT_TONE[s.format as keyof typeof FORMAT_TONE] ?? "slate"}>{s.format}</Badge>
                  </div>
                  <h3 className="mt-3 text-sm font-bold leading-snug">{s.judul}</h3>
                  <p className="mt-1 text-xs text-fg-muted">{s.penerbit} · {s.cakupan}</p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[["Masuk", s.sel_masuk, "text-fg"], ["Keluar", s.baris_dimuat, "text-emerald-200"], ["Dibuang", s.baris_dibuang, "text-rose-200"]].map(([l, v, c]) => (
                      <div key={l as string} className="rounded-xl bg-white/5 py-2 ring-1 ring-white/10">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{l}</dt>
                        <dd className={`text-base font-extrabold tabular-nums ${c}`}>{fmtInt(v as number | null)}</dd>
                      </div>
                    ))}
                  </dl>
                  {s.alasan_dibuang && Object.keys(s.alasan_dibuang).length > 0 && (
                    <ul className="mt-3 space-y-1 text-[11px] text-fg-muted">
                      {Object.entries(s.alasan_dibuang).map(([a, n]) => (
                        <li key={a} className="flex justify-between gap-2"><span>{a}</span><span className="font-semibold tabular-nums">{fmtInt(n)}</span></li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-[11px] text-fg-subtle">→ <code className="text-violet-200">{s.tabel_fakta}</code></p>
                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                     className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold text-violet-300 hover:text-violet-200">
                    Buka sumber <ExternalLink className="size-3" aria-hidden />
                  </a>
                </GlassCard>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <GlassCard className="xl:col-span-3">
          <CardHeader icon={ListChecks} title="Transformasi yang diterapkan" subtitle="Diimplementasikan eksplisit di etl/transform/*.py" />
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {TRANSFORMS.map((x, i) => (
              <li key={x.t} className="rounded-2xl bg-white/5 p-3.5 ring-1 ring-white/10">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="grid size-5 place-items-center rounded-md bg-violet-500/20 text-[10px] font-bold text-violet-200">{i + 1}</span>
                  {x.t}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{x.d}</p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{x.ds}</p>
              </li>
            ))}
          </ol>
        </GlassCard>

        <GlassCard className="xl:col-span-2">
          <CardHeader icon={History} title="Riwayat etl_run" subtitle="15 run terakhir (manual & terjadwal)" />
          {runs.length === 0 ? (
            <EmptyState title="Belum ada run" message="Belum ada catatan di tabel etl_run." />
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-fg-subtle">
                  <tr><th className="px-2 py-2">Run</th><th className="px-2 py-2">Mulai (WIB)</th><th className="px-2 py-2">Trigger</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Durasi</th></tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {runs.map((r) => {
                    const dur = r.selesai ? (new Date(r.selesai).getTime() - new Date(r.mulai).getTime()) / 1000 : null;
                    return (
                      <tr key={r.run_id}>
                        <td className="px-2 py-2.5 font-semibold">#{r.run_id}</td>
                        <td className="px-2 py-2.5 text-fg-muted">{fmtTime(r.mulai)}</td>
                        <td className="px-2 py-2.5"><Badge tone={r.trigger === "scheduled" ? "blue" : "slate"}>{r.trigger}</Badge></td>
                        <td className="px-2 py-2.5">
                          {r.status === "success" ? <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="size-3.5" aria-hidden />sukses</span>
                            : r.status === "failed" ? <span className="inline-flex items-center gap-1 text-rose-300" title={r.catatan ?? ""}><XCircle className="size-3.5" aria-hidden />gagal</span>
                            : <span className="inline-flex items-center gap-1 text-amber-300"><Clock className="size-3.5" aria-hidden />berjalan</span>}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-fg-muted">{dur == null ? "–" : `${dur.toFixed(1)} dtk`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>

      {lastSteps.length > 0 && (
        <GlassCard className="mt-4">
          <CardHeader icon={ListChecks} title={`etl_step_log — run #${lastOk?.run_id}`} subtitle="Satu baris per dataset per tahap (E/T/L)." />
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-fg-subtle">
                <tr>
                  <th className="px-2 py-2">Dataset</th><th className="px-2 py-2">Format</th><th className="px-2 py-2">Tahap</th>
                  <th className="px-2 py-2 text-right">Masuk</th><th className="px-2 py-2 text-right">Keluar</th><th className="px-2 py-2 text-right">Dibuang</th>
                  <th className="px-2 py-2 text-right">ms</th><th className="px-2 py-2">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {lastSteps.map((s, i) => (
                  <tr key={i} className="align-top">
                    <td className="px-2 py-2 font-semibold">{s.dataset}</td>
                    <td className="px-2 py-2">{s.format_sumber}</td>
                    <td className="px-2 py-2"><Badge tone={s.tahap === "E" ? "violet" : s.tahap === "T" ? "blue" : "green"}>{s.tahap}</Badge></td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtInt(s.baris_masuk)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtInt(s.baris_keluar)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-rose-200">{fmtInt(s.baris_dibuang)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-fg-muted">{fmtInt(s.durasi_ms)}</td>
                    <td className="max-w-[420px] px-2 py-2 text-fg-muted">{s.catatan_transformasi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </>
  );
}
