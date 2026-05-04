import ReactECharts from "echarts-for-react";
import { type ReactElement } from "react";
import type { PsHeatmapAnalysis } from "./psChegadasHeatmapAnalysis";

export type PsChegadasHeatmapReportProps = {
  unidade: string;
  mesLabel: string;
  analysis: PsHeatmapAnalysis;
};

export function PsChegadasHeatmapReport(props: PsChegadasHeatmapReportProps): ReactElement {
  const { analysis, unidade, mesLabel } = props;

  // --- Lógica de Destaque para Fluxo Diário ---
  const dailySorted = [...analysis.dailySeries.map(d => d.total)].sort((a, b) => a - b);
  const dailyThreshold = dailySorted[Math.floor(dailySorted.length * 0.8)] || 0;

  const dailyOption = {
    title: { text: "Fluxo Diário", textStyle: { color: "#e2e8f0", fontSize: 13 } },
    tooltip: { trigger: "axis" },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "category",
      data: analysis.dailySeries.map((d) => d.day),
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      splitLine: { show: true, lineStyle: { color: "rgba(148, 163, 184, 0.25)", type: "dashed" } }
    },
    yAxis: { 
      type: "value", 
      axisLabel: { color: "#94a3b8", fontSize: 10 }, 
      splitLine: { show: true, lineStyle: { color: "rgba(148, 163, 184, 0.25)", type: "dashed" } }
    },
    series: [
      {
        name: "Chegadas",
        type: "line",
        smooth: true,
        data: analysis.dailySeries.map((d) => ({
          value: d.total,
          itemStyle: { color: d.total >= dailyThreshold && d.total > 0 ? "#facc15" : "#2de0b9" },
          label: {
            show: true,
            position: "top",
            color: d.total >= dailyThreshold && d.total > 0 ? "#facc15" : "#2de0b9",
            fontWeight: 900,
            fontSize: 11,
            formatter: (p: any) => p.value > 0 ? p.value : ""
          }
        })),
        areaStyle: { 
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(45, 224, 185, 0.15)' }, { offset: 1, color: 'transparent' }]
          }
        },
        lineStyle: { color: "#2de0b9", width: 2 },
        showSymbol: true,
        symbolSize: (val: any, params: any) => params.data.value >= dailyThreshold ? 8 : 4
      }
    ]
  };

  // --- Lógica de Destaque para Distribuição Horária ---
  const hourlyTotal = analysis.hourlySeries.reduce((acc, h) => acc + h.avg, 0);
  const hourlyRawData = analysis.hourlySeries.map(h => {
    const val = hourlyTotal > 0 ? (h.avg / hourlyTotal) * 100 : 0;
    return parseFloat(val.toFixed(1));
  });
  const hourlySorted = [...hourlyRawData].sort((a, b) => a - b);
  const hourlyThreshold = hourlySorted[Math.floor(hourlySorted.length * 0.8)] || 0;

  const hourlyOption = {
    title: { text: "Distribuição Hora (%)", textStyle: { color: "#e2e8f0", fontSize: 13 } },
    tooltip: { 
      trigger: "axis",
      formatter: (params: any) => {
        const p = params[0];
        return `<b>${p.name}</b><br/>${p.marker} <b>${p.value}%</b> do volume total<br/><b>Média: ${p.data.rawCount} chegadas</b>`;
      }
    },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "category",
      data: analysis.hourlySeries.map((h) => `${h.hour}h`),
      axisLabel: { color: "#94a3b8", fontSize: 9 }
    },
    yAxis: { 
      type: "value", 
      axisLabel: { color: "#94a3b8", fontSize: 9, formatter: "{value}%" }, 
      splitLine: { show: true, lineStyle: { color: "rgba(71, 85, 105, 0.15)", type: "dashed" } }
    },
    series: [
      {
        name: "Distribuição",
        type: "bar",
        data: analysis.hourlySeries.map((h, i) => {
          const val = hourlyRawData[i];
          return {
            value: val,
            rawCount: h.avg.toFixed(1),
            itemStyle: { color: val >= hourlyThreshold && val > 0 ? "#facc15" : "#38bdf8" },
            label: {
              show: true,
              position: "top",
              color: val >= hourlyThreshold && val > 0 ? "#facc15" : "#38bdf8",
              fontWeight: 900,
              fontSize: 11,
              formatter: "{c}%"
            }
          };
        })
      }
    ]
  };

  // --- Lógica "Camaleão" para o Gráfico de Radar ---
  const weekdayData = analysis.weekdaySeries.map(w => parseFloat(w.avg.toFixed(1)));
  const maxWeekday = Math.max(...weekdayData, 1);
  const avgWeekday = weekdayData.reduce((a, b) => a + b, 0) / 7;
  const weekdayLabelsShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  const pctVariation = ((maxWeekday - avgWeekday) / avgWeekday) * 100;
  const isCritical = pctVariation > 30;
  const isAlert = pctVariation > 15;

  const alertColor = "#facc15";   
  const criticalColor = "#ef4444"; 
  const calmColor = "#a78bfa";     
  
  let baseColor = calmColor;
  if (isCritical) baseColor = criticalColor;
  else if (isAlert) baseColor = alertColor;

  const radarOption = {
    title: { text: "Sazonalidade Semanal", textStyle: { color: "#e2e8f0", fontSize: 13 } },
    tooltip: { trigger: "item" },
    radar: {
      indicator: weekdayLabelsShort.map((name, i) => {
        const isPeak = weekdayData[i] === maxWeekday;
        return {
          name: isPeak ? `{peak|${name}}` : name,
          max: Math.ceil(maxWeekday * 1.15),
          color: isPeak ? baseColor : "#2de0b9" // Segue a cor do camaleão se for pico
        };
      }),
      axisName: {
        fontSize: 12,
        fontWeight: "bold",
        rich: {
          peak: {
            fontSize: 15,
            fontWeight: 900,
            color: baseColor,
            textShadowColor: baseColor + "66", // Brilho na cor da criticidade
            textShadowBlur: 10
          }
        }
      },
      center: ['50%', '60%'],
      radius: '55%',
      splitArea: { show: false },
      splitLine: { show: true, lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
      axisLine: { show: true, lineStyle: { color: "rgba(148, 163, 184, 0.1)" } }
    },
    series: [{
      name: "Média",
      type: "radar",
      data: [{
        value: weekdayData,
        name: "Média de Chegadas",
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: baseColor, width: isCritical ? 4 : 2 },
        areaStyle: { 
          color: {
            type: 'radial', x: 0.5, y: 0.5, r: 0.5,
            colorStops: [{ offset: 0, color: calmColor + '10' }, { offset: 1, color: baseColor + '40' }]
          }
        },
        itemStyle: { color: baseColor },
        label: { 
          show: true, fontSize: 10, color: "#e2e8f0",
          formatter: (p: any) => (p.value === maxWeekday && (isAlert || isCritical)) ? `{val|${p.value}}` : p.value,
          rich: { val: { color: baseColor, fontWeight: 'bold', fontSize: 13 } }
        }
      }]
    }]
  };

  // --- Lógica do Perfil de Estresse Mensal (Donut) ---
  const totalDays = analysis.dailySeries.length;
  let stableDays = 0;
  let alertDays = 0;
  let criticalDays = 0;

  analysis.dailySeries.forEach(d => {
    const variation = ((d.total - avgWeekday) / avgWeekday) * 100;
    if (variation > 30) criticalDays++;
    else if (variation > 15) alertDays++;
    else stableDays++;
  });

  const stressProfileOption = {
    title: { 
      text: "Perfil de Estresse Mensal", 
      left: "center",
      top: 5,
      textStyle: { color: "#e2e8f0", fontSize: 13 } 
    },
    tooltip: { trigger: 'item' },
    series: [
      {
        name: 'Perfil Mensal',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '62%'],
        startAngle: 150, // Gira o gráfico para posicionar as fatias menores na lateral
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 8, borderColor: '#1e293b', borderWidth: 2 },
        label: {
          show: true,
          position: 'outside',
          formatter: '{b}\n{c} dias ({d}%)',
          color: 'inherit',
          fontSize: 12,
          fontWeight: 900,
          lineHeight: 16
        },
        labelLine: { show: true, length: 25, length2: 15, lineStyle: { width: 2 } },
        data: [
          { value: stableDays, name: 'ESTÁVEL', itemStyle: { color: '#a78bfa' } },
          { value: alertDays, name: 'ATENÇÃO', itemStyle: { color: '#facc15' } },
          { value: criticalDays, name: 'CRÍTICO', itemStyle: { color: '#ef4444' } }
        ]
      }
    ],
    graphic: {
      type: 'text',
      left: 'center',
      top: '59%',
      style: {
        text: `${totalDays}\nDIAS`,
        textAlign: 'center',
        fill: '#f8fafc',
        fontSize: 16,
        fontWeight: 'bold'
      }
    }
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Grid de 2x2 (4 slots) */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Fluxo Diário */}
        <div className="rounded-2xl border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_92%,transparent)] p-4 shadow-sm">
          <ReactECharts key="daily-flow" notMerge={true} option={dailyOption} style={{ height: "280px" }} />
          <div className="mt-4 flex flex-col items-center gap-1.5">
            <div className="flex justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#2de0b9]" />
                <span className="text-[11px] text-[var(--app-muted)] font-bold">Padrão</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#facc15]" />
                <span className="text-[11px] text-[var(--app-muted)] font-bold">Pico</span>
              </div>
            </div>
            <p className="text-[10px] text-[var(--app-muted)] italic text-center leading-tight font-medium">Valor total de chegadas por dia</p>
          </div>
        </div>

        {/* Distribuição por Hora */}
        <div className="rounded-2xl border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_92%,transparent)] p-4 shadow-sm">
          <ReactECharts key="hourly-dist" notMerge={true} option={hourlyOption} style={{ height: "280px" }} />
          <div className="mt-4 flex flex-col items-center gap-1.5">
            <div className="flex justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-md bg-[#38bdf8]" />
                <span className="text-[11px] text-[var(--app-muted)] font-bold">Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-md bg-[#facc15]" />
                <span className="text-[11px] text-[var(--app-muted)] font-bold">Crítico</span>
              </div>
            </div>
            <p className="text-[10px] text-[var(--app-muted)] italic text-center leading-tight font-medium">Percentual (%) do volume total de chegadas</p>
          </div>
        </div>

        {/* Radar */}
        <div className="rounded-2xl border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_92%,transparent)] p-4 shadow-sm flex flex-col">
          <ReactECharts key="weekly-radar" notMerge={true} option={radarOption} style={{ height: "280px" }} />
          <div className="mt-auto border-t border-[var(--table-grid)]/30 pt-3">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]" />
                <span className="text-[11px] text-[var(--app-muted)] uppercase font-bold italic">Estável (&lt;15%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#facc15]" />
                <span className="text-[11px] text-[var(--app-muted)] uppercase font-bold italic">Atenção (&gt;15%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
                <span className="text-[11px] text-[var(--app-muted)] uppercase font-bold italic">Crítico (&gt;30%)</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-[#cbd5e1] text-center italic leading-tight font-medium">
              % em relação à média semanal
            </p>
          </div>
        </div>

        {/* Perfil de Estresse Mensal (Donut) */}
        <div className="rounded-2xl border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_92%,transparent)] p-4 shadow-sm flex flex-col">
          <ReactECharts key="stress-profile" notMerge={true} option={stressProfileOption} style={{ height: "280px" }} />
          <div className="mt-auto border-t border-[var(--table-grid)]/30 pt-3">
            <p className="text-[11px] text-[#cbd5e1] text-center italic leading-tight font-medium">
              Análise estratégica da frequência de picos críticos ao longo de todo o mês.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
