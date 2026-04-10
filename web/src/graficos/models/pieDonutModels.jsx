import EchartsCanvas from '../EchartsCanvas';
import { CHART_COLORS, tooltipItem, legendDark } from '../chartDefaults';

function pieBase(data, radius) {
  const items = data?.items ?? [];
  return {
    color: CHART_COLORS,
    ...tooltipItem(),
    ...legendDark(true),
    series: [
      {
        type: 'pie',
        radius,
        center: ['50%', '46%'],
        data: items.map((d) => ({ name: d.name, value: d.value })),
        label: { color: '#cbd5e1' },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.45)' },
        },
      },
    ],
  };
}

export function buildPieOption(data) {
  return pieBase(data, '58%');
}

export function PieModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildPieOption(data)} height={height} loading={loading} />;
}

export function buildDonutOption(data) {
  return pieBase(data, ['42%', '62%']);
}

export function DonutModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildDonutOption(data)} height={height} loading={loading} />;
}
