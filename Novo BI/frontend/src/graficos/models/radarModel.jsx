import EchartsCanvas from '../EchartsCanvas';
import { CHART_COLORS, tooltipItem, legendDark } from '../chartDefaults';

export function buildRadarOption(data) {
  const indicators = (data?.indicators ?? []).map((i) => ({
    name: i.name,
    max: i.max ?? 100,
  }));
  const seriesList = data?.series ?? [];
  return {
    color: CHART_COLORS,
    ...tooltipItem(),
    ...legendDark(true),
    radar: {
      indicator: indicators,
      splitArea: { areaStyle: { color: ['rgba(14,165,233,0.06)', 'rgba(51,65,85,0.2)'] } },
      axisName: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#475569' } },
    },
    series: [
      {
        type: 'radar',
        data: seriesList.map((s, i) => ({
          name: s.name,
          value: s.value,
          areaStyle: { opacity: 0.12 },
          lineStyle: { width: 2, color: CHART_COLORS[i % CHART_COLORS.length] },
        })),
      },
    ],
  };
}

export default function RadarModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildRadarOption(data)} height={height} loading={loading} />;
}
