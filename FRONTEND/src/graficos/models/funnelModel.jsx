import EchartsCanvas from '../EchartsCanvas';
import { CHART_COLORS, tooltipItem, legendDark } from '../chartDefaults';

export function buildFunnelOption(data) {
  const items = data?.items ?? [];
  const maxV = Math.max(1, ...items.map((i) => Number(i.value) || 0));
  return {
    color: CHART_COLORS,
    ...tooltipItem(),
    ...legendDark(true),
    series: [
      {
        type: 'funnel',
        left: '8%',
        top: 24,
        bottom: 48,
        width: '84%',
        min: 0,
        max: maxV,
        minSize: '0%',
        maxSize: '100%',
        sort: 'descending',
        gap: 4,
        label: { show: true, position: 'inside', color: '#0f172a', fontWeight: 600 },
        data: items.map((d) => ({ name: d.name, value: d.value })),
      },
    ],
  };
}

export default function FunnelModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildFunnelOption(data)} height={height} loading={loading} />;
}
