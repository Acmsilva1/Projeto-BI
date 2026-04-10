import EchartsCanvas from '../EchartsCanvas';
import { baseGrid, tooltipDark, categoryAxis, valueAxis } from '../chartDefaults';

export function buildCandlestickOption(data) {
  const categories = data?.categories ?? [];
  const values = data?.values ?? [];
  return {
    ...tooltipDark(),
    grid: baseGrid(),
    xAxis: { ...categoryAxis(), data: categories },
    yAxis: { ...valueAxis(), scale: true },
    series: [
      {
        type: 'candlestick',
        data: values,
        itemStyle: {
          color: '#22c55e',
          color0: '#ef4444',
          borderColor: '#22c55e',
          borderColor0: '#ef4444',
        },
      },
    ],
  };
}

export default function CandlestickModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildCandlestickOption(data)} height={height} loading={loading} />;
}
