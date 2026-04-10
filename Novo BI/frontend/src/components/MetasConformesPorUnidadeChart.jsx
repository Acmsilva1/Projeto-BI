import React, { useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useTheme } from '../context/ThemeContext';
import { chartUi } from '../utils/chartTheme';
import EchartsCanvas from '../graficos/EchartsCanvas';
import ChartPanel from '../graficos/ChartPanel';

/**
 * % de metas conformes por unidade — tendência mensal; só filtros globais (regional/unidade).
 * GET /api/v1/gerencia/metas-conformes-por-unidade
 */
export default function MetasConformesPorUnidadeChart({ filters }) {
  const { theme } = useTheme();
  const ui = chartUi(theme);

  const params = useMemo(
    () => ({
      period: filters.period,
      regional: filters.regional,
      unidade: filters.unidade,
    }),
    [filters.period, filters.regional, filters.unidade],
  );

  const { data, loading, error } = useApi('gerencia/metas-conformes-por-unidade', params);

  const titulo = data?.titulo ?? '% de metas conformes por unidade';
  const months = data?.months ?? [];
  const series = data?.series ?? [];
  const pct = data?.isPercent !== false;

  const lineOption = useMemo(() => {
    if (!months.length) return {};
    if (!series.length) {
      return {
        title: {
          text: 'Nenhuma unidade no filtro atual',
          left: 'center',
          top: 'middle',
          textStyle: { color: ui.muted, fontSize: 14, fontWeight: 600 },
        },
      };
    }

    return {
      animationDurationUpdate: 400,
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: ui.tooltipBg,
        borderColor: ui.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: ui.tooltipFg, fontSize: ui.tooltipFont, fontWeight: 600 },
        valueFormatter: (v) => {
          const n = Number(v);
          if (Number.isNaN(n)) return '—';
          const s = n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
          return pct ? `${s}%` : s;
        },
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
        boundaryGap: false,
        data: months,
        axisLabel: { color: ui.fg, fontSize: ui.axisSize, fontWeight: 600 },
        axisLine: { lineStyle: { color: ui.axisLine, width: theme === 'light' ? 1.5 : 1 } },
      },
      yAxis: {
        type: 'value',
        min: pct ? 0 : undefined,
        max: pct ? 100 : undefined,
        axisLabel: {
          color: ui.fg,
          fontSize: ui.axisSize,
          fontWeight: 600,
          formatter: (v) => {
            const n = Number(v);
            if (Number.isNaN(n)) return '';
            return pct ? `${n.toFixed(0)}%` : String(n);
          },
        },
        splitLine: { lineStyle: { color: ui.splitLine } },
      },
      series: series.map((s) => ({
        name: s.name,
        type: 'line',
        smooth: 0.35,
        data: s.data,
        showSymbol: true,
        symbolSize: theme === 'light' ? 6 : 5,
        lineStyle: { width: theme === 'light' ? 2.6 : 2.2, color: s.color },
        itemStyle: { color: s.color },
        emphasis: { focus: 'series' },
        label: {
          show: true,
          position: 'top',
          distance: 4,
          fontSize: ui.pointLabelSize,
          fontWeight: ui.labelFontWeight,
          color: s.color,
          textBorderColor: ui.labelTextBorder,
          textBorderWidth: ui.labelTextBorderW,
          formatter: (p) => {
            const n = Number(p.value);
            if (!Number.isFinite(n) || n === 0) return '';
            const t = n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            return pct ? `${t}%` : t;
          },
        },
      })),
    };
  }, [months, series, pct, ui, theme]);

  return (
    <section
      className="dashboard-panel overflow-hidden ring-1 ring-inset ring-pipeline-live/35"
      aria-label={titulo}
    >
      <div className="gerencia-panel-head flex flex-col gap-2 px-3 py-2.5 pl-4 sm:px-4 sm:py-3 sm:pl-5">
        <h2 className="text-center text-sm font-semibold tracking-tight text-app-fg sm:text-base">
          <span className="mr-2 text-lg leading-none align-middle sm:text-xl" aria-hidden>
            ✅
          </span>
          {titulo}
        </h2>
        {error ? (
          <p className="text-center text-xs text-rose-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <ChartPanel theme={theme} variant="embedded" minHeightClass="min-h-[360px]" loading={loading}>
        <EchartsCanvas option={lineOption} height={400} loading={false} />
      </ChartPanel>
    </section>
  );
}
