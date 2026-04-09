/** Estilo base alinhado ao tema escuro do painel (slate + hospital). */
export const CHART_COLORS = [
  '#0ea5e9',
  '#22c55e',
  '#a855f7',
  '#f97316',
  '#ec4899',
  '#eab308',
  '#14b8a6',
  '#ef4444',
];

export function baseGrid() {
  return { left: '3%', right: '4%', bottom: '3%', top: '14%', containLabel: true };
}

export function textStyle() {
  return { color: '#e2e8f0', fontFamily: 'Outfit, sans-serif' };
}

export function axisLine() {
  return { lineStyle: { color: '#475569' } };
}

export function splitLine() {
  return { lineStyle: { color: '#334155', type: 'dashed' } };
}

export function categoryAxis() {
  return {
    type: 'category',
    axisLine: axisLine(),
    axisLabel: { color: '#94a3b8' },
    splitLine: { show: false },
  };
}

export function valueAxis() {
  return {
    type: 'value',
    axisLine: axisLine(),
    axisLabel: { color: '#94a3b8' },
    splitLine: splitLine(),
  };
}

export function tooltipDark() {
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
    },
  };
}

export function tooltipItem() {
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
    },
  };
}

export function legendDark(bottom = false) {
  return {
    legend: {
      type: 'scroll',
      bottom: bottom ? 0 : undefined,
      top: bottom ? undefined : 0,
      textStyle: { color: '#94a3b8' },
    },
  };
}
