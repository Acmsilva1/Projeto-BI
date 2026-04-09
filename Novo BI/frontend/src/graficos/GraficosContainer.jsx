import React, { useMemo, useState } from 'react';
import { CHART_REGISTRY, getDemoDataForChart } from './registry';

const selectClass =
  'w-full max-w-md rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2.5 ' +
  'text-sm font-medium text-slate-100 outline-none cursor-pointer ' +
  '[color-scheme:dark] focus:border-hospital-500 focus:ring-2 focus:ring-hospital-500/30';

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
      className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-lg shadow-black/20"
      aria-label={title}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          {description ? <p className="text-xs text-slate-500 leading-relaxed max-w-xl">{description}</p> : null}
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
              <option key={r.id} value={r.id} className="bg-slate-900 text-slate-100">
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-800/80 bg-slate-950/40 p-2 min-h-[200px]">
        {Chart ? <Chart data={chartData} height={height} /> : null}
      </div>

      <p className="mt-3 text-[11px] text-slate-600 font-mono truncate" title={activeId}>
        id: <span className="text-slate-500">{activeId}</span>
      </p>
    </section>
  );
}
