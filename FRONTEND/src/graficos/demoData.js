/**
 * Dados de exemplo por id de gráfico — troque por props vindas da API no módulo real.
 */
export const SAMPLES = {
  'bar-vertical': {
    categories: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
    series: [
      { name: 'Série A', data: [120, 200, 150, 80, 70, 110] },
      { name: 'Série B', data: [90, 160, 120, 140, 100, 85] },
    ],
  },
  'bar-horizontal': {
    categories: ['UTI', 'Enf', 'PS', 'CC', 'Amb'],
    series: [{ name: 'Leitos', data: [42, 88, 120, 36, 210] }],
  },
  'bar-stacked': {
    categories: ['T1', 'T2', 'T3', 'T4'],
    stacked: true,
    series: [
      { name: 'Eletivo', data: [32, 45, 28, 50] },
      { name: 'Urgência', data: [18, 22, 31, 24] },
    ],
  },
  line: {
    categories: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'],
    series: [
      { name: 'Ocupação %', data: [72, 75, 78, 74, 80, 82, 79] },
      { name: 'Meta', data: [85, 85, 85, 85, 85, 85, 85] },
    ],
  },
  area: {
    categories: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
    series: [{ name: 'Volume', data: [820, 932, 901, 934, 1290, 1330] }],
    smooth: true,
  },
  pie: {
    items: [
      { name: 'Convênio A', value: 420 },
      { name: 'Convênio B', value: 310 },
      { name: 'Particular', value: 180 },
      { name: 'SUS', value: 90 },
    ],
  },
  donut: {
    items: [
      { name: 'Alta', value: 65 },
      { name: 'Internação', value: 22 },
      { name: 'Transferência', value: 8 },
      { name: 'Óbito', value: 5 },
    ],
  },
  scatter: {
    points: [
      [12, 45],
      [18, 62],
      [25, 38],
      [30, 71],
      [42, 55],
      [55, 48],
      [60, 82],
    ],
  },
  radar: {
    indicators: [
      { name: 'Tempo', max: 100 },
      { name: 'Qualidade', max: 100 },
      { name: 'Custo', max: 100 },
      { name: 'Satisfação', max: 100 },
      { name: 'Segurança', max: 100 },
    ],
    series: [
      { name: 'Unidade A', value: [78, 85, 70, 88, 92] },
      { name: 'Unidade B', value: [65, 72, 82, 75, 80] },
    ],
  },
  heatmap: {
    xLabels: ['07h', '10h', '13h', '16h', '19h'],
    yLabels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
    data: [
      [0, 0, 12],
      [1, 0, 18],
      [2, 0, 35],
      [3, 0, 28],
      [4, 0, 15],
      [0, 1, 8],
      [1, 1, 22],
      [2, 1, 40],
      [3, 1, 30],
      [4, 1, 20],
      [0, 2, 5],
      [1, 2, 15],
      [2, 2, 25],
      [3, 2, 22],
      [4, 2, 10],
      [0, 3, 20],
      [1, 3, 28],
      [2, 3, 45],
      [3, 3, 38],
      [4, 3, 25],
      [0, 4, 14],
      [1, 4, 24],
      [2, 4, 32],
      [3, 4, 28],
      [4, 4, 18],
    ],
  },
  gauge: { value: 72, name: 'Meta SLA', min: 0, max: 100 },
  funnel: {
    items: [
      { name: 'Atendidos', value: 1000 },
      { name: 'Triados', value: 850 },
      { name: 'Consulta', value: 620 },
      { name: 'Exames', value: 410 },
      { name: 'Alta', value: 380 },
    ],
  },
  treemap: {
    items: [
      {
        name: 'Hospital',
        children: [
          { name: 'Clínica', value: 210 },
          { name: 'Cirúrgico', value: 180 },
          { name: 'PS', value: 320 },
        ],
      },
    ],
  },
  sankey: {
    nodes: [
      { name: 'PS' },
      { name: 'Internação' },
      { name: 'CC' },
      { name: 'Alta' },
      { name: 'Transferência' },
    ],
    links: [
      { source: 'PS', target: 'Internação', value: 120 },
      { source: 'PS', target: 'Alta', value: 800 },
      { source: 'Internação', target: 'Alta', value: 90 },
      { source: 'Internação', target: 'CC', value: 40 },
      { source: 'CC', target: 'Alta', value: 38 },
      { source: 'CC', target: 'Transferência', value: 2 },
    ],
  },
  sunburst: {
    items: [
      {
        name: 'Operacional',
        children: [
          { name: 'PS', value: 40 },
          {
            name: 'Internação',
            value: 35,
            children: [
              { name: 'UTI', value: 15 },
              { name: 'Enf', value: 20 },
            ],
          },
          { name: 'CC', value: 25 },
        ],
      },
    ],
  },
  boxplot: {
    categories: ['A', 'B', 'C'],
    /** [min, Q1, median, Q3, max] por categoria */
    boxData: [
      [650, 820, 940, 1050, 1200],
      [620, 800, 900, 980, 1100],
      [700, 850, 960, 1020, 1180],
    ],
    outliers: [
      [0, 1300],
      [1, 450],
      [2, 1250],
    ],
  },
  candlestick: {
    categories: ['D1', 'D2', 'D3', 'D4', 'D5'],
    /** [open, close, low, high] */
    values: [
      [100, 105, 98, 108],
      [105, 102, 99, 106],
      [102, 110, 101, 112],
      [110, 108, 104, 111],
      [108, 115, 107, 116],
    ],
  },
  graph: {
    categories: [
      { name: 'PS', symbolSize: 48 },
      { name: 'Lab', symbolSize: 36 },
      { name: 'Imagem', symbolSize: 36 },
      { name: 'Internação', symbolSize: 44 },
    ],
    links: [
      { source: 'PS', target: 'Lab' },
      { source: 'PS', target: 'Imagem' },
      { source: 'PS', target: 'Internação' },
      { source: 'Lab', target: 'Internação' },
    ],
  },
  parallel: {
    dimensions: [
      { name: 'Ocupação', max: 100 },
      { name: 'Tempo médio', max: 120 },
      { name: 'Satisfação', max: 100 },
      { name: 'Custo idx', max: 100 },
    ],
    series: [
      {
        name: 'Hosp A',
        data: [
          [72, 45, 88, 62],
          [68, 50, 82, 58],
          [75, 42, 90, 65],
        ],
      },
      {
        name: 'Hosp B',
        data: [
          [65, 52, 80, 55],
          [62, 55, 78, 52],
          [70, 48, 85, 60],
        ],
      },
      {
        name: 'Hosp C',
        data: [
          [80, 38, 90, 70],
          [78, 40, 88, 68],
        ],
      },
    ],
  },
  'mixed-line-bar': {
    categories: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai'],
    barSeries: { name: 'Atendimentos', data: [420, 532, 501, 534, 590], axisName: 'Qtd' },
    lineSeries: { name: 'Taxa ocupação', data: [72, 75, 78, 74, 80], axisName: '%' },
  },
};

export function getSampleById(id) {
  return SAMPLES[id] ? structuredClone(SAMPLES[id]) : {};
}
