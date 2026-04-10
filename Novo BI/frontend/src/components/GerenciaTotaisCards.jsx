import React, { useMemo, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useTheme } from '../context/ThemeContext';
import { chartUi } from '../utils/chartTheme';
import { buildTotaisCardsChartOption } from '../utils/gerenciaChartOptions.js';
import ExportCsvButton from './ExportCsvButton';
import { datedExportBasename, downloadCsv } from '../utils/downloadCsv';
import ChartPanel from '../graficos/ChartPanel';
import EchartsCanvas from '../graficos/EchartsCanvas';
import GerenciaChartToolbar from './GerenciaChartToolbar.jsx';

/** Faixas superiores distintas — leitura rápida sem depender só do cinza */
const KPI_TOP_COLORS = [
  'var(--dash-live)',
  'color-mix(in srgb, var(--primary) 92%, white)',
  '#a78bfa',
  '#fbbf24',
  '#fb7185',
  '#38bdf8',
];

function fmtTotal(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString('pt-BR');
}

/**
 * Faixa horizontal de totais PS — GET /api/v1/gerencia/totais-ps
 */
export default function GerenciaTotaisCards({ filters }) {
  const { theme } = useTheme();
  const ui = chartUi(theme);
  const [viewMode, setViewMode] = useState('table');
  const [chartKind, setChartKind] = useState('bar');

  const params = useMemo(
    () => ({
      period: filters.period,
      regional: filters.regional,
      unidade: filters.unidade,
    }),
    [filters.period, filters.regional, filters.unidade],
  );

  const { data, loading, error } = useApi('gerencia/totais-ps', params);
  const cards = data?.cards ?? [];

  const chartOption = useMemo(
    () => buildTotaisCardsChartOption({ ui, theme, cards, chartKind }),
    [ui, theme, cards, chartKind],
  );

  const onExportCsv = useCallback(() => {
    const rows = [['Indicador', 'Valor'], ...cards.map((c) => [c.label ?? '', c.value ?? ''])];
    downloadCsv(`${datedExportBasename('gerencia-totais-ps')}.csv`, rows);
  }, [cards]);

  return (
    <section
      className="dashboard-panel overflow-hidden ring-1 ring-inset ring-pipeline-live/35"
      aria-label={data?.meta?.titulo || 'Totais PS'}
    >
      <div className="gerencia-panel-head flex flex-col gap-2 px-3 py-2.5 pl-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:pl-5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-pipeline-live shadow-[0_0_10px_color-mix(in_srgb,var(--dash-live)_70%,transparent)]"
            aria-hidden
          />
          <h2 className="text-xs font-bold uppercase tracking-wider text-app-fg">
            <span className="mr-1.5 text-sm normal-case" aria-hidden>
              📊
            </span>
            {data?.meta?.titulo || 'Totais PS'}
          </h2>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <GerenciaChartToolbar
            theme={theme}
            showViewToggle
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            chartKind={chartKind}
            onChartKindChange={setChartKind}
            tableModeLabel="Cartões"
            chartModeLabel="Gráfico"
          />
          {!loading && cards.length > 0 ? (
            <ExportCsvButton onClick={onExportCsv} title="Baixar totais em CSV" />
          ) : null}
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-pipeline-live" aria-hidden />
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="px-3 py-3 text-xs text-pipeline-critical sm:px-4">{error}</p>
      ) : viewMode === 'chart' ? (
        <ChartPanel theme={theme} variant="embedded" minHeightClass="min-h-[280px]" loading={loading}>
          <EchartsCanvas option={chartOption} height={320} loading={false} />
        </ChartPanel>
      ) : (
        <div
          className="grid w-full min-w-0 gap-x-2 gap-y-2.5 px-3 py-3 sm:gap-x-2.5 sm:px-4 sm:py-4 [grid-auto-columns:minmax(0,1fr)] [grid-auto-flow:column] [grid-template-rows:repeat(2,minmax(0,auto))]"
          role="list"
        >
          {cards.map((c, i) => (
            <article
              key={c.key}
              role="listitem"
              className="flex min-h-0 min-w-0 flex-col rounded-lg border-x-2 border-b-2 border-table-grid bg-app-elevated/90 px-2 py-2 shadow-[0_1px_0_0_color-mix(in_srgb,var(--app-fg)_08%,transparent)] sm:px-2.5 sm:py-2.5"
              style={{ borderTopWidth: 3, borderTopStyle: 'solid', borderTopColor: KPI_TOP_COLORS[i % KPI_TOP_COLORS.length] }}
              title={c.label}
            >
              <span className="line-clamp-2 text-[9px] font-bold uppercase leading-tight tracking-wide text-app-muted sm:text-[10px]">
                {c.label}
              </span>
              <span className="mt-1 truncate text-base font-bold tabular-nums tracking-tight text-app-fg sm:text-lg">
                {fmtTotal(c.value)}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
