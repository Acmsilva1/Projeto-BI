'use strict';

/**
 * cc_detalhado.js  Modulo de Eficiencia Cirurgica
 * ------------------------------------------------------------------
 * Monitora a cronologia dos eventos (5, 6, 12, 14, 7) e atrasos.
 * ------------------------------------------------------------------
 */

const CC_DETALHADO = {
  async init() {
    console.log('Iniciando modulo CC Detalhado...');
    await Promise.all([
      this.loadKpis(),
      this.loadPerformance(),
    ]);
    this.renderTemposMediosChart();
    this.renderOciosidadeChart();
  },

  async loadKpis() {
    try {
      const { data } = await window.API.fetchAPI('cc/kpis');
      const setVal = (id, value, suffix = '') => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${value ?? '--'}${suffix}`;
      };

      setVal('cc-kpi-tempo-cirurgia', window.API.formatNumber(data.tempoCirurgiaMin || 0, 1), ' min');
      setVal('cc-kpi-tempo-sala', window.API.formatNumber(data.tempoSalaMin || 0, 1), ' min');
      setVal('cc-kpi-tempo-anestesia', window.API.formatNumber(data.tempoAnestesiaMin || 0, 1), ' min');
      setVal('cc-resumo-eletivas', window.API.formatNumber(data.eletivas || 0, 0));
      setVal('cc-resumo-urgencias', window.API.formatNumber(data.urgencias || 0, 0));
      setVal('cc-resumo-altas', window.API.formatNumber(data.altas || 0, 0));
      setVal('cc-resumo-obitos', window.API.formatNumber(data.obitos || 0, 0));
    } catch (err) {
      console.error('Erro ao carregar KPIs CC:', err);
    }
  },

  async loadPerformance() {
    try {
      const { data } = await window.API.fetchAPI('cc/performance');
      const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      setVal('cc-perf-atraso', `${data.atraso30min}%`);
      setVal('cc-perf-reabordagem', `${data.taxaReabordagem}%`);
      setVal('cc-perf-ociosidade', `${data.ociosidadeSala}%`);
      setVal('cc-perf-sub', `${data.subutilizacaoFiltrado} min`);
      setVal('cc-kpi-total', window.API.formatNumber(data.totalCirurgias || 0, 0));
      setVal('cc-kpi-atraso', `${data.atraso30min}%`);
    } catch (err) {
      console.error('Erro ao carregar performance CC:', err);
    }
  },

  renderOciosidadeChart() {
    const ctx = document.getElementById('chartCcOciosidade');
    if (!ctx) return;
    
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Produtivo', 'Ocioso'],
        datasets: [{
          data: [81.5, 18.5],
          backgroundColor: ['#22c55e', 'rgba(255,255,255,0.05)'],
          borderWidth: 0,
          cutout: '80%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  },

  renderTemposMediosChart() {
    const ctx = document.getElementById('chartCcTemposMedios');
    if (!ctx) return;

    if (this.chart) this.chart.destroy();

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Inicio Sala', 'Anestesia', 'Cirurgia', 'Saida Sala'],
        datasets: [{
          label: 'Media de Tempo (min)',
          data: [15, 45, 115, 20],
          backgroundColor: ['#6366f1', '#8b5cf6', '#3b82f6', '#94a3b8'],
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { grid: { display: false }, ticks: { color: '#f1f5f9' } }
        }
      }
    });
  }
};

window.CC_DETALHADO = CC_DETALHADO;





