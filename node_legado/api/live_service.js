/**
 * live_service.js — Camada de API (fina).
 *
 * Dados: db.js → fetchView (PostgreSQL ou SQLite) → mapeamento leve linha→JSON → { ok, data }.
 *
 * Evitar aqui: agregações pesadas, joins simulados em JS, laços sobre fatos
 * brutos muito grandes — isso aumenta delay na API.
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

/** Meses (YYYY-MM) que intersectam [parsePeriodStart(query), hoje] — alinhado ao filtro 30 / 90 / ano. */
function monthKeysOverlappingQueryPeriod(query = {}) {
  const start = parsePeriodStart(query);
  const end = new Date();
  const keys = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= endMonth) {
    keys.push(toMonthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  if (!keys.length) keys.push(toMonthKey(new Date()));
  const MAX = 24;
  if (keys.length > MAX) return keys.slice(-MAX);
  return keys;
}

function monthsLabelsFromKeys(mesKeys) {
  return (mesKeys || []).map((k) => formatMonthPtBr(k));
}

function emptyMetasMesesCells(mesKeys) {
  const z = () => ({ v: 0, d: 0 });
  return {
    meses: (mesKeys || []).map(() => z()),
    t: { v: 0, ytd: 0, sec: '(—)' },
  };
}

function mergeGerenciaMonthlyRowPacks(ds, pred, unitMap, unidadeId, monthKeys, query) {
  const out = emptyRowPack();
  (monthKeys || []).forEach((mk) => {
    const p = buildMonthlyGerenciaRowPack(ds, pred, unitMap, unidadeId, mk, query);
    out.fluxRows.push(...p.fluxRows);
    out.fluxInternacaoMesRows.push(...(p.fluxInternacaoMesRows || []));
    out.medRows.push(...p.medRows);
    out.viasRows.push(...(p.viasRows || []));
    out.labRows.push(...p.labRows);
    out.rxRows.push(...p.rxRows);
    out.tcusRows.push(...p.tcusRows);
    out.reavRows.push(...p.reavRows);
    out.altasRows.push(...p.altasRows);
    out.convRows.push(...p.convRows);
  });
  return out;
}

/** Desloca YYYY-MM por deltaMonths (ex.: -1 = mês anterior). */
function shiftMonthKey(monthKey, deltaMonths) {
  const parts = String(monthKey).split('-');
  const ys = parseInt(parts[0], 10);
  const ms = parseInt(parts[1], 10);
  const d = new Date(ys, ms - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function januaryKeyOf(monthKey) {
  const y = String(monthKey).slice(0, 4);
  return `${y}-01`;
}

/** Meses extras: m-1 do primeiro mês (VAR. da 1ª coluna) e janeiro do ano do último mês (YTD). */
function metasPorVolumesSupportMonthKeys(mesKeys) {
  if (!mesKeys || !mesKeys.length) return [];
  const have = new Set(mesKeys);
  const out = [];
  const prev = shiftMonthKey(mesKeys[0], -1);
  if (!have.has(prev)) out.push(prev);
  const jan = januaryKeyOf(mesKeys[mesKeys.length - 1]);
  if (!have.has(jan)) out.push(jan);
  return out;
}

function buildMetasPorVolumesRowsByMonthByUnit(ds, unitMap, pred, mesKeys, periodQuery = {}) {
  const support = metasPorVolumesSupportMonthKeys(mesKeys);
  const allKeys = [...new Set([...mesKeys, ...support])];
  const mesSet = new Set(mesKeys || []);
  const fluxInternados = (ds.fluxRows || []).filter(isDestinoInternadoPbi);
  const viasAll = ds.viasRows || [];
  const rowsByMonthByUnit = {};
  allKeys.forEach((k) => {
    const clip = mesSet.has(k);
    rowsByMonthByUnit[k] = {
      fluxRows: groupRowsByUnitInMonth(ds.fluxRows, unitMap, pred, ['DATA', 'DT_ENTRADA'], k, periodQuery, clip),
      /** PBI % conversão: numerador no mês de DT_INTERNACAO (não no mês da DATA do atendimento). */
      fluxInternacaoMesRows: groupRowsByUnitInMonth(
        fluxInternados,
        unitMap,
        pred,
        ['DT_INTERNACAO', 'DT_INTERNACAO_DATA'],
        k,
        periodQuery,
        clip,
      ),
      medRows: groupRowsByUnitInMonth(ds.medRows, unitMap, pred, ['DATA', 'DT_PRESCRICAO'], k, periodQuery, clip),
      viasRows: groupRowsByUnitInMonth(viasAll, unitMap, pred, ['DATA'], k, periodQuery, clip),
      labRows: groupRowsByUnitInMonth(ds.labRows, unitMap, pred, ['DATA', 'DT_SOLICITACAO', 'DT_EXAME'], k, periodQuery, clip),
      rxRows: groupRowsByUnitInMonth(ds.rxRows, unitMap, pred, ['DATA', 'DT_SOLICITACAO'], k, periodQuery, clip),
      tcusRows: groupRowsByUnitInMonth(ds.tcusRows, unitMap, pred, ['DATA', 'DT_EXAME', 'DT_REALIZADO'], k, periodQuery, clip),
      reavRows: groupRowsByUnitInMonth(ds.reavRows, unitMap, pred, ['DATA', 'DT_SOLIC_REAVALIACAO'], k, periodQuery, clip),
      altasRows: groupRowsByUnitInMonth(ds.altasRows, unitMap, pred, ['DT_ALTA', 'DT_ENTRADA'], k, periodQuery, clip),
      convRows: groupRowsByUnitInMonth(ds.convRows, unitMap, pred, ['DT_ENTRADA', 'DT_ALTA'], k, periodQuery, clip),
    };
  });
  return {
    rowsByMonthByUnit,
    prevMonthKey: shiftMonthKey(mesKeys[0], -1),
    januaryKey: januaryKeyOf(mesKeys[mesKeys.length - 1]),
  };
}

function rowPackForUnidade(rowsByMonthByUnit, monthKey, unidadeId) {
  const pack = rowsByMonthByUnit[monthKey];
  const k = String(unidadeId);
  if (!pack) {
    return {
      fluxRows: [],
      fluxInternacaoMesRows: [],
      medRows: [],
      viasRows: [],
      labRows: [],
      rxRows: [],
      tcusRows: [],
      reavRows: [],
      altasRows: [],
      convRows: [],
    };
  }
  return {
    fluxRows: pack.fluxRows.get(k) || [],
    fluxInternacaoMesRows: pack.fluxInternacaoMesRows?.get(k) || [],
    medRows: pack.medRows.get(k) || [],
    viasRows: pack.viasRows?.get(k) || [],
    labRows: pack.labRows.get(k) || [],
    rxRows: pack.rxRows.get(k) || [],
    tcusRows: pack.tcusRows.get(k) || [],
    reavRows: pack.reavRows.get(k) || [],
    altasRows: pack.altasRows.get(k) || [],
    convRows: pack.convRows.get(k) || [],
  };
}

/** Pacote vazio (merge / fallback). */
function emptyRowPack() {
  return {
    fluxRows: [],
    fluxInternacaoMesRows: [],
    medRows: [],
    viasRows: [],
    labRows: [],
    rxRows: [],
    tcusRows: [],
    reavRows: [],
    altasRows: [],
    convRows: [],
  };
}

/**
 * Agrega os 3 meses da grade num único pacote — “Total” da matriz (VALOR sintético do período).
 * Recalcula razões sobre volumes fundidos (ex.: medicações/paciente ≠ média das taxas mensais).
 */
function mergeRowPacksAcrossMonths(rowsByMonthByUnit, mesKeys, unidadeId) {
  const out = emptyRowPack();
  (mesKeys || []).forEach((mk) => {
    const p = rowPackForUnidade(rowsByMonthByUnit, mk, unidadeId);
    out.fluxRows.push(...p.fluxRows);
    out.fluxInternacaoMesRows.push(...(p.fluxInternacaoMesRows || []));
    out.medRows.push(...p.medRows);
    out.viasRows.push(...(p.viasRows || []));
    out.labRows.push(...p.labRows);
    out.rxRows.push(...p.rxRows);
    out.tcusRows.push(...p.tcusRows);
    out.reavRows.push(...p.reavRows);
    out.altasRows.push(...p.altasRows);
    out.convRows.push(...p.convRows);
  });
  return out;
}

/**
 * Unidades com PS — cadastro oficial (código + nome + UF).
 * Rótulo exibido: {codigo} - {unidadeNome}_{regional}. Lista via fetchView (SQLite).
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
  if (query.unidade) list = list.filter((u) => String(u.unidadeId) === String(query.unidade));
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
  const data = METAS_POR_VOLUMES_INDICADORES.map((ind) => {
    const metaRef = metaRefDisplayMetasPorVolumes(ind);
    return {
      key: ind.key,
      name: ind.name,
      isReverso: ind.isReverso,
      isP: ind.isP,
      metaTexto: metaRef.texto,
      metaTitulo: metaRef.titulo,
      ...emptyMetasMonthCells(),
      subItems: subTemplate.map((s) => ({ ...s })),
    };
  });
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
 * Limiares são metas de referência até a réplica SQLite devolver valores por período.
 */
const METRICAS_POR_UNIDADE_COLUNAS = [
  { key: 'atendimentos', label: 'Atendimentos', kind: 'int' },
  { key: 'altas', label: 'Altas', kind: 'int' },
  { key: 'obitos', label: 'Óbitos', kind: 'int' },
  { key: 'pct_evasao', label: '% Evasão', kind: 'pct', pctSense: 'low_good', pctGreenAt: 8, pctRedAt: 22 },
  {
    key: 'pct_desfecho_sobre_altas',
    label: '% desfecho médico (s/ altas)',
    kind: 'pct',
    pctSense: 'high_good',
    pctGreenAt: 82,
    pctRedAt: 58,
  },
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
 * Query: ?period=&regional=&unidade= — agregação conforme dados na réplica.
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
 * slaMaxMinutos: null até dados ou configuração definirem o SLA (min). Com null, não há destaque.
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
 * Meta de referência por métrica (faixa de ribbon / gauge até a réplica preencher valores).
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

let fetchViewFn = null;
let fetchViewReady = false;

function getFetchView() {
  if (fetchViewReady) return fetchViewFn;
  fetchViewReady = true;
  try {
    ({ fetchView: fetchViewFn } = require('./db'));
  } catch (err) {
    fetchViewFn = null;
    console.warn('[LiveService] db fetch unavailable, using fallback data only:', err?.message || err);
  }
  return fetchViewFn;
}

async function safeFetchView(viewName, options = {}) {
  const fetchView = getFetchView();
  if (!fetchView) return [];
  try {
    return await fetchView(viewName, {}, options);
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn(`[LiveService] fetch ${viewName} failed: ${msg}`);
    return [];
  }
}

/**
 * Filtro de período no SQL (menos linhas lidas que SELECT * + filtro em Node).
 * Desligar: GERENCIA_SQL_DATE_FILTER=0
 * Por omissão ativo (valor vazio ou diferente de "0").
 */
function gerenciaSqlDateFilterEnabled() {
  const v = process.env.GERENCIA_SQL_DATE_FILTER;
  if (v == null || String(v).trim() === '') return true;
  return String(v).trim() !== '0';
}

/** Colunas de data por tabela lógica (nomes como no catálogo / PBI). Postgres usa minúsculas no SQL. */
const GERENCIA_FACT_DATE_COLUMNS = {
  tbl_tempos_entrada_consulta_saida: ['DATA', 'DT_ENTRADA'],
  tbl_tempos_medicacao: ['DATA', 'DT_PRESCRICAO'],
  tbl_tempos_laboratorio: ['DATA', 'DT_SOLICITACAO', 'DT_EXAME', 'DT_ENTRADA'],
  tbl_tempos_rx_e_ecg: ['DATA', 'DT_SOLICITACAO', 'DT_EXAME'],
  tbl_tempos_tc_e_us: ['DATA', 'DT_EXAME', 'DT_REALIZADO', 'DT_LIBERACAO'],
  tbl_tempos_reavaliacao: ['DATA', 'DT_SOLIC_REAVALIACAO'],
  tbl_altas_ps: ['DT_ALTA', 'DT_ENTRADA'],
  tbl_intern_conversoes: ['DT_ENTRADA', 'DT_ALTA'],
  tbl_vias_medicamentos: ['DATA', 'DT_LIBERACAO'],
};

function gerenciaFetchOpts(logical, query) {
  if (!gerenciaSqlDateFilterEnabled()) return {};
  const cols = GERENCIA_FACT_DATE_COLUMNS[logical];
  if (!cols?.length) return {};
  return {
    dateFrom: parsePeriodStart(query),
    dateColumns: cols,
  };
}

function gerenciaDatasetCacheKey(query) {
  if (!gerenciaSqlDateFilterEnabled()) return 'full';
  const p = Number(query?.period);
  const periodKey = Number.isFinite(p) && p > 0 ? p : 365;
  return `df:${periodKey}`;
}

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function pickDate(row, fields) {
  for (const f of fields) {
    const d = toDate(row?.[f]);
    if (d) return d;
  }
  return null;
}

function toMonthKey(d) {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Início do intervalo do filtro "period" (dias).
 * - 366 = ano civil corrente (1 jan → hoje), para YTD alinhado ao PBI.
 * - Qualquer outro N finito > 0 = últimos N dias (rolante), ex.: 365 = ~12 meses, não só jan–dez do ano atual.
 */
function parsePeriodStart(query = {}) {
  const days = Number(query.period);
  const now = new Date();
  if (days === 366) return new Date(now.getFullYear(), 0, 1);
  if (Number.isFinite(days) && days > 0) {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  }
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  return d;
}

function isInPeriod(rowDate, query = {}) {
  if (!rowDate) return false;
  return rowDate >= parsePeriodStart(query);
}

function nKey(...parts) {
  return parts.map((p) => String(p ?? '')).join('|');
}

function distinctCountBy(rows, keyFn) {
  const s = new Set();
  rows.forEach((r) => s.add(keyFn(r)));
  return s.size;
}

function ratioPct(num, den) {
  if (!den) return 0;
  return (num / den) * 100;
}

/** Power BI: fluxo[DESTINO] = "Internado" (case-insensitive). */
function isDestinoInternadoPbi(r) {
  const v = String(r?.DESTINO ?? '').trim();
  return v.toLowerCase() === 'internado';
}

/** CD_MATERIAL excluídos em `Media medicacoes por pac` (Medidas.tmdl). */
const PBI_VIAS_EXCLUDE_CD_MATERIAL = new Set([84278, 84288, 84153, 84271]);

/**
 * Power BI: % desfecho — DISTINCTCOUNT onde DT_DESFECHO preenchido e MEDICO_DESFECHO = MEDICO_ATENDIMENTO.
 */
function desfechoMedicoAtendDistinctCountPbi(fluxRows) {
  const s = new Set();
  fluxRows.forEach((r) => {
    if (!pickDate(r, ['DT_DESFECHO'])) return;
    const md = normUpper(String(r.MEDICO_DESFECHO ?? '').trim());
    const ma = normUpper(String(r.MEDICO_ATENDIMENTO ?? '').trim());
    if (!md || !ma || md !== ma) return;
    s.add(nKey(r.NR_ATENDIMENTO));
  });
  return s.size;
}

/**
 * Power BI: DATEDIFF(DT_SOLIC_REAVALIACAO, referência, MINUTE) em `% Atend > Tempo reavaliacao (0)`.
 * Referência = menor não-nula entre DT_EVO_PRESC e DT_FIM_REAVALIACAO (lógica SWITCH do DAX).
 */
function reavaliacaoMinutosPbi(r) {
  const dtIni = pickDate(r, ['DT_SOLIC_REAVALIACAO']);
  if (!dtIni) return null;
  const dtEvo = pickDate(r, ['DT_EVO_PRESC']);
  const dtFim = pickDate(r, ['DT_FIM_REAVALIACAO']);
  let dtRef = null;
  if (!dtEvo && !dtFim) return null;
  if (!dtEvo) dtRef = dtFim;
  else if (!dtFim) dtRef = dtEvo;
  else dtRef = dtEvo <= dtFim ? dtEvo : dtFim;
  if (!dtRef) return null;
  return (dtRef.getTime() - dtIni.getTime()) / 60000;
}

function reavaliacaoLinhaValidaDenominadorPbi(r) {
  if (!pickDate(r, ['DT_SOLIC_REAVALIACAO'])) return false;
  return !!(pickDate(r, ['DT_EVO_PRESC']) || pickDate(r, ['DT_FIM_REAVALIACAO']));
}

/**
 * Power BI: AVERAGEX(VALUES(NR_ATENDIMENTO), COUNTROWS(SUMMARIZE(... NR_PRESCRICAO, CD_MATERIAL))) excl. materiais.
 */
function mediaMedicacoesPorPacientePbi(viasRows) {
  if (!viasRows?.length) return 0;
  const byNr = new Map();
  viasRows.forEach((r) => {
    const cd = asNumber(r.CD_MATERIAL);
    if (PBI_VIAS_EXCLUDE_CD_MATERIAL.has(cd)) return;
    const nr = nKey(r.NR_ATENDIMENTO);
    if (!byNr.has(nr)) byNr.set(nr, new Set());
    byNr.get(nr).add(`${nKey(r.NR_PRESCRICAO)}|${cd}`);
  });
  if (!byNr.size) return 0;
  let sum = 0;
  byNr.forEach((pairs) => {
    sum += pairs.size;
  });
  return sum / byNr.size;
}

function avg(rows, valueFn) {
  if (!rows.length) return 0;
  const values = rows.map(valueFn).filter((v) => Number.isFinite(v));
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function normUpper(s) {
  return String(s || '').trim().toUpperCase();
}

function containsAny(text, needles) {
  const t = normUpper(text);
  return needles.some((n) => t.includes(normUpper(n)));
}

function formatMonthPtBr(key) {
  const [y, m] = String(key || '').split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return key;
  return d
    .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    .replace(/\./g, '')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function buildRollingMonthKeys(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(toMonthKey(d));
  }
  return out;
}

/** Postgres / PBI: coluna ps pode ser boolean, 0/1, 't'/'f', 'S'/'N', etc. */
function rowIsPsAtivo(r) {
  const v = r?.ps;
  if (v == null) return true;
  if (v === true || v === 1) return true;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === 't' || s === '1' || s === 's' || s === 'sim' || s === 'yes') return true;
  return false;
}

async function loadUnidadesPsFromDb() {
  const candidates = ['tbl_unidades', 'tbl_unidades_teste', 'tbl_unidades_prod'];
  for (const table of candidates) {
    const rows = await safeFetchView(table, {
      columns: 'id,nome,uf,cd_estabelecimento,ps',
      orderBy: 'cd_estabelecimento',
    });
    if (!rows.length) continue;
    const mapped = rows
      .filter((r) => rowIsPsAtivo(r))
      .map((r) => ({
        codigo: String(r.cd_estabelecimento ?? r.id ?? ''),
        unidadeId: String(r.cd_estabelecimento ?? r.id ?? ''),
        unidadeNome: String(r.nome || '').trim() || String(r.id || ''),
        regional: String(r.uf || '').trim().toUpperCase(),
      }))
      .filter((u) => u.unidadeId);
    if (mapped.length) return sortUnidadesPorCodigo(mapped);
  }
  return sortUnidadesPorCodigo(DEMO_UNIDADES_PS);
}

function filterUnitsByQuery(units, query = {}) {
  let out = [...units];
  if (query.regional) out = out.filter((u) => u.regional === query.regional);
  if (query.unidade) out = out.filter((u) => String(u.unidadeId) === String(query.unidade));
  return sortUnidadesPorCodigo(out);
}

function unitMetaMap(units) {
  const byId = new Map();
  const byName = new Map();
  units.forEach((u) => {
    const canon = String(u.unidadeId);
    establishmentIdLookupKeys(canon).forEach((k) => {
      byId.set(k, u);
    });
    byName.set(normUpper(u.unidadeNome), u);
  });
  return { byId, byName };
}

function rowUnitId(row) {
  const direct =
    row?.unidade_id ??
    row?.unidadeId ??
    row?.CD_ESTABELECIMENTO ??
    row?.cd_estabelecimento ??
    row?.CD_ESTAB_URG ??
    row?.CD_ESTAB_INT;
  if (direct != null && direct !== '') return String(direct);
  return null;
}

function rowUnidadeNome(row) {
  return String(row?.UNIDADE ?? row?.unidade ?? '').trim();
}

/** Chaves equivalentes para cruzar fact (CD numérico) com cadastro (ex.: 1 vs 001). */
function establishmentIdLookupKeys(id) {
  const s = String(id ?? '').trim();
  if (!s) return [];
  const keys = new Set([s]);
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (!Number.isNaN(n)) {
      keys.add(String(n));
      keys.add(String(n).padStart(2, '0'));
      keys.add(String(n).padStart(3, '0'));
    }
  }
  return [...keys];
}

/** Resolve linha factual → meta da unidade (id com zeros ou só nome). */
function resolveUnitFromRow(row, unitMap) {
  const id = rowUnitId(row);
  if (id) {
    for (const k of establishmentIdLookupKeys(id)) {
      const u = unitMap.byId.get(k);
      if (u) return u;
    }
  }
  const nome = rowUnidadeNome(row);
  if (nome) return unitMap.byName.get(normUpper(nome)) || null;
  return null;
}

function buildRowPredicate(query, unitMap) {
  return (row) => {
    const unit = resolveUnitFromRow(row, unitMap);
    if (query.unidade && (!unit || String(unit.unidadeId) !== String(query.unidade))) return false;
    if (query.regional && (!unit || String(unit.regional) !== String(query.regional))) return false;
    return true;
  };
}

/**
 * Linhas por unidade e mês (eixo DATA no fluxo) + slice de internação no mês (PBI % conversão).
 * Usado nos gráficos de 12 meses (acompanhamento / % conformes).
 */
function buildMonthlyGerenciaRowPack(ds, pred, unitMap, unidadeId, mk, query = {}) {
  const uid = String(unidadeId);
  const matchUnit = (r) => {
    if (!pred(r)) return false;
    const u = resolveUnitFromRow(r, unitMap);
    return u != null && String(u.unidadeId) === uid;
  };
  const dateInMonth = (r, fields) => toMonthKey(pickDate(r, fields)) === mk;
  const inPeriod = (r, fields) => {
    const d = pickDate(r, fields);
    return d && isInPeriod(d, query);
  };
  const p = (rows, fields) =>
    (rows || []).filter((r) => matchUnit(r) && dateInMonth(r, fields) && inPeriod(r, fields));
  return {
    fluxRows: p(ds.fluxRows, ['DATA', 'DT_ENTRADA']),
    fluxInternacaoMesRows: (ds.fluxRows || []).filter(
      (r) =>
        matchUnit(r) &&
        isDestinoInternadoPbi(r) &&
        dateInMonth(r, ['DT_INTERNACAO', 'DT_INTERNACAO_DATA']) &&
        inPeriod(r, ['DT_INTERNACAO', 'DT_INTERNACAO_DATA']),
    ),
    medRows: p(ds.medRows, ['DATA', 'DT_PRESCRICAO']),
    viasRows: p(ds.viasRows, ['DATA']),
    labRows: p(ds.labRows, ['DATA', 'DT_SOLICITACAO', 'DT_EXAME']),
    rxRows: p(ds.rxRows, ['DATA', 'DT_SOLICITACAO']),
    tcusRows: p(ds.tcusRows, ['DATA', 'DT_EXAME', 'DT_REALIZADO']),
    reavRows: p(ds.reavRows, ['DATA', 'DT_SOLIC_REAVALIACAO']),
    altasRows: p(ds.altasRows, ['DT_ALTA', 'DT_ENTRADA']),
    convRows: p(ds.convRows, ['DT_ENTRADA', 'DT_ALTA']),
  };
}

/**
 * Vários GET /gerencia/* partilham o mesmo dataset em memória.
 * Chave de cache inclui o período quando o filtro SQL está ativo (datasets distintos).
 */
const GERENCIA_DS_TTL_MS = 25_000;
const gerenciaDsCache = new Map();
const gerenciaDsInflightByKey = new Map();

async function loadGerenciaDatasets(query = {}) {
  const cacheKey = gerenciaDatasetCacheKey(query);
  const now = Date.now();
  const hit = gerenciaDsCache.get(cacheKey);
  if (hit && now - hit.at < GERENCIA_DS_TTL_MS) {
    return hit.data;
  }
  let inflight = gerenciaDsInflightByKey.get(cacheKey);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const fo = (logical) => gerenciaFetchOpts(logical, query);
      const [fluxRows, medRows, labRows, rxRows, tcusRows, reavRows, altasRows, convRows, viasRows, metasRows] =
        await Promise.all([
          safeFetchView('tbl_tempos_entrada_consulta_saida', fo('tbl_tempos_entrada_consulta_saida')),
          safeFetchView('tbl_tempos_medicacao', fo('tbl_tempos_medicacao')),
          safeFetchView('tbl_tempos_laboratorio', fo('tbl_tempos_laboratorio')),
          safeFetchView('tbl_tempos_rx_e_ecg', fo('tbl_tempos_rx_e_ecg')),
          safeFetchView('tbl_tempos_tc_e_us', fo('tbl_tempos_tc_e_us')),
          safeFetchView('tbl_tempos_reavaliacao', fo('tbl_tempos_reavaliacao')),
          safeFetchView('tbl_altas_ps', fo('tbl_altas_ps')),
          safeFetchView('tbl_intern_conversoes', fo('tbl_intern_conversoes')),
          safeFetchView('tbl_vias_medicamentos', fo('tbl_vias_medicamentos')),
          safeFetchView('meta_tempos', fo('meta_tempos')),
        ]);
      const out = {
        fluxRows,
        medRows,
        labRows,
        rxRows,
        tcusRows,
        reavRows,
        altasRows,
        convRows,
        viasRows: viasRows || [],
        metasRows,
      };
      gerenciaDsCache.set(cacheKey, { data: out, at: Date.now() });
      return out;
    } finally {
      gerenciaDsInflightByKey.delete(cacheKey);
    }
  })();

  gerenciaDsInflightByKey.set(cacheKey, inflight);
  return inflight;
}

function metaLimitRowsByKey(rows, keyText, fallback) {
  const found = rows.find((r) => containsAny(r.CHAVE, [keyText]));
  return asNumber(found?.VALOR_MIN) || fallback;
}

function reduceMetrics(rows, ctx) {
  const fluxRows = rows.fluxRows || [];
  const fluxRowCount = fluxRows.length;
  const atendimentos = distinctCountBy(fluxRows, (r) => nKey(r.NR_ATENDIMENTO));
  const altas = rows.altasRows.length;
  const obitos = rows.altasRows.filter((r) => containsAny(r.TIPO_DESFECHO || r.DS_MOTIVO_ALTA, ['OBITO'])).length;
  const evasoes = rows.altasRows.filter((r) => containsAny(r.TIPO_DESFECHO || r.DS_MOTIVO_ALTA, ['EVADI', 'EVAS'])).length;
  /** PBI: COUNT internados no contexto de mês de internação (série) ou fluxo com DESTINO no mesmo slice (período único). */
  const internadosFluxCount =
    rows.fluxInternacaoMesRows != null
      ? rows.fluxInternacaoMesRows.length
      : fluxRows.filter(isDestinoInternadoPbi).length;
  const internacoes = internadosFluxCount;
  const conversoes = distinctCountBy(rows.convRows, (r) => nKey(r.NR_ATENDIMENTO_URG));
  const saidas = altas + evasoes + obitos;
  const reavaliacoes = distinctCountBy(rows.reavRows, (r) => nKey(r.NR_ATENDIMENTO));

  const viasRows = rows.viasRows || [];
  const pacientesMedicadosVias = distinctCountBy(viasRows, (r) => nKey(r.NR_ATENDIMENTO));
  const pacientesMedicadosMed = distinctCountBy(rows.medRows, (r) => nKey(r.NR_ATENDIMENTO));
  const pacientesMedicados = viasRows.length ? pacientesMedicadosVias : pacientesMedicadosMed;

  const medicacoes = rows.medRows.length;
  const pacientesLab = distinctCountBy(rows.labRows, (r) => nKey(r.NR_ATENDIMENTO));
  const examesLab = rows.labRows.length;
  const rxRows = rows.rxRows.filter((r) => containsAny(r.TIPO || r.EXAME, ['RX']));
  const ecgRows = rows.rxRows.filter((r) => containsAny(r.TIPO || r.EXAME, ['ECG']));
  const pacientesRx = distinctCountBy(rxRows, (r) => nKey(r.NR_ATENDIMENTO));
  const pacientesEcg = distinctCountBy(ecgRows, (r) => nKey(r.NR_ATENDIMENTO));
  const tcRows = rows.tcusRows.filter((r) => containsAny(r.TIPO || r.EXAME, ['TC', 'TOMO']));
  const usRows = rows.tcusRows.filter((r) => containsAny(r.TIPO || r.EXAME, ['US', 'ULTRA']));
  const pacientesTc = distinctCountBy(tcRows, (r) => nKey(r.NR_ATENDIMENTO));
  const pacientesUs = distinctCountBy(usRows, (r) => nKey(r.NR_ATENDIMENTO));
  const tcs = tcRows.length;

  const triagemMeta = metaLimitRowsByKey(ctx.metasRows, 'TRIAGEM', 12);
  const consultaMeta = metaLimitRowsByKey(ctx.metasRows, 'CONSULTA', 90);
  const medicacaoMeta = metaLimitRowsByKey(ctx.metasRows, 'MEDICACAO', 30);
  const reavalMeta = metaLimitRowsByKey(ctx.metasRows, 'REAVALI', 60);
  const permanenciaMeta = metaLimitRowsByKey(ctx.metasRows, 'ALTA', 240);

  /** PBI `% Atend > Tempo * (0)`: denominador = COUNT(fluxo[NR_ATENDIMENTO]) no contexto. */
  const triagemAcima = fluxRows.filter((r) => asNumber(r.MIN_ENTRADA_X_TRIAGEM) > triagemMeta).length;
  const consultaAcima = fluxRows.filter((r) => asNumber(r.MIN_ENTRADA_X_CONSULTA) > consultaMeta).length;
  const permanenciaAcima = fluxRows.filter((r) => asNumber(r.MIN_ENTRADA_X_ALTA) > permanenciaMeta).length;
  const medicacaoAcima = rows.medRows.filter((r) => asNumber(r.MINUTOS) > medicacaoMeta).length;

  const reavRows = rows.reavRows || [];
  const reavDenom = reavRows.filter((r) => reavaliacaoLinhaValidaDenominadorPbi(r)).length;
  const reavaliacaoAcima = reavRows.filter((r) => {
    if (!reavaliacaoLinhaValidaDenominadorPbi(r)) return false;
    let min = reavaliacaoMinutosPbi(r);
    if (min == null || !Number.isFinite(min)) min = asNumber(r.MINUTOS);
    return min > reavalMeta;
  }).length;

  const medicacoesRapidas = rows.medRows.filter((r) => asNumber(r.MINUTOS) <= medicacaoMeta).length;

  const desfechoMedicoQtdAltas = rows.altasRows.filter((r) => containsAny(r.TIPO_DESFECHO, ['ALTA', 'ALTA MED'])).length;
  const pctDesfechoSobreAltas = altas ? ratioPct(desfechoMedicoQtdAltas, altas) : 0;
  const desfechoFluxDistinct = desfechoMedicoAtendDistinctCountPbi(fluxRows);

  const mediaMedicacoesPorPac =
    viasRows.length > 0
      ? mediaMedicacoesPorPacientePbi(viasRows)
      : pacientesMedicadosMed
        ? medicacoes / pacientesMedicadosMed
        : 0;

  /** Ref. “medicações/paciente”: linhas Vias (PBI) ou fallback prescrições. */
  const medicacoes_ref_linhas = viasRows.length ? viasRows.length : medicacoes;

  /** Ref. matriz — alinhado aos denominadores PBI `(0)`. */
  const metasPorVolumesRefs = {
    triagem_acima_meta: [triagemAcima, fluxRowCount],
    consulta_acima_meta: [consultaAcima, fluxRowCount],
    medicacao_acima_meta: [medicacaoAcima, medicacoes],
    reavaliacao_acima_meta: [reavaliacaoAcima, reavDenom],
    permanencia_acima_meta: [permanenciaAcima, fluxRowCount],
  };

  return {
    atendimentos,
    flux_row_count: fluxRowCount,
    altas,
    obitos,
    evasoes,
    saidas,
    internacoes,
    conversoes,
    reavaliacoes,
    medicacoes_ref_linhas,
    pacientes_medicados: pacientesMedicados,
    medicacoes,
    medicacoes_rapidas: medicacoesRapidas,
    pacientes_lab: pacientesLab,
    exames_lab: examesLab,
    pacientes_rx: pacientesRx,
    pacientes_ecg: pacientesEcg,
    pacientes_tc: pacientesTc,
    pacientes_us: pacientesUs,
    tcs,
    desfecho_medico_qtd: desfechoFluxDistinct,
    pct_desfecho_sobre_altas: pctDesfechoSobreAltas,
    pct_evasao: ratioPct(evasoes, atendimentos),
    pct_desfecho_medico: ratioPct(desfechoFluxDistinct, atendimentos),
    pct_conversao: ratioPct(internadosFluxCount, fluxRowCount),
    pct_reavaliacao: ratioPct(reavaliacoes, atendimentos),
    pct_pacientes_medicados: ratioPct(pacientesMedicados, atendimentos),
    media_medicacoes_por_pac: mediaMedicacoesPorPac,
    pct_medicacoes_rapidas: ratioPct(medicacoesRapidas, medicacoes),
    pct_pacientes_lab: ratioPct(pacientesLab, atendimentos),
    media_lab_por_pac: pacientesLab ? examesLab / pacientesLab : 0,
    pct_pacientes_rx: ratioPct(pacientesRx, atendimentos),
    pct_pacientes_ecg: ratioPct(pacientesEcg, atendimentos),
    pct_pacientes_tc: ratioPct(pacientesTc, atendimentos),
    media_tcs_por_pac: pacientesTc ? tcs / pacientesTc : 0,
    pct_pacientes_us: ratioPct(pacientesUs, atendimentos),
    triagem_acima_meta_pct: ratioPct(triagemAcima, fluxRowCount),
    consulta_acima_meta_pct: ratioPct(consultaAcima, fluxRowCount),
    medicacao_acima_meta_pct: ratioPct(medicacaoAcima, medicacoes),
    reavaliacao_acima_meta_pct: ratioPct(reavaliacaoAcima, reavDenom),
    permanencia_acima_meta_pct: ratioPct(permanenciaAcima, fluxRowCount),
    avg_triagem_min: avg(fluxRows, (r) => asNumber(r.MIN_ENTRADA_X_TRIAGEM)),
    avg_consulta_min: avg(fluxRows, (r) => asNumber(r.MIN_ENTRADA_X_CONSULTA)),
    avg_permanencia_min: avg(fluxRows, (r) => asNumber(r.MIN_ENTRADA_X_ALTA)),
    avg_medicacao_min: avg(rows.medRows, (r) => asNumber(r.MINUTOS)),
    avg_rxecg_min: avg(rows.rxRows, (r) => asNumber(r.MINUTOS)),
    avg_tcus_min: avg(rows.tcusRows, (r) => asNumber(r.MINUTOS)),
    avg_reavaliacao_min: avg(reavRows, (r) => asNumber(r.MINUTOS)),
    metasPorVolumesRefs,
  };
}

function groupRowsByUnit(rows, unitMap, predicate, dateFields, query) {
  const buckets = new Map();
  rows.forEach((r) => {
    if (!predicate(r)) return;
    const d = pickDate(r, dateFields);
    if (!isInPeriod(d, query)) return;
    const unit = resolveUnitFromRow(r, unitMap);
    if (!unit) return;
    const k = String(unit.unidadeId);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(r);
  });
  return buckets;
}

/**
 * Agrupa por unidade restringindo ao mês yyyy-mm.
 * `applyPeriodClip`: meses da série principal — também exige isInPeriod (filtro do topo).
 * Chaves de apoio (mês anterior / jan) usam applyPeriodClip=false para VAR e YTD coerentes.
 */
function groupRowsByUnitInMonth(rows, unitMap, predicate, dateFields, monthKey, periodQuery, applyPeriodClip) {
  const buckets = new Map();
  rows.forEach((r) => {
    if (!predicate(r)) return;
    const d = pickDate(r, dateFields);
    if (!d || toMonthKey(d) !== monthKey) return;
    if (applyPeriodClip && !isInPeriod(d, periodQuery)) return;
    const unit = resolveUnitFromRow(r, unitMap);
    if (!unit) return;
    const k = String(unit.unidadeId);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(r);
  });
  return buckets;
}

function metasPorVolumesMetricValue(m, key) {
  if (!m) return 0;
  switch (key) {
    case 'conversao':
      return m.pct_conversao;
    case 'pacs_medicados':
      return m.pct_pacientes_medicados;
    case 'medicacoes_por_paciente':
      return m.media_medicacoes_por_pac;
    case 'pacs_exames_lab':
      return m.pct_pacientes_lab;
    case 'lab_por_paciente':
      return m.media_lab_por_pac;
    case 'pacs_exames_tc':
      return m.pct_pacientes_tc;
    case 'tcs_por_paciente':
      return m.media_tcs_por_pac;
    case 'triagem_acima_meta':
      return m.triagem_acima_meta_pct;
    case 'consulta_acima_meta':
      return m.consulta_acima_meta_pct;
    case 'medicacao_acima_meta':
      return m.medicacao_acima_meta_pct;
    case 'reavaliacao_acima_meta':
      return m.reavaliacao_acima_meta_pct;
    case 'permanencia_acima_meta':
      return m.permanencia_acima_meta_pct;
    case 'desfecho_medico':
      return m.pct_desfecho_medico;
    default:
      return 0;
  }
}

function fmtMetasPorVolumesRefPair(n, d) {
  const nn = Math.round(asNumber(n));
  const dd = Math.round(asNumber(d));
  if (!dd && !nn) return '(—)';
  if (!dd) return `(${nn})`;
  return `(${nn}/${dd})`;
}

/** Texto (ref.) por indicador, a partir de um `reduceMetrics` (ex.: janela 3 meses fundida). */
function metasPorVolumesRefSec(m, key) {
  if (!m) return '(—)';
  const r = m.metasPorVolumesRefs || {};
  switch (key) {
    case 'conversao':
      return fmtMetasPorVolumesRefPair(m.internacoes, m.flux_row_count ?? m.atendimentos);
    case 'pacs_medicados':
      return fmtMetasPorVolumesRefPair(m.pacientes_medicados, m.atendimentos);
    case 'medicacoes_por_paciente':
      return fmtMetasPorVolumesRefPair(m.medicacoes_ref_linhas ?? m.medicacoes, m.pacientes_medicados);
    case 'pacs_exames_lab':
      return fmtMetasPorVolumesRefPair(m.pacientes_lab, m.atendimentos);
    case 'lab_por_paciente':
      return fmtMetasPorVolumesRefPair(m.exames_lab, m.pacientes_lab);
    case 'pacs_exames_tc':
      return fmtMetasPorVolumesRefPair(m.pacientes_tc, m.atendimentos);
    case 'tcs_por_paciente':
      return fmtMetasPorVolumesRefPair(m.tcs, m.pacientes_tc);
    case 'triagem_acima_meta':
      return fmtMetasPorVolumesRefPair(r.triagem_acima_meta?.[0], r.triagem_acima_meta?.[1]);
    case 'consulta_acima_meta':
      return fmtMetasPorVolumesRefPair(r.consulta_acima_meta?.[0], r.consulta_acima_meta?.[1]);
    case 'medicacao_acima_meta':
      return fmtMetasPorVolumesRefPair(r.medicacao_acima_meta?.[0], r.medicacao_acima_meta?.[1]);
    case 'reavaliacao_acima_meta':
      return fmtMetasPorVolumesRefPair(r.reavaliacao_acima_meta?.[0], r.reavaliacao_acima_meta?.[1]);
    case 'permanencia_acima_meta':
      return fmtMetasPorVolumesRefPair(r.permanencia_acima_meta?.[0], r.permanencia_acima_meta?.[1]);
    case 'desfecho_medico':
      return fmtMetasPorVolumesRefPair(m.desfecho_medico_qtd, m.atendimentos);
    default:
      return `(${Math.round(asNumber(m.atendimentos))})`;
  }
}

function pairForMetasPorVolumesRefAgg(m, key) {
  if (!m) return [0, 0];
  const r = m.metasPorVolumesRefs || {};
  switch (key) {
    case 'conversao':
      return [asNumber(m.internacoes), asNumber(m.flux_row_count ?? m.atendimentos)];
    case 'pacs_medicados':
      return [asNumber(m.pacientes_medicados), asNumber(m.atendimentos)];
    case 'medicacoes_por_paciente':
      return [asNumber(m.medicacoes_ref_linhas ?? m.medicacoes), asNumber(m.pacientes_medicados)];
    case 'pacs_exames_lab':
      return [asNumber(m.pacientes_lab), asNumber(m.atendimentos)];
    case 'lab_por_paciente':
      return [asNumber(m.exames_lab), asNumber(m.pacientes_lab)];
    case 'pacs_exames_tc':
      return [asNumber(m.pacientes_tc), asNumber(m.atendimentos)];
    case 'tcs_por_paciente':
      return [asNumber(m.tcs), asNumber(m.pacientes_tc)];
    case 'triagem_acima_meta':
      return [asNumber(r.triagem_acima_meta?.[0]), asNumber(r.triagem_acima_meta?.[1])];
    case 'consulta_acima_meta':
      return [asNumber(r.consulta_acima_meta?.[0]), asNumber(r.consulta_acima_meta?.[1])];
    case 'medicacao_acima_meta':
      return [asNumber(r.medicacao_acima_meta?.[0]), asNumber(r.medicacao_acima_meta?.[1])];
    case 'reavaliacao_acima_meta':
      return [asNumber(r.reavaliacao_acima_meta?.[0]), asNumber(r.reavaliacao_acima_meta?.[1])];
    case 'permanencia_acima_meta':
      return [asNumber(r.permanencia_acima_meta?.[0]), asNumber(r.permanencia_acima_meta?.[1])];
    case 'desfecho_medico':
      return [asNumber(m.desfecho_medico_qtd), asNumber(m.atendimentos)];
    default:
      return [asNumber(m.atendimentos), asNumber(m.atendimentos)];
  }
}

/** (ref.) na linha pai = soma dos pares n/d de cada unidade (mesmo critério da coluna Valor sintética). */
function metasPorVolumesRefSecParent(unitSynthMs, key) {
  if (!unitSynthMs?.length) return '(—)';
  let n = 0;
  let d = 0;
  unitSynthMs.forEach((m) => {
    const p = pairForMetasPorVolumesRefAgg(m, key);
    n += p[0];
    d += p[1];
  });
  return fmtMetasPorVolumesRefPair(n, d);
}

/** (ref.) de um mês agregando todas as unidades — soma dos pares n/d de cada unidade naquele mês. */
function metasPorVolumesRefSecMonthAllUnits(rowsByMonthByUnit, monthKey, unitIds, ds, key) {
  if (!unitIds?.length) return '(—)';
  let n = 0;
  let d = 0;
  unitIds.forEach((uid) => {
    const m = reduceMetrics(rowPackForUnidade(rowsByMonthByUnit, monthKey, uid), ds);
    const p = pairForMetasPorVolumesRefAgg(m, key);
    n += asNumber(p[0]);
    d += asNumber(p[1]);
  });
  return fmtMetasPorVolumesRefPair(n, d);
}

function fmtMetaBr(n) {
  return Number(n).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Meta exibida ao lado do indicador na matriz Metas por volumes (mesma base do gauge / ribbon). */
function metaRefDisplayMetasPorVolumes(ind) {
  const cfg = METAS_ACOMP_POR_KEY[ind.key] || { meta: 0 };
  const m = Number(cfg.meta) || 0;
  const v = fmtMetaBr(m);
  if (ind.isP) {
    const cmp = ind.isReverso ? '≤' : '≥';
    const titulo = ind.isReverso
      ? `Meta: ${cmp} ${v}% (quanto menor, melhor)`
      : `Meta: ${cmp} ${v}% (quanto maior, melhor)`;
    return { texto: `${cmp} ${v}%`, titulo };
  }
  return {
    texto: `≤ ${v}`,
    titulo: `Meta: ≤ ${v} (quanto menor, melhor)`,
  };
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

/** Tendência global % metas conformes por unidade — conforme dados na réplica. */
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
    const units = await loadUnidadesPsFromDb();
    return filterUnitsByQuery(units, { regional: query.regional });
  }

  /**
   * Matriz consolidada “Metas por volumes” + drill por unidade (subItems).
   */
  async getGerenciaMetasPorVolumes(query = {}) {
    const allUnits = await loadUnidadesPsFromDb();
    const units = filterUnitsByQuery(allUnits, query);
    const unitMap = unitMetaMap(allUnits);
    const pred = buildRowPredicate(query, unitMap);
    const ds = await loadGerenciaDatasets(query);
    const mesKeys = monthKeysOverlappingQueryPeriod(query);
    const months = monthsLabelsFromKeys(mesKeys);
    const { rowsByMonthByUnit, prevMonthKey, januaryKey } = buildMetasPorVolumesRowsByMonthByUnit(
      ds,
      unitMap,
      pred,
      mesKeys,
      query,
    );
    const periodDays = Number(query.period);
    const z = emptyMetasMesesCells(mesKeys);

    const data = METAS_POR_VOLUMES_INDICADORES.map((ind) => {
      const metaRef = metaRefDisplayMetasPorVolumes(ind);
      const item = {
        key: ind.key,
        name: ind.name,
        isReverso: ind.isReverso,
        isP: ind.isP,
        metaTexto: metaRef.texto,
        metaTitulo: metaRef.titulo,
        meses: z.meses.map((c) => ({ ...c })),
        t: { ...z.t },
        subItems: [],
      };
      const unitValues = [];
      units.forEach((u) => {
        const m0 = reduceMetrics(rowPackForUnidade(rowsByMonthByUnit, prevMonthKey, u.unidadeId), ds);
        const mJan = reduceMetrics(rowPackForUnidade(rowsByMonthByUnit, januaryKey, u.unidadeId), ds);
        const mMonths = mesKeys.map((mk) => reduceMetrics(rowPackForUnidade(rowsByMonthByUnit, mk, u.unidadeId), ds));
        const mSynth = reduceMetrics(mergeRowPacksAcrossMonths(rowsByMonthByUnit, mesKeys, u.unidadeId), ds);
        const v0 = metasPorVolumesMetricValue(m0, ind.key);
        const vJan = metasPorVolumesMetricValue(mJan, ind.key);
        const vMonths = mMonths.map((m) => metasPorVolumesMetricValue(m, ind.key));
        const vSynth = metasPorVolumesMetricValue(mSynth, ind.key);
        const meses = vMonths.map((v, i) => ({
          v,
          d: i === 0 ? v - v0 : v - vMonths[i - 1],
          sec: metasPorVolumesRefSec(mMonths[i], ind.key),
        }));
        const ytd =
          periodDays === 366
            ? (vMonths.length ? vMonths[vMonths.length - 1] - vJan : 0)
            : vMonths.length > 1
              ? vMonths[vMonths.length - 1] - vMonths[0]
              : vMonths.length === 1
                ? vMonths[0] - v0
                : 0;
        unitValues.push({ v0, vJan, vMonths, vSynth, mSynth, ytd });
        item.subItems.push({
          unidadeId: u.unidadeId,
          name: labelUnidadePs(u),
          meses,
          t: { v: vSynth, ytd, sec: metasPorVolumesRefSec(mSynth, ind.key) },
        });
      });
      if (!unitValues.length) return { ...item, subItems: [] };
      const n = unitValues.length;
      const avgPick = (pick) => unitValues.reduce((a, u) => a + asNumber(pick(u)), 0) / n;
      const g0 = avgPick((u) => u.v0);
      const gJan = avgPick((u) => u.vJan);
      const gMonths = mesKeys.map((_, i) => avgPick((u) => u.vMonths[i]));
      const gSynth = avgPick((u) => u.vSynth);
      const unitIdsList = units.map((u) => u.unidadeId);
      const gMonthSecs = mesKeys.map((mk) =>
        metasPorVolumesRefSecMonthAllUnits(rowsByMonthByUnit, mk, unitIdsList, ds, ind.key),
      );
      item.meses = gMonths.map((v, i) => ({
        v,
        d: i === 0 ? v - g0 : v - gMonths[i - 1],
        sec: gMonthSecs[i],
      }));
      const gYtd =
        periodDays === 366
          ? (gMonths.length ? gMonths[gMonths.length - 1] - gJan : 0)
          : gMonths.length > 1
            ? gMonths[gMonths.length - 1] - gMonths[0]
            : gMonths.length === 1
              ? gMonths[0] - g0
              : 0;
      item.t = {
        v: gSynth,
        ytd: gYtd,
        sec: metasPorVolumesRefSecParent(
          unitValues.map((u) => u.mSynth),
          ind.key,
        ),
      };
      return item;
    });

    return {
      months,
      mesKeys,
      data,
      meta: {
        schemaVersion: 6,
        titulo: 'Metas por volumes',
        filtroUnidades: 'apenas_unidades_com_ps',
        unidadesNoContexto: units.length,
        eixoMeses: 'periodo_topo',
      },
    };
  }

  /**
   * Uma linha por unidade PS com volumes e percentuais (dados na réplica).
   * Query: ?period=&regional=&unidade=
   */
  async getGerenciaMetricasPorUnidade(query = {}) {
    const allUnits = await loadUnidadesPsFromDb();
    const units = filterUnitsByQuery(allUnits, query);
    const unitMap = unitMetaMap(allUnits);
    const pred = buildRowPredicate(query, unitMap);
    const ds = await loadGerenciaDatasets(query);

    const fluxByUnit = groupRowsByUnit(ds.fluxRows, unitMap, pred, ['DATA', 'DT_ENTRADA'], query);
    const viasByUnit = groupRowsByUnit(ds.viasRows || [], unitMap, pred, ['DATA'], query);
    const medByUnit = groupRowsByUnit(ds.medRows, unitMap, pred, ['DATA', 'DT_PRESCRICAO'], query);
    const labByUnit = groupRowsByUnit(ds.labRows, unitMap, pred, ['DATA', 'DT_SOLICITACAO', 'DT_EXAME'], query);
    const rxByUnit = groupRowsByUnit(ds.rxRows, unitMap, pred, ['DATA', 'DT_SOLICITACAO'], query);
    const tcusByUnit = groupRowsByUnit(ds.tcusRows, unitMap, pred, ['DATA', 'DT_EXAME', 'DT_REALIZADO'], query);
    const reavByUnit = groupRowsByUnit(ds.reavRows, unitMap, pred, ['DATA', 'DT_SOLIC_REAVALIACAO'], query);
    const altasByUnit = groupRowsByUnit(ds.altasRows, unitMap, pred, ['DT_ALTA', 'DT_ENTRADA'], query);
    const convByUnit = groupRowsByUnit(ds.convRows, unitMap, pred, ['DT_ENTRADA', 'DT_ALTA'], query);

    const linhas = units.map((u) => {
      const k = String(u.unidadeId);
      const m = reduceMetrics(
        {
          fluxRows: fluxByUnit.get(k) || [],
          medRows: medByUnit.get(k) || [],
          viasRows: viasByUnit.get(k) || [],
          labRows: labByUnit.get(k) || [],
          rxRows: rxByUnit.get(k) || [],
          tcusRows: tcusByUnit.get(k) || [],
          reavRows: reavByUnit.get(k) || [],
          altasRows: altasByUnit.get(k) || [],
          convRows: convByUnit.get(k) || [],
        },
        ds,
      );
      return {
        unidadeId: u.unidadeId,
        label: labelUnidadePs(u),
        valores: {
          atendimentos: m.atendimentos,
          altas: m.altas,
          obitos: m.obitos,
          pct_evasao: m.pct_evasao,
          pct_desfecho_sobre_altas: m.pct_desfecho_sobre_altas,
          pct_desfecho_medico: m.pct_desfecho_medico,
          saidas: m.saidas,
          internacoes: m.internacoes,
          pct_conversao: m.pct_conversao,
          pct_reavaliacao: m.pct_reavaliacao,
          pct_pacientes_medicados: m.pct_pacientes_medicados,
          media_medicacoes_por_pac: m.media_medicacoes_por_pac,
          pct_medicacoes_rapidas: m.pct_medicacoes_rapidas,
          pct_pacientes_lab: m.pct_pacientes_lab,
          media_lab_por_pac: m.media_lab_por_pac,
          pct_pacientes_rx: m.pct_pacientes_rx,
          pct_pacientes_ecg: m.pct_pacientes_ecg,
          pct_pacientes_tc: m.pct_pacientes_tc,
          media_tcs_por_pac: m.media_tcs_por_pac,
          pct_pacientes_us: m.pct_pacientes_us,
        },
      };
    });

    return {
      colunas: METRICAS_POR_UNIDADE_COLUNAS,
      linhas,
      meta: {
        schemaVersion: 2,
        titulo: 'Indicadores por unidade (PS)',
        filtroUnidades: 'regional_unidade_gerencia',
      },
    };
  }

  async getGerenciaTotaisPs(query = {}) {
    const allUnits = await loadUnidadesPsFromDb();
    const unitMap = unitMetaMap(allUnits);
    const pred = buildRowPredicate(query, unitMap);
    const ds = await loadGerenciaDatasets(query);
    const rows = {
      fluxRows: ds.fluxRows.filter((r) => pred(r) && isInPeriod(pickDate(r, ['DATA', 'DT_ENTRADA']), query)),
      medRows: ds.medRows.filter((r) => pred(r) && isInPeriod(pickDate(r, ['DATA', 'DT_PRESCRICAO']), query)),
      viasRows: (ds.viasRows || []).filter((r) => pred(r) && isInPeriod(pickDate(r, ['DATA']), query)),
      labRows: ds.labRows.filter((r) => pred(r) && isInPeriod(pickDate(r, ['DATA', 'DT_SOLICITACAO', 'DT_EXAME']), query)),
      rxRows: ds.rxRows.filter((r) => pred(r) && isInPeriod(pickDate(r, ['DATA', 'DT_SOLICITACAO']), query)),
      tcusRows: ds.tcusRows.filter((r) => pred(r) && isInPeriod(pickDate(r, ['DATA', 'DT_EXAME', 'DT_REALIZADO']), query)),
      reavRows: ds.reavRows.filter((r) => pred(r) && isInPeriod(pickDate(r, ['DATA', 'DT_SOLIC_REAVALIACAO']), query)),
      altasRows: ds.altasRows.filter((r) => pred(r) && isInPeriod(pickDate(r, ['DT_ALTA', 'DT_ENTRADA']), query)),
      convRows: ds.convRows.filter((r) => pred(r) && isInPeriod(pickDate(r, ['DT_ENTRADA', 'DT_ALTA']), query)),
    };
    const m = reduceMetrics(rows, ds);
    const values = {
      atendimentos: m.atendimentos,
      altas: m.altas,
      obitos: m.obitos,
      evasoes: m.evasoes,
      desfecho: m.desfecho_medico_qtd,
      desfecho_medico: m.desfecho_medico_qtd,
      saidas: m.saidas,
      internacoes: m.internacoes,
      conversoes: m.conversoes,
      reavaliacoes: m.reavaliacoes,
      pacientes_medicados: m.pacientes_medicados,
      medicacoes: m.medicacoes,
      medicacoes_rapidas: m.medicacoes_rapidas,
      pacientes_lab: m.pacientes_lab,
      exames_lab: m.exames_lab,
      pacientes_rx: m.pacientes_rx,
      pacientes_ecg: m.pacientes_ecg,
      pacientes_tc: m.pacientes_tc,
      tcs: m.tcs,
      pacientes_us: m.pacientes_us,
    };
    return {
      cards: GERENCIA_TOTAIS_PS_DEF.map(({ key, label }) => ({
        key,
        label,
        value: asNumber(values[key]),
        format: 'int',
      })),
      meta: {
        schemaVersion: 2,
        titulo: 'Totais PS (filtro atual)',
      },
    };
  }

  /** Jornada PS: médias em minutos por etapa e por unidade. Query: period, regional, unidade, filtro */
  async getGerenciaTempoMedioEtapas(query = {}) {
    const allUnits = await loadUnidadesPsFromDb();
    const units = filterUnitsByQuery(allUnits, query);
    const unitMap = unitMetaMap(allUnits);
    const pred = buildRowPredicate(query, unitMap);
    const ds = await loadGerenciaDatasets(query);
    const metaRows = ds.metasRows || [];
    const triagemMeta = metaLimitRowsByKey(metaRows, 'TRIAGEM', 12);
    const consultaMeta = metaLimitRowsByKey(metaRows, 'CONSULTA', 90);
    const medMeta = metaLimitRowsByKey(metaRows, 'MEDICACAO', 30);
    const rxMeta = metaLimitRowsByKey(metaRows, 'RX', 60);
    const tcMeta = metaLimitRowsByKey(metaRows, 'TC', 120);
    const reavMeta = metaLimitRowsByKey(metaRows, 'REAVALI', 60);
    const permMeta = metaLimitRowsByKey(metaRows, 'ALTA', 240);

    const fluxByUnit = groupRowsByUnit(ds.fluxRows, unitMap, pred, ['DATA', 'DT_ENTRADA'], query);
    const medByUnit = groupRowsByUnit(ds.medRows, unitMap, pred, ['DATA', 'DT_PRESCRICAO'], query);
    const rxByUnit = groupRowsByUnit(ds.rxRows, unitMap, pred, ['DATA', 'DT_SOLICITACAO'], query);
    const tcusByUnit = groupRowsByUnit(ds.tcusRows, unitMap, pred, ['DATA', 'DT_EXAME', 'DT_REALIZADO'], query);
    const reavByUnit = groupRowsByUnit(ds.reavRows, unitMap, pred, ['DATA', 'DT_SOLIC_REAVALIACAO'], query);

    const linhas = units.map((u) => {
      const k = String(u.unidadeId);
      const flux = fluxByUnit.get(k) || [];
      const med = medByUnit.get(k) || [];
      const rx = rxByUnit.get(k) || [];
      const tcus = tcusByUnit.get(k) || [];
      const reav = reavByUnit.get(k) || [];
      return {
        unidadeId: u.unidadeId,
        unidadeLabel: labelUnidadePs(u),
        valores: {
          totem_triagem: avg(flux, (r) => asNumber(r.MIN_ENTRADA_X_TRIAGEM)),
          totem_consulta: avg(flux, (r) => asNumber(r.MIN_ENTRADA_X_CONSULTA)),
          presc_medicacao: avg(med, (r) => asNumber(r.MINUTOS)),
          presc_rx_ecg: avg(rx, (r) => asNumber(r.MINUTOS)),
          presc_tc_us: avg(tcus, (r) => asNumber(r.MINUTOS)),
          pedido_reavaliacao: avg(reav, (r) => {
            if (!reavaliacaoLinhaValidaDenominadorPbi(r)) return NaN;
            const m = reavaliacaoMinutosPbi(r);
            return m != null && Number.isFinite(m) ? m : asNumber(r.MINUTOS);
          }),
          permanencia_total: avg(flux, (r) => asNumber(r.MIN_ENTRADA_X_ALTA)),
        },
      };
    });

    const totais = {
      totem_triagem: avg(linhas, (r) => asNumber(r.valores.totem_triagem)),
      totem_consulta: avg(linhas, (r) => asNumber(r.valores.totem_consulta)),
      presc_medicacao: avg(linhas, (r) => asNumber(r.valores.presc_medicacao)),
      presc_rx_ecg: avg(linhas, (r) => asNumber(r.valores.presc_rx_ecg)),
      presc_tc_us: avg(linhas, (r) => asNumber(r.valores.presc_tc_us)),
      pedido_reavaliacao: avg(linhas, (r) => asNumber(r.valores.pedido_reavaliacao)),
      permanencia_total: avg(linhas, (r) => asNumber(r.valores.permanencia_total)),
    };

    const etapas = TEMPO_MEDIO_ETAPAS_COLS.map((e) => {
      const map = {
        totem_triagem: triagemMeta,
        totem_consulta: consultaMeta,
        presc_medicacao: medMeta,
        presc_rx_ecg: rxMeta,
        presc_tc_us: tcMeta,
        pedido_reavaliacao: reavMeta,
        permanencia_total: permMeta,
      };
      return { ...e, slaMaxMinutos: map[e.key] ?? null };
    });

    return {
      titulo: 'Tempo medio por etapa (min)',
      etapas,
      filtroUnidadeOpcoes: [{ value: '', label: 'Todas' }, ...units.map((u) => ({ value: u.unidadeId, label: labelUnidadePs(u) }))],
      linhas,
      totais,
      meta: { schemaVersion: 2 },
    };
  }

  /**
   * Painel “Metas de acompanhamento”: catálogo de métricas + gauge global + série mensal por unidade.
   * Query: period, regional, unidade, metric (key do indicador, ex. conversao).
   * Valores conforme fetchView na réplica SQLite.
   */
  async getGerenciaMetasAcompanhamentoGestao(query = {}) {
    const allUnits = await loadUnidadesPsFromDb();
    const units = filterUnitsByQuery(allUnits, query);
    const unitMap = unitMetaMap(allUnits);
    const pred = buildRowPredicate(query, unitMap);
    const ds = await loadGerenciaDatasets(query);

    const rawKey = query.metric != null ? String(query.metric) : 'conversao';
    const found = METAS_POR_VOLUMES_INDICADORES.find((x) => x.key === rawKey);
    const indResolved = found || METAS_POR_VOLUMES_INDICADORES[0];
    const metricKey = indResolved.key;
    const cfg = METAS_ACOMP_POR_KEY[metricKey] || { meta: 0 };
    const sense = indResolved.isReverso ? 'low_good' : 'high_good';
    const ribbonCmp = sense === 'low_good' ? '<' : '>';

    const monthKeys = monthKeysOverlappingQueryPeriod(query);
    const months = monthsLabelsFromKeys(monthKeys);

    const perMetric = (m) => {
      switch (metricKey) {
        case 'conversao': return m.pct_conversao;
        case 'pacs_medicados': return m.pct_pacientes_medicados;
        case 'medicacoes_por_paciente': return m.media_medicacoes_por_pac;
        case 'pacs_exames_lab': return m.pct_pacientes_lab;
        case 'lab_por_paciente': return m.media_lab_por_pac;
        case 'pacs_exames_tc': return m.pct_pacientes_tc;
        case 'tcs_por_paciente': return m.media_tcs_por_pac;
        case 'triagem_acima_meta': return m.triagem_acima_meta_pct;
        case 'consulta_acima_meta': return m.consulta_acima_meta_pct;
        case 'medicacao_acima_meta': return m.medicacao_acima_meta_pct;
        case 'reavaliacao_acima_meta': return m.reavaliacao_acima_meta_pct;
        case 'permanencia_acima_meta': return m.permanencia_acima_meta_pct;
        case 'desfecho_medico': return m.pct_desfecho_medico;
        default: return 0;
      }
    };

    const series = units.map((u, idx) => {
      const data = monthKeys.map((mk) =>
        perMetric(reduceMetrics(buildMonthlyGerenciaRowPack(ds, pred, unitMap, u.unidadeId, mk, query), ds)),
      );
      return {
        unidadeId: u.unidadeId,
        name: labelUnidadePs(u),
        color: METAS_ACOMP_CORES_UNIDADE[idx % METAS_ACOMP_CORES_UNIDADE.length],
        data,
      };
    });

    /** Gauge = média do indicador no período inteiro (volumes fundidos), por unidade. */
    const periodValByUnit = units.map((u) =>
      perMetric(reduceMetrics(mergeGerenciaMonthlyRowPacks(ds, pred, unitMap, u.unidadeId, monthKeys, query), ds)),
    );
    const globalVal = periodValByUnit.length
      ? periodValByUnit.reduce((a, b) => a + b, 0) / periodValByUnit.length
      : 0;
    const gaugeMax = indResolved.isP ? 100 : Math.max(10, Number(cfg.meta) * 1.5 || 10);

    return {
      titulo: 'Metas de acompanhamento da gestao',
      catalog: METAS_POR_VOLUMES_INDICADORES.map((x) => ({
        key: x.key,
        label: x.name,
        isP: x.isP,
        isReverso: x.isReverso,
      })),
      selectedKey: metricKey,
      gauge: {
        title: `${indResolved.name} global no periodo`,
        value: globalVal,
        min: 0,
        max: gaugeMax,
        isPercent: indResolved.isP,
        sense,
      },
      metaRibbon: {
        target: cfg.meta,
        sense,
        text: `META ${fmtMetaBr(cfg.meta)} ${ribbonCmp} melhor`,
      },
      months,
      series,
      meta: {
        schemaVersion: 3,
        filtroUnidades: 'regional_unidade_gerencia',
        demo: false,
        eixoMeses: 'periodo_topo',
      },
    };
  }

  /**
   * % metas conformes por unidade — meses alinhados ao filtro de período (30 / 90 / ano).
   * Conforme tabelas/views existentes na réplica SQLite.
   */
  async getGerenciaMetasConformesPorUnidade(query = {}) {
    const allUnits = await loadUnidadesPsFromDb();
    const units = filterUnitsByQuery(allUnits, query);
    const unitMap = unitMetaMap(allUnits);
    const pred = buildRowPredicate(query, unitMap);
    const ds = await loadGerenciaDatasets(query);
    const monthKeys = monthKeysOverlappingQueryPeriod(query);
    const months = monthsLabelsFromKeys(monthKeys);
    const metas = {
      triagem: metaLimitRowsByKey(ds.metasRows, 'TRIAGEM', 12),
      consulta: metaLimitRowsByKey(ds.metasRows, 'CONSULTA', 90),
      medicacao: metaLimitRowsByKey(ds.metasRows, 'MEDICACAO', 30),
      reavaliacao: metaLimitRowsByKey(ds.metasRows, 'REAVALI', 60),
      permanencia: metaLimitRowsByKey(ds.metasRows, 'ALTA', 240),
      conversao: 12,
      desfecho: 82,
    };

    const series = units.map((u, idx) => {
      const data = monthKeys.map((mk) => {
        const rows = buildMonthlyGerenciaRowPack(ds, pred, unitMap, u.unidadeId, mk, query);
        const m = reduceMetrics(rows, ds);
        let ok = 0;
        let total = 0;
        const checks = [
          [m.triagem_acima_meta_pct, metas.triagem, 'low'],
          [m.consulta_acima_meta_pct, metas.consulta, 'low'],
          [m.medicacao_acima_meta_pct, metas.medicacao, 'low'],
          [m.reavaliacao_acima_meta_pct, metas.reavaliacao, 'low'],
          [m.permanencia_acima_meta_pct, metas.permanencia, 'low'],
          [m.pct_conversao, metas.conversao, 'high'],
          [m.pct_desfecho_medico, metas.desfecho, 'high'],
        ];
        checks.forEach(([v, t, mode]) => {
          total += 1;
          if (mode === 'low' && v <= t) ok += 1;
          if (mode === 'high' && v >= t) ok += 1;
        });
        return ratioPct(ok, total);
      });
      return {
        unidadeId: u.unidadeId,
        name: labelUnidadePs(u),
        color: METAS_ACOMP_CORES_UNIDADE[idx % METAS_ACOMP_CORES_UNIDADE.length],
        data,
      };
    });

    return {
      titulo: '% de metas conformes por unidade',
      months,
      isPercent: true,
      series,
      meta: {
        schemaVersion: 3,
        filtroUnidades: 'regional_unidade_gerencia',
        demo: false,
        eixoMeses: 'periodo_topo',
      },
    };
  }

  /**
   * Drill explícito por indicador (opcional se a view principal não trouxer subItems).
   * Query: ?period=&regional=&unidade=
   */
  async getGerenciaMetasPorVolumesPorIndicador(indicadorKey, filters) {
    const ind = METAS_POR_VOLUMES_INDICADORES.find((x) => x.key === indicadorKey);
    const allUnits = await loadUnidadesPsFromDb();
    const units = filterUnitsByQuery(allUnits, filters || {});
    const unitMap = unitMetaMap(allUnits);
    const q = filters || {};
    const pred = buildRowPredicate(q, unitMap);
    const ds = await loadGerenciaDatasets(q);
    const mesKeys = monthKeysOverlappingQueryPeriod(q);
    const months = monthsLabelsFromKeys(mesKeys);
    const { rowsByMonthByUnit, prevMonthKey, januaryKey } = buildMetasPorVolumesRowsByMonthByUnit(
      ds,
      unitMap,
      pred,
      mesKeys,
      q,
    );
    const key = ind?.key ?? indicadorKey;
    const periodDays = Number(q.period);
    const unidades = units.map((u) => {
      const m0 = reduceMetrics(rowPackForUnidade(rowsByMonthByUnit, prevMonthKey, u.unidadeId), ds);
      const mJan = reduceMetrics(rowPackForUnidade(rowsByMonthByUnit, januaryKey, u.unidadeId), ds);
      const mMonths = mesKeys.map((mk) => reduceMetrics(rowPackForUnidade(rowsByMonthByUnit, mk, u.unidadeId), ds));
      const mSynth = reduceMetrics(mergeRowPacksAcrossMonths(rowsByMonthByUnit, mesKeys, u.unidadeId), ds);
      const v0 = metasPorVolumesMetricValue(m0, key);
      const vJan = metasPorVolumesMetricValue(mJan, key);
      const vMonths = mMonths.map((m) => metasPorVolumesMetricValue(m, key));
      const vSynth = metasPorVolumesMetricValue(mSynth, key);
      const meses = vMonths.map((v, i) => ({
        v,
        d: i === 0 ? v - v0 : v - vMonths[i - 1],
        sec: metasPorVolumesRefSec(mMonths[i], key),
      }));
      const ytd =
        periodDays === 366
          ? (vMonths.length ? vMonths[vMonths.length - 1] - vJan : 0)
          : vMonths.length > 1
            ? vMonths[vMonths.length - 1] - vMonths[0]
            : vMonths.length === 1
              ? vMonths[0] - v0
              : 0;
      return {
        unidadeId: u.unidadeId,
        name: labelUnidadePs(u),
        meses,
        t: { v: vSynth, ytd, sec: metasPorVolumesRefSec(mSynth, key) },
      };
    });
    return {
      indicadorKey,
      indicadorNome: ind?.name ?? String(indicadorKey),
      months,
      mesKeys,
      unidades,
    };
  }

  /**
   * Um único payload para a visão Gerência — uma ida ao Postgres (datasets partilhados)
   * e agregação no Node; o React faz um só GET e pinta tudo de uma vez.
   */
  async getGerenciaDashboardBundle(query = {}) {
    const q = { ...query };
    const metasAcompPromises = METAS_POR_VOLUMES_INDICADORES.map((ind) =>
      this.getGerenciaMetasAcompanhamentoGestao({ ...q, metric: ind.key }),
    );
    const parts = await Promise.all([
      this.getGerenciaTotaisPs(q),
      this.getGerenciaTempoMedioEtapas(q),
      this.getGerenciaMetasPorVolumes(q),
      this.getGerenciaMetasConformesPorUnidade(q),
      this.getGerenciaMetricasPorUnidade(q),
      this.getGerenciaUnidadesPs(q),
      ...metasAcompPromises,
    ]);
    const metasAcompanhamentoByMetric = {};
    METAS_POR_VOLUMES_INDICADORES.forEach((ind, i) => {
      metasAcompanhamentoByMetric[ind.key] = parts[6 + i];
    });
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      totaisPs: parts[0],
      tempoMedioEtapas: parts[1],
      metasPorVolumes: parts[2],
      metasConformesPorUnidade: parts[3],
      metricasPorUnidade: parts[4],
      unidadesPs: parts[5],
      metasAcompanhamentoByMetric,
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
