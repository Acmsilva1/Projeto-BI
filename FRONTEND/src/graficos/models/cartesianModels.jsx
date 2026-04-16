import EchartsCanvas from '../EchartsCanvas';
import {
  CHART_COLORS,
  baseGrid,
  tooltipDark,
  legendDark,
  categoryAxis,
  valueAxis,
} from '../chartDefaults';

function cartesianSeries(type, series, extra = {}) {
  return (series || []).map((s, i) => ({
    type,
    name: s.name,
    data: s.data,
    itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    ...extra,
  }));
}

export function buildBarVerticalOption(data) {
  const categories = data?.categories ?? [];
  const series = data?.series ?? [];
  const stacked = Boolean(data?.stacked);
  return {
    color: CHART_COLORS,
    ...tooltipDark(),
    ...legendDark(),
    grid: baseGrid(),
    xAxis: { ...categoryAxis(), data: categories },
    yAxis: valueAxis(),
    series: cartesianSeries('bar', series, stacked ? { stack: 'total' } : {}),
  };
}

export function BarVerticalModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildBarVerticalOption(data)} height={height} loading={loading} />;
}

export function buildBarHorizontalOption(data) {
  const categories = data?.categories ?? [];
  const series = data?.series ?? [];
  return {
    color: CHART_COLORS,
    ...tooltipDark(),
    ...legendDark(),
    grid: baseGrid(),
    xAxis: valueAxis(),
    yAxis: { ...categoryAxis(), data: categories },
    series: cartesianSeries('bar', series),
  };
}

export function BarHorizontalModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildBarHorizontalOption(data)} height={height} loading={loading} />;
}

export function buildBarStackedOption(data) {
  return buildBarVerticalOption({ ...data, stacked: true });
}

export function BarStackedModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildBarStackedOption(data)} height={height} loading={loading} />;
}

export function buildLineOption(data) {
  const categories = data?.categories ?? [];
  const series = data?.series ?? [];
  const smooth = Boolean(data?.smooth);
  return {
    color: CHART_COLORS,
    ...tooltipDark(),
    ...legendDark(),
    grid: baseGrid(),
    xAxis: { ...categoryAxis(), data: categories, boundaryGap: false },
    yAxis: valueAxis(),
    series: cartesianSeries('line', series, {
      smooth,
      symbol: 'circle',
      symbolSize: 6,
    }),
  };
}

export function LineModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildLineOption(data)} height={height} loading={loading} />;
}

export function buildAreaOption(data) {
  const opt = buildLineOption(data);
  opt.series = (opt.series || []).map((s) => ({
    ...s,
    type: 'line',
    areaStyle: { opacity: 0.25 },
  }));
  return opt;
}

export function AreaModel({ data, height = 360, loading }) {
  return <EchartsCanvas option={buildAreaOption(data)} height={height} loading={loading} />;
}
