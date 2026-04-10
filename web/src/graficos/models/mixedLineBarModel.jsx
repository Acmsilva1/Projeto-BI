import EchartsCanvas from '../EchartsCanvas';
import {
  CHART_COLORS,
  baseGrid,
  tooltipDark,
  legendDark,
  categoryAxis,
  valueAxis,
} from '../chartDefaults';

/** Barras + linha com dois eixos Y (ex.: volume + %). */
export function buildMixedLineBarOption(data) {
  const categories = data?.categories ?? [];
  const barSeries = data?.barSeries ?? { name: 'Volume', data: [] };
  const lineSeries = data?.lineSeries ?? { name: 'Taxa %', data: [] };
  return {
    color: CHART_COLORS,
    ...tooltipDark(),
    ...legendDark(),
    grid: baseGrid(),
    xAxis: { ...categoryAxis(), data: categories },
    yAxis: [
      { ...valueAxis(), name: barSeries.axisName || '', nameTextStyle: { color: '#94a3b8' } },
      {
        ...valueAxis(),
        name: lineSeries.axisName || '%',
        nameTextStyle: { color: '#94a3b8' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: barSeries.name,
        type: 'bar',
        data: barSeries.data,
        itemStyle: { color: CHART_COLORS[0] },
      },
      {
        name: lineSeries.name,
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: lineSeries.data,
        itemStyle: { color: CHART_COLORS[1] },
      },
    ],
  };
}

export default function MixedLineBarModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildMixedLineBarOption(data)} height={height} loading={loading} />;
}
