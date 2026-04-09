import EchartsCanvas from '../EchartsCanvas';
import { tooltipItem, legendDark } from '../chartDefaults';

export function buildHeatmapOption(data) {
  const xLabels = data?.xLabels ?? [];
  const yLabels = data?.yLabels ?? [];
  const raw = data?.data ?? [];
  const max = Math.max(1, ...raw.map((d) => d[2] ?? 0));
  return {
    ...tooltipItem(),
    ...legendDark(true),
    grid: { height: '62%', top: '12%', left: '10%', right: '8%' },
    xAxis: { type: 'category', data: xLabels, splitArea: { show: true }, axisLabel: { color: '#94a3b8' } },
    yAxis: { type: 'category', data: yLabels, splitArea: { show: true }, axisLabel: { color: '#94a3b8' } },
    visualMap: {
      min: 0,
      max,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      textStyle: { color: '#94a3b8' },
      inRange: { color: ['#0c4a6e', '#0ea5e9', '#e0f2fe'] },
    },
    series: [
      {
        type: 'heatmap',
        data: raw,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.45)' } },
      },
    ],
  };
}

export default function HeatmapModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildHeatmapOption(data)} height={height} loading={loading} />;
}
