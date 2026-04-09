import EchartsCanvas from '../EchartsCanvas';
import { CHART_COLORS, tooltipItem } from '../chartDefaults';

export function buildTreemapOption(data) {
  const items = data?.items ?? [];
  return {
    color: CHART_COLORS,
    ...tooltipItem(),
    series: [
      {
        type: 'treemap',
        roam: false,
        breadcrumb: { show: true, itemStyle: { color: '#334155', borderColor: '#475569', textStyle: { color: '#e2e8f0' } } },
        label: { show: true, color: '#0f172a', fontWeight: 600 },
        upperLabel: { show: true, color: '#f8fafc' },
        data: items,
      },
    ],
  };
}

export default function TreemapModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildTreemapOption(data)} height={height} loading={loading} />;
}
