import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Loader2 } from 'lucide-react';
import KpiCard from '../KpiCard';

/**
 * Bloco estilo PBI: KPIs + gauge % geral + combo barras (atend. / intern.) + linha % por unidade.
 */
export default function ConversaoPbiPanel({ conversao, loading }) {
  const kpis = conversao?.kpis || {};
  const rows = conversao?.porUnidadeUltimoMes || [];

  const comboOption = useMemo(() => {
    const labels = rows.map((r) => (r.unidade || '').replace(/^PS\s+/i, '').slice(0, 22));
    const atends = rows.map((r) => r.atendimentos);
    const inters = rows.map((r) => r.internacoes);
    const taxas = rows.map((r) => r.taxaPct);
    const maxTaxa = taxas.length ? Math.ceil(Math.max(8, ...taxas) * 1.15) : 10;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#1e293b',
        textStyle: { color: '#e2e8f0', fontSize: 11 },
      },
      legend: {
        data: ['Qtd atendimentos', 'Qtd internações', '% conversão'],
        bottom: 0,
        textStyle: { color: '#94a3b8', fontSize: 10 },
      },
      grid: { top: 16, right: 56, bottom: 52, left: 48, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#64748b', fontSize: 9, rotate: 35 },
        axisLine: { lineStyle: { color: '#1e293b' } },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Qtd',
          axisLabel: { color: '#64748b', fontSize: 10 },
          splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
        },
        {
          type: 'value',
          name: '%',
          min: 0,
          max: maxTaxa,
          axisLabel: { color: '#94a3b8', fontSize: 10, formatter: '{value}%' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Qtd atendimentos',
          type: 'bar',
          data: atends,
          itemStyle: { color: '#166534', borderRadius: [3, 3, 0, 0] },
        },
        {
          name: 'Qtd internações',
          type: 'bar',
          data: inters,
          itemStyle: { color: '#86efac', borderRadius: [3, 3, 0, 0] },
        },
        {
          name: '% conversão',
          type: 'line',
          yAxisIndex: 1,
          data: taxas,
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 2, color: '#f97316' },
          itemStyle: { color: '#f97316' },
        },
      ],
    };
  }, [rows]);

  const gaugeOption = useMemo(() => {
    const v = Number(kpis.taxaConversaoPct || 0);
    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 15,
          splitNumber: 5,
          radius: '88%',
          center: ['50%', '58%'],
          axisLine: {
            lineStyle: {
              width: 14,
              color: [
                [0.25, '#22c55e'],
                [0.5, '#eab308'],
                [0.75, '#f97316'],
                [1, '#ef4444'],
              ],
            },
          },
          pointer: { itemStyle: { color: '#e2e8f0' }, width: 4 },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { color: '#64748b', fontSize: 9, distance: -36 },
          title: { show: false },
          detail: {
            valueAnimation: true,
            formatter: '{value}%',
            color: '#f1f5f9',
            fontSize: 22,
            fontWeight: 700,
            offsetCenter: [0, '24%'],
          },
          data: [{ value: v }],
        },
      ],
    };
  }, [kpis.taxaConversaoPct]);

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Conversão (PS × internação)</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Internações" value={kpis.quantidadeInternacoes} loading={loading} accent="emerald" />
        <KpiCard label="Atendimentos PS" value={kpis.quantidadeAtendimentos} loading={loading} />
        <KpiCard
          label="Tempo médio PS → internação"
          value={
            kpis.tempoMedioPsInternacaoHoras != null
              ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(
                  kpis.tempoMedioPsInternacaoHoras,
                )
              : '—'
          }
          loading={loading}
          suffix={kpis.tempoMedioPsInternacaoHoras != null ? ' h' : undefined}
        />
        <div className="card-premium flex flex-col min-h-[120px]">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">% conversão (todas)</h3>
          <div className="flex-1 min-h-[100px]">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-600">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : (
              <ReactECharts option={gaugeOption} style={{ height: 120, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge />
            )}
          </div>
        </div>
      </div>
      <div className="card-premium">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">% conversão por unidade</h3>
        <div className="h-80">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-600">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : (
            <ReactECharts option={comboOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} notMerge />
          )}
        </div>
      </div>
    </section>
  );
}
