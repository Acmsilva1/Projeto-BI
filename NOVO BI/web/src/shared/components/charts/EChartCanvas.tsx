import ReactECharts from "echarts-for-react";
import type { ReactElement } from "react";

const baseOption = {
  animationDuration: 700,
  tooltip: { trigger: "axis" },
  grid: { left: 24, right: 14, top: 22, bottom: 28 },
  xAxis: {
    type: "category",
    data: ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "D0"],
    axisLine: { lineStyle: { color: "var(--table-grid)" } },
    axisLabel: { color: "var(--table-header-muted)" }
  },
  yAxis: {
    type: "value",
    axisLine: { lineStyle: { color: "var(--table-grid)" } },
    splitLine: { lineStyle: { color: "var(--table-row-sep)" } },
    axisLabel: { color: "var(--table-header-muted)" }
  },
  series: [
    {
      name: "Amostra",
      type: "line",
      smooth: true,
      data: [12, 15, 18, 17, 21, 24, 23],
      lineStyle: { width: 3, color: "var(--dash-live)" },
      areaStyle: { color: "color-mix(in srgb, var(--dash-live) 25%, transparent)" }
    }
  ]
};

export function EChartCanvas(): ReactElement {
  return (
    <ReactECharts
      option={baseOption}
      notMerge
      lazyUpdate
      style={{ width: "100%", height: 240 }}
      opts={{ renderer: "canvas" }}
    />
  );
}
