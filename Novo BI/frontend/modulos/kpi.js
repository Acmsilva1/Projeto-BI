/**
 * kpi.js  Cards de KPI e Gauge
 */

const KPI_CONFIG = {
  taxaOcupacao: {
    label: 'Taxa de Ocupacao',
    icon: 'bed',
    color: '#3b82f6',
    grad: 'var(--grad-blue)',
    format: (v) => `${v}%`,
  },
  tempoMedioInternacao: {
    label: 'Tempo Medio Internacao',
    icon: 'clock',
    color: '#8b5cf6',
    grad: 'var(--grad-purple)',
    format: (v) => `${v} dias`,
  },
  cirurgiasNoMes: {
    label: 'Cirurgias no Mes',
    icon: 'scissors',
    color: '#06b6d4',
    grad: 'var(--grad-cyan)',
    format: (v) => v.toString(),
  },
  taxaReadmissao: {
    label: 'Taxa de Readmissao',
    icon: 'alert-triangle',
    color: '#ef4444',
    grad: 'var(--grad-red)',
    format: (v) => `${v}%`,
  },
  satisfacaoPaciente: {
    label: 'Satisfacao do Paciente',
    icon: 'heart',
    color: '#22c55e',
    grad: 'var(--grad-green)',
    format: (v) => `${v}%`,
  },
  leitosDisponiveis: {
    label: 'Leitos Disponiveis',
    icon: 'minus-square',
    color: '#94a3b8',
    grad: 'linear-gradient(135deg, #334155, #94a3b8)',
    format: (v) => v.toString(),
  },
  pacientesAtivos: {
    label: 'Pacientes Ativos',
    icon: 'users',
    color: '#ec4899',
    grad: 'linear-gradient(135deg, #831843, #ec4899)',
    format: (v) => v.toString(),
  },
};

function renderKpiCards(data) {
  const grid = document.getElementById('kpiGrid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.entries(data).forEach(([key, kpi]) => {
    const cfg = KPI_CONFIG[key];
    if (!cfg) return;

    const valor = typeof kpi === 'object' ? kpi.valor : kpi;
    const meta = typeof kpi === 'object' ? kpi.meta : 100;
    const variacao = typeof kpi === 'object' ? kpi.variacao : 0;
    const unidade = typeof kpi === 'object' ? kpi.unidade : '';

    const pct = Math.min(100, Math.round((valor / meta) * 100));
    const isUp = variacao >= 0;
    const varSign = isUp ? '+' : '';
    const varColor = isUp ? 'text-emerald-500' : 'text-rose-500';
    const varBg = isUp ? 'bg-emerald-500/10' : 'bg-rose-500/10';
    const varIcon = isUp ? 'trending-up' : 'trending-down';

    const card = document.createElement('div');
    card.className = 'card-premium flex flex-col gap-4 group transition-all hover:-translate-y-1';

    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg shadow-slate-200/50 dark:shadow-none" 
             style="background: ${cfg.color}15; color: ${cfg.color}">
          <i data-lucide="${cfg.icon}" class="w-6 h-6"></i>
        </div>
        <div class="flex items-center gap-1.5 px-2 py-1 rounded-full ${varBg} ${varColor} text-[10px] font-bold">
          <i data-lucide="${varIcon}" class="w-3 h-3"></i>
          ${varSign}${variacao}${unidade === '%' ? '%' : ''}
        </div>
      </div>
      
      <div>
        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">${cfg.label}</p>
        <h4 class="text-2xl font-bold text-slate-900 dark:text-white mb-3">
          ${cfg.format(valor)}
        </h4>
        
        <!-- Barra de Progresso Tailwind -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-[10px] font-semibold">
            <span class="text-slate-500">${pct}% da meta</span>
            <span class="text-slate-400">Meta: ${cfg.format(meta)}</span>
          </div>
          <div class="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full transition-all duration-1000 ease-out rounded-full" 
                 style="width: 0%; background: ${cfg.color}"></div>
          </div>
        </div>
      </div>
    `;

    grid.appendChild(card);

    // Animacao da barra de progresso
    requestAnimationFrame(() => {
      setTimeout(() => {
        const fill = card.querySelector('div[style*="width: 0%"]');
        if (fill) fill.style.width = `${pct}%`;
      }, 100);
    });
  });

  if (window.lucide) lucide.createIcons();
}

// --- Gauge (Semi-circulo) ------------------------------------------
function drawGauge(canvasId, percentual, cor) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h - 10;
  const r = Math.min(w, h * 2) * 0.42;

  ctx.clearRect(0, 0, w, h);

  // Fundo
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#1f2a3d';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Valor
  const angle = Math.PI + (percentual / 100) * Math.PI;
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  grad.addColorStop(0, cor + 'aa');
  grad.addColorStop(1, cor);

  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, angle);
  ctx.lineWidth = 14;
  ctx.strokeStyle = grad;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Glow
  ctx.shadowBlur = 10;
  ctx.shadowColor = cor;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function initGauges(setores) {
  const gaugeMap = {
    'UTI Adulto': { id: 'gaugeUtiAdulto', cor: '#ef4444' },
    'UTI Neonatal': { id: 'gaugeUtiNeo', cor: '#f97316' },
    'Clinica Medica': { id: 'gaugeClinica', cor: '#3b82f6' },
    'Cirurgico': { id: 'gaugeCirurgico', cor: '#8b5cf6' },
    'Maternidade': { id: 'gaugeMaternidade', cor: '#ec4899' },
  };

  setores.forEach(setor => {
    const cfg = gaugeMap[setor.nome];
    if (!cfg) return;
    drawGauge(cfg.id, setor.percentual, cfg.cor);

    const valEl = document.getElementById(`${cfg.id}Val`);
    if (valEl) {
      valEl.textContent = `${setor.percentual}%`;
      valEl.style.color = setor.percentual >= 90 ? '#ef4444' : setor.percentual >= 80 ? '#f59e0b' : '#22c55e';
    }
  });
}

window.KPIModule = { renderKpiCards, initGauges, drawGauge };





