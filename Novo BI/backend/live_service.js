/**
 * live_service.js — Camada de API (fina).
 *
 * Arquitetura desejada:
 *   PostgreSQL (views/ETL prontos) → fetchView() → mapeamento leve linha→JSON → { ok, data }.
 *
 * Não fazer aqui: agregações pesadas, joins simulados em JS, laços sobre fatos
 * brutos grandes — isso aumenta delay. O “pesado” fica no Postgres; scripts
 * de referência vivem em ../postgres/sql/ (ver ../postgres/ORIENTACAO.txt).
 *
 * Hoje: respostas vazias/zeradas até religar require('./db') + fetchView por método.
 */

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

const emptyKpiField = () => ({
  valor: 0,
  unidade: '',
  variacao: 0,
  tendencia: 'estavel',
  meta: 0,
});

const emptySla = () => ({
  total: 0,
  acima: 0,
  percent: 0,
  meta: 0,
  mu: 0,
  sigma: 0,
  zScore: 0,
});

const slaKeys = ['triagem', 'consulta', 'medicacao', 'reavaliacao', 'rx_ecg', 'tc_us', 'permanencia'];

/** Indicadores da matriz “Metas por volumes” (alinhado ao modelo Power BI). */
const METAS_POR_VOLUMES_INDICADORES = [
  { key: 'conversao', name: 'Conversão', isReverso: true, isP: true },
  { key: 'pacs_medicados', name: 'Pacs medicados', isReverso: true, isP: true },
  { key: 'medicacoes_por_paciente', name: 'Medicações por paciente', isReverso: true, isP: false },
  { key: 'pacs_exames_lab', name: 'Pacs c/ exames laboratoriais', isReverso: true, isP: true },
  { key: 'lab_por_paciente', name: 'Laboratório por paciente', isReverso: true, isP: false },
  { key: 'pacs_exames_tc', name: 'Pacs c/ exames de TC', isReverso: true, isP: true },
  { key: 'tcs_por_paciente', name: 'TCs por paciente', isReverso: true, isP: false },
  { key: 'triagem_acima_meta', name: 'Triagem acima da meta', isReverso: true, isP: true },
  { key: 'consulta_acima_meta', name: 'Consulta acima da meta', isReverso: true, isP: true },
  { key: 'medicacao_acima_meta', name: 'Medicação acima da meta', isReverso: true, isP: true },
  { key: 'reavaliacao_acima_meta', name: 'Reavaliação acima da meta', isReverso: true, isP: true },
  { key: 'permanencia_acima_meta', name: 'Permanência acima da meta', isReverso: true, isP: true },
  { key: 'desfecho_medico', name: 'Desfecho do médico do atend.', isReverso: false, isP: true },
];

function emptyMetasMonthCells() {
  const z = () => ({ v: 0, d: 0 });
  return {
    m1: z(),
    m2: z(),
    m3: z(),
    t: { v: 0, ytd: 0, sec: '(0)' },
  };
}

function defaultRollingMonths() {
  const months = [];
  const mesKeys = [];
  for (let i = 2; i >= 0; i -= 1) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    mesKeys.push(`${y}-${m}`);
    months.push(
      d
        .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
        .replace(/\./g, '')
        .replace(/^\w/, (c) => c.toUpperCase()),
    );
  }
  return { months, mesKeys };
}

/**
 * Unidades com PS — cadastro oficial (código + nome + UF).
 * Rótulo exibido: {codigo} - {unidadeNome}_{regional}. Substituir por fetchView no Postgres.
 */
const DEMO_UNIDADES_PS = [
  { codigo: '001', unidadeId: '001', unidadeNome: 'PS HOSPITAL VITÓRIA', regional: 'ES' },
  { codigo: '003', unidadeId: '003', unidadeNome: 'PS VILA VELHA', regional: 'ES' },
  { codigo: '013', unidadeId: '013', unidadeNome: 'PS SIG', regional: 'DF' },
  { codigo: '025', unidadeId: '025', unidadeNome: 'PS BARRA DA TIJUCA', regional: 'RJ' },
  { codigo: '026', unidadeId: '026', unidadeNome: 'PS BOTAFOGO', regional: 'RJ' },
  { codigo: '031', unidadeId: '031', unidadeNome: 'PS GUTIERREZ', regional: 'MG' },
  { codigo: '033', unidadeId: '033', unidadeNome: 'PS PAMPULHA', regional: 'MG' },
  { codigo: '039', unidadeId: '039', unidadeNome: 'PS TAGUATINGA', regional: 'DF' },
  { codigo: '045', unidadeId: '045', unidadeNome: 'PS CAMPO GRANDE', regional: 'RJ' },
];

function labelUnidadePs(u) {
  const nome = String(u.unidadeNome || '').trim();
  const reg = String(u.regional || '').trim();
  const cod = u.codigo != null && u.codigo !== '' ? String(u.codigo).padStart(3, '0') : '';
  if (cod && nome && reg) return `${cod} - ${nome}_${reg}`;
  if (reg && nome) return `${reg} - ${nome}`;
  return nome || reg || String(u.unidadeId || '');
}

function sortUnidadesPorCodigo(list) {
  return [...list].sort((a, b) => {
    const ca = String(a.codigo ?? a.unidadeId ?? '');
    const cb = String(b.codigo ?? b.unidadeId ?? '');
    const na = parseInt(ca, 10);
    const nb = parseInt(cb, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    return ca.localeCompare(cb, 'pt-BR', { numeric: true });
  });
}

/** Lista para filtro do cabeçalho: respeita regional; não filtra por unidade (o select precisa de todas da regional). */
function listUnidadesPsParaFiltro(query = {}) {
  let list = [...DEMO_UNIDADES_PS];
  if (query.regional) list = list.filter((u) => u.regional === query.regional);
  return sortUnidadesPorCodigo(list);
}

/** Unidades no contexto da matriz (regional + opcionalmente uma unidade só). */
function filterUnidadesPsMatriz(query = {}) {
  let list = [...DEMO_UNIDADES_PS];
  if (query.regional) list = list.filter((u) => u.regional === query.regional);
  if (query.unidade) list = list.filter((u) => u.unidadeId === query.unidade);
  return sortUnidadesPorCodigo(list);
}

function subItemsMetasPorVolumesFromUnidades(units) {
  return units.map((u) => ({
    unidadeId: u.unidadeId,
    name: labelUnidadePs(u),
    ...emptyMetasMonthCells(),
  }));
}

function metasPorVolumesMatrixForQuery(query = {}) {
  const { months, mesKeys } = defaultRollingMonths();
  const units = filterUnidadesPsMatriz(query);
  const subTemplate = subItemsMetasPorVolumesFromUnidades(units);
  const data = METAS_POR_VOLUMES_INDICADORES.map((ind) => ({
    key: ind.key,
    name: ind.name,
    isReverso: ind.isReverso,
    isP: ind.isP,
    ...emptyMetasMonthCells(),
    subItems: subTemplate.map((s) => ({ ...s })),
  }));
  return {
    months,
    mesKeys,
    data,
    meta: {
      schemaVersion: 1,
      titulo: 'Metas por volumes',
      filtroUnidades: 'apenas_unidades_com_ps',
      unidadesNoContexto: units.length,
    },
  };
}

/**
 * Colunas da grade “indicadores por unidade” (PS) — alinhado ao painel do BI.
 * kind: int | pct | decimal | text
 *
 * pctSense (só kind pct): como interpretar % para verde/vermelho na UI.
 * - high_good: quanto maior, melhor → verde se valor >= pctGreenAt; vermelho se valor <= pctRedAt
 * - low_good: quanto menor, melhor → verde se valor <= pctGreenAt; vermelho se valor >= pctRedAt
 * Sem pctSense / sem limiares: só negrito neutro (evita generalizar 80/40).
 * Limiares são metas de referência até a view/Postgres devolver valores oficiais por período.
 */
const METRICAS_POR_UNIDADE_COLUNAS = [
  { key: 'atendimentos', label: 'Atendimentos', kind: 'int' },
  { key: 'altas', label: 'Altas', kind: 'int' },
  { key: 'obitos', label: 'Óbitos', kind: 'int' },
  { key: 'pct_evasao', label: '% Evasão', kind: 'pct', pctSense: 'low_good', pctGreenAt: 8, pctRedAt: 22 },
  { key: 'desfecho', label: 'Desfecho', kind: 'text' },
  {
    key: 'pct_desfecho_medico',
    label: '% desfecho do médico do atend.',
    kind: 'pct',
    pctSense: 'high_good',
    pctGreenAt: 82,
    pctRedAt: 58,
  },
  { key: 'saidas', label: 'Saídas', kind: 'int' },
  { key: 'internacoes', label: 'Internações', kind: 'int' },
  { key: 'pct_conversao', label: '% Conversão', kind: 'pct', pctSense: 'high_good', pctGreenAt: 12, pctRedAt: 4 },
  { key: 'pct_reavaliacao', label: '% Reavaliação', kind: 'pct', pctSense: 'high_good', pctGreenAt: 22, pctRedAt: 8 },
  {
    key: 'pct_pacientes_medicados',
    label: '% pacientes medicados',
    kind: 'pct',
    pctSense: 'high_good',
    pctGreenAt: 88,
    pctRedAt: 68,
  },
  { key: 'media_medicacoes_por_pac', label: 'Média medicações por pac', kind: 'decimal' },
  {
    key: 'pct_medicacoes_rapidas',
    label: '% medicações rápidas',
    kind: 'pct',
    pctSense: 'high_good',
    pctGreenAt: 72,
    pctRedAt: 42,
  },
  { key: 'pct_pacientes_lab', label: '% pacientes com laboratório', kind: 'pct', pctSense: 'high_good', pctGreenAt: 55, pctRedAt: 28 },
  { key: 'media_lab_por_pac', label: 'Média laborat./pac', kind: 'decimal' },
  { key: 'pct_pacientes_rx', label: '% pacientes com RX', kind: 'pct', pctSense: 'high_good', pctGreenAt: 48, pctRedAt: 22 },
  { key: 'pct_pacientes_ecg', label: '% pacientes com ECG', kind: 'pct', pctSense: 'high_good', pctGreenAt: 32, pctRedAt: 14 },
  { key: 'pct_pacientes_tc', label: '% pacientes com TC', kind: 'pct', pctSense: 'high_good', pctGreenAt: 22, pctRedAt: 8 },
  { key: 'media_tcs_por_pac', label: 'Média TCs/pac', kind: 'decimal' },
  { key: 'pct_pacientes_us', label: '% pacientes com US', kind: 'pct', pctSense: 'high_good', pctGreenAt: 28, pctRedAt: 10 },
];

function emptyMetricasPorUnidadeValores() {
  const valores = {};
  METRICAS_POR_UNIDADE_COLUNAS.forEach((c) => {
    valores[c.key] = c.kind === 'text' ? '' : 0;
  });
  return valores;
}

function metricasPorUnidadeForQuery(query = {}) {
  const units = filterUnidadesPsMatriz(query);
  return {
    colunas: METRICAS_POR_UNIDADE_COLUNAS,
    linhas: units.map((u) => ({
      unidadeId: u.unidadeId,
      label: labelUnidadePs(u),
      valores: { ...emptyMetricasPorUnidadeValores() },
    })),
    meta: {
      schemaVersion: 1,
      titulo: 'Indicadores por unidade (PS)',
      filtroUnidades: 'regional_unidade_gerencia',
    },
  };
}

/**
 * Faixa de totais consolidados (mesmas dimensões da grade por unidade, valores absolutos).
 * Query: ?period=&regional=&unidade= — hoje zerado; view Postgres agregará.
 */
const GERENCIA_TOTAIS_PS_DEF = [
  { key: 'atendimentos', label: 'Atendimentos' },
  { key: 'altas', label: 'Altas' },
  { key: 'obitos', label: 'Óbitos' },
  { key: 'evasoes', label: 'Evasões' },
  { key: 'desfecho', label: 'Desfecho' },
  { key: 'desfecho_medico', label: 'Desfecho médico do atend.' },
  { key: 'saidas', label: 'Saídas' },
  { key: 'internacoes', label: 'Internações' },
  { key: 'conversoes', label: 'Conversões' },
  { key: 'reavaliacoes', label: 'Reavaliações' },
  { key: 'pacientes_medicados', label: 'Pacientes medicados' },
  { key: 'medicacoes', label: 'Medicações' },
  { key: 'medicacoes_rapidas', label: 'Medicações rápidas' },
  { key: 'pacientes_lab', label: 'Pacientes c/ laboratório' },
  { key: 'exames_lab', label: 'Exames laboratório' },
  { key: 'pacientes_rx', label: 'Pacientes c/ RX' },
  { key: 'pacientes_ecg', label: 'Pacientes c/ ECG' },
  { key: 'pacientes_tc', label: 'Pacientes c/ TC' },
  { key: 'tcs', label: 'TCs' },
  { key: 'pacientes_us', label: 'Pacientes c/ US' },
];

function emptyGerenciaTotaisPs() {
  const valores = {};
  GERENCIA_TOTAIS_PS_DEF.forEach((d) => {
    valores[d.key] = 0;
  });
  return valores;
}

function gerenciaTotaisPsForQuery(query = {}) {
  void query;
  const valores = emptyGerenciaTotaisPs();
  return {
    cards: GERENCIA_TOTAIS_PS_DEF.map(({ key, label }) => ({
      key,
      label,
      value: valores[key],
      format: 'int',
    })),
    meta: {
      schemaVersion: 1,
      titulo: 'Totais PS (filtro atual)',
    },
  };
}

/**
 * Jornada: tempo médio por etapa (min) — colunas alinhadas ao BI.
 * columnBg: cor do destaque só quando valor > slaMaxMinutos (fora da meta). Na meta = visual neutro.
 * slaMaxMinutos: null até view/Postgres ou configuração definirem o SLA (min). Com null, não há destaque.
 */
const TEMPO_MEDIO_ETAPAS_COLS = [
  { key: 'totem_triagem', label: 'Totem → Triagem', icons: ['Ticket', 'Megaphone'], columnBg: null, slaMaxMinutos: null },
  { key: 'totem_consulta', label: 'Totem → Consulta', icons: ['Ticket', 'Stethoscope'], columnBg: null, slaMaxMinutos: null },
  { key: 'presc_medicacao', label: 'Prescrição → Medicação', icons: ['ClipboardList', 'Pill'], columnBg: null, slaMaxMinutos: null },
  {
    key: 'presc_rx_ecg',
    label: 'Prescrição → Revisão (Execução)',
    icons: ['ClipboardList', 'ScanLine'],
    columnBg: null,
    slaMaxMinutos: null,
  },
  {
    key: 'presc_tc_us',
    label: 'Prescrição → TC/US (Laudo)',
    icons: ['ClipboardList', 'Scan'],
    columnBg: 'blue',
    slaMaxMinutos: null,
  },
  {
    key: 'pedido_reavaliacao',
    label: 'Pedido → Reavaliação',
    icons: ['PencilLine', 'RefreshCw'],
    columnBg: 'green',
    slaMaxMinutos: null,
  },
  { key: 'permanencia_total', label: 'Permanência total', icons: ['Building2', 'Clock'], columnBg: null, slaMaxMinutos: null },
];

function valoresTempoMedioZerados() {
  const o = {};
  TEMPO_MEDIO_ETAPAS_COLS.forEach((c) => {
    o[c.key] = 0;
  });
  return o;
}

function tempoMedioEtapasForQuery(query = {}) {
  void query.filtro;
  const units = filterUnidadesPsMatriz(query);
  const z = valoresTempoMedioZerados();
  const linhas = units.map((u) => ({
    unidadeId: u.unidadeId,
    unidadeLabel: labelUnidadePs(u),
    valores: { ...z },
  }));
  const totais = { ...z };

  return {
    titulo: 'Tempo médio por etapa (min)',
    etapas: TEMPO_MEDIO_ETAPAS_COLS,
    filtroUnidadeOpcoes: [{ value: '', label: 'Todas' }],
    linhas,
    totais,
    meta: { schemaVersion: 1 },
  };
}

/** Labels fixos abr/25 … mar/26 (alinhado ao painel de referência). */
const METAS_ACOMP_MES_LABELS = (() => {
  const short = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const out = [];
  let y = 2025;
  let m = 4;
  for (let i = 0; i < 12; i += 1) {
    out.push(`${short[m - 1]}/${String(y % 100).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
})();

/** Cor estável por índice da unidade (legenda = mesma cor da linha). */
const METAS_ACOMP_CORES_UNIDADE = [
  '#92400e',
  '#2563eb',
  '#ea580c',
  '#15803d',
  '#7c3aed',
  '#db2777',
  '#0e7490',
  '#a16207',
  '#475569',
  '#b45309',
];

/**
 * Meta de referência por métrica (faixa de ribbon / gauge até a view Postgres preencher valores).
 * sense: derivado de isReverso — low_good = quanto menor melhor; high_good = quanto maior melhor.
 */
const METAS_ACOMP_POR_KEY = {
  conversao: { meta: 6 },
  pacs_medicados: { meta: 12 },
  medicacoes_por_paciente: { meta: 2.4 },
  pacs_exames_lab: { meta: 18 },
  lab_por_paciente: { meta: 1.8 },
  pacs_exames_tc: { meta: 14 },
  tcs_por_paciente: { meta: 1.2 },
  triagem_acima_meta: { meta: 10 },
  consulta_acima_meta: { meta: 12 },
  medicacao_acima_meta: { meta: 11 },
  reavaliacao_acima_meta: { meta: 9 },
  permanencia_acima_meta: { meta: 15 },
  desfecho_medico: { meta: 82 },
};

function fmtMetaBr(n) {
  return Number(n).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function metasAcompanhamentoGestaoForQuery(query = {}) {
  const rawKey = query.metric != null ? String(query.metric) : 'conversao';
  const found = METAS_POR_VOLUMES_INDICADORES.find((x) => x.key === rawKey);
  const indResolved = found || METAS_POR_VOLUMES_INDICADORES[0];
  const metricKey = indResolved.key;
  const cfg = METAS_ACOMP_POR_KEY[metricKey] || { meta: 0 };
  const sense = indResolved.isReverso ? 'low_good' : 'high_good';
  const { meta } = cfg;
  const ribbonCmp = sense === 'low_good' ? '<' : '>';
  const ribbonText = `META ${fmtMetaBr(meta)} ${ribbonCmp} melhor`;

  const units = filterUnidadesPsMatriz(query);
  const nMeses = METAS_ACOMP_MES_LABELS.length;
  const zeros = () => Array(nMeses).fill(0);

  const series = units.map((u, idx) => ({
    unidadeId: u.unidadeId,
    name: labelUnidadePs(u),
    color: METAS_ACOMP_CORES_UNIDADE[idx % METAS_ACOMP_CORES_UNIDADE.length],
    data: zeros(),
  }));

  const globalVal = 0;

  const gaugeMax = indResolved.isP ? 100 : Math.max(10, Number(meta) * 1.5 || 10);

  return {
    titulo: 'Metas de acompanhamento da gestão',
    catalog: METAS_POR_VOLUMES_INDICADORES.map((x) => ({
      key: x.key,
      label: x.name,
      isP: x.isP,
      isReverso: x.isReverso,
    })),
    selectedKey: metricKey,
    gauge: {
      title: `${indResolved.name} global no período`,
      value: globalVal,
      min: 0,
      max: gaugeMax,
      isPercent: indResolved.isP,
      sense,
    },
    metaRibbon: {
      target: meta,
      sense,
      text: ribbonText,
    },
    months: [...METAS_ACOMP_MES_LABELS],
    series,
    meta: {
      schemaVersion: 1,
      filtroUnidades: 'regional_unidade_gerencia',
      demo: false,
    },
  };
}

/** Tendência global % metas conformes por unidade — hoje zerado até a view Postgres. */
function metasConformesPorUnidadeForQuery(query = {}) {
  const units = filterUnidadesPsMatriz(query);
  const nMeses = METAS_ACOMP_MES_LABELS.length;
  const zeros = () => Array(nMeses).fill(0);

  const series = units.map((u, idx) => ({
    unidadeId: u.unidadeId,
    name: labelUnidadePs(u),
    color: METAS_ACOMP_CORES_UNIDADE[idx % METAS_ACOMP_CORES_UNIDADE.length],
    data: zeros(),
  }));

  return {
    titulo: '% de metas conformes por unidade',
    months: [...METAS_ACOMP_MES_LABELS],
    isPercent: true,
    series,
    meta: {
      schemaVersion: 1,
      filtroUnidades: 'regional_unidade_gerencia',
      demo: false,
    },
  };
}

class LiveService {
  async getKPIs() {
    return {
      taxaOcupacao: { ...emptyKpiField(), unidade: '%' },
      tempoMedioInternacao: { ...emptyKpiField(), unidade: 'dias' },
      cirurgiasNoMes: { ...emptyKpiField(), unidade: 'proced.' },
      taxaReadmissao: { ...emptyKpiField(), unidade: '%' },
      satisfacaoPaciente: { ...emptyKpiField(), unidade: '%' },
      faturamentoMes: { ...emptyKpiField(), unidade: 'R$' },
      leitosDisponiveis: { ...emptyKpiField(), unidade: 'leitos' },
      pacientesAtivos: { ...emptyKpiField(), unidade: 'pac.' },
    };
  }

  async getKpiUnidades() {
    return [];
  }

  async getIndicadoresGerais() {
    return { linhas: [], totais: {} };
  }

  async getOverviewMetasVolumes(query = {}) {
    return this.getGerenciaMetasPorVolumes(query);
  }

  /**
   * Unidades que possuem PS — para o filtro do cabeçalho na visão Gerência.
   * Mesmo shape de getKpiUnidades: { unidadeId, unidadeNome, regional }.
   */
  async getGerenciaUnidadesPs(query = {}) {
    return listUnidadesPsParaFiltro(query);
  }

  /**
   * Matriz consolidada “Metas por volumes” + drill por unidade (subItems).
   */
  async getGerenciaMetasPorVolumes(query = {}) {
    return metasPorVolumesMatrixForQuery(query);
  }

  /**
   * Uma linha por unidade PS com volumes e percentuais (view/Postgres no futuro).
   * Query: ?period=&regional=&unidade=
   */
  async getGerenciaMetricasPorUnidade(query = {}) {
    return metricasPorUnidadeForQuery(query);
  }

  async getGerenciaTotaisPs(query = {}) {
    return gerenciaTotaisPsForQuery(query);
  }

  /** Jornada PS: médias em minutos por etapa e por unidade. Query: period, regional, unidade, filtro */
  async getGerenciaTempoMedioEtapas(query = {}) {
    return tempoMedioEtapasForQuery(query);
  }

  /**
   * Painel “Metas de acompanhamento”: catálogo de métricas + gauge global + série mensal por unidade.
   * Query: period, regional, unidade, metric (key do indicador, ex. conversao).
   * Valores zerados até fetchView/Postgres preencher.
   */
  async getGerenciaMetasAcompanhamentoGestao(query = {}) {
    return metasAcompanhamentoGestaoForQuery(query);
  }

  /**
   * % metas conformes por unidade (12 meses) — só filtros globais da tela.
   * Zerado até a view existir no Postgres.
   */
  async getGerenciaMetasConformesPorUnidade(query = {}) {
    return metasConformesPorUnidadeForQuery(query);
  }

  /**
   * Drill explícito por indicador (opcional se a view principal não trouxer subItems).
   * Query: ?period=&regional=&unidade=
   */
  async getGerenciaMetasPorVolumesPorIndicador(indicadorKey, filters) {
    const ind = METAS_POR_VOLUMES_INDICADORES.find((x) => x.key === indicadorKey);
    const units = filterUnidadesPsMatriz(filters || {});
    return {
      indicadorKey,
      indicadorNome: ind?.name ?? null,
      unidades: subItemsMetasPorVolumesFromUnidades(units),
    };
  }

  async getPSVolumes() {
    return {
      atendimentos: 0,
      examesLaboratoriais: 0,
      rxEcg: 0,
      tcUs: 0,
      prescricoes: 0,
      evasoes: 0,
      conversaoInternacao: '0',
      reavaliacoes: 0,
      pacsMedicados: 0,
      medicacoesPorPaciente: '0',
      pacsExamesLab: 0,
      labPorPaciente: '0',
      pacsTcs: 0,
      tcsPorPaciente: '0',
      desfechoMedico: '',
    };
  }

  async getPSKpis() {
    return {
      tempoPermanenciaMin: 0,
      tempoConsultaMin: 0,
      examesTotal: 0,
      medicacaoTotal: 0,
      conversaoInternacao: 0,
      altas: 0,
      obitos: 0,
    };
  }

  async getPSSlas() {
    const out = {};
    slaKeys.forEach((k) => {
      out[k] = emptySla();
    });
    return out;
  }

  async getPSMatrix() {
    return [];
  }

  async getPSHistory() {
    return this.getOverviewMetasVolumes({});
  }

  async getPSPerfil() {
    return { faixaEtaria: [], sexo: [], desfechoMedico: [] };
  }

  async getPSFluxos() {
    return {
      diasLabels: [],
      horasLabels: [],
      heatmapAtendimentos: [],
      heatmapTempoMedioMin: [],
      resumoPorHora: [],
      heatmapCalendario: { horasLabels: [], diasLabels: [], atendimentos: [] },
    };
  }

  async getPSMedicacao() {
    return { porVia: [], velocidade: { rapida: 0, lenta: 0 }, top10: [] };
  }

  async getPSConversao() {
    return {
      labels: [],
      taxaConversaoPct: [],
      atendimentos: [],
      internacoes: [],
      porUnidadeUltimoMes: [],
      kpis: {
        quantidadeAtendimentos: 0,
        quantidadeInternacoes: 0,
        taxaConversaoPct: 0,
        tempoMedioPsInternacaoHoras: null,
      },
    };
  }

  async getFinanceiroResumo() {
    return {
      labels: [],
      receitas: [],
      despesas: [],
      meta: 0,
      glosasPercent: [],
    };
  }

  async getFinanceiroConvenio() {
    return { labels: [], valores: [], cores: [] };
  }

  async getFinanceiroGlosas() {
    return { total: 0, percentualFaturamento: 0, porMotivo: [] };
  }

  async getOcupacaoSetor() {
    return { setores: [] };
  }

  async getInternacaoKPIs() {
    return {
      altasAcumuladas: 0,
      obitosAcumulados: 0,
      tempoMedioPermanencia: '0',
      taxaReadmissao: '0',
    };
  }

  async getInternacaoResumo() {
    return {
      quantidadeInternacoes: 0,
      altas: 0,
      obitos: 0,
      pacientesClinicos: 0,
      pacientesCirurgicos: 0,
      pacientesInternos: 0,
      pacientesExternos: 0,
    };
  }

  async getInternacoes() {
    return [];
  }

  async getOcupacaoTendencia() {
    return { labels: [], series: [], meta: 0 };
  }

  async getOcupacaoQualidade() {
    return {
      labels: [],
      infeccaoHospitalar: [],
      quedas: [],
      ulcerasPressao: [],
      nps: [],
      meta: 0,
      metaNps: 0,
    };
  }

  async getCirurgiaEspecialidade() {
    return { labels: [], dados: [], meta: [] };
  }

  async getCirurgiaEvolucao() {
    return { labels: [], eletivas: [], urgencias: [], meta: 0 };
  }

  async getCirurgiaTempoCentro() {
    return {
      labels: DIAS_SEMANA,
      mediaTempoMin: [0, 0, 0, 0, 0, 0, 0],
      heatmap: [],
      horasLabels: [],
    };
  }

  async getCCPerformance() {
    return {
      atraso30min: '0',
      ociosidadeSala: '0',
      subutilizacaoFiltrado: 0,
      taxaReabordagem: '0',
      totalCirurgias: 0,
    };
  }

  async getCCKpis() {
    return {
      tempoCirurgiaMin: 0,
      tempoSalaMin: 0,
      tempoAnestesiaMin: 0,
      altas: 0,
      obitos: 0,
      eletivas: 0,
      urgencias: 0,
    };
  }

  async getCCPerformanceTimeline() {
    return [];
  }
}

module.exports = new LiveService();
