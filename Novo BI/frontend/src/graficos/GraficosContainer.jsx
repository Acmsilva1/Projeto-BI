import React, { useMemo, useState } from 'react';
import { CHART_REGISTRY, getDemoDataForChart } from './registry';
import { useTheme } from '../context/ThemeContext';
import ChartPanel from './ChartPanel';

const selectClassDark =
  'w-full max-w-md rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2.5 ' +
  'text-sm font-medium text-slate-100 outline-none cursor-pointer ' +
  'focus:border-hospital-500 focus:ring-2 focus:ring-hospital-500/30';

const selectClassLight =
  'w-full max-w-md rounded-lg border border-app-border bg-app-elevated px-3 py-2.5 ' +
  'text-sm font-medium text-app-fg outline-none cursor-pointer ' +
  'focus:border-hospital-500 focus:ring-2 focus:ring-hospital-500/30';

/**
 * Container com seletor de tipo de gráfico + preview.
 * - Sem `data`: usa amostra de demoData.js.
 * - Com `data`: seu payload (mesmo formato da amostra do id escolhido).
 */
export default function GraficosContainer({
  title = 'Biblioteca de gráficos',
  description = 'Escolha o modelo; nos módulos, importe o componente ou use buildOptionById + EchartsCanvas com dados da API.',
  data = null,
  chartId: controlledId = null,
  onChartIdChange = null,
  height = 400,
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const selectClass = isLight ? selectClassLight : selectClassDark;

  const [internalId, setInternalId] = useState(CHART_REGISTRY[0]?.id ?? 'bar-vertical');
  const activeId = controlledId != null ? controlledId : internalId;

  const setId = (id) => {
    if (onChartIdChange) onChartIdChange(id);
    else setInternalId(id);
  };

  const entry = useMemo(
    () => CHART_REGISTRY.find((r) => r.id === activeId) ?? CHART_REGISTRY[0],
    [activeId],
  );

  const Chart = entry?.Chart;
  const chartData = data ?? getDemoDataForChart(activeId);

  return (
    <section
      className={[
        'rounded-xl border p-5 shadow-lg',
        isLight
          ? 'border-app-border bg-app-surface text-app-fg shadow-black/5'
          : 'border-slate-800 bg-slate-900/50 text-slate-100 shadow-black/20',
      ].join(' ')}
      aria-label={title}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold text-app-fg">{title}</h3>
          {description ? (
            <p className="text-xs text-app-muted leading-relaxed max-w-xl">{description}</p>
          ) : null}
        </div>
        <div className="shrink-0 w-full sm:w-auto sm:min-w-[280px]">
          <label htmlFor="graficos-select" className="sr-only">
            Tipo de gráfico
          </label>
          <select
            id="graficos-select"
            className={selectClass}
            value={activeId}
            onChange={(e) => setId(e.target.value)}
          >
            {CHART_REGISTRY.map((r) => (
              <option
                key={r.id}
                value={r.id}
                className={isLight ? 'bg-app-surface text-app-fg' : 'bg-slate-900 text-slate-100'}
              >
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ChartPanel theme={theme} variant="card" minHeightClass="min-h-[200px]" className="mt-5" paddingClassName="p-2">
        {Chart ? <Chart data={chartData} height={height} /> : null}
      </ChartPanel>

      <p className="mt-3 text-[11px] text-app-muted font-mono truncate" title={activeId}>
        id: <span className="text-app-muted/80">{activeId}</span>
      </p>
    </section>
  );
}
