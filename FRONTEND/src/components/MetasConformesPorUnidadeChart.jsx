import React, { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useTheme } from '../context/ThemeContext';
import { chartUi } from '../utils/chartTheme';
import { buildTimeSeriesMultiChartOption } from '../utils/gerenciaChartOptions.js';
import EchartsCanvas from '../graficos/EchartsCanvas';
import ChartPanel from '../graficos/ChartPanel';
import GerenciaChartToolbar from './GerenciaChartToolbar.jsx';

/**
 * % de metas conformes por unidade — tendência mensal; só filtros globais (regional/unidade).
 * GET /api/v1/gerencia/metas-conformes-por-unidade
 * @param {object} [prefetched] — slice de `dashboard-bundle`.
 */
export default function MetasConformesPorUnidadeChart({ filters, prefetched }) {
  const { theme } = useTheme();
  const ui = chartUi(theme);
  const [chartKind, setChartKind] = useState('line');

  const params = useMemo(
    () => ({
      period: filters.period,
      regional: filters.regional,
      unidade: filters.unidade,
    }),
    [filters.period, filters.regional, filters.unidade],
  );

  const api = useApi('gerencia/metas-conformes-por-unidade', params, { enabled: prefetched == null });
  const data = prefetched != null ? prefetched : api.data;
  const loading = prefetched != null ? false : api.loading;
  const error = prefetched != null ? null : api.error;

  const titulo = data?.titulo ?? '% de metas conformes por unidade';
  const months = data?.months ?? [];
  const series = data?.series ?? [];
  const pct = data?.isPercent !== false;

  const lineOption = useMemo(() => {
    const opt = buildTimeSeriesMultiChartOption({
      theme,
      ui,
      months,
      series,
      chartKind,
      pct,
      yMin: pct ? 0 : undefined,
      yMax: pct ? 100 : undefined,
      emptyMessage: 'Nenhuma unidade no filtro atual',
    });
    if (!opt.series || !Array.isArray(opt.series)) return opt;
    if (chartKind === 'line') {
      return {
        ...opt,
        series: opt.series.map((s, idx) => {
          const src = series[idx];
          const color = src?.color;
          return {
            ...s,
            emphasis: { focus: 'series' },
            label: {
              show: true,
              position: 'top',
              distance: 4,
              fontSize: ui.pointLabelSize,
              fontWeight: ui.labelFontWeight,
              color: color || s.lineStyle?.color,
              textBorderColor: ui.labelTextBorder,
              textBorderWidth: ui.labelTextBorderW,
              formatter: (p) => {
                const n = Number(p.value);
                if (!Number.isFinite(n) || n === 0) return '';
                const t = n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                return pct ? `${t}%` : t;
              },
            },
          };
        }),
      };
    }
    if (chartKind === 'bar') {
      return {
        ...opt,
        series: opt.series.map((s) => ({ ...s, emphasis: { focus: 'series' } })),
      };
    }
    return opt;
  }, [theme, ui, months, series, pct, chartKind]);

  return (
    <section
      className="dashboard-panel overflow-visible ring-1 ring-inset ring-pipeline-live/35"
      aria-label={titulo}
    >
      <div className="gerencia-panel-head flex flex-col gap-2 px-3 py-2.5 pl-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-4 sm:py-3 sm:pl-5">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h2 className="text-sm font-semibold tracking-tight text-app-fg sm:text-base">
            <span className="mr-2 text-lg leading-none align-middle sm:text-xl" aria-hidden>
              ✅
            </span>
            {titulo}
          </h2>
          {error ? (
            <p className="mt-1 text-center text-xs text-rose-400 sm:text-left" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <GerenciaChartToolbar theme={theme} chartKind={chartKind} onChartKindChange={setChartKind} className="sm:pt-0.5" />
      </div>

      <ChartPanel
        theme={theme}
        variant="embedded"
        minHeightClass="min-h-[360px]"
        loading={loading}
        className="relative z-0"
      >
        <EchartsCanvas option={lineOption} height={400} loading={false} />
      </ChartPanel>
    </section>
  );
}
