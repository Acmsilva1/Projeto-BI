'use strict';

/**
 * ps.js  Modulo do Pronto Socorro (MedSenior Edition)
 * ------------------------------------------------------------------
 * Gerencia a regua de volumes, cards de SLA (7 categorias) e a matriz.
 * ------------------------------------------------------------------
 */

const PS = {
  _listenersBound: false,
  _refreshTimer: null,

  async init() {
    console.log('Iniciando modulo PS (MedSenior)...');
    this.setupListeners();
    await Promise.all([
      this.loadVolumes(),
      this.loadKpis(),
      this.loadSlas(),
      this.loadMatrix(),
    ]);
  },

  setupListeners() {
    if (this._listenersBound) return;
    this._listenersBound = true;

    // Configura os sliders de meta se existirem
    ['triagem', 'consulta', 'medicacao', 'permanencia'].forEach(key => {
      const el = document.getElementById(`range-${key}`);
      if (el) {
        el.addEventListener('input', (e) => {
          const val = e.target.value;
          const display = document.getElementById(`val-${key}`);
          if (display) {
            display.textContent = (key === 'permanencia') ? `${Math.floor(val/60)}h` : `${val}m`;
          }
          this.refreshData();
        });
      }
    });
  },

  async refreshData() {
    clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(async () => {
      await Promise.all([
        this.loadVolumes(),
        this.loadKpis(),
        this.loadSlas(),
        this.loadMatrix(),
      ]);
    }, 180);
  },

  getMetaParams() {
    const val = (id, fallback) => {
      const el = document.getElementById(id);
      return Number(el?.value || fallback);
    };

    return {
      meta_triagem: val('range-triagem', 12),
      meta_consulta: val('range-consulta', 90),
      meta_medicacao: val('range-medicacao', 30),
      meta_permanencia: val('range-permanencia', 180),
    };
  },

  async loadVolumes() {
    try {
      const response = await window.API.fetchAPI('ps/volumes', this.getMetaParams());
      if (!response || !response.data) {
        console.warn('Volumes PS retornou dados vazios');
        return;
      }
      const data = response.data;
      
      const setVal = (id, val, suffix = '') => {
        const el = document.getElementById(id);
        if (el) el.textContent = (val !== undefined && val !== null) ? (val + suffix) : '--';
      };

      setVal('ps-vol-atend', window.API.formatNumber(data.atendimentos, 0));
      setVal('ps-vol-evasao', window.API.formatNumber(data.evasoes, 0));
      setVal('ps-vol-conversao', data.conversaoInternacao, '%');
      setVal('ps-vol-presc', window.API.formatNumber(data.prescricoes, 0));

    } catch (err) {
      console.error('Erro ao carregar volumes PS:', err);
    }
  },

  async loadSlas() {
    try {
      // Metas do catalogo como padrao (fallback)
      const metaParams = this.getMetaParams();
      const { data } = await window.API.fetchAPI('ps/slas', metaParams);
      const container = document.getElementById('psSlaGrid');
      if (!container) return;
      
      container.innerHTML = '';

      const configs = [
        { key: 'triagem', label: 'Triagem', meta: `${metaParams.meta_triagem}m` },
        { key: 'consulta', label: 'Consulta', meta: `${metaParams.meta_consulta}m` },
        { key: 'medicacao', label: 'Medicacao', meta: `${metaParams.meta_medicacao}m` },
        { key: 'reavaliacao', label: 'Reavaliacao', meta: '45m' }, // Novo Catlogo
        { key: 'rx_ecg', label: 'RX / ECG', meta: '45m' },       // Novo Catlogo
        { key: 'tc_us', label: 'TC / US', meta: '60m' },        // Novo Catlogo
        { key: 'permanencia', label: 'Permanencia', meta: `${Math.floor(metaParams.meta_permanencia / 60)}h` }
      ];

      configs.forEach(cfg => {
        const item = data[cfg.key] || { percent: 0, total: 0, acima: 0 };
        const card = document.createElement('div');
        card.className = 'card-premium flex flex-col gap-3 relative overflow-hidden group hover:border-hospital-500/50 transition-all cursor-default';
        
        const statusColor = this.getColorForSla(item.percent);
        const isNaMeta = Number(item.acima || 0) === 0 || Number(item.percent || 0) === 0;
        const statusText = isNaMeta ? 'NA META' : 'FORA DA META';
        const statusTextClass = isNaMeta ? 'text-emerald-400' : 'text-rose-400';

        card.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${cfg.label}</span>
            <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-bold text-slate-500">Meta: ${cfg.meta}</span>
          </div>
          
          <div class="flex items-end justify-between">
            <div>
              <span class="text-3xl font-black text-slate-900 dark:text-white leading-none">${item.percent}%</span>
              <span class="text-[10px] font-bold ${statusTextClass} ml-1">${statusText}</span>
            </div>
            <div class="text-right">
              <p class="text-[10px] text-slate-400 leading-tight">Fora: <strong>${item.acima}</strong></p>
              <p class="text-[10px] text-slate-400 leading-tight">Total: ${item.total}</p>
            </div>
          </div>

          <div class="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
            <div class="h-full transition-all duration-1000" style="width: ${item.percent}%; background-color: ${statusColor}"></div>
          </div>
        `;
        container.appendChild(card);
      });
    } catch (err) {
      console.error('Erro ao carregar SLAs PS:', err);
    }
  },

  async loadKpis() {
    try {
      const { data } = await window.API.fetchAPI('ps/kpis', this.getMetaParams());
      const setVal = (id, value, suffix = '') => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${value ?? '--'}${suffix}`;
      };

      setVal('ps-kpi-permanencia', window.API.formatNumber(data.tempoPermanenciaMin || 0, 1), ' min');
      setVal('ps-kpi-consulta', window.API.formatNumber(data.tempoConsultaMin || 0, 1), ' min');
      setVal('ps-kpi-exames', window.API.formatNumber(data.examesTotal || 0, 0));
      setVal('ps-kpi-medicacao', window.API.formatNumber(data.medicacaoTotal || 0, 0));
      setVal('ps-kpi-altas', window.API.formatNumber(data.altas || 0, 0));
      setVal('ps-kpi-obitos', window.API.formatNumber(data.obitos || 0, 0));
      setVal('ps-vol-conversao', data.conversaoInternacao || 0, '%');
    } catch (err) {
      console.error('Erro ao carregar KPIs PS:', err);
    }
  },

  async loadMatrix() {
    try {
      const { data } = await window.API.fetchAPI('ps/matrix', this.getMetaParams());
      const body = document.getElementById('matrixUnidadesBody');
      if (!body) return;
      
      body.innerHTML = '';

      data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors";
        
        tr.innerHTML = `
          <td class="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">${row.unidade}</td>
          ${this.formatMatrixCell(row.triagemPercent)}
          ${this.formatMatrixCell(row.consultaPercent)}
          ${this.formatMatrixCell(row.medicacaoPercent)}
          ${this.formatMatrixCell(row.imagemPercent)}
          ${this.formatMatrixCell(row.altaPercent)}
        `;
        body.appendChild(tr);
      });
    } catch (err) {
      console.error('Erro ao carregar matriz PS:', err);
    }
  },

  formatMatrixCell(val) {
    let colorClass = 'text-emerald-500';
    if (val > 15) colorClass = 'text-rose-500';
    else if (val > 8) colorClass = 'text-amber-500';

    return `<td class="px-6 py-4 font-bold ${colorClass}">${val}%</td>`;
  },

  getColorForSla(percent) {
    if (percent > 15) return '#ef4444'; // Rose-500
    if (percent > 8) return '#f59e0b';  // Amber-500
    return '#10b981'; // Emerald-500
  }
};

window.PS = PS;





