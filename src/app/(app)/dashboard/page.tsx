import type { Metadata } from "next";
import { BedDouble, CalendarRange, Globe2, Hotel, Plane, PlaneLanding, TrendingUp, Users } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { ParamSelect } from "@/components/filters";
import { CardHeader, EmptyState, GlassCard, PageHeader } from "@/components/ui";
import {
  AseanChart, GatewayChart, RecoveryChart, SeasonalHeatmap, TpkChart, TrendChart,
} from "@/components/charts/overview-charts";
import { fmtCompact, fmtDec, fmtInt } from "@/lib/format";
import { getKpi, getTren, getWismanTahun, getWorldBank } from "@/lib/queries";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tahun?: string }> }) {
  const [kpi, tren, wb] = await Promise.all([getKpi(), getTren(), getWorldBank()]);

  if (!tren.length) {
    return (
      <>
        <PageHeader eyebrow="Overview" title="Pariwisata Indonesia dalam angka" />
        <GlassCard>
          <EmptyState title="Belum ada data" message="Jalankan pipeline ETL (python -m etl.run_etl) untuk memuat data ke hub Supabase." />
        </GlassCard>
      </>
    );
  }

  // tahun lengkap = 12 bulan wisman terisi
  const fullYears = kpi.filter((k) => (k.bulan_wisman ?? 0) === 12).map((k) => k.tahun);
  const { tahun: tParam } = await searchParams;
  const tahun = fullYears.includes(Number(tParam)) ? Number(tParam) : Math.max(...fullYears);
  const k = kpi.find((r) => r.tahun === tahun)!;

  const gw = await getWismanTahun(tahun);
  const gwAgg = Object.values(
    gw.reduce<Record<string, { pintu: string; jenis: string; total: number }>>((acc, r) => {
      acc[r.pintu_masuk] ??= { pintu: r.pintu_masuk, jenis: r.jenis_pintu, total: 0 };
      acc[r.pintu_masuk].total += r.jumlah_kunjungan;
      return acc;
    }, {}),
  ).filter((r) => !/lainnya/i.test(r.pintu));
  const totalGw = gw.reduce((s, r) => s + r.jumlah_kunjungan, 0);
  const ngurahRai = gwAgg.find((r) => r.pintu === "Ngurah Rai")?.total ?? 0;

  const wbIdn2019 = wb.find((r) => r.negara_iso3 === "IDN" && r.waktu_id === 201900 && r.indikator_kode === "ST.INT.RCPT.CD")?.nilai;
  const wbIdn2020 = wb.find((r) => r.negara_iso3 === "IDN" && r.waktu_id === 202000 && r.indikator_kode === "ST.INT.RCPT.CD")?.nilai;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Pariwisata Indonesia dalam angka"
        description="Ringkasan hasil integrasi 5 sumber data (BPS & World Bank) yang dimuat lewat pipeline ETL ke satu database terpusat."
      >
        <div className="w-full sm:w-48">
          <ParamSelect
            name="tahun"
            label="Tahun KPI"
            value={String(tahun)}
            options={[...fullYears].reverse().map((y) => ({ value: String(y), label: String(y) }))}
          />
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={`Kunjungan wisman ${tahun}`} value={fmtCompact(k.total_wisman)} icon={PlaneLanding} accent="violet"
          delta={k.yoy_wisman} deltaLabel={`% vs ${tahun - 1}`} footnote={`${fmtInt(k.total_wisman)} kunjungan · BPS (CSV)`} />
        <KpiCard label={`Perjalanan wisnus ${tahun}`} value={fmtCompact(k.total_wisnus)} icon={Users} accent="green"
          delta={k.yoy_wisnus} deltaLabel={`% vs ${tahun - 1}`} footnote="Perjalanan domestik menurut provinsi tujuan · BPS (CSV)" />
        <KpiCard label={`Rata-rata TPK hotel bintang ${tahun}`} value={fmtDec(k.rata_tpk, 1)} unit="%" icon={Hotel} accent="cyan"
          delta={k.delta_tpk_poin} deltaLabel={`poin vs ${tahun - 1}`} footnote="Rata-rata 12 bulan TPK nasional · BPS (XLSX)" />
        <KpiCard label={`Kamar akomodasi ${k.kamar_akomodasi ? tahun : ""}`} value={fmtCompact(k.kamar_akomodasi)} icon={BedDouble} accent="blue"
          delta={k.yoy_kamar} deltaLabel={`% vs ${tahun - 1}`}
          footnote={k.kamar_akomodasi ? `${fmtInt(k.usaha_akomodasi)} usaha; ${fmtInt(k.kamar_hotel_bintang)} kamar hotel bintang · BPS (PDF)` : "Data PDF hanya mencakup 2021–2025"} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <GlassCard className="xl:col-span-2">
          <CardHeader icon={TrendingUp} title="Tren bulanan wisman & wisnus 2018–2025"
            subtitle="Sumbu kiri: kunjungan wisman. Sumbu kanan: perjalanan wisnus. Area merah muda menandai periode pembatasan COVID-19 (Mar 2020 – Des 2022). Geser slider untuk zoom." />
          <TrendChart data={tren} />
        </GlassCard>
        <GlassCard>
          <CardHeader icon={Plane} title={`Pintu masuk wisman teratas ${tahun}`}
            subtitle={`Ngurah Rai (Bali) menyumbang ${fmtDec((ngurahRai / (totalGw || 1)) * 100, 1)}% dari ${fmtCompact(totalGw)} kunjungan. Warna: ungu = udara, biru = laut, hijau = darat.`} />
          <GatewayChart rows={gwAgg} />
        </GlassCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GlassCard>
          <CardHeader icon={CalendarRange} title="Pola musiman"
            subtitle="Indeks musiman = nilai bulan ÷ rata-rata bulanan tahun itu × 100. Di atas 100 berarti bulan sibuk." />
          <SeasonalHeatmap data={tren} />
        </GlassCard>
        <GlassCard>
          <CardHeader icon={TrendingUp} title="Dampak COVID-19 & pemulihan"
            subtitle={`Indeks tahunan dengan 2019 = 100. Pada ${tahun}, wisman berada di ${fmtDec(((k.total_wisman ?? 0) / (kpi.find((r) => r.tahun === 2019)?.total_wisman || 1)) * 100, 1)}% level 2019.`} />
          <RecoveryChart data={tren} />
        </GlassCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <GlassCard className="xl:col-span-2">
          <CardHeader icon={Hotel} title="TPK hotel bintang nasional per bulan" subtitle="Garis kuning: rata-rata 2019 sebagai acuan sebelum pandemi." />
          <TpkChart data={tren} />
        </GlassCard>
        <GlassCard className="xl:col-span-3">
          <CardHeader icon={Globe2} title="Indonesia di antara negara ASEAN (World Bank, JSON)"
            subtitle={`Penerimaan pariwisata internasional Indonesia turun dari US$ ${fmtCompact(wbIdn2019 ?? null)} (2019) menjadi US$ ${fmtCompact(wbIdn2020 ?? null)} (2020). World Bank belum merilis data 2021+.`} />
          <AseanChart rows={wb} />
        </GlassCard>
      </div>
    </>
  );
}
