/**
 * tendencias.js  Grficos de Qualidade, Radar e NPS
 */

function renderQualidadeLinhas(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Infeccao Hospitalar',
          data: data.infeccaoHospitalar,
          borderColor: '#ef4444',
          backgroundColor: '#ef444415',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 7,
        },
        {
          label: 'Quedas',
          data: data.quedas,
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b15',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 7,
        },
        {
          label: 'Ulceras por Pressao',
          data: data.ulcerasPressao,
          borderColor: '#8b5cf6',
          backgroundColor: '#8b5cf615',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 7,
        },
        {
          label: 'Meta (2,0)',
          data: Array(data.labels.length).fill(data.meta),
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
          min: 0,
          ticks: { ...OcupacaoModule.CHART_DEFAULTS.scales.y.ticks, callback: v => `${v}/100` }
        }
      }
    }
  });
}

function renderQualidadeRadar(canvasId) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;

  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: [
        'Seguranca do Paciente',
        'Infeccao Hospitalar',
        'Satisfacao',
        'Tempo de Espera',
        'Readmissao',
        'Documentacao',
        'Protocolos',
      ],
      datasets: [
        {
          label: 'Performance Atual',
          data: [88, 82, 91, 75, 87, 79, 93],
          borderColor: '#3b82f6',
          backgroundColor: '#3b82f620',
          borderWidth: 2,
          pointBackgroundColor: '#3b82f6',
          pointRadius: 4,
        },
        {
          label: 'Meta',
          data: [90, 90, 90, 85, 90, 85, 90],
          borderColor: '#22c55e80',
          backgroundColor: '#22c55e08',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointBackgroundColor: '#22c55e',
          pointRadius: 3,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 12, borderRadius: 3, useBorderRadius: true }
        },
        tooltip: OcupacaoModule.CHART_DEFAULTS.plugins.tooltip,
      },
      scales: {
        r: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          angleLines: { color: 'rgba(255,255,255,0.06)' },
          pointLabels: { color: '#94a3b8', font: { family: 'Inter', size: 10 } },
          ticks: { color: '#64748b', backdropColor: 'transparent', font: { size: 9 }, stepSize: 20 },
          min: 60, max: 100,
        }
      }
    }
  });
}

function renderNPS(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;

  const gradNPS = ctx.createLinearGradient(0, 0, 0, 200);
  gradNPS.addColorStop(0, '#3b82f640');
  gradNPS.addColorStop(1, '#3b82f600');

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'NPS / Satisfacao (%)',
          data: data.nps,
          borderColor: '#3b82f6',
          backgroundColor: gradNPS,
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: '#3b82f6',
        },
        {
          label: `Meta (${data.metaNps}%)`,
          data: Array(data.labels.length).fill(data.metaNps),
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
          min: 75, max: 100,
          ticks: { ...OcupacaoModule.CHART_DEFAULTS.scales.y.ticks, callback: v => `${v}%` }
        }
      }
    }
  });
}

window.TendenciasModule = {
  renderQualidadeLinhas,
  renderQualidadeRadar,
  renderNPS,
};





