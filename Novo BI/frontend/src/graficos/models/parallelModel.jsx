import EchartsCanvas from '../EchartsCanvas';
import { CHART_COLORS, tooltipItem } from '../chartDefaults';

export function buildParallelOption(data) {
  const dimensions = data?.dimensions ?? [];
  const seriesList = data?.series ?? [];
  return {
    color: CHART_COLORS,
    ...tooltipItem(),
    parallelAxis: dimensions.map((d, i) => ({
      dim: i,
      name: d.name,
      max: d.max ?? 100,
      nameTextStyle: { color: '#94a3b8' },
      axisLabel: { color: '#94a3b8' },
    })),
    parallel: {
      left: '8%',
      right: '10%',
      bottom: '14%',
      top: '16%',
      parallelAxisDefault: {
        areaSelectStyle: { opacity: 0.4 },
      },
    },
    series: seriesList.map((s, i) => ({
      name: s.name,
      type: 'parallel',
      lineStyle: { width: 2, color: CHART_COLORS[i % CHART_COLORS.length] },
      data: s.data,
    })),
  };
}

export default function ParallelModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildParallelOption(data)} height={height} loading={loading} />;
}
