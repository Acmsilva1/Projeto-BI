/**
 * financeiro.js  Grficos do Modulo Financeiro
 */

function renderFinanceiroResumo(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;

  // Gradientes
  const gradReceita = ctx.createLinearGradient(0, 0, 0, 300);
  gradReceita.addColorStop(0, '#22c55e40');
  gradReceita.addColorStop(1, '#22c55e00');

  const gradDespesa = ctx.createLinearGradient(0, 0, 0, 300);
  gradDespesa.addColorStop(0, '#ef444440');
  gradDespesa.addColorStop(1, '#ef444400');

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Receitas',
          data: data.receitas,
          borderColor: '#22c55e',
          backgroundColor: gradReceita,
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#22c55e',
        },
        {
          label: 'Despesas',
          data: data.despesas,
          borderColor: '#ef4444',
          backgroundColor: gradDespesa,
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ef4444',
        },
        {
          label: `Meta Receita`,
          data: Array(data.labels.length).fill(data.meta),
          borderColor: '#3b82f680',
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      ...OcupacaoModule.CHART_DEFAULTS,
      scales: {
        x: { ...OcupacaoModule.CHART_DEFAULTS.scales.x },
        y: {
          ...OcupacaoModule.CHART_DEFAULTS.scales.y,
          ticks: {
            ...OcupacaoModule.CHART_DEFAULTS.scales.y.ticks,
            callback: v => API.formatCurrency(v),
          }
        }
      }
    }
  });
}

function renderConveniosPizza(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.labels,
      datasets: [{
        data: data.valores,
        backgroundColor: data.cores.map(c => c + 'cc'),
        borderColor: data.cores,
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 11 },
            boxWidth: 10,
            padding: 12,
          }
        },
        tooltip: {
          ...OcupacaoModule.CHART_DEFAULTS.plugins.tooltip,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${API.formatCurrency(ctx.raw)}`,
          }
        }
      }
    }
  });
}

function renderGlosasBarras(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.porMotivo.map(m => m.motivo),
      datasets: [{
        label: 'Valor (R$)',
        data: data.porMotivo.map(m => m.valor),
        backgroundColor: ['#ef4444aa', '#f97316aa', '#f59e0baa', '#eab308aa', '#94a3b8aa'],
        borderColor:     ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#94a3b8'],
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      ...OcupacaoModule.CHART_DEFAULTS,
      indexAxis: 'y',
      plugins: {
        ...OcupacaoModule.CHART_DEFAULTS.plugins,
        legend: { display: false },
        tooltip: {
          ...OcupacaoModule.CHART_DEFAULTS.plugins.tooltip,
          callbacks: { label: ctx => ` ${API.formatCurrency(ctx.raw)}` }
        }
      },
      scales: {
        x: {
          ...OcupacaoModule.CHART_DEFAULTS.scales.x,
          ticks: { ...OcupacaoModule.CHART_DEFAULTS.scales.x.ticks, callback: v => API.formatCurrency(v) }
        },
        y: { ...OcupacaoModule.CHART_DEFAULTS.scales.y }
      }
    }
  });
}

function renderGlosaTendencia(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Taxa de Glosa (%)',
          data: data.glosasPercent,
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b20',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: '#f59e0b',
        },
        {
          label: 'Meta (3,5%)',
          data: Array(data.labels.length).fill(3.5),
          borderColor: '#22c55e80',
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      ...OcupacaoModule.CHART_DEFAULTS,
      scales: {
        x: { ...OcupacaoModule.CHART_DEFAULTS.scales.x },
        y: {
          ...OcupacaoModule.CHART_DEFAULTS.scales.y,
          ticks: { ...OcupacaoModule.CHART_DEFAULTS.scales.y.ticks, callback: v => `${v}%` }
        }
      }
    }
  });
}

window.FinanceiroModule = {
  renderFinanceiroResumo,
  renderConveniosPizza,
  renderGlosasBarras,
  renderGlosaTendencia,
};





