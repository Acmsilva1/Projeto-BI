import { useMemo } from 'react';
import { buildOptionById, isChartId } from './registry';

/**
 * Retorna a option ECharts para o `chartId` e dados — use com `<EchartsCanvas option={option} />`.
 *
 * @example
 * import { useChartOption, EchartsCanvas } from '@/graficos';
 * const { option, ok } = useChartOption('bar-vertical', dados);
 * return ok ? <EchartsCanvas option={option} height={300} /> : null;
 */
export function useChartOption(chartId, data) {
  return useMemo(() => {
    if (!isChartId(chartId)) {
      return { option: null, ok: false, chartId };
    }
    const option = buildOptionById(chartId, data ?? {});
    return { option, ok: true, chartId };
  }, [chartId, data]);
}
