import React, { useMemo, useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useTheme } from '../context/ThemeContext';
import { chartUi } from '../utils/chartTheme';
import EchartsCanvas from '../graficos/EchartsCanvas';
import ChartPanel from '../graficos/ChartPanel';

function gaugeAxisColors(sense, meta, max) {
  const m = Number(meta) || 0;
  const hi = Number(max) || 100;
  const t = hi <= 0 ? 0 : Math.min(1, Math.max(0, m / hi));
  if (sense === 'low_good') {
    return [
      [0, '#22c55e'],
      [t, '#22c55e'],
      [Math.min(1, t + (1 - t) * 0.45), '#eab308'],
      [1, '#ef4444'],
    ];
  }
  return [
    [0, '#ef4444'],
    [Math.max(0, t * 0.55), '#eab308'],
    [t, '#22c55e'],
    [1, '#22c55e'],
  ];
}

/**
 * Painel Metas de acompanhamento — botões de métrica, medidor global e tendência por unidade (cores fixas).
 * GET /api/v1/gerencia/metas-acompanhamento-gestao?metric=&period=&regional=&unidade=
 */
export default function MetasAcompanhamentoGestao({ filters }) {
  const { theme } = useTheme();
  const ui = chartUi(theme);
  const [metric, setMetric] = useState('conversao');

  const params = useMemo(
    () => ({
      period: filters.period,
      regional: filters.regional,
      unidade: filters.unidade,
      metric,
    }),
    [filters.period, filters.regional, filters.unidade, metric],
  );

  const { data, loading, error } = useApi('gerencia/metas-acompanhamento-gestao', params);

  const catalog = data?.catalog ?? [];
  const gauge = data?.gauge;
  const months = data?.months ?? [];
  const series = data?.series ?? [];
  const metaRibbon = data?.metaRibbon;

  const gaugeOption = useMemo(() => {
    if (!gauge) return {};
    const gMax = Number(gauge.max) || 100;
    const gVal = Math.min(gMax, Math.max(0, Number(gauge.value) || 0));
    const stops = gaugeAxisColors(gauge.sense, metaRibbon?.target ?? 0, gMax);
    const pct = gauge.isPercent;
    const detailFmt = (v) => {
      const n = Number(v);
      if (Number.isNaN(n)) return '—';
      const dec = pct ? 1 : 2;
      const s = n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      return pct ? `${s}%` : s;
    };

    return {
      animationDurationUpdate: 400,
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: gauge.min ?? 0,
          max: gMax,
          splitNumber: 5,
          radius: '92%',
          center: ['50%', '72%'],
          axisLine: {
            lineStyle: {
              width: 14,
              color: stops,
            },
          },
          pointer: { length: '58%', width: 5 },
          axisTick: { length: 6, distance: -18, lineStyle: { color: ui.tickLine } },
          splitLine: { length: 10, distance: -20, lineStyle: { color: ui.tickLine } },
          axisLabel: {
            color: ui.muted,
            distance: -32,
            fontSize: ui.axisSize,
            fontWeight: 600,
            formatter: (v) => (pct ? `${Number(v).toFixed(1)}%` : String(v)),
          },
          anchor: {
            show: true,
            size: 12,
            itemStyle: {
              color: ui.gaugeAnchorFill,
              borderWidth: 2,
              borderColor: ui.gaugeAnchorBorder,
            },
          },
          title: {
            show: true,
            offsetCenter: [0, '18%'],
            color: ui.fg,
            fontSize: ui.gaugeTitleSize,
            fontWeight: 700,
            text: gauge.title || '',
          },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '-8%'],
            fontSize: ui.gaugeDetailSize,
            fontWeight: 800,
            color: ui.fgStrong,
            formatter: detailFmt,
          },
          data: [{ value: gVal }],
        },
      ],
    };
  }, [gauge, metaRibbon?.target, ui]);

  const lineOption = useMemo(() => {
    if (!months.length || !series.length || !gauge) return {};
    const pct = gauge.isPercent;
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
          const dec = pct ? 1 : 2;
          const s = n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
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
        scale: true,
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
            if (Number.isNaN(n)) return '';
            const dec = pct ? 1 : 2;
            const t = n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
            return pct ? `${t}%` : t;
          },
        },
      })),
    };
  }, [months, series, gauge, ui, theme]);

  const onPickMetric = useCallback((key) => {
    setMetric(key);
  }, []);

  return (
    <section
      className="dashboard-panel overflow-hidden ring-1 ring-inset ring-pipeline-live/35"
      aria-label={data?.titulo || 'Metas de acompanhamento da gestão'}
    >
      <div className="gerencia-panel-head flex flex-col gap-2 px-3 py-2.5 pl-4 sm:px-4 sm:py-3 sm:pl-5">
        <h2 className="text-sm font-semibold tracking-tight text-app-fg sm:text-base">
          <span className="mr-2 text-lg leading-none align-middle sm:text-xl" aria-hidden>
            🎯
          </span>
          {data?.titulo || 'Metas de acompanhamento da gestão'}
        </h2>
        {error ? (
          <p className="text-xs text-rose-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="border-t border-table-grid px-3 py-3 sm:px-4 sm:py-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {catalog.map((c) => {
            const active = c.key === metric;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onPickMetric(c.key)}
                className={[
                  'rounded-lg border px-2.5 py-1.5 text-left text-[10px] font-semibold transition-colors sm:text-[11px]',
                  theme === 'light'
                    ? active
                      ? 'border-emerald-600/70 bg-emerald-100 text-emerald-950 shadow-sm'
                      : 'border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50'
                    : active
                      ? 'border-emerald-500/50 bg-emerald-900/35 text-emerald-100'
                      : 'border-slate-600/50 bg-slate-900/40 text-slate-300 hover:border-slate-500/60 hover:bg-slate-800/50',
                ].join(' ')}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          <ChartPanel
            theme={theme}
            variant="card"
            paddingClassName="px-2 py-2"
            className="flex min-h-[220px] min-w-0 flex-1 flex-col sm:min-h-[240px]"
            loading={loading}
          >
            <div className="flex flex-1 flex-col sm:flex-row sm:items-center">
              <div className="min-h-[200px] min-w-0 flex-1 sm:min-h-[220px]">
                <EchartsCanvas option={gaugeOption} height={220} loading={false} />
              </div>
              {metaRibbon?.text ? (
                <div className="flex shrink-0 items-center justify-center px-2 pb-2 sm:w-40 sm:flex-col sm:pb-0 sm:pr-3">
                  <span
                    className={[
                      'inline-flex rounded-md px-2.5 py-1 text-center text-[10px] font-bold leading-tight shadow-sm ring-1 ring-inset sm:text-[11px]',
                      theme === 'light'
                        ? 'bg-emerald-100 text-emerald-950 ring-emerald-600/35'
                        : 'bg-emerald-900/50 text-emerald-200 ring-emerald-600/40',
                    ].join(' ')}
                  >
                    {metaRibbon.text}
                  </span>
                </div>
              ) : null}
            </div>
          </ChartPanel>
        </div>

        <ChartPanel
          theme={theme}
          variant="card"
          minHeightClass="min-h-[360px]"
          className="mt-4"
          loading={loading}
        >
          <EchartsCanvas option={lineOption} height={400} loading={false} />
        </ChartPanel>
      </div>
    </section>
  );
}
