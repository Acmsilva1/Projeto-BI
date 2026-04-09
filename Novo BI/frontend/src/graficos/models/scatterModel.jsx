import EchartsCanvas from '../EchartsCanvas';
import { CHART_COLORS, baseGrid, tooltipItem, valueAxis } from '../chartDefaults';

export function buildScatterOption(data) {
  const raw = data?.points ?? [];
  const points = raw.map((p) => (Array.isArray(p) ? p : [p.x, p.y]));
  return {
    color: CHART_COLORS,
    ...tooltipItem(),
    grid: baseGrid(),
    xAxis: { ...valueAxis(), scale: true, splitLine: { show: true, lineStyle: { color: '#334155', type: 'dashed' } } },
    yAxis: { ...valueAxis(), scale: true },
    series: [
      {
        type: 'scatter',
        symbolSize: 12,
        data: points,
        itemStyle: { color: CHART_COLORS[0] },
      },
    ],
  };
}

export default function ScatterModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildScatterOption(data)} height={height} loading={loading} />;
}
