/**
 * Options ECharts reutilizáveis — mesmos dados, vários tipos (linha, barras, pizza).
 */

function emptyOption(ui, text) {
  return {
    title: {
      text: text || 'Sem dados',
      left: 'center',
      top: 'middle',
      textStyle: { color: ui.muted, fontSize: 14, fontWeight: 600 },
    },
  };
}

/**
 * Séries temporais (meses no eixo X) — `series`: [{ name, data[], color? }].
 * @param {'line'|'bar'|'pie'} chartKind — pizza = último mês, fatias por série.
 */
export function buildTimeSeriesMultiChartOption({
  theme,
  ui,
  months,
  series,
  chartKind,
  pct,
  yMin,
  yMax,
  emptyMessage,
}) {
  const list = series || [];
  if (!list.length) return emptyOption(ui, emptyMessage);

  const pctMode = pct === true;
  const fmtDec = (n, dec) =>
    Number(n).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

  const tooltipVal = (v) => {
    const n = Number(v);
    if (Number.isNaN(n)) return '—';
    const s = fmtDec(n, pctMode ? 1 : 2);
    return pctMode ? `${s}%` : s;
  };

  if (chartKind === 'pie') {
    const last = Math.max(0, (months?.length || 1) - 1);
    const data = list.map((s) => ({
      name: s.name,
      value: Math.abs(Number(Array.isArray(s.data) ? s.data[last] : 0)) || 0,
      itemStyle: s.color ? { color: s.color } : undefined,
    }));
    return {
      animationDurationUpdate: 400,
      tooltip: {
        trigger: 'item',
        backgroundColor: ui.tooltipBg,
        borderColor: ui.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: ui.tooltipFg, fontSize: ui.tooltipFont, fontWeight: 600 },
        valueFormatter: tooltipVal,
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        left: 'center',
        width: '96%',
        textStyle: { color: ui.fg, fontSize: ui.legendSize - 1, fontWeight: 600 },
        pageTextStyle: { color: ui.muted, fontWeight: 600 },
      },
      series: [
        {
          type: 'pie',
          radius: ['32%', '52%'],
          center: ['50%', '46%'],
          data,
          label: { color: ui.fg, fontSize: 10, fontWeight: 600 },
        },
      ],
    };
  }

  const boundaryGap = chartKind === 'bar';
  const cartSeries = list.map((s) => {
    const color = s.color;
    const data = Array.isArray(s.data) ? s.data : [];
    if (chartKind === 'bar') {
      return {
        name: s.name,
        type: 'bar',
        data,
        barMaxWidth: 20,
        itemStyle: color ? { color } : undefined,
      };
    }
    return {
      name: s.name,
      type: 'line',
      smooth: 0.35,
      data,
      showSymbol: true,
      symbolSize: theme === 'light' ? 6 : 5,
      lineStyle: { width: theme === 'light' ? 2.6 : 2.2, color },
      itemStyle: color ? { color } : undefined,
    };
  });

  return {
    animationDurationUpdate: 400,
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: ui.tooltipBg,
      borderColor: ui.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: ui.tooltipFg, fontSize: ui.tooltipFont, fontWeight: 600 },
      valueFormatter: tooltipVal,
    },
    legend: {
      type: 'scroll',
      top: 4,
      left: 'center',
      width: '96%',
      textStyle: { color: ui.fg, fontSize: ui.legendSize, fontWeight: 600 },
      pageTextStyle: { color: ui.muted, fontWeight: 600 },
    },
    grid: { left: 52, right: 20, top: 56, bottom: 28 },
    xAxis: {
      type: 'category',
      boundaryGap,
      data: months || [],
      axisLabel: { color: ui.fg, fontSize: ui.axisSize, fontWeight: 600 },
      axisLine: { lineStyle: { color: ui.axisLine, width: theme === 'light' ? 1.5 : 1 } },
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      scale: yMin == null && yMax == null,
      axisLabel: {
        color: ui.fg,
        fontSize: ui.axisSize,
        fontWeight: 600,
        formatter: (v) => {
          const n = Number(v);
          if (Number.isNaN(n)) return '';
          return pctMode ? `${n.toFixed(0)}%` : String(n);
        },
      },
      splitLine: { lineStyle: { color: ui.splitLine } },
    },
    series: cartSeries,
  };
}

/** Totais PS — cartões → barras ou pizza (mesmo `cards`). */
export function buildTotaisCardsChartOption({ ui, theme, cards, chartKind }) {
  const list = cards || [];
  if (!list.length) return emptyOption(ui, 'Sem totais');

  const barColor = theme === 'light' ? '#0d9488' : '#2dd4bf';

  const items = list.map((c) => ({
    name: String(c.label || c.key || '—').slice(0, 42),
    value: Math.max(0, Math.round(Number(c.value))) || 0,
  }));

  if (chartKind === 'pie') {
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: ui.tooltipBg,
        borderColor: ui.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: ui.tooltipFg, fontSize: ui.tooltipFont, fontWeight: 600 },
      },
      series: [{ type: 'pie', radius: ['28%', '58%'], data: items, label: { color: ui.fg, fontSize: 10, fontWeight: 600 } }],
    };
  }

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: ui.tooltipBg,
      borderColor: ui.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: ui.tooltipFg, fontSize: ui.tooltipFont, fontWeight: 600 },
    },
    grid: { left: 48, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: ui.fg, fontSize: ui.axisSize, fontWeight: 600 },
      splitLine: { lineStyle: { color: ui.splitLine } },
    },
    yAxis: {
      type: 'category',
      data: items.map((i) => i.name),
      inverse: true,
      axisLabel: { color: ui.fg, fontSize: 10, fontWeight: 600, width: 120, overflow: 'truncate' },
      axisLine: { lineStyle: { color: ui.axisLine } },
    },
    series: [{ type: 'bar', data: items.map((i) => i.value), name: 'Valor', barMaxWidth: 22, itemStyle: { color: barColor } }],
  };
}

export const GERENCIA_CHART_KINDS = [
  { id: 'line', label: 'Linha' },
  { id: 'bar', label: 'Barras' },
  { id: 'pie', label: 'Pizza' },
];
