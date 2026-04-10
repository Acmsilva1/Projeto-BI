import EchartsCanvas from '../EchartsCanvas';
import { CHART_COLORS, tooltipItem } from '../chartDefaults';

export function buildGraphOption(data) {
  const cats = data?.categories ?? [];
  const links = data?.links ?? [];
  const nodes = cats.map((c, i) => ({
    id: String(i),
    name: c.name,
    symbolSize: c.symbolSize ?? 40,
    itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
  }));
  const nameToId = Object.fromEntries(nodes.map((n) => [n.name, n.id]));
  const edges = links
    .map((l) => {
      const s = nameToId[l.source];
      const t = nameToId[l.target];
      if (s == null || t == null) return null;
      return { source: s, target: t };
    })
    .filter(Boolean);
  return {
    ...tooltipItem(),
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        force: { repulsion: 220, edgeLength: [80, 140] },
        label: { show: true, color: '#f8fafc', fontWeight: 600 },
        lineStyle: { color: '#64748b', curveness: 0.15 },
        data: nodes,
        links: edges,
      },
    ],
  };
}

export default function GraphModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildGraphOption(data)} height={height} loading={loading} />;
}
