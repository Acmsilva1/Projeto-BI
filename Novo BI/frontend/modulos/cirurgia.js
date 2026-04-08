/**
 * cirurgia.js  Grficos do Centro Cirurgico
 */

function renderCirurgiasEspacialidade(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;

  const COLORS = ['#3b82f6','#22c55e','#ef4444','#8b5cf6','#f59e0b','#ec4899','#06b6d4','#94a3b8'];

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Cirurgias',
          data: data.dados,
          backgroundColor: COLORS.map(c => c + 'cc'),
          borderColor: COLORS,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Meta',
          data: data.meta,
          type: 'line',
          borderColor: '#ffffff50',
          borderDash: [4, 4],
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
        y: { ...OcupacaoModule.CHART_DEFAULTS.scales.y, beginAtZero: true }
      }
    }
  });
}

function renderCirurgiasEvolucao(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Eletivas',
          data: data.eletivas,
          backgroundColor: '#3b82f688',
          borderColor: '#3b82f6',
          borderWidth: 2,
          borderRadius: 5,
          borderSkipped: false,
          stack: 'total',
        },
        {
          label: 'Urgencias',
          data: data.urgencias,
          backgroundColor: '#ef444488',
          borderColor: '#ef4444',
          borderWidth: 2,
          borderRadius: 5,
          borderSkipped: false,
          stack: 'total',
        },
        {
          label: `Meta (${data.meta})`,
          data: Array(data.labels.length).fill(data.meta),
          type: 'line',
          borderColor: '#22c55e',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          stack: false,
        }
      ]
    },
    options: {
      ...OcupacaoModule.CHART_DEFAULTS,
      scales: {
        x: { ...OcupacaoModule.CHART_DEFAULTS.scales.x, stacked: true },
        y: { ...OcupacaoModule.CHART_DEFAULTS.scales.y, stacked: true, beginAtZero: true }
      }
    }
  });
}

function renderTempoSemana(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;

  const cores = data.mediaTempoMin.map(v => v > 240 ? '#ef4444cc' : v > 200 ? '#f59e0bcc' : '#22c55ecc');

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Tempo Medio (min)',
        data: data.mediaTempoMin,
        backgroundColor: cores,
        borderColor: cores.map(c => c.replace('cc', '')),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      ...OcupacaoModule.CHART_DEFAULTS,
      plugins: {
        ...OcupacaoModule.CHART_DEFAULTS.plugins,
        legend: { display: false }
      },
      scales: {
        x: { ...OcupacaoModule.CHART_DEFAULTS.scales.x },
        y: {
          ...OcupacaoModule.CHART_DEFAULTS.scales.y,
          beginAtZero: false,
          ticks: {
            ...OcupacaoModule.CHART_DEFAULTS.scales.y.ticks,
            callback: v => `${v}min`
          }
        }
      }
    }
  });
}

// --- Heatmap CC ----------------------------------------------------
function renderHeatmapCC(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sb', 'Dom'];

  let html = `<div class="heatmap-days">${dias.map(d => `<div class="heatmap-day-label">${d}</div>`).join('')}</div>`;
  html += '<div class="heatmap-grid">';

  data.heatmap.forEach((row, horaIdx) => {
    html += `<div class="heatmap-row">
      <span class="heatmap-label">${data.horasLabels[horaIdx]}</span>`;

    row.forEach(val => {
      const alpha = Math.round((val / 100) * 255).toString(16).padStart(2, '0');
      const cor = val >= 80 ? `#ef4444${alpha}` : val >= 50 ? `#f59e0b${alpha}` : `#3b82f6${alpha}`;
      html += `<div class="heatmap-cell" style="background:${cor}" title="${val}% utilizacao"></div>`;
    });

    html += '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
}

window.CirurgiaModule = {
  renderCirurgiasEspacialidade,
  renderCirurgiasEvolucao,
  renderTempoSemana,
  renderHeatmapCC,
};





