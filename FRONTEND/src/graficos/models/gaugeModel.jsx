import EchartsCanvas from '../EchartsCanvas';

export function buildGaugeOption(data) {
  const value = Number(data?.value ?? 0);
  const min = Number(data?.min ?? 0);
  const max = Number(data?.max ?? 100);
  const name = data?.name ?? '';
  return {
    series: [
      {
        type: 'gauge',
        min,
        max,
        splitNumber: 8,
        axisLine: {
          lineStyle: {
            width: 14,
            color: [
              [0.3, '#ef4444'],
              [0.7, '#eab308'],
              [1, '#22c55e'],
            ],
          },
        },
        pointer: { itemStyle: { color: '#0ea5e9' } },
        axisTick: { distance: -14, length: 6, lineStyle: { color: '#64748b' } },
        splitLine: { distance: -16, length: 12, lineStyle: { color: '#64748b' } },
        axisLabel: { color: '#94a3b8', distance: 18 },
        detail: {
          valueAnimation: true,
          formatter: '{value}',
          color: '#f1f5f9',
          fontSize: 22,
        },
        title: { offsetCenter: [0, '72%'], color: '#94a3b8', fontSize: 12 },
        data: [{ value, name }],
      },
    ],
  };
}

export default function GaugeModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildGaugeOption(data)} height={height} loading={loading} />;
}
