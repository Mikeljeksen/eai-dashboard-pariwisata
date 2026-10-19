"use client";

import { useEffect, useState } from "react";
import type { EChartsOption } from "echarts";
import { AURORA, EChart, echarts } from "./echart";
import { Skeleton } from "@/components/ui";
import { fmtCompact, fmtDec, fmtInt } from "@/lib/format";

export type ProvPoint = {
  kode: number;
  nama: string;
  pulau: string;
  nilai: number | null;
  wisnus: number | null;
  tpk: number | null;
  kamar: number | null;
};

const PULAU_COLOR: Record<string, string> = {
  Sumatera: AURORA.violet,
  Jawa: AURORA.blue,
  "Bali-Nusa Tenggara": AURORA.pink,
  Kalimantan: AURORA.green,
  Sulawesi: AURORA.cyan,
  Maluku: AURORA.amber,
  Papua: "#fb923c",
};

const fmtMetric = (v: number | null, unit: string) =>
  v == null ? "tidak ada data" : unit === "%" ? `${fmtDec(v, 2)}%` : unit === "rasio" ? fmtDec(v, 1) : fmtInt(v);

/* ---------------------------------------------------------------- */
/* Peta choropleth 38 provinsi                                       */
/* ---------------------------------------------------------------- */
let mapReady: Promise<void> | null = null;
function ensureMap() {
  mapReady ??= fetch("/geo/indonesia-38-provinsi.geojson")
    .then((r) => r.json())
    .then((geo) => echarts.registerMap("indonesia38", geo));
  return mapReady;
}

export function ChoroplethMap({ points, metricLabel, unit }: { points: ProvPoint[]; metricLabel: string; unit: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureMap().then(() => setReady(true));
  }, []);

  if (!ready) return <Skeleton className="h-[380px] w-full" />;

  // Metrik jumlah sangat timpang (Jawa mendominasi) -> warna memakai skala log10
  const useLog = unit !== "%" && unit !== "rasio";
  const tr = (v: number | null) => (v == null ? null : useLog ? Math.log10(Math.max(v, 1)) : v);
  const vals = points.map((p) => tr(p.nilai)).filter((v): v is number => v != null);
  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: (p) => {
        const d = (p as unknown as { data?: { nama: string; asli: number | null } }).data;
        return d ? `<b>${d.nama}</b><br/>${metricLabel}: ${fmtMetric(d.asli, unit)}` : "Tidak ada data";
      },
    },
    visualMap: {
      min: vals.length ? Math.min(...vals) : 0,
      max: vals.length ? Math.max(...vals) : 1,
      left: 8, bottom: 8, itemHeight: 110, itemWidth: 10, calculable: true,
      text: [useLog ? "tinggi (skala log)" : "tinggi", "rendah"],
      inRange: { color: ["#1e1b4b", "#4c1d95", "#6d28d9", "#2563eb", "#06b6d4", "#34d399"] },
      formatter: (v) => {
        const x = useLog ? 10 ** (v as number) : (v as number);
        return unit === "%" ? `${fmtDec(x, 0)}%` : unit === "rasio" ? fmtDec(x, 0) : fmtCompact(x);
      },
    },
    series: [{
      type: "map",
      map: "indonesia38",
      nameProperty: "KODE_PROV",
      roam: true,
      scaleLimit: { min: 1, max: 6 },
      layoutCenter: ["50%", "50%"],
      layoutSize: "112%",
      itemStyle: { areaColor: "rgba(255,255,255,0.06)", borderColor: "rgba(11,11,26,0.9)", borderWidth: 0.6 },
      emphasis: { label: { show: false }, itemStyle: { areaColor: "#f9a8d4" } },
      select: { disabled: true },
      data: points.map((p) => ({ name: String(p.kode), value: tr(p.nilai) ?? undefined, asli: p.nilai, nama: p.nama })),
    }],
  };
  return <EChart option={option} height={380} ariaLabel={`Peta choropleth Indonesia: ${metricLabel} per provinsi`} />;
}

/* ---------------------------------------------------------------- */
/* Ranking bar                                                       */
/* ---------------------------------------------------------------- */
export function RankingChart({ points, metricLabel, unit }: { points: ProvPoint[]; metricLabel: string; unit: string }) {
  const sorted = points.filter((p) => p.nilai != null).sort((a, b) => (a.nilai ?? 0) - (b.nilai ?? 0));
  const option: EChartsOption = {
    grid: { left: 8, right: 64, top: 4, bottom: 4, containLabel: true },
    tooltip: { trigger: "item", formatter: (p) => `<b>${(p as { name: string }).name}</b><br/>${metricLabel}: ${fmtMetric((p as { value: number }).value, unit)}` },
    xAxis: { type: "value", axisLabel: { formatter: (v: number) => (unit === "%" ? `${v}%` : fmtCompact(v)) } },
    yAxis: { type: "category", data: sorted.map((p) => p.nama), axisLabel: { color: AURORA.muted, fontSize: 11, width: 130, overflow: "truncate" } },
    series: [{
      type: "bar", barMaxWidth: 12,
      data: sorted.map((p) => ({ value: p.nilai, itemStyle: { color: PULAU_COLOR[p.pulau] ?? AURORA.violet, borderRadius: [0, 5, 5, 0] } })),
      label: { show: true, position: "right", color: AURORA.subtle, fontSize: 10,
        formatter: (p) => (unit === "%" ? `${fmtDec(p.value as number, 1)}%` : unit === "rasio" ? fmtDec(p.value as number, 1) : fmtCompact(p.value as number)) },
    }],
  };
  return <EChart option={option} height={Math.max(260, sorted.length * 19 + 20)} ariaLabel={`Ranking provinsi berdasarkan ${metricLabel}`} />;
}

export function PulauLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-fg-muted" aria-label="Legenda warna pulau">
      {Object.entries(PULAU_COLOR).map(([k, c]) => (
        <li key={k} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: c }} />{k}</li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- */
/* Scatter korelasi lintas dataset                                   */
/* ---------------------------------------------------------------- */
export function CorrelationScatter({ points, mode }: { points: ProvPoint[]; mode: "wisnus_tpk" | "kamar_wisnus" }) {
  const pts = points.filter((p) => (mode === "wisnus_tpk" ? p.wisnus != null && p.tpk != null : p.kamar != null && p.wisnus != null));
  const pulau = [...new Set(pts.map((p) => p.pulau))];
  const xName = mode === "wisnus_tpk" ? "Perjalanan wisnus (skala log)" : "Kamar akomodasi (skala log)";
  const yName = mode === "wisnus_tpk" ? "TPK hotel bintang (%)" : "Perjalanan wisnus (skala log)";
  const maxKamar = Math.max(1, ...pts.map((p) => p.kamar ?? 0));

  const option: EChartsOption = {
    grid: { left: 8, right: 24, top: 48, bottom: 28, containLabel: true },
    legend: { top: 0, left: 0, type: "scroll" },
    tooltip: {
      trigger: "item",
      formatter: (p) => {
        const d = (p as unknown as { data: { p: ProvPoint } }).data.p;
        return `<b>${d.nama}</b><br/>Wisnus: ${fmtInt(d.wisnus)}<br/>TPK: ${d.tpk == null ? "–" : fmtDec(d.tpk, 2) + "%"}<br/>Kamar akomodasi: ${fmtInt(d.kamar)}`;
      },
    },
    xAxis: { type: "log", name: xName, nameLocation: "middle", nameGap: 26, axisLabel: { formatter: (v: number) => fmtCompact(v) },
      splitLine: { lineStyle: { color: AURORA.grid, type: "dashed" } } },
    yAxis: mode === "wisnus_tpk"
      ? { type: "value", name: yName, axisLabel: { formatter: "{value}%" } }
      : { type: "log", name: yName, axisLabel: { formatter: (v: number) => fmtCompact(v) } },
    series: pulau.map((pl) => ({
      name: pl,
      type: "scatter",
      color: PULAU_COLOR[pl],
      itemStyle: { opacity: 0.85, borderColor: "rgba(255,255,255,0.5)", borderWidth: 0.8 },
      emphasis: { label: { show: true, formatter: (p: { data: { p: ProvPoint } }) => p.data.p.nama, color: "#fff", position: "top" } },
      data: pts.filter((p) => p.pulau === pl).map((p) => ({
        value: mode === "wisnus_tpk" ? [p.wisnus, p.tpk] : [p.kamar, p.wisnus],
        symbolSize: mode === "wisnus_tpk" ? 8 + 26 * Math.sqrt((p.kamar ?? 0) / maxKamar) : 12,
        p,
      })),
    })) as EChartsOption["series"],
  };
  return <EChart option={option} height={360} ariaLabel={`Scatter korelasi ${xName} terhadap ${yName} per provinsi`} />;
}

export function CorrelationPanel({ points, rWisnusTpk, rKamarWisnus }: {
  points: ProvPoint[];
  rWisnusTpk: string;
  rKamarWisnus: string;
}) {
  const [mode, setMode] = useState<"wisnus_tpk" | "kamar_wisnus">("wisnus_tpk");
  return (
    <div>
      <div role="tablist" aria-label="Pilih pasangan variabel" className="mb-2 inline-flex flex-wrap rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
        {([["wisnus_tpk", "Wisnus × TPK"], ["kamar_wisnus", "Kamar × Wisnus"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === k ? "bg-white/15 text-fg" : "text-fg-muted hover:text-fg"}`}>
            {l}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-fg-muted">
        {mode === "wisnus_tpk"
          ? <>Korelasi Pearson log(wisnus) vs TPK: <b className="text-fg">{rWisnusTpk}</b>. Ukuran titik sebanding dengan jumlah kamar akomodasi (PDF).</>
          : <>Korelasi Pearson log(kamar) vs log(wisnus): <b className="text-fg">{rKamarWisnus}</b>.</>}
      </p>
      <CorrelationScatter points={points} mode={mode} />
    </div>
  );
}
