/**
 * ocupacao.js  Grficos de Ocupacao de Leitos
 */

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#94a3b8',
        font: { family: 'Inter', size: 11 },
        boxWidth: 12,
        boxHeight: 12,
        borderRadius: 3,
        useBorderRadius: true,
      }
    },
    tooltip: {
      backgroundColor: '#131929',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      padding: 10,
      cornerRadius: 8,
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
    }
  }
};

// --- Ocupacao por Setor (Barra Horizontal) ------------------------
let chartOcupacaoSetor = null;
let chartOcupacaoSetorFull = null;

function renderOcupacaoSetor(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;

  const cores = data.setores.map(s =>
    s.percentual >= 90 ? '#ef4444' :
    s.percentual >= 80 ? '#f59e0b' : '#22c55e'
  );

  const config = {
    type: 'bar',
    data: {
      labels: data.setores.map(s => s.nome),
      datasets: [
        {
          label: 'Ocupacao (%)',
          data: data.setores.map(s => s.percentual),
          backgroundColor: cores.map(c => c + '99'),
          borderColor: cores,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Meta (85%)',
          data: Array(data.setores.length).fill(85),
          type: 'line',
          borderColor: '#3b82f6',
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      scales: {
        x: {
          ...CHART_DEFAULTS.scales.x,
          min: 0, max: 100,
          ticks: { ...CHART_DEFAULTS.scales.x.ticks, callback: v => `${v}%` }
        },
        y: { ...CHART_DEFAULTS.scales.y }
      }
    }
  };

  return new Chart(ctx, config);
}

// --- Tendencia de Ocupacao (Linha Multi-srie) ---------------------
let chartOcupacaoTendencia = null;
let chartOcupacaoTendenciaFull = null;

function renderOcupacaoTendencia(canvasId, data) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;

  const datasets = data.series.map(s => ({
    label: s.nome,
    data: s.dados,
    borderColor: s.cor,
    backgroundColor: s.cor + '15',
    borderWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 5,
    fill: false,
    tension: 0.4,
  }));

  // Linha de meta
  datasets.push({
    label: `Meta (${data.meta}%)`,
    data: Array(data.labels.length).fill(data.meta),
    borderColor: '#ffffff30',
    borderDash: [5, 5],
    borderWidth: 1,
    pointRadius: 0,
    fill: false,
  });

  return new Chart(ctx, {
    type: 'line',
    data: { labels: data.labels, datasets },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: {
          ...CHART_DEFAULTS.scales.x,
          ticks: {
            ...CHART_DEFAULTS.scales.x.ticks,
            maxTicksLimit: 8,
            maxRotation: 0,
          }
        },
        y: {
          ...CHART_DEFAULTS.scales.y,
          min: 40, max: 100,
          ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => `${v}%` }
        }
      }
    }
  });
}

window.OcupacaoModule = {
  renderOcupacaoSetor,
  renderOcupacaoTendencia,
  CHART_DEFAULTS,
};





