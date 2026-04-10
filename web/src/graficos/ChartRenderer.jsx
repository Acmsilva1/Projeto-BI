import React from 'react';
import { getChartEntry } from './registry';

/**
 * Renderiza qualquer modelo pelo `chartId` — use em qualquer módulo com dados da API.
 *
 * @example
 * import { ChartRenderer } from '@/graficos';
 * <ChartRenderer chartId="line" data={resposta.data} height={320} loading={loading} />
 */
export default function ChartRenderer({
  chartId,
  data,
  height = 360,
  loading = false,
  className = '',
  fallback = null,
}) {
  const entry = getChartEntry(chartId);

  if (!entry) {
    if (fallback != null) return fallback;
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-700 bg-slate-900/30 px-4 py-10 text-center text-sm text-slate-500 min-h-[180px] ${className}`}
        role="status"
      >
        <span>Gráfico não encontrado.</span>
        <code className="text-xs text-slate-600 font-mono">{String(chartId)}</code>
        <span className="text-[11px] text-slate-600">Use um id de CHART_IDS ou importe um *Model.</span>
      </div>
    );
  }

  const C = entry.Chart;
  return (
    <div className={className}>
      <C data={data} height={height} loading={loading} />
    </div>
  );
}
