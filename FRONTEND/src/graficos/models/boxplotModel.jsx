import EchartsCanvas from '../EchartsCanvas';
import {
  CHART_COLORS,
  baseGrid,
  tooltipDark,
  legendDark,
  categoryAxis,
  valueAxis,
} from '../chartDefaults';

export function buildBoxplotOption(data) {
  const categories = data?.categories ?? [];
  const boxData = data?.boxData ?? [];
  const outliers = data?.outliers ?? [];
  return {
    color: CHART_COLORS,
    ...tooltipDark(),
    ...legendDark(),
    grid: baseGrid(),
    xAxis: { ...categoryAxis(), data: categories, boundaryGap: true },
    yAxis: valueAxis(),
    series: [
      {
        name: 'Boxplot',
        type: 'boxplot',
        data: boxData,
        itemStyle: { color: '#0ea5e9', borderColor: '#38bdf8' },
      },
      {
        name: 'Outliers',
        type: 'scatter',
        data: outliers,
        itemStyle: { color: '#f97316' },
      },
    ],
  };
}

export default function BoxplotModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildBoxplotOption(data)} height={height} loading={loading} />;
}
