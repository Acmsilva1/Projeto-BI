/** Tipografia/cores ECharts — modo claro com contraste forte (alinhado a css.md). */
export function chartUi(theme) {
  const light = theme === 'light';
  if (light) {
    return {
      fg: '#0f172a',
      fgStrong: '#020617',
      muted: '#475569',
      axisLine: '#94a3b8',
      splitLine: 'rgba(15, 23, 42, 0.1)',
      gaugeAnchorFill: '#f8fafc',
      gaugeAnchorBorder: '#334155',
      tickLine: '#64748b',
      legendSize: 12,
      axisSize: 12,
      pointLabelSize: 10,
      gaugeTitleSize: 14,
      gaugeDetailSize: 32,
      tooltipBg: 'rgba(255, 255, 255, 0.97)',
      tooltipBorder: '#e2e8f0',
      tooltipFg: '#0f172a',
      tooltipFont: 13,
      labelFontWeight: 600,
      labelTextBorder: '#ffffff',
      labelTextBorderW: 2,
    };
  }
  return {
    fg: '#e2e8f0',
    fgStrong: '#f1f5f9',
    muted: '#94a3b8',
    axisLine: '#475569',
    splitLine: 'rgba(148, 163, 184, 0.15)',
    gaugeAnchorFill: '#0f172a',
    gaugeAnchorBorder: '#64748b',
    tickLine: '#64748b',
    legendSize: 10,
    axisSize: 10,
    pointLabelSize: 9,
    gaugeTitleSize: 12,
    gaugeDetailSize: 28,
    tooltipBg: 'rgba(15, 23, 42, 0.94)',
    tooltipBorder: '#334155',
    tooltipFg: '#f1f5f9',
    tooltipFont: 12,
    labelFontWeight: 500,
    labelTextBorder: 'transparent',
    labelTextBorderW: 0,
  };
}
