import EchartsCanvas from '../EchartsCanvas';
import { CHART_COLORS, tooltipItem } from '../chartDefaults';

export function buildSunburstOption(data) {
  const items = data?.items ?? [];
  return {
    color: CHART_COLORS,
    ...tooltipItem(),
    series: [
      {
        type: 'sunburst',
        data: items,
        radius: [0, '92%'],
        label: { rotate: 'radial', color: '#0f172a', fontWeight: 600 },
        itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: '#0f172a' },
        levels: [
          {},
          { r0: '12%', r: '38%', itemStyle: { borderWidth: 2 } },
          { r0: '38%', r: '62%', label: { rotate: 'tangential' } },
          { r0: '62%', r: '88%', label: { position: 'outside', color: '#cbd5e1' } },
        ],
      },
    ],
  };
}

export default function SunburstModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildSunburstOption(data)} height={height} loading={loading} />;
}
