'use strict';

const AppState = {
  currentSection: '',
  charts: {},
  filters: {
    period: 30,
    regional: '',
    unidade: '',
  },
  unidadesPorRegional: {
    ES: ['001 - HOSPITAL VITORIA_ES', '003 - PS VILA VELHA_ES'],
    DF: ['013 - PS SIG_DF', '039 - PS TAGUATINGA_DF'],
    RJ: ['025 - PS BARRA DA TIJUCA_RJ', '026 - PS BOTAFOGO_RJ', '045 - PS CAMPO GRANDE_RJ'],
    MG: ['031 - PS GUTIERREZ_MG', '033 - PS PAMPULHA_MG'],
  },
};
window.AppState = AppState;

const initializedSections = new Set();
const sectionGroups = {
  overview: ['overview'],
  ps: ['ps'],
  cirurgias: ['cirurgias', 'cc-detalhado'],
  internacoes: ['internacoes'],
};

const valueLabelPlugin = {
  id: 'valueLabelPlugin',
  afterDatasetsDraw(chart) {
    if (chart.config.type === 'radar') return;
    const { ctx } = chart;

    ctx.save();
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;
      meta.data.forEach((element, index) => {
        const rawValue = dataset.data[index];
        if (rawValue === null || rawValue === undefined) return;

        const value = Number(rawValue);
        const label = Number.isNaN(value) ? String(rawValue) : value.toLocaleString('pt-BR');

        if (chart.config.type === 'bar') {
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(label, element.x, element.y - 14);
          return;
        }

        if (chart.config.type === 'line') {
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(label, element.x, element.y - 10);
          return;
        }

        const pos = element.tooltipPosition();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, pos.x, pos.y);
      });
    });

    ctx.restore();
  },
};

function navigateTo(section) {
  if (AppState.currentSection === section) return;

  document.querySelectorAll('.dashboard-section').forEach((s) => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));

  const targets = sectionGroups[section] || [section];
  targets.forEach((s) => {
    const target = document.getElementById(`section-${s}`);
    if (target) {
      target.classList.add('active');
      target.classList.remove('hidden');
    }
  });
  document.getElementById(`nav-${section}`)?.classList.add('active');

  const labels = {
    overview: 'Resumo Geral',
    ps: 'Pronto Socorro',
    cirurgias: 'Centro Cirurgico',
    internacoes: 'Internacoes',
  };
  const breadcrumb = document.getElementById('breadcrumbSection');
  if (breadcrumb) breadcrumb.textContent = labels[section] || section;

  AppState.currentSection = section;
  lucide.createIcons();
  initSectionIfNeeded(section);
}

async function initSectionIfNeeded(section) {
  if (initializedSections.has(section)) return;
  initializedSections.add(section);

  switch (section) {
    case 'overview': await initOverview(); break;
    case 'ps': await window.PS.init(); break;
    case 'cirurgias':
      await Promise.all([
        initCirurgias(),
        window.CC_DETALHADO.init(),
      ]);
      break;
    case 'internacoes': await initInternacoes(); break;
    default: break;
  }
}

function destroyChart(key) {
  if (AppState.charts[key]) {
    AppState.charts[key].destroy();
    AppState.charts[key] = null;
  }
}

async function initOverview() {
  try {
    const [kpiRes, psRes, ccRes, intRes, kpiUnidadesRes] = await Promise.all([
      window.API.fetchAPI('kpi'),
      window.API.fetchAPI('ps/kpis'),
      window.API.fetchAPI('cc/kpis'),
      window.API.fetchAPI('ocupacao/resumo'),
      window.API.fetchAPI('kpi/unidades'),
    ]);

    if (kpiRes.ok) {
      const k = kpiRes.data;
      const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      set('ov-kpi-pacientes', window.API.formatNumber(k.pacientesAtivos?.valor || 0, 0));
      set('ov-kpi-ocupacao', `${window.API.formatNumber(k.taxaOcupacao?.valor || 0, 1)}%`);
      set('ov-kpi-cirurgias', window.API.formatNumber(k.cirurgiasNoMes?.valor || 0, 0));
    }

    const ps = psRes.ok ? psRes.data : {};
    const cc = ccRes.ok ? ccRes.data : {};
    const it = intRes.ok ? intRes.data : {};
    const unidades = kpiUnidadesRes.ok ? kpiUnidadesRes.data : [];

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    set('ov-kpi-internacoes', window.API.formatNumber(it.quantidadeInternacoes || 0, 0));

    const operacaoCtx = document.getElementById('chartOverviewOperacao');
    if (operacaoCtx) {
      destroyChart('overviewOperacao');
      AppState.charts.overviewOperacao = new Chart(operacaoCtx, {
        type: 'bar',
        data: {
          labels: ['PS Conversao %', 'CC Eletivas', 'CC Urgencias', 'Internacoes'],
          datasets: [{
            data: [
              Number(ps.conversaoInternacao || 0),
              Number(cc.eletivas || 0),
              Number(cc.urgencias || 0),
              Number(it.quantidadeInternacoes || 0),
            ],
            backgroundColor: ['#06b6d4aa', '#3b82f6aa', '#f59e0baa', '#8b5cf6aa'],
            borderColor: ['#06b6d4', '#3b82f6', '#f59e0b', '#8b5cf6'],
            borderWidth: 2,
            borderRadius: 8,
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
    }

    const internacaoCtx = document.getElementById('chartOverviewInternacao');
    if (internacaoCtx) {
      destroyChart('overviewInternacao');
      AppState.charts.overviewInternacao = new Chart(internacaoCtx, {
        type: 'doughnut',
        data: {
          labels: ['Clinicos', 'Cirurgicos', 'Internos', 'Externos'],
          datasets: [{
            data: [
              Number(it.pacientesClinicos || 0),
              Number(it.pacientesCirurgicos || 0),
              Number(it.pacientesInternos || 0),
              Number(it.pacientesExternos || 0),
            ],
            backgroundColor: ['#8b5cf6aa', '#06b6d4aa', '#14b8a6aa', '#f59e0baa'],
            borderColor: ['#8b5cf6', '#06b6d4', '#14b8a6', '#f59e0b'],
            borderWidth: 2,
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '62%' },
      });
    }

    const unidadesCtx = document.getElementById('chartOverviewUnidades');
    if (unidadesCtx) {
      destroyChart('overviewUnidades');
      AppState.charts.overviewUnidades = new Chart(unidadesCtx, {
        type: 'bar',
        data: {
          labels: unidades.map((u) => (u.unidadeNome || '').replace('PS ', '').slice(0, 18)),
          datasets: [
            {
              label: 'Ocupacao (%)',
              data: unidades.map((u) => Number(u.taxaOcupacao || 0)),
              backgroundColor: '#3b82f6aa',
              borderColor: '#3b82f6',
              borderWidth: 2,
              borderRadius: 6,
            },
            {
              label: 'Pacientes Ativos',
              data: unidades.map((u) => Number(u.pacientesAtivos || 0)),
              backgroundColor: '#22c55eaa',
              borderColor: '#22c55e',
              borderWidth: 2,
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 } },
            y: { ticks: { color: '#94a3b8' }, beginAtZero: true },
          },
        },
      });
    }
  } catch (err) {
    console.error('Erro ao inicializar Resumo Geral:', err);
  }
}

function renderInternacaoCharts(resumo) {
  const desfechoCtx = document.getElementById('chartInternacaoDesfecho');
  const perfilCtx = document.getElementById('chartInternacaoPerfil');
  const origemCtx = document.getElementById('chartInternacaoOrigem');

  if (desfechoCtx) {
    destroyChart('desfecho');
    AppState.charts.desfecho = new Chart(desfechoCtx, {
      type: 'bar',
      data: {
        labels: ['Internacoes', 'Altas', 'Obitos'],
        datasets: [{
          data: [resumo.quantidadeInternacoes, resumo.altas, resumo.obitos],
          backgroundColor: ['#3b82f6aa', '#22c55eaa', '#ef4444aa'],
          borderColor: ['#3b82f6', '#22c55e', '#ef4444'],
          borderWidth: 2,
          borderRadius: 8,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
  }

  if (perfilCtx) {
    destroyChart('perfil');
    AppState.charts.perfil = new Chart(perfilCtx, {
      type: 'doughnut',
      data: {
        labels: ['Clinicos', 'Cirurgicos'],
        datasets: [{
          data: [resumo.pacientesClinicos, resumo.pacientesCirurgicos],
          backgroundColor: ['#8b5cf6aa', '#06b6d4aa'],
          borderColor: ['#8b5cf6', '#06b6d4'],
          borderWidth: 2,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%' },
    });
  }

  if (origemCtx) {
    destroyChart('origem');
    AppState.charts.origem = new Chart(origemCtx, {
      type: 'pie',
      data: {
        labels: ['Internos', 'Externos'],
        datasets: [{
          data: [resumo.pacientesInternos, resumo.pacientesExternos],
          backgroundColor: ['#14b8a6aa', '#f59e0baa'],
          borderColor: ['#14b8a6', '#f59e0b'],
          borderWidth: 2,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }
}

async function initInternacoes() {
  try {
    const [kpiRes, resumoRes] = await Promise.all([
      window.API.fetchAPI('ocupacao/kpis'),
      window.API.fetchAPI('ocupacao/resumo'),
    ]);

    if (kpiRes.ok) {
      const k = kpiRes.data;
      document.getElementById('int-kpi-altas').textContent = k.altasAcumuladas;
      document.getElementById('int-kpi-obitos').textContent = k.obitosAcumulados;
      document.getElementById('int-kpi-permanencia').textContent = `${k.tempoMedioPermanencia} dias`;
    }

    if (resumoRes.ok) {
      const r = resumoRes.data;
      const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setText('int-kpi-total', r.quantidadeInternacoes ?? '--');
      setText('int-resumo-clinicos', r.pacientesClinicos ?? '--');
      setText('int-resumo-cirurgicos', r.pacientesCirurgicos ?? '--');
      setText('int-resumo-internos', r.pacientesInternos ?? '--');
      setText('int-resumo-externos', r.pacientesExternos ?? '--');

      renderInternacaoCharts({
        quantidadeInternacoes: Number(r.quantidadeInternacoes || 0),
        altas: Number(r.altas || 0),
        obitos: Number(r.obitos || 0),
        pacientesClinicos: Number(r.pacientesClinicos || 0),
        pacientesCirurgicos: Number(r.pacientesCirurgicos || 0),
        pacientesInternos: Number(r.pacientesInternos || 0),
        pacientesExternos: Number(r.pacientesExternos || 0),
      });
    }
  } catch (err) {
    console.error('Erro ao inicializar Internacoes:', err);
  }
}

async function initCirurgias() {
  try {
    const [espRes, evoRes] = await Promise.all([
      window.API.fetchAPI('cirurgia/especialidade'),
      window.API.fetchAPI('cirurgia/evolucao'),
    ]);

    if (espRes.ok && window.CirurgiaModule) {
      window.CirurgiaModule.renderCirurgiasEspacialidade('chartCirurgiasEspecialidade', espRes.data);
    }
    if (evoRes.ok && window.CirurgiaModule) {
      window.CirurgiaModule.renderCirurgiasEvolucao('chartCirurgiasEvolucao', evoRes.data);
    }
  } catch (err) {
    console.error('Erro ao inicializar Centro Cirurgico:', err);
  }
}

function setupGlobalFilters() {
  const regSelect = document.getElementById('filterRegional');
  const uniSelect = document.getElementById('filterUnidade');
  const periodSelect = document.getElementById('filterPeriod');

  regSelect?.addEventListener('change', (e) => {
    const reg = e.target.value;
    AppState.filters.regional = reg;
    AppState.filters.unidade = '';

    if (uniSelect) {
      uniSelect.innerHTML = '<option value="">Todas Unidades</option>';
      if (reg && AppState.unidadesPorRegional[reg]) {
        AppState.unidadesPorRegional[reg].forEach((u) => {
          const opt = document.createElement('option');
          const [id, label] = u.includes(' - ') ? u.split(' - ') : [u, u];
          opt.value = id;
          opt.textContent = label || u;
          uniSelect.appendChild(opt);
        });
      }
    }
    refreshCurrentSection();
  });

  uniSelect?.addEventListener('change', (e) => {
    AppState.filters.unidade = e.target.value;
    refreshCurrentSection();
  });

  periodSelect?.addEventListener('change', (e) => {
    AppState.filters.period = Number(e.target.value || 30);
    refreshCurrentSection();
  });
}

function refreshCurrentSection() {
  initializedSections.clear();
  initSectionIfNeeded(AppState.currentSection);
}

function setupNavControls() {
  document.getElementById('nav-overview')?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('overview'); });
  document.getElementById('nav-ps')?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('ps'); });
  document.getElementById('nav-cirurgias')?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('cirurgias'); });
  document.getElementById('nav-internacoes')?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('internacoes'); });
}

function startClock() {
  const el = document.getElementById('topbarDatetime');
  const update = () => {
    const now = new Date();
    if (el) el.textContent = now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ' -');
  };
  update();
  setInterval(update, 60000);
}

async function init() {
  if (window.Chart && !window.__valueLabelPluginRegistered) {
    Chart.register(valueLabelPlugin);
    window.__valueLabelPluginRegistered = true;
  }
  lucide.createIcons();
  startClock();
  setupGlobalFilters();
  setupNavControls();
  navigateTo('overview');
}

document.addEventListener('DOMContentLoaded', init);





