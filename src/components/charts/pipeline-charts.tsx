"use client";

import type { EChartsOption } from "echarts";
import { AURORA, EChart } from "./echart";
import { fmtInt } from "@/lib/format";

export type FlowRow = { dataset: string; format: string; masuk: number; dimuat: number; alasan: Record<string, number> };

/** Sankey aliran baris: sel mentah per sumber → dimuat ke hub / dibuang (per alasan). */
export function RowFlowSankey({ rows }: { rows: FlowRow[] }) {
  const nodes = new Map<string, { name: string; itemStyle?: { color: string } }>();
  const links: { source: string; target: string; value: number }[] = [];
  const hub = "Dimuat ke hub (Supabase)";
  nodes.set(hub, { name: hub, itemStyle: { color: AURORA.green } });
  const fmtColor: Record<string, string> = { XLSX: AURORA.violet, CSV: AURORA.blue, JSON: AURORA.amber, PDF: AURORA.pink };

  for (const r of rows) {
    const src = `${r.dataset} (${r.format})`;
    nodes.set(src, { name: src, itemStyle: { color: fmtColor[r.format] ?? AURORA.cyan } });
    if (r.dimuat) links.push({ source: src, target: hub, value: r.dimuat });
    for (const [alasan, n] of Object.entries(r.alasan)) {
      const t = `Dibuang: ${alasan}`;
      nodes.set(t, { name: t, itemStyle: { color: "rgba(244,114,182,0.75)" } });
      links.push({ source: src, target: t, value: n });
    }
  }

  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: (p) => {
        const d = p as { dataType: string; data: { source?: string; target?: string; value?: number }; name: string; value: number };
        return d.dataType === "edge"
          ? `${d.data.source} → ${d.data.target}<br/><b>${fmtInt(d.data.value)}</b> baris`
          : `<b>${d.name}</b><br/>${fmtInt(d.value)} baris`;
      },
    },
    series: [{
      type: "sankey",
      left: 4, right: 290, top: 8, bottom: 8,
      nodeWidth: 12, nodeGap: 10, draggable: false,
      emphasis: { focus: "adjacency" },
      label: { color: AURORA.text, fontSize: 11, width: 280, overflow: "truncate", formatter: (p) => p.name },
      lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.35 },
      data: [...nodes.values()],
      links,
    }],
  };
  return <EChart option={option} height={420} ariaLabel="Diagram sankey aliran baris dari tiap sumber ke database hub atau dibuang beserta alasannya" />;
}
