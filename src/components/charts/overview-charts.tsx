"use client";

import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { AURORA, EChart } from "./echart";
import { BULAN_PENDEK, fmtCompact, fmtDec, fmtInt } from "@/lib/format";
import type { Tren, WbRow } from "@/lib/queries";

const COVID_START = "Mar 2020";
const COVID_END = "Des 2022";
const covidArea = {
  silent: true,
  itemStyle: { color: "rgba(244,114,182,0.08)", borderColor: "rgba(244,114,182,0.35)", borderType: "dashed" as const, borderWidth: 1 },
  label: { show: true, position: "insideTop" as const, color: "#f9a8d4", fontSize: 11, fontWeight: 600, formatter: "Periode COVID-19" },
  data: [[{ xAxis: COVID_START }, { xAxis: COVID_END }]] as never,
};

/* ---------------------------------------------------------------- */
/* Tren bulanan wisman & wisnus (dua sumbu) dengan anotasi COVID     */
/* ---------------------------------------------------------------- */
export function TrendChart({ data }: { data: Tren[] }) {
  const option: EChartsOption = {
    grid: { left: 8, right: 8, top: 48, bottom: 56, containLabel: true },
    legend: { top: 0, left: 0 },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => fmtInt(v as number),
    },
    xAxis: { type: "category", data: data.map((d) => d.label), boundaryGap: false, axisLabel: { hideOverlap: true } },
    yAxis: [
      { type: "value", name: "Wisman", axisLabel: { formatter: (v: number) => fmtCompact(v) } },
      { type: "value", name: "Wisnus", axisLabel: { formatter: (v: number) => fmtCompact(v) }, splitLine: { show: false } },
    ],
    dataZoom: [{ type: "inside", zoomOnMouseWheel: false, moveOnMouseWheel: false }, { type: "slider", height: 18, bottom: 8, borderColor: "transparent",
      backgroundColor: "rgba(255,255,255,0.04)", fillerColor: "rgba(167,139,250,0.18)",
      handleStyle: { color: AURORA.violet }, textStyle: { color: AURORA.subtle } }],
    series: [
      {
        name: "Kunjungan wisman", type: "line", data: data.map((d) => d.wisman), yAxisIndex: 0,
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: "rgba(167,139,250,0.35)" }, { offset: 1, color: "rgba(167,139,250,0)" }] } },
        markArea: covidArea,
      },
      { name: "Perjalanan wisnus", type: "line", data: data.map((d) => d.wisnus), yAxisIndex: 1, lineStyle: { width: 2 }, color: AURORA.green },
    ],
  };
  return <EChart option={option} height={340} ariaLabel="Grafik garis tren bulanan kunjungan wisman dan perjalanan wisnus 2018–2025 dengan anotasi periode COVID-19" />;
}

/* ---------------------------------------------------------------- */
/* TPK nasional bulanan + garis acuan rata-rata 2019                 */
/* ---------------------------------------------------------------- */
export function TpkChart({ data }: { data: Tren[] }) {
  const base = data.filter((d) => d.tahun === 2019 && d.tpk != null);
  const avg2019 = base.reduce((s, d) => s + (d.tpk ?? 0), 0) / (base.length || 1);
  const option: EChartsOption = {
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", valueFormatter: (v) => `${fmtDec(v as number, 2)}%` },
    xAxis: { type: "category", data: data.map((d) => d.label), boundaryGap: false, axisLabel: { hideOverlap: true } },
    yAxis: { type: "value", min: 0, max: 70, axisLabel: { formatter: "{value}%" } },
    series: [{
      name: "TPK hotel bintang", type: "line", data: data.map((d) => d.tpk), color: AURORA.cyan,
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [
        { offset: 0, color: "rgba(34,211,238,0.3)" }, { offset: 1, color: "rgba(34,211,238,0)" }] } },
      markArea: covidArea,
      markLine: {
        silent: true, symbol: "none",
        lineStyle: { color: AURORA.amber, type: "dashed" },
        label: { color: AURORA.amber, formatter: `Rata-rata 2019: ${fmtDec(avg2019, 1)}%`, position: "insideEndTop" },
        data: [{ yAxis: Number(avg2019.toFixed(2)) }],
      },
    }],
  };
  return <EChart option={option} height={280} ariaLabel="Grafik TPK hotel bintang nasional per bulan dengan garis acuan rata-rata 2019" />;
}

/* ---------------------------------------------------------------- */
/* Heatmap musiman: indeks musiman (nilai bulan ÷ rata-rata tahunan) */
/* ---------------------------------------------------------------- */
const METRIK = { wisman: "Wisman", wisnus: "Wisnus", tpk: "TPK" } as const;
type MetrikKey = keyof typeof METRIK;

export function SeasonalHeatmap({ data }: { data: Tren[] }) {
  const [metric, setMetric] = useState<MetrikKey>("wisman");
  const { years, cells } = useMemo(() => {
    const years = [...new Set(data.map((d) => d.tahun))].sort();
    const cells: [number, number, number | null][] = [];
    years.forEach((y, yi) => {
      const rows = data.filter((d) => d.tahun === y && d[metric] != null);
      if (rows.length < 12) {
        rows.forEach((r) => cells.push([r.bulan - 1, yi, null]));
        return;
      }
      const mean = rows.reduce((s, r) => s + (r[metric] as number), 0) / rows.length;
      rows.forEach((r) => cells.push([r.bulan - 1, yi, Math.round(((r[metric] as number) / mean) * 100)]));
    });
    return { years, cells };
  }, [data, metric]);

  const option: EChartsOption = {
    grid: { left: 8, right: 8, top: 8, bottom: 56, containLabel: true },
    tooltip: {
      formatter: (p) => {
        const v = (p as unknown as { value: [number, number, number | null] }).value;
        return `${BULAN_PENDEK[v[0]]} ${years[v[1]]}<br/><b>Indeks musiman: ${v[2] ?? "–"}</b><br/><span style="color:${AURORA.subtle}">100 = rata-rata bulanan tahun tsb.</span>`;
      },
    },
    xAxis: { type: "category", data: BULAN_PENDEK, splitArea: { show: false } },
    yAxis: { type: "category", data: years.map(String), inverse: true },
    visualMap: {
      min: 60, max: 140, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemHeight: 160, itemWidth: 10,
      inRange: { color: ["#1e1b4b", "#4c1d95", "#2563eb", "#06b6d4", "#34d399"] },
      text: ["di atas rata-rata", "di bawah"], textStyle: { color: AURORA.subtle, fontSize: 11 },
    },
    series: [{
      type: "heatmap", data: cells.filter((c) => c[2] != null),
      label: { show: true, color: "#f4f4fb", fontSize: 10, formatter: (p) => String((p.value as number[])[2]) },
      itemStyle: { borderColor: "rgba(11,11,26,0.9)", borderWidth: 2, borderRadius: 6 },
      emphasis: { itemStyle: { borderColor: "#fff" } },
    }],
  };
  return (
    <div>
      <div role="tablist" aria-label="Pilih metrik musiman" className="mb-3 inline-flex rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
        {(Object.keys(METRIK) as MetrikKey[]).map((k) => (
          <button key={k} role="tab" aria-selected={metric === k} onClick={() => setMetric(k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${metric === k ? "bg-white/15 text-fg" : "text-fg-muted hover:text-fg"}`}>
            {METRIK[k]}
          </button>
        ))}
      </div>
      <EChart option={option} height={330} ariaLabel={`Heatmap indeks musiman ${METRIK[metric]} per bulan dan tahun`} />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Indeks pemulihan tahunan (2019 = 100)                             */
/* ---------------------------------------------------------------- */
export function RecoveryChart({ data }: { data: Tren[] }) {
  const years = [...new Set(data.map((d) => d.tahun))].sort();
  const total = (y: number, k: "wisman" | "wisnus") => {
    const rows = data.filter((d) => d.tahun === y && d[k] != null);
    return rows.length === 12 ? rows.reduce((s, r) => s + (r[k] as number), 0) : null;
  };
  const avg = (y: number) => {
    const rows = data.filter((d) => d.tahun === y && d.tpk != null);
    return rows.length === 12 ? rows.reduce((s, r) => s + (r.tpk as number), 0) / 12 : null;
  };
  const idx = (v: number | null, b: number | null) => (v == null || !b ? null : Math.round((v / b) * 1000) / 10);
  const b = { wisman: total(2019, "wisman"), wisnus: total(2019, "wisnus"), tpk: avg(2019) };
  const option: EChartsOption = {
    grid: { left: 8, right: 8, top: 40, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0 },
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "–" : `${fmtDec(v as number, 1)}`) },
    xAxis: { type: "category", data: years.map(String) },
    yAxis: { type: "value", axisLabel: { formatter: "{value}" } },
    series: [
      { name: "Wisman", type: "bar", barMaxWidth: 18, data: years.map((y) => idx(total(y, "wisman"), b.wisman)) },
      { name: "Wisnus", type: "bar", barMaxWidth: 18, data: years.map((y) => idx(total(y, "wisnus"), b.wisnus)), color: AURORA.green },
      { name: "TPK", type: "bar", barMaxWidth: 18, data: years.map((y) => idx(avg(y), b.tpk)), color: AURORA.cyan,
        markLine: { silent: true, symbol: "none", data: [{ yAxis: 100 }], lineStyle: { color: AURORA.amber, type: "dashed" },
          label: { color: AURORA.amber, formatter: "Level 2019 = 100" } } },
    ],
  };
  return <EChart option={option} height={300} ariaLabel="Diagram batang indeks pemulihan tahunan wisman, wisnus, dan TPK terhadap 2019" />;
}

/* ---------------------------------------------------------------- */
/* Top pintu masuk wisman                                            */
/* ---------------------------------------------------------------- */
export function GatewayChart({ rows }: { rows: { pintu: string; jenis: string; total: number }[] }) {
  const sorted = [...rows].sort((a, b) => a.total - b.total).slice(-10);
  const col = { udara: AURORA.violet, laut: AURORA.blue, darat: AURORA.green, lainnya: AURORA.subtle } as Record<string, string>;
  const option: EChartsOption = {
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: "item", formatter: (p) => {
      const d = (p as unknown as { data: { value: number; jenis: string }; name: string });
      return `${d.name} <span style="color:${AURORA.subtle}">(pintu ${d.data.jenis})</span><br/><b>${fmtInt(d.data.value)}</b> kunjungan`;
    } },
    xAxis: { type: "value", splitNumber: 3, axisLabel: { formatter: (v: number) => fmtCompact(v) } },
    yAxis: { type: "category", data: sorted.map((r) => r.pintu), axisLabel: { color: AURORA.muted, width: 120, overflow: "truncate" } },
    series: [{
      type: "bar", barMaxWidth: 16,
      data: sorted.map((r) => ({ value: r.total, jenis: r.jenis, itemStyle: { color: col[r.jenis], borderRadius: [0, 6, 6, 0] } })),
      label: { show: true, position: "right", color: AURORA.muted, fontSize: 11, formatter: (p) => fmtCompact(p.value as number) },
    }],
  };
  return <EChart option={option} height={340} ariaLabel="Diagram batang 10 pintu masuk wisman terbesar" />;
}

/* ---------------------------------------------------------------- */
/* ASEAN: kedatangan internasional & penerimaan per wisatawan (WB)   */
/* ---------------------------------------------------------------- */
export function AseanChart({ rows }: { rows: WbRow[] }) {
  const [mode, setMode] = useState<"arrivals" | "receipts">("arrivals");
  const countries = ["Indonesia", "Thailand", "Malaysia", "Vietnam", "Singapura", "Filipina"];
  const years = [...new Set(rows.map((r) => Math.floor(r.waktu_id / 100)))].sort();
  const get = (c: string, y: number, k: string) =>
    rows.find((r) => r.negara_nama === c && Math.floor(r.waktu_id / 100) === y && r.indikator_kode === k)?.nilai ?? null;

  const option: EChartsOption =
    mode === "arrivals"
      ? {
          grid: { left: 8, right: 8, top: 40, bottom: 8, containLabel: true },
          legend: { top: 0, left: 0, type: "scroll" },
          tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "–" : `${fmtCompact(v as number)} orang`) },
          xAxis: { type: "category", data: years.map(String), boundaryGap: false },
          yAxis: { type: "value", axisLabel: { formatter: (v: number) => fmtCompact(v) } },
          series: countries.map((c) => ({
            name: c, type: "line", data: years.map((y) => get(c, y, "ST.INT.ARVL")),
            lineStyle: { width: c === "Indonesia" ? 4 : 1.6, opacity: c === "Indonesia" ? 1 : 0.7 },
            symbolSize: c === "Indonesia" ? 7 : 4, z: c === "Indonesia" ? 10 : 2,
          })),
        }
      : (() => {
          const per = countries
            .map((c) => {
              const r = get(c, 2019, "ST.INT.RCPT.CD");
              const a = get(c, 2019, "ST.INT.ARVL");
              return { c, v: r && a ? Math.round(r / a) : null };
            })
            .filter((d) => d.v != null)
            .sort((a, b) => (a.v ?? 0) - (b.v ?? 0));
          return {
            grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
            tooltip: { trigger: "item", formatter: (p) => `${(p as { name: string }).name}<br/><b>US$ ${fmtInt((p as { value: number }).value)}</b> per kedatangan (2019)` },
            xAxis: { type: "value", axisLabel: { formatter: (v: number) => `$${fmtInt(v)}` } },
            yAxis: { type: "category", data: per.map((d) => d.c) },
            series: [{
              type: "bar", barMaxWidth: 18,
              data: per.map((d) => ({ value: d.v, itemStyle: { color: d.c === "Indonesia" ? AURORA.violet : "rgba(96,165,250,0.55)", borderRadius: [0, 6, 6, 0] } })),
              label: { show: true, position: "right", color: AURORA.muted, formatter: (p) => `$${fmtInt(p.value as number)}` },
            }],
          } as EChartsOption;
        })();

  return (
    <div>
      <div role="tablist" aria-label="Pilih tampilan ASEAN" className="mb-3 inline-flex rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
        {([["arrivals", "Kedatangan 2010–2020"], ["receipts", "Penerimaan / wisatawan 2019"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === k ? "bg-white/15 text-fg" : "text-fg-muted hover:text-fg"}`}>
            {l}
          </button>
        ))}
      </div>
      <EChart option={option} height={320} ariaLabel="Perbandingan pariwisata internasional Indonesia dengan negara ASEAN (World Bank)" />
    </div>
  );
}
