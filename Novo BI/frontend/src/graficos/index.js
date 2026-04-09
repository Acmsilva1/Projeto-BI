/**
 * Biblioteca de gráficos — habilitada para qualquer módulo via `@/graficos`.
 *
 * Por id + dados (recomendado quando o tipo vem da API ou de config):
 *   import { ChartRenderer } from '@/graficos';
 *   <ChartRenderer chartId="line" data={data} height={320} loading={loading} />
 *
 * Modelo explícito:
 *   import { LineModel } from '@/graficos';
 *   <LineModel data={data} height={320} />
 *
 * Só a option ECharts:
 *   import { useChartOption, EchartsCanvas } from '@/graficos';
 */

export { default as EchartsCanvas } from './EchartsCanvas';
export { default as ChartRenderer } from './ChartRenderer';
export { default as GraficosContainer } from './GraficosContainer';
export { useChartOption } from './useChartOption';
export {
  CHART_REGISTRY,
  CHART_IDS,
  OPTION_BUILDERS,
  buildOptionById,
  getDemoDataForChart,
  getChartEntry,
  getChartLabel,
  isChartId,
} from './registry';
export { SAMPLES, getSampleById } from './demoData';
export * from './chartDefaults';

export {
  BarVerticalModel,
  BarHorizontalModel,
  BarStackedModel,
  LineModel,
  AreaModel,
  buildBarVerticalOption,
  buildBarHorizontalOption,
  buildBarStackedOption,
  buildLineOption,
  buildAreaOption,
} from './models/cartesianModels';
export { PieModel, DonutModel, buildPieOption, buildDonutOption } from './models/pieDonutModels';
export { default as ScatterModel, buildScatterOption } from './models/scatterModel';
export { default as RadarModel, buildRadarOption } from './models/radarModel';
export { default as HeatmapModel, buildHeatmapOption } from './models/heatmapModel';
export { default as GaugeModel, buildGaugeOption } from './models/gaugeModel';
export { default as FunnelModel, buildFunnelOption } from './models/funnelModel';
export { default as TreemapModel, buildTreemapOption } from './models/treemapModel';
export { default as SankeyModel, buildSankeyOption } from './models/sankeyModel';
export { default as SunburstModel, buildSunburstOption } from './models/sunburstModel';
export { default as BoxplotModel, buildBoxplotOption } from './models/boxplotModel';
export { default as CandlestickModel, buildCandlestickOption } from './models/candlestickModel';
export { default as GraphModel, buildGraphOption } from './models/graphModel';
export { default as ParallelModel, buildParallelOption } from './models/parallelModel';
export { default as MixedLineBarModel, buildMixedLineBarOption } from './models/mixedLineBarModel';
