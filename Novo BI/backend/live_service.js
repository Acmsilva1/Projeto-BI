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

function parsePeriodStart(query = {}) {
  const days = Number(query.period);
  const now = new Date();
  if (days === 365) return new Date(now.getFullYear(), 0, 1);
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

async function loadUnidadesPsFromDb() {
  const candidates = ['tbl_unidades', 'tbl_unidades_teste'];
  for (const table of candidates) {
    const rows = await safeFetchView(table, {
      columns: 'id,nome,uf,cd_estabelecimento,ps',
      orderBy: 'cd_estabelecimento',
    });
    if (!rows.length) continue;
    const mapped = rows
      .filter((r) => {
        if (r.ps == null) return true;
        return r.ps === true || r.ps === 1 || String(r.ps).toLowerCase() === 'true';
      })
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
    byId.set(String(u.unidadeId), u);
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

function buildRowPredicate(query, unitMap) {
  return (row) => {
    const id = rowUnitId(row);
    let unit = id ? unitMap.byId.get(String(id)) : null;
    if (!unit) {
      const nome = rowUnidadeNome(row);
      if (nome) unit = unitMap.byName.get(normUpper(nome)) || null;
    }
    if (query.unidade && (!unit || String(unit.unidadeId) !== String(query.unidade))) return false;
    if (query.regional && (!unit || String(unit.regional) !== String(query.regional))) return false;
    return true;
  };
}

async function loadGerenciaDatasets() {
  const [
    painelRows,
    snapshotRows,
    fluxRows,
    medRows,
    labRows,
    rxRows,
    tcusRows,
    reavRows,
    altasRows,
    convRows,
    metasRows,
  ] = await Promise.all([
    safeFetchView('vw_painel_ps_base'),
    safeFetchView('ps_resumo_unidades_snapshot_prod'),
    safeFetchView('tbl_tempos_entrada_consulta_saida'),
    safeFetchView('tbl_tempos_medicacao'),
    safeFetchView('tbl_tempos_laboratorio'),
    safeFetchView('tbl_tempos_rx_e_ecg'),
    safeFetchView('tbl_tempos_tc_e_us'),
    safeFetchView('tbl_tempos_reavaliacao'),
    safeFetchView('tbl_altas_ps'),
    safeFetchView('tbl_intern_conversoes'),
    safeFetchView('meta_tempos'),
  ]);
  return {
    painelRows,
    snapshotRows,
    fluxRows,
    medRows,
    labRows,
    rxRows,
    tcusRows,
    reavRows,
    altasRows,
    convRows,
    metasRows,
  };
}

function metaLimitRowsByKey(rows, keyText, fallback) {
  const found = rows.find((r) => containsAny(r.CHAVE, [keyText]));
  return asNumber(found?.VALOR_MIN) || fallback;
}

function reduceMetrics(rows, ctx) {
  const atendimentos = distinctCountBy(rows.fluxRows, (r) => nKey(r.NR_ATENDIMENTO));
  const altas = rows.altasRows.length;
  const obitos = rows.altasRows.filter((r) => containsAny(r.TIPO_DESFECHO || r.DS_MOTIVO_ALTA, ['OBITO'])).length;
  const evasoes = rows.altasRows.filter((r) => containsAny(r.TIPO_DESFECHO || r.DS_MOTIVO_ALTA, ['EVADI', 'EVAS'])).length;
  const internacoes = distinctCountBy(rows.convRows, (r) => nKey(r.NR_ATENDIMENTO_INT || r.NR_ATENDIMENTO_URG));
  const conversoes = distinctCountBy(rows.convRows, (r) => nKey(r.NR_ATENDIMENTO_URG));
  const saidas = altas + evasoes + obitos;
  const reavaliacoes = distinctCountBy(rows.reavRows, (r) => nKey(r.NR_ATENDIMENTO));
  const pacientesMedicados = distinctCountBy(rows.medRows, (r) => nKey(r.NR_ATENDIMENTO));
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

  const triagemAcima = rows.fluxRows.filter((r) => asNumber(r.MIN_ENTRADA_X_TRIAGEM) > triagemMeta).length;
  const consultaAcima = rows.fluxRows.filter((r) => asNumber(r.MIN_ENTRADA_X_CONSULTA) > consultaMeta).length;
  const permanenciaAcima = rows.fluxRows.filter((r) => asNumber(r.MIN_ENTRADA_X_ALTA) > permanenciaMeta).length;
  const medicacaoAcima = rows.medRows.filter((r) => asNumber(r.MINUTOS) > medicacaoMeta).length;
  const reavaliacaoAcima = rows.reavRows.filter((r) => asNumber(r.MINUTOS) > reavalMeta).length;
  const medicacoesRapidas = rows.medRows.filter((r) => asNumber(r.MINUTOS) <= medicacaoMeta).length;

  const desfechoMedicoQtd = rows.altasRows.filter((r) => containsAny(r.TIPO_DESFECHO, ['ALTA', 'ALTA MED'])).length;
  const desfechoTxt = desfechoMedicoQtd ? 'Alta medica' : '';

  return {
    atendimentos,
    altas,
    obitos,
    evasoes,
    saidas,
    internacoes,
    conversoes,
    reavaliacoes,
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
    desfecho: desfechoTxt,
    desfecho_medico_qtd: desfechoMedicoQtd,
    pct_evasao: ratioPct(evasoes, atendimentos),
    pct_desfecho_medico: ratioPct(desfechoMedicoQtd, atendimentos),
    pct_conversao: ratioPct(internacoes, atendimentos),
    pct_reavaliacao: ratioPct(reavaliacoes, atendimentos),
    pct_pacientes_medicados: ratioPct(pacientesMedicados, atendimentos),
    media_medicacoes_por_pac: pacientesMedicados ? medicacoes / pacientesMedicados : 0,
    pct_medicacoes_rapidas: ratioPct(medicacoesRapidas, medicacoes),
    pct_pacientes_lab: ratioPct(pacientesLab, atendimentos),
    media_lab_por_pac: pacientesLab ? examesLab / pacientesLab : 0,
    pct_pacientes_rx: ratioPct(pacientesRx, atendimentos),
    pct_pacientes_ecg: ratioPct(pacientesEcg, atendimentos),
    pct_pacientes_tc: ratioPct(pacientesTc, atendimentos),
    media_tcs_por_pac: pacientesTc ? tcs / pacientesTc : 0,
    pct_pacientes_us: ratioPct(pacientesUs, atendimentos),
    triagem_acima_meta_pct: ratioPct(triagemAcima, atendimentos),
    consulta_acima_meta_pct: ratioPct(consultaAcima, atendimentos),
    medicacao_acima_meta_pct: ratioPct(medicacaoAcima, medicacoes),
    reavaliacao_acima_meta_pct: ratioPct(reavaliacaoAcima, reavaliacoes),
    permanencia_acima_meta_pct: ratioPct(permanenciaAcima, atendimentos),
    avg_triagem_min: avg(rows.fluxRows, (r) => asNumber(r.MIN_ENTRADA_X_TRIAGEM)),
    avg_consulta_min: avg(rows.fluxRows, (r) => asNumber(r.MIN_ENTRADA_X_CONSULTA)),
    avg_permanencia_min: avg(rows.fluxRows, (r) => asNumber(r.MIN_ENTRADA_X_ALTA)),
    avg_medicacao_min: avg(rows.medRows, (r) => asNumber(r.MINUTOS)),
    avg_rxecg_min: avg(rows.rxRows, (r) => asNumber(r.MINUTOS)),
    avg_tcus_min: avg(rows.tcusRows, (r) => asNumber(r.MINUTOS)),
    avg_reavaliacao_min: avg(rows.reavRows, (r) => asNumber(r.MINUTOS)),
  };
}

function groupRowsByUnit(rows, unitMap, predicate, dateFields, query) {
  const buckets = new Map();
  rows.forEach((r) => {
    if (!predicate(r)) return;
    const d = pickDate(r, dateFields);
    if (!isInPeriod(d, query)) return;
    const id = rowUnitId(r);
    const unit = id ? unitMap.byId.get(String(id)) : unitMap.byName.get(normUpper(rowUnidadeNome(r)));
    if (!unit) return;
    const k = String(unit.unidadeId);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(r);
  });
  return buckets;
}

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
    const ds = await loadGerenciaDatasets();
    const monthsInfo = defaultRollingMonths();
    const rowsByMonthByUnit = {};
    monthsInfo.mesKeys.forEach((k) => {
      rowsByMonthByUnit[k] = {
        fluxRows: groupRowsByUnit(ds.fluxRows, unitMap, pred, ['DATA', 'DT_ENTRADA'], query),
        medRows: groupRowsByUnit(ds.medRows, unitMap, pred, ['DATA', 'DT_PRESCRICAO'], query),
        labRows: groupRowsByUnit(ds.labRows, unitMap, pred, ['DATA', 'DT_SOLICITACAO', 'DT_EXAME'], query),
        rxRows: groupRowsByUnit(ds.rxRows, unitMap, pred, ['DATA', 'DT_SOLICITACAO'], query),
        tcusRows: groupRowsByUnit(ds.tcusRows, unitMap, pred, ['DATA', 'DT_EXAME', 'DT_REALIZADO'], query),
        reavRows: groupRowsByUnit(ds.reavRows, unitMap, pred, ['DATA', 'DT_SOLIC_REAVALIACAO'], query),
        altasRows: groupRowsByUnit(ds.altasRows, unitMap, pred, ['DT_ALTA', 'DT_ENTRADA'], query),
        convRows: groupRowsByUnit(ds.convRows, unitMap, pred, ['DT_ENTRADA', 'DT_ALTA'], query),
      };
    });

    const buildMetricValue = (m, key) => {
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
    };

    const z = emptyMetasMonthCells();
    const data = METAS_POR_VOLUMES_INDICADORES.map((ind) => {
      const item = {
        key: ind.key,
        name: ind.name,
        isReverso: ind.isReverso,
        isP: ind.isP,
        ...emptyMetasMonthCells(),
        subItems: [],
      };
      const unitValues = [];
      units.forEach((u) => {
        const unitRows = {};
        monthsInfo.mesKeys.forEach((k) => {
          const pack = rowsByMonthByUnit[k];
          unitRows[k] = {
            fluxRows: pack.fluxRows.get(String(u.unidadeId)) || [],
            medRows: pack.medRows.get(String(u.unidadeId)) || [],
            labRows: pack.labRows.get(String(u.unidadeId)) || [],
            rxRows: pack.rxRows.get(String(u.unidadeId)) || [],
            tcusRows: pack.tcusRows.get(String(u.unidadeId)) || [],
            reavRows: pack.reavRows.get(String(u.unidadeId)) || [],
            altasRows: pack.altasRows.get(String(u.unidadeId)) || [],
            convRows: pack.convRows.get(String(u.unidadeId)) || [],
          };
        });
        const m1 = reduceMetrics(unitRows[monthsInfo.mesKeys[0]], ds);
        const m2 = reduceMetrics(unitRows[monthsInfo.mesKeys[1]], ds);
        const m3 = reduceMetrics(unitRows[monthsInfo.mesKeys[2]], ds);
        const v1 = buildMetricValue(m1, ind.key);
        const v2 = buildMetricValue(m2, ind.key);
        const v3 = buildMetricValue(m3, ind.key);
        unitValues.push([v1, v2, v3]);
        item.subItems.push({
          unidadeId: u.unidadeId,
          name: labelUnidadePs(u),
          m1: { v: v1, d: 0 },
          m2: { v: v2, d: v2 - v1 },
          m3: { v: v3, d: v3 - v2 },
          t: { v: v3, ytd: v3 - v1, sec: `(${Math.round(v3)})` },
        });
      });
      if (!unitValues.length) return { ...item, ...z };
      const avgForIdx = (i) => unitValues.reduce((a, b) => a + asNumber(b[i]), 0) / unitValues.length;
      const g1 = avgForIdx(0);
      const g2 = avgForIdx(1);
      const g3 = avgForIdx(2);
      item.m1 = { v: g1, d: 0 };
      item.m2 = { v: g2, d: g2 - g1 };
      item.m3 = { v: g3, d: g3 - g2 };
      item.t = { v: g3, ytd: g3 - g1, sec: `(${Math.round(g3)})` };
      return item;
    });

    return {
      months: monthsInfo.months,
      mesKeys: monthsInfo.mesKeys,
      data,
      meta: {
        schemaVersion: 2,
        titulo: 'Metas por volumes',
        filtroUnidades: 'apenas_unidades_com_ps',
        unidadesNoContexto: units.length,
      },
    };
  }

  /**
   * Uma linha por unidade PS com volumes e percentuais (view/Postgres no futuro).
   * Query: ?period=&regional=&unidade=
   */
  async getGerenciaMetricasPorUnidade(query = {}) {
    const allUnits = await loadUnidadesPsFromDb();
    const units = filterUnitsByQuery(allUnits, query);
    const unitMap = unitMetaMap(allUnits);
    const pred = buildRowPredicate(query, unitMap);
    const ds = await loadGerenciaDatasets();

    const fluxByUnit = groupRowsByUnit(ds.fluxRows, unitMap, pred, ['DATA', 'DT_ENTRADA'], query);
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
          desfecho: m.desfecho,
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
    const ds = await loadGerenciaDatasets();
    const rows = {
      fluxRows: ds.fluxRows.filter((r) => pred(r) && isInPeriod(pickDate(r, ['DATA', 'DT_ENTRADA']), query)),
      medRows: ds.medRows.filter((r) => pred(r) && isInPeriod(pickDate(r, ['DATA', 'DT_PRESCRICAO']), query)),
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
    const ds = await loadGerenciaDatasets();
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
          pedido_reavaliacao: avg(reav, (r) => asNumber(r.MINUTOS)),
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
   * Valores zerados até fetchView/Postgres preencher.
   */
  async getGerenciaMetasAcompanhamentoGestao(query = {}) {
    const allUnits = await loadUnidadesPsFromDb();
    const units = filterUnitsByQuery(allUnits, query);
    const unitMap = unitMetaMap(allUnits);
    const pred = buildRowPredicate(query, unitMap);
    const ds = await loadGerenciaDatasets();

    const rawKey = query.metric != null ? String(query.metric) : 'conversao';
    const found = METAS_POR_VOLUMES_INDICADORES.find((x) => x.key === rawKey);
    const indResolved = found || METAS_POR_VOLUMES_INDICADORES[0];
    const metricKey = indResolved.key;
    const cfg = METAS_ACOMP_POR_KEY[metricKey] || { meta: 0 };
    const sense = indResolved.isReverso ? 'low_good' : 'high_good';
    const ribbonCmp = sense === 'low_good' ? '<' : '>';

    const monthKeys = buildRollingMonthKeys(12);
    const months = monthKeys.map(formatMonthPtBr);

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
      const data = monthKeys.map((mk) => {
        const dateInMonth = (r, f) => toMonthKey(pickDate(r, f)) === mk;
        const rows = {
          fluxRows: ds.fluxRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DATA', 'DT_ENTRADA'])),
          medRows: ds.medRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DATA', 'DT_PRESCRICAO'])),
          labRows: ds.labRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DATA', 'DT_SOLICITACAO', 'DT_EXAME'])),
          rxRows: ds.rxRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DATA', 'DT_SOLICITACAO'])),
          tcusRows: ds.tcusRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DATA', 'DT_EXAME', 'DT_REALIZADO'])),
          reavRows: ds.reavRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DATA', 'DT_SOLIC_REAVALIACAO'])),
          altasRows: ds.altasRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DT_ALTA', 'DT_ENTRADA'])),
          convRows: ds.convRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DT_ENTRADA', 'DT_ALTA'])),
        };
        return perMetric(reduceMetrics(rows, ds));
      });
      return {
        unidadeId: u.unidadeId,
        name: labelUnidadePs(u),
        color: METAS_ACOMP_CORES_UNIDADE[idx % METAS_ACOMP_CORES_UNIDADE.length],
        data,
      };
    });

    const globalValues = series.flatMap((s) => s.data).filter((v) => Number.isFinite(v));
    const globalVal = globalValues.length ? globalValues.reduce((a, b) => a + b, 0) / globalValues.length : 0;
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
        schemaVersion: 2,
        filtroUnidades: 'regional_unidade_gerencia',
        demo: false,
      },
    };
  }

  /**
   * % metas conformes por unidade (12 meses) — só filtros globais da tela.
   * Zerado até a view existir no Postgres.
   */
  async getGerenciaMetasConformesPorUnidade(query = {}) {
    const allUnits = await loadUnidadesPsFromDb();
    const units = filterUnitsByQuery(allUnits, query);
    const unitMap = unitMetaMap(allUnits);
    const pred = buildRowPredicate(query, unitMap);
    const ds = await loadGerenciaDatasets();
    const monthKeys = buildRollingMonthKeys(12);
    const months = monthKeys.map(formatMonthPtBr);
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
        const dateInMonth = (r, f) => toMonthKey(pickDate(r, f)) === mk;
        const rows = {
          fluxRows: ds.fluxRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DATA', 'DT_ENTRADA'])),
          medRows: ds.medRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DATA', 'DT_PRESCRICAO'])),
          labRows: ds.labRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DATA', 'DT_SOLICITACAO', 'DT_EXAME'])),
          rxRows: ds.rxRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DATA', 'DT_SOLICITACAO'])),
          tcusRows: ds.tcusRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DATA', 'DT_EXAME', 'DT_REALIZADO'])),
          reavRows: ds.reavRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DATA', 'DT_SOLIC_REAVALIACAO'])),
          altasRows: ds.altasRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DT_ALTA', 'DT_ENTRADA'])),
          convRows: ds.convRows.filter((r) => pred(r) && String(rowUnitId(r) || '') === String(u.unidadeId) && dateInMonth(r, ['DT_ENTRADA', 'DT_ALTA'])),
        };
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
        schemaVersion: 2,
        filtroUnidades: 'regional_unidade_gerencia',
        demo: false,
      },
    };
  }

  /**
   * Drill explícito por indicador (opcional se a view principal não trouxer subItems).
   * Query: ?period=&regional=&unidade=
   */
  async getGerenciaMetasPorVolumesPorIndicador(indicadorKey, filters) {
    const ind = METAS_POR_VOLUMES_INDICADORES.find((x) => x.key === indicadorKey);
    const units = filterUnitsByQuery(await loadUnidadesPsFromDb(), filters || {});
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
