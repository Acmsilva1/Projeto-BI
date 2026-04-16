import { getSampleById } from './demoData';
import {
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
import {
  PieModel,
  DonutModel,
  buildPieOption,
  buildDonutOption,
} from './models/pieDonutModels';
import ScatterModel, { buildScatterOption } from './models/scatterModel';
import RadarModel, { buildRadarOption } from './models/radarModel';
import HeatmapModel, { buildHeatmapOption } from './models/heatmapModel';
import GaugeModel, { buildGaugeOption } from './models/gaugeModel';
import FunnelModel, { buildFunnelOption } from './models/funnelModel';
import TreemapModel, { buildTreemapOption } from './models/treemapModel';
import SankeyModel, { buildSankeyOption } from './models/sankeyModel';
import SunburstModel, { buildSunburstOption } from './models/sunburstModel';
import BoxplotModel, { buildBoxplotOption } from './models/boxplotModel';
import CandlestickModel, { buildCandlestickOption } from './models/candlestickModel';
import GraphModel, { buildGraphOption } from './models/graphModel';
import ParallelModel, { buildParallelOption } from './models/parallelModel';
import MixedLineBarModel, { buildMixedLineBarOption } from './models/mixedLineBarModel';

/** Catálogo: id estável, rótulo no seletor, componente React. */
export const CHART_REGISTRY = [
  { id: 'bar-vertical', label: 'Barras verticais', Chart: BarVerticalModel },
  { id: 'bar-horizontal', label: 'Barras horizontais', Chart: BarHorizontalModel },
  { id: 'bar-stacked', label: 'Barras empilhadas', Chart: BarStackedModel },
  { id: 'mixed-line-bar', label: 'Barras + linha (2 eixos)', Chart: MixedLineBarModel },
  { id: 'line', label: 'Linha', Chart: LineModel },
  { id: 'area', label: 'Área', Chart: AreaModel },
  { id: 'pie', label: 'Pizza', Chart: PieModel },
  { id: 'donut', label: 'Rosca (donut)', Chart: DonutModel },
  { id: 'scatter', label: 'Dispersão', Chart: ScatterModel },
  { id: 'radar', label: 'Radar', Chart: RadarModel },
  { id: 'heatmap', label: 'Mapa de calor', Chart: HeatmapModel },
  { id: 'gauge', label: 'Velocímetro', Chart: GaugeModel },
  { id: 'funnel', label: 'Funil', Chart: FunnelModel },
  { id: 'treemap', label: 'Treemap', Chart: TreemapModel },
  { id: 'sankey', label: 'Sankey', Chart: SankeyModel },
  { id: 'sunburst', label: 'Sunburst', Chart: SunburstModel },
  { id: 'boxplot', label: 'Boxplot', Chart: BoxplotModel },
  { id: 'candlestick', label: 'Candlestick', Chart: CandlestickModel },
  { id: 'graph', label: 'Grafo (força)', Chart: GraphModel },
  { id: 'parallel', label: 'Coordenadas paralelas', Chart: ParallelModel },
];

/** Lista de ids válidos (para selects, validação, tipagem informal). */
export const CHART_IDS = CHART_REGISTRY.map((r) => r.id);

const _BY_ID = Object.fromEntries(CHART_REGISTRY.map((r) => [r.id, r]));

export function isChartId(chartId) {
  return chartId != null && String(chartId) in _BY_ID;
}

export function getChartEntry(chartId) {
  if (chartId == null) return null;
  return _BY_ID[String(chartId)] ?? null;
}

export function getChartLabel(chartId) {
  return getChartEntry(chartId)?.label ?? null;
}

/** Gera `option` do ECharts por id — útil se quiser só o JSON da option. */
export const OPTION_BUILDERS = {
  'bar-vertical': buildBarVerticalOption,
  'bar-horizontal': buildBarHorizontalOption,
  'bar-stacked': buildBarStackedOption,
  'mixed-line-bar': buildMixedLineBarOption,
  line: buildLineOption,
  area: buildAreaOption,
  pie: buildPieOption,
  donut: buildDonutOption,
  scatter: buildScatterOption,
  radar: buildRadarOption,
  heatmap: buildHeatmapOption,
  gauge: buildGaugeOption,
  funnel: buildFunnelOption,
  treemap: buildTreemapOption,
  sankey: buildSankeyOption,
  sunburst: buildSunburstOption,
  boxplot: buildBoxplotOption,
  candlestick: buildCandlestickOption,
  graph: buildGraphOption,
  parallel: buildParallelOption,
};

export function buildOptionById(chartId, data) {
  const fn = OPTION_BUILDERS[chartId];
  return fn ? fn(data) : {};
}

export function getDemoDataForChart(chartId) {
  return getSampleById(chartId);
}
