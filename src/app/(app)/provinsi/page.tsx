import type { Metadata } from "next";
import { BarChart3, GitMerge, Info, MapPinned, Scale } from "lucide-react";
import { ParamSelect } from "@/components/filters";
import { Badge, CardHeader, EmptyState, GlassCard, PageHeader } from "@/components/ui";
import { ChoroplethMap, CorrelationPanel, PulauLegend, RankingChart, type ProvPoint } from "@/components/charts/provinsi-charts";
import { fmtCompact, fmtDec } from "@/lib/format";
import { getIntegrasi, type Integrasi } from "@/lib/queries";
import { gini, pearson, rDescription } from "@/lib/stats";

export const metadata: Metadata = { title: "Analisis Provinsi" };

const METRICS = {
  wisnus: { label: "Perjalanan wisnus (provinsi tujuan)", unit: "perjalanan", sumber: "D2 · CSV" },
  tpk_rata: { label: "Rata-rata TPK hotel bintang", unit: "%", sumber: "D1 · XLSX" },
  wisman_pintu_masuk: { label: "Wisman via pintu masuk di provinsi", unit: "kunjungan", sumber: "D3 · CSV" },
  kamar_akomodasi: { label: "Jumlah kamar akomodasi", unit: "kamar", sumber: "D5 · PDF" },
  wisnus_per_kamar: { label: "Wisnus per kamar akomodasi", unit: "rasio", sumber: "D2 ÷ D5" },
} as const;
type MetricKey = keyof typeof METRICS;

/** Basis 34 provinsi: provinsi pemekaran 2022 digabung ke provinsi induknya. */
function rollup34(rows: Integrasi[]): Integrasi[] {
  const out = new Map<number, Integrasi & { _tpkN: number; _tpkSum: number }>();
  for (const r of rows) {
    const kode = r.kode_induk ?? r.provinsi_kode;
    const cur = out.get(kode);
    if (!cur) {
      out.set(kode, { ...r, provinsi_kode: kode, kode_induk: null, _tpkN: r.tpk_rata != null ? 1 : 0, _tpkSum: r.tpk_rata ?? 0 });
      continue;
    }
    const add = (a: number | null, b: number | null) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0));
    cur.wisnus = add(cur.wisnus, r.wisnus);
    cur.wisman_pintu_masuk = add(cur.wisman_pintu_masuk, r.wisman_pintu_masuk);
    cur.kamar_akomodasi = add(cur.kamar_akomodasi, r.kamar_akomodasi);
    cur.usaha_akomodasi = add(cur.usaha_akomodasi, r.usaha_akomodasi);
    if (r.tpk_rata != null) { cur._tpkN += 1; cur._tpkSum += r.tpk_rata; }
    if (r.provinsi_kode === kode) cur.provinsi = r.provinsi;
  }
  return [...out.values()].map((r) => ({
    ...r,
    tpk_rata: r._tpkN ? r._tpkSum / r._tpkN : null,
    wisnus_per_kamar: r.wisnus != null && r.kamar_akomodasi ? r.wisnus / r.kamar_akomodasi : null,
  }));
}

export default async function ProvinsiPage({ searchParams }: {
  searchParams: Promise<{ tahun?: string; metrik?: string; basis?: string }>;
}) {
  const all = await getIntegrasi();
  if (!all.length) {
    return (
      <>
        <PageHeader eyebrow="Analisis per Provinsi" title="Peta & korelasi antarprovinsi" />
        <GlassCard><EmptyState title="Belum ada data" message="Jalankan pipeline ETL untuk memuat data." /></GlassCard>
      </>
    );
  }

  const sp = await searchParams;
  const years = [...new Set(all.map((r) => r.tahun))].sort();
  const metrik: MetricKey = (sp.metrik && sp.metrik in METRICS ? sp.metrik : "wisnus") as MetricKey;
  const defaultYear = Math.max(...all.filter((r) => r.kamar_akomodasi != null && r.bulan_wisnus === 12).map((r) => r.tahun));
  const tahun = years.includes(Number(sp.tahun)) ? Number(sp.tahun) : defaultYear;
  const basis = sp.basis === "34" ? "34" : "38";
  const m = METRICS[metrik];

  let rows = all.filter((r) => r.tahun === tahun);
  if (basis === "34") rows = rollup34(rows);

  const points: ProvPoint[] = rows.map((r) => ({
    kode: r.provinsi_kode, nama: r.provinsi, pulau: r.pulau,
    nilai: (r[metrik] as number | null) ?? null,
    wisnus: r.wisnus, tpk: r.tpk_rata, kamar: r.kamar_akomodasi,
  }));
  // Dalam basis 34, provinsi pemekaran diwarnai dengan nilai provinsi induknya di peta
  const mapPoints: ProvPoint[] = basis === "34"
    ? all.filter((r) => r.tahun === tahun).map((r) => {
        const induk = points.find((p) => p.kode === (r.kode_induk ?? r.provinsi_kode));
        return { ...(induk as ProvPoint), kode: r.provinsi_kode, nama: `${r.provinsi}${r.kode_induk ? ` (digabung ke ${induk?.nama})` : ""}` };
      })
    : points;

  const withVal = points.filter((p) => p.nilai != null);
  const sum = withVal.reduce((s, p) => s + (p.nilai ?? 0), 0);
  const top5 = [...withVal].sort((a, b) => (b.nilai ?? 0) - (a.nilai ?? 0)).slice(0, 5);
  const top5Share = metrik !== "tpk_rata" && metrik !== "wisnus_per_kamar" && sum ? (top5.reduce((s, p) => s + (p.nilai ?? 0), 0) / sum) * 100 : null;
  const g = metrik !== "tpk_rata" ? gini(withVal.map((p) => p.nilai as number)) : null;

  const wt = points.filter((p) => p.wisnus && p.tpk != null);
  const r1 = pearson(wt.map((p) => Math.log10(p.wisnus!)), wt.map((p) => p.tpk!));
  const kw = points.filter((p) => p.wisnus && p.kamar);
  const r2 = pearson(kw.map((p) => Math.log10(p.kamar!)), kw.map((p) => Math.log10(p.wisnus!)));
  const rText = (r: number | null, n: number) => (r == null ? "n/a" : `r = ${fmtDec(r, 2)} (${rDescription(r)}, n = ${n})`);

  return (
    <>
      <PageHeader
        eyebrow="Analisis per Provinsi"
        title="Peta & korelasi antarprovinsi"
        description="Kunci provinsi dan tahun yang sudah distandarkan di ETL membuat empat sumber berbeda (XLSX, CSV, PDF, dan pemetaan pintu masuk) bisa dibandingkan dalam satu kanvas."
      >
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[560px]">
          <ParamSelect name="tahun" label="Tahun" value={String(tahun)} options={years.map((y) => ({ value: String(y), label: String(y) }))} />
          <ParamSelect name="metrik" label="Metrik" value={metrik}
            options={(Object.keys(METRICS) as MetricKey[]).map((k) => ({ value: k, label: METRICS[k].label }))} />
          <ParamSelect name="basis" label="Basis wilayah" value={basis}
            options={[{ value: "38", label: "38 provinsi (2022+)" }, { value: "34", label: "34 provinsi (gabung pemekaran)" }]} />
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <GlassCard className="xl:col-span-2">
          <CardHeader icon={MapPinned} title={`${m.label} — ${tahun}`}
            subtitle="Scroll atau pinch untuk zoom, seret untuk menggeser peta. Provinsi abu-abu belum memiliki data pada tahun ini."
            action={<Badge tone="violet">{m.sumber}</Badge>} />
          {withVal.length ? <ChoroplethMap points={mapPoints} metricLabel={m.label} unit={m.unit} />
            : <EmptyState title="Metrik tidak tersedia untuk tahun ini" message="Contoh: data kamar akomodasi (PDF) hanya mencakup 2021–2025, dan wisnus mulai 2019." />}
          <p className="mt-2 text-[11px] text-fg-subtle">
            Batas wilayah: GeoJSON 38 provinsi oleh denyherianto (CC BY 4.0).
          </p>
        </GlassCard>

        <div className="grid grid-cols-1 gap-4">
          <GlassCard>
            <CardHeader icon={Scale} title="Ketimpangan antarprovinsi" subtitle="Seberapa terkonsentrasi metrik ini di beberapa provinsi saja." />
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <dt className="text-[11px] font-semibold text-fg-subtle">Pangsa 5 provinsi teratas</dt>
                <dd className="mt-1 text-2xl font-extrabold">{top5Share == null ? "–" : `${fmtDec(top5Share, 1)}%`}</dd>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <dt className="text-[11px] font-semibold text-fg-subtle">Koefisien Gini</dt>
                <dd className="mt-1 text-2xl font-extrabold">{g == null ? "–" : fmtDec(g, 2)}</dd>
              </div>
            </dl>
            <ol className="mt-4 space-y-2 text-sm">
              {top5.map((p, i) => (
                <li key={p.kode} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white/8 text-[11px] font-bold text-fg-muted">{i + 1}</span>
                    <span className="truncate">{p.nama}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-fg-muted">
                    {m.unit === "%" ? `${fmtDec(p.nilai, 1)}%` : m.unit === "rasio" ? fmtDec(p.nilai, 1) : fmtCompact(p.nilai)}
                  </span>
                </li>
              ))}
            </ol>
          </GlassCard>
          <GlassCard>
            <CardHeader icon={Info} title="Penanganan 34 vs 38 provinsi" />
            <p className="text-xs leading-relaxed text-fg-muted">
              Papua Barat Daya, Papua Selatan, Papua Tengah, dan Papua Pegunungan dibentuk pada 2022. Sebelum itu
              sumber BPS mengisi nilainya dengan &ldquo;-&rdquo;, yang diubah menjadi NULL di ETL. Kolom <code className="text-violet-200">kode_induk</code> di{" "}
              <code className="text-violet-200">dim_provinsi</code> memungkinkan roll-up ke basis 34 provinsi agar runtun waktu tetap sebanding.
            </p>
          </GlassCard>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GlassCard>
          <CardHeader icon={BarChart3} title={`Ranking provinsi — ${m.label}`} subtitle={`Tahun ${tahun}, basis ${basis} provinsi. Warna batang menunjukkan pulau.`} />
          <PulauLegend />
          <div className="mt-3">
            {withVal.length ? <RankingChart points={points} metricLabel={m.label} unit={m.unit} />
              : <EmptyState title="Tidak ada data" message="Pilih tahun atau metrik lain." />}
          </div>
        </GlassCard>
        <GlassCard>
          <CardHeader icon={GitMerge} title="Korelasi lintas dataset"
            subtitle="Hanya mungkin dibuat karena kelima sumber telah diintegrasikan dengan kunci provinsi-tahun yang sama." />
          <CorrelationPanel points={points} rWisnusTpk={rText(r1, wt.length)} rKamarWisnus={rText(r2, kw.length)} />
        </GlassCard>
      </div>
    </>
  );
}
