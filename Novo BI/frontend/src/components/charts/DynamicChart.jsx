/**
 * DynamicChart.jsx  — Componente universal de gráfico interativo
 * ---------------------------------------------------------------
 * Props:
 *   title       string         Título do card
 *   data        { labels[], values[], datasets[] }
 *   defaultType 'bar'|'line'|'pie'|'donut'
 *   loading     bool
 *   error       string|null
 *   className   string (opcional, para height)
 */

import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { BarChart2, PieChart, TrendingUp, Loader2, AlertCircle } from 'lucide-react';

const PALETTE = ['#0ea5e9','#3b82f6','#8b5cf6','#14b8a6','#f59e0b','#ef4444','#06b6d4','#22c55e'];

function buildOption(type, data, title) {
  const isPie = type === 'pie' || type === 'donut';
  const labels = data?.labels || [];
  const values = data?.values || [];

  const series = data?.datasets
    ? data.datasets.map((ds, di) => ({
        name: ds.label,
        type: isPie ? 'pie' : type,
        radius: type === 'donut' ? ['45%', '70%'] : isPie ? '68%' : undefined,
        data: isPie
          ? labels.map((l, i) => ({ name: l, value: ds.data[i], itemStyle: { color: PALETTE[i % PALETTE.length] } }))
          : ds.data,
        smooth: type === 'line',
        areaStyle: type === 'line' ? { opacity: 0.08 } : undefined,
        itemStyle: {
          borderRadius: type === 'bar' ? [4, 4, 0, 0] : 0,
          color: isPie ? undefined : PALETTE[di % PALETTE.length],
        },
        lineStyle: type === 'line' ? { width: 2, color: PALETTE[di % PALETTE.length] } : undefined,
        symbol: type === 'line' ? 'circle' : undefined,
        symbolSize: type === 'line' ? 6 : undefined,
      }))
    : [{
        name: title,
        type: isPie ? 'pie' : type,
        radius: type === 'donut' ? ['45%', '70%'] : isPie ? '68%' : undefined,
        data: isPie
          ? labels.map((l, i) => ({ name: l, value: values[i], itemStyle: { color: PALETTE[i % PALETTE.length] } }))
          : values,
        smooth: type === 'line',
        areaStyle: type === 'line' ? { opacity: 0.08 } : undefined,
        itemStyle: {
          borderRadius: type === 'bar' ? [4, 4, 0, 0] : 0,
          color: (params) => PALETTE[params.dataIndex % PALETTE.length],
        },
        lineStyle: type === 'line' ? { width: 2, color: PALETTE[0] } : undefined,
        symbol: type === 'line' ? 'circle' : undefined,
        symbolSize: type === 'line' ? 6 : undefined,
      }];

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: isPie ? 'item' : 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#1e293b',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
    },
    legend: data?.datasets ? {
      bottom: 0,
      textStyle: { color: '#94a3b8', fontSize: 11 },
      icon: 'circle',
    } : { show: false },
    grid: !isPie ? { top: 12, right: 12, bottom: data?.datasets ? 40 : 28, left: 48, containLabel: true } : undefined,
    xAxis: !isPie ? {
      type: 'category',
      data: labels,
      axisLabel: { color: '#64748b', fontSize: 11 },
      axisLine: { lineStyle: { color: '#1e293b' } },
      splitLine: { show: false },
    } : undefined,
    yAxis: !isPie ? {
      type: 'value',
      axisLabel: { color: '#64748b', fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
    } : undefined,
    series,
  };
}

const TYPES = [
  { key: 'bar',   Icon: BarChart2,  label: 'Barras' },
  { key: 'line',  Icon: TrendingUp, label: 'Linha'  },
  { key: 'pie',   Icon: PieChart,   label: 'Pizza'  },
  { key: 'donut', Icon: PieChart,   label: 'Donut'  },
];

const DynamicChart = ({ title, data, defaultType = 'bar', loading = false, error = null, className = 'h-64' }) => {
  const [type, setType] = useState(defaultType);

  const option = useMemo(() => buildOption(type, data, title), [type, data, title]);

  return (
    <div className={`card-premium flex flex-col gap-3 group ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</h3>

        {/* Seletor de Tipo — aparece no hover */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
          {TYPES.map(({ key, Icon, label }) => (
            <button
              key={key}
              title={label}
              onClick={() => setType(key)}
              className={`p-1.5 rounded-md transition-colors ${
                type === key
                  ? 'bg-hospital-500/20 text-hospital-400'
                  : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {loading && (
          <div className="h-full flex items-center justify-center text-slate-600">
            <Loader2 size={24} className="animate-spin" />
          </div>
        )}
        {!loading && error && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-rose-500">
            <AlertCircle size={20} />
            <span className="text-xs">{error}</span>
          </div>
        )}
        {!loading && !error && data && (
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
          />
        )}
      </div>
    </div>
  );
};

export default DynamicChart;
