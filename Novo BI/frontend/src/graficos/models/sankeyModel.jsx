import EchartsCanvas from '../EchartsCanvas';
import { CHART_COLORS, tooltipItem } from '../chartDefaults';

export function buildSankeyOption(data) {
  const nodes = data?.nodes ?? [];
  const links = data?.links ?? [];
  return {
    color: CHART_COLORS,
    ...tooltipItem(),
    series: [
      {
        type: 'sankey',
        layout: 'none',
        emphasis: { focus: 'adjacency' },
        data: nodes,
        links,
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.45 },
        label: { color: '#e2e8f0', fontSize: 11 },
      },
    ],
  };
}

export default function SankeyModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildSankeyOption(data)} height={height} loading={loading} />;
}
