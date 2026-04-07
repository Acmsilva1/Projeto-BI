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
      this.loadHistory(),
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
        this.loadHistory(),
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
      setVal('ps-vol-medicados', window.API.formatNumber(data.pacsMedicados, 0));
      setVal('ps-vol-med-pac', data.medicacoesPorPaciente);
      setVal('ps-vol-exame-lab', window.API.formatNumber(data.pacsExamesLab, 0));
      setVal('ps-vol-lab-pac', data.labPorPaciente);
      setVal('ps-vol-exame-tc', window.API.formatNumber(data.pacsTcs, 0));
      setVal('ps-vol-tc-pac', data.tcsPorPaciente);
      setVal('ps-vol-desfecho', data.desfechoMedico);

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
        
        const taxaSucesso = Math.max(0, 100 - item.percent);
        const taxaSucessoStr = taxaSucesso.toFixed(1);
        
        let barColor = 'bg-emerald-500';
        if (taxaSucesso < 85) barColor = 'bg-rose-500';
        else if (taxaSucesso < 95) barColor = 'bg-amber-500';

        const taxaHistorica = Math.max(0, 100 - (item.mu || 0));
        const delta = (taxaSucesso - taxaHistorica).toFixed(1);
        const isPositivo = delta >= 0;
        const deltaStr = isPositivo ? `+${delta}%` : `${delta}%`;
        const deltaColorClass = isPositivo ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500';
        
        const fmt = (num) => new Intl.NumberFormat('pt-BR').format(num || 0);
        const atendidosNaMeta = item.total - item.acima;

        card.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${cfg.label}</span>
            <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-bold text-slate-500">Meta: ${cfg.meta}</span>
          </div>
          
          <div class="mt-3 flex items-start justify-between">
            <div class="flex flex-col">
              <span class="text-3xl font-black text-slate-900 dark:text-white leading-none">${taxaSucessoStr}%</span>
              <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Dentro do Prazo</span>
            </div>
            <div class="flex flex-col items-end gap-1">
              <div class="px-2 py-0.5 rounded ${deltaColorClass}">
                <span class="text-[10px] font-bold">${deltaStr}</span>
              </div>
              <span class="text-[8px] text-amber-500 dark:text-amber-400 font-bold uppercase tracking-wider">vs Últimos 30d</span>
            </div>
          </div>

          <div class="mt-2 flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2">
            <span>Na Meta: <strong class="text-slate-700 dark:text-slate-300 font-mono">${fmt(atendidosNaMeta)}</strong></span>
            <span>Total: <span class="font-mono">${fmt(item.total)}</span></span>
          </div>

          <div class="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div class="h-full transition-all duration-1000 ${barColor}" style="width: ${taxaSucessoStr}%"></div>
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

  getColorForSla(zScore) {
    // Usando Z-Score estatistico em vez de porcentagem:
    // z <= 1 (verde), 1 < z <= 2 (amarelo), z > 2 (vermelho)
    const z = Number(zScore || 0);
    if (z > 2) return '#ef4444'; // Rose-500
    if (z > 1) return '#f59e0b';  // Amber-500
    return '#10b981'; // Emerald-500
  },
  
  async loadHistory() {
    try {
      const { data } = await window.API.fetchAPI('ps/history', this.getMetaParams());
      const container = document.getElementById('psHistoryTableContainer');
      if (!container) return;
      
      const thead = document.getElementById('historyMonthsHeader');
      if (thead) {
        thead.innerHTML = `
          <th class="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">Total</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800" colspan="2">${data.months[0]}</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800" colspan="2">${data.months[1]}</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800" colspan="2">${data.months[2]}</th>
          <th class="px-3 py-2 text-center font-semibold text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800 border-l" colspan="4">Total</th>
        `;
      }
      
      const tbody = document.getElementById('psHistoryTableBody');
      if (tbody) {
        tbody.innerHTML = '';
        
        const fmtVal = (val, isP) => (isP ? val.toFixed(2) + '%' : val.toFixed(2)).replace('.', ',');
        const fmtDelta = (d, isP) => {
           if(d === 0) return (isP ? '0,00%' : '0,00');
           const s = d > 0 ? '+' : '';
           return s + (isP ? d.toFixed(2) + '%' : d.toFixed(2)).replace('.', ',');
        };
        const getBg = (v, isRev, isP) => {
           const good = isRev ? v < (isP?15:3) : v > (isP?80:5);
           const bad = isRev ? v > (isP?30:4) : v < (isP?50:2);
           if(good) return 'bg-[#dcfce7] dark:bg-emerald-900/30 text-[#166534] dark:text-emerald-300';
           if(bad) return 'bg-[#ffedd5] dark:bg-orange-900/30 text-[#9a3412] dark:text-orange-300';
           return '';
        };

        const renderCell = (obj, row, isTotal = false) => {
           const bg = getBg(obj.v, row.isReverso, row.isP);
           const valStr = fmtVal(obj.v, row.isP);
           
           if(isTotal) {
              const deltaFromPrev = obj.v - row.m3.v; // vs last month
              return `
                <td class="px-2 py-1 text-right border-l border-slate-200 dark:border-slate-800">
                  <span class="font-bold px-1 py-0.5 rounded ${bg}">${valStr}</span>
                </td>
                <td class="px-1 py-1 text-left text-[10px] text-rose-600 dark:text-rose-400 font-medium">(${fmtVal(row.m2.v, row.isP)})</td>
                <td class="px-1 py-1 text-left text-[10px] text-slate-500">${fmtDelta(deltaFromPrev, row.isP)}</td>
                <td class="px-1 py-1 text-left text-[9px] text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">YTD ${fmtDelta(obj.ytd||0, row.isP)}</td>
              `;
           }
           
           return `
             <td class="px-2 py-1 text-right">
               <span class="inline-block font-medium px-1 py-0.5 rounded w-12 text-right ${bg}">${valStr}</span>
             </td>
             <td class="px-2 py-1 text-left text-[10px] text-slate-500 w-12 border-r border-slate-50 dark:border-slate-800/50">${fmtDelta(obj.d, row.isP)}</td>
           `;
        };

        data.data.forEach((row, idx) => {
          const rowId = 'row-' + idx;
          const tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-800 text-[11px] font-mono whitespace-nowrap cursor-pointer group";
          
          tr.innerHTML = `
            <td class="px-3 py-1 font-sans font-bold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800 truncate max-w-[150px] select-none" title="${row.name}">
               <button class="text-slate-400 mr-1 group-hover:text-amber-500 transition-colors pointer-events-none">
                  <i data-lucide="plus-square" class="w-3 h-3 inline"></i>
               </button>
               ${row.name}
            </td>
            ${renderCell(row.m1, row)}
            ${renderCell(row.m2, row)}
            ${renderCell(row.m3, row)}
            ${renderCell(row.t, row, true)}
          `;
          tbody.appendChild(tr);

          const subRows = [];
          if (row.subItems) {
            row.subItems.forEach(sub => {
               // Propagar propriedades de renderização
               sub.isReverso = row.isReverso;
               sub.isP = row.isP;

               const subTr = document.createElement('tr');
               subTr.className = `hidden hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 text-[11px] font-mono whitespace-nowrap bg-slate-50 dark:bg-slate-900/50`;
               subTr.innerHTML = `
                 <td class="px-3 py-1 pl-8 font-sans text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 truncate max-w-[150px]" title="${sub.name}">
                    ${sub.name}
                 </td>
                 ${renderCell(sub.m1, sub)}
                 ${renderCell(sub.m2, sub)}
                 ${renderCell(sub.m3, sub)}
                 ${renderCell(sub.t, sub, true)}
               `;
               tbody.appendChild(subTr);
               subRows.push(subTr);
            });
          }

          let isOpen = false;
          tr.addEventListener('click', () => {
             isOpen = !isOpen;
             const btn = tr.querySelector('button');
             if(isOpen) {
                 btn.innerHTML = '<i data-lucide="minus-square" class="w-3 h-3 inline text-amber-500"></i>';
                 subRows.forEach(sr => sr.classList.remove('hidden'));
             } else {
                 btn.innerHTML = '<i data-lucide="plus-square" class="w-3 h-3 inline"></i>';
                 subRows.forEach(sr => sr.classList.add('hidden'));
             }
             if(window.lucide) window.lucide.createIcons();
          });
        });
        
        if(window.lucide) window.lucide.createIcons();
      }
    } catch (err) {
      console.error('Erro ao carregar Historico de 3 Meses:', err);
    }
  }
};

window.PS = PS;





