import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Loader2 } from 'lucide-react';

/**
 * Mapa de calor dia do mês (1–31) × hora (00–23) — alinhado ao modelo PBI "Quantidade de atendimentos".
 */
export default function HeatmapFluxos({ title = 'Quantidade de atendimentos', heatmapCalendario, loading, className = 'h-[420px]' }) {
  const option = useMemo(() => {
    const hc = heatmapCalendario || {};
    const dias = hc.diasLabels || [];
    const horas = hc.horasLabels || [];
    const mat = hc.atendimentos || [];
    const data = [];
    let vmax = 1;
    for (let i = 0; i < dias.length; i += 1) {
      const row = mat[i] || [];
      for (let j = 0; j < horas.length; j += 1) {
        const v = Number(row[j] || 0);
        if (v > vmax) vmax = v;
        data.push([j, i, v]);
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        formatter: (p) => {
          const [hx, di, val] = p.data;
          return `Dia ${dias[di] ?? di + 1} · ${horas[hx] ?? hx}<br/><b>${val}</b> atend.`;
        },
        backgroundColor: '#0f172a',
        borderColor: '#1e293b',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
      },
      grid: { top: 8, right: 12, bottom: 48, left: 56, containLabel: false },
      xAxis: {
        type: 'category',
        data: horas,
        splitArea: { show: true },
        axisLabel: { color: '#64748b', fontSize: 9, interval: 1, rotate: 45 },
        axisLine: { lineStyle: { color: '#1e293b' } },
      },
      yAxis: {
        type: 'category',
        data: dias,
        splitArea: { show: true },
        axisLabel: { color: '#64748b', fontSize: 10 },
        axisLine: { lineStyle: { color: '#1e293b' } },
        name: 'Dia',
        nameTextStyle: { color: '#64748b', fontSize: 10 },
      },
      visualMap: {
        min: 0,
        max: vmax,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 4,
        inRange: {
          color: ['#ecfccb', '#fde047', '#fb923c', '#ef4444'],
        },
        textStyle: { color: '#94a3b8', fontSize: 10 },
      },
      series: [
        {
          name: 'Atendimentos',
          type: 'heatmap',
          data,
          label: { show: false },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.35)' },
          },
        },
      ],
    };
  }, [heatmapCalendario]);

  return (
    <div className={`card-premium flex flex-col gap-3 ${className}`}>
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest shrink-0">{title}</h3>
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-600">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : (
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} notMerge />
        )}
      </div>
    </div>
  );
}
