"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, HeatmapChart, LineChart, MapChart, PieChart, SankeyChart, ScatterChart } from "echarts/charts";
import {
  DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent,
  TitleComponent, TooltipComponent, VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

echarts.use([
  BarChart, LineChart, ScatterChart, MapChart, HeatmapChart, PieChart, SankeyChart,
  GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, MarkAreaComponent,
  MarkLineComponent, DataZoomComponent, TitleComponent, CanvasRenderer,
]);

export const AURORA = {
  violet: "#a78bfa",
  blue: "#60a5fa",
  green: "#34d399",
  cyan: "#22d3ee",
  pink: "#f472b6",
  amber: "#fbbf24",
  text: "#f4f4fb",
  muted: "#b4b4cf",
  subtle: "#8d8db0",
  grid: "rgba(255,255,255,0.08)",
};

/** Tema ECharts kustom yang selaras dengan glassmorphism Aurora. */
const theme = {
  color: [AURORA.violet, AURORA.blue, AURORA.green, AURORA.cyan, AURORA.pink, AURORA.amber],
  backgroundColor: "transparent",
  textStyle: { fontFamily: "var(--font-jakarta), system-ui, sans-serif", color: AURORA.muted },
  title: { textStyle: { color: AURORA.text } },
  legend: { textStyle: { color: AURORA.muted, fontSize: 12 }, icon: "roundRect", itemWidth: 12, itemHeight: 8 },
  tooltip: {
    backgroundColor: "rgba(18,18,42,0.88)",
    borderColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    padding: [10, 12],
    textStyle: { color: AURORA.text, fontSize: 12 },
    extraCssText: "backdrop-filter: blur(16px); border-radius: 14px; box-shadow: 0 12px 32px rgba(0,0,0,.45);",
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.18)" } },
    axisTick: { show: false },
    axisLabel: { color: AURORA.subtle, fontSize: 11 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisLabel: { color: AURORA.subtle, fontSize: 11 },
    splitLine: { lineStyle: { color: AURORA.grid, type: "dashed" } },
    nameTextStyle: { color: AURORA.subtle, fontSize: 11 },
  },
  line: { symbol: "circle", symbolSize: 5, smooth: true, lineStyle: { width: 2.4 } },
  bar: { itemStyle: { borderRadius: [6, 6, 0, 0] } },
  visualMap: { textStyle: { color: AURORA.muted } },
};
echarts.registerTheme("aurora", theme);

export { echarts };

export function EChart({
  option,
  height = 320,
  ariaLabel,
  onEvents,
}: {
  option: EChartsOption;
  height?: number | string;
  ariaLabel: string;
  onEvents?: Record<string, (p: unknown) => void>;
}) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ReactEChartsCore
        echarts={echarts}
        option={{ aria: { enabled: true }, animationDuration: 700, ...option }}
        theme="aurora"
        notMerge
        lazyUpdate
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "canvas" }}
        onEvents={onEvents}
      />
    </div>
  );
}
