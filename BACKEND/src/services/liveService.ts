// @ts-nocheck â€” domÃ­nio herdado do legado JS; tipar gradualmente se necessÃ¡rio.
/**
 * live_service â€” Camada de API (fina).
 *
 * Dados: db â†’ fetchView (PostgreSQL ou SQLite) â†’ mapeamento leve linhaâ†’JSON â†’ { ok, data }.
 *
 * Evitar aqui: agregaÃ§Ãµes pesadas, joins simulados em JS, laÃ§os sobre fatos
 * brutos muito grandes â€” isso aumenta delay na API.
 */

import {
  attachMetasPorVolumesPorIndicadorUiTones,
  attachMetasPorVolumesUiTones,
} from '../domain/gerencia/metasPorVolumesTones.js';
import { parsePeriodStart, parsePeriodEnd, isInPeriod } from '../domain/shared/period.js';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { cacheGetStale, cacheSetStale } from '../cache/redisMemoryCache.js';
import {
  getGerenciaHotCoverageDays,
  getGerenciaMaxPeriodDays,
  getGerenciaWarmStatus,
  loadGerenciaDatasets,
  ensureGerenciaWarmPlan,
} from '../repositories/gerenciaRepository.js';
import { readRepository } from '../repositories/readRepository.js';
import { domainEventBus } from '../messaging/domainEventBus.js';
import { DomainEvents } from '../domain/messages/events.js';
import { incGerenciaPerf, markGerenciaBundleBuild } from '../observability/gerenciaPerf.js';

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
/** Chave antiga (só nacional) — ainda lida no miss da v2 para migração. */
const GERENCIA_APERITIVO_LEGACY_KEY = 'hospital-bi:gerencia:aperitivo:v1:default';

function normalizeGerenciaQuery(raw = {}) {
  const q = { ...raw };
  const maxPeriod = getGerenciaMaxPeriodDays();
  const pRaw = Number(q.period);
  let requestedPeriod = Number.isFinite(pRaw) && pRaw > 0 ? Math.floor(pRaw) : 1;
  if (requestedPeriod === 366) requestedPeriod = maxPeriod;
  const capped = requestedPeriod > maxPeriod;
  const effectivePeriod = Math.max(1, Math.min(requestedPeriod, maxPeriod));
  q.period = effectivePeriod;
  return {
    q,
    requestedPeriod,
    effectivePeriod,
    capped,
  };
}

function isDefaultGerenciaScope(q = {}) {
  return String(q.regional ?? '').trim() === '' && String(q.unidade ?? '').trim() === '';
}

function normAperitivoSeg(v) {
  const t = String(v ?? '').trim();
  if (!t) return '_';
  const s = t.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 56);
  return s || '_';
}

/** Chave stale do bundle aperitivo (v2) — inclui regional/unidade para hits instantâneos por filtro. */
function aperitivoStaleCacheKey(q = {}) {
  const p = Math.min(60, Math.max(1, Math.floor(Number(q.period) || 1)));
  return `hospital-bi:gerencia:aperitivo:v2:p${p}:r:${normAperitivoSeg(q.regional)}:u:${normAperitivoSeg(q.unidade)}`;
}

/** Chave de cache Redis para bundle completo (>7d) por filtro. */
function gerenciaBundleStaleCacheKey(q = {}) {
  const p = Math.min(60, Math.max(1, Math.floor(Number(q.period) || 1)));
  return `hospital-bi:gerencia:bundle:v1:p${p}:r:${normAperitivoSeg(q.regional)}:u:${normAperitivoSeg(q.unidade)}`;
}

function nationalSevenDayQuery() {
  return { period: 7, regional: '', unidade: '' };
}

async function loadAperitivoCacheByKey(key) {
  try {
    const raw = await cacheGetStale(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.bundle) return null;
    return parsed.bundle;
  } catch {
    return null;
  }
}

async function saveAperitivoCacheByKey(key, bundle) {
  try {
    await cacheSetStale(key, JSON.stringify({ at: new Date().toISOString(), bundle }));
  } catch {
    /* ignore */
  }
}

async function loadGerenciaBundleCacheByKey(key) {
  return loadAperitivoCacheByKey(key);
}

async function saveGerenciaBundleCacheByKey(key, bundle) {
  return saveAperitivoCacheByKey(key, bundle);
}

function readCell(row, ...keys) {
  for (const k of keys) {
    if (row?.[k] != null && String(row[k]).trim() !== '') return row[k];
    const up = String(k).toUpperCase();
    if (row?.[up] != null && String(row[up]).trim() !== '') return row[up];
    const lo = String(k).toLowerCase();
    if (row?.[lo] != null && String(row[lo]).trim() !== '') return row[lo];
  }
  return null;
}

function numCell(row, ...keys) {
  const v = readCell(row, ...keys);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

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

/** Indicadores da matriz â€œMetas por volumesâ€ (alinhado ao modelo Power BI). */
const METAS_POR_VOLUMES_INDICADORES = [
  { key: 'conversao', name: 'ConversÃ£o', isReverso: true, isP: true },
  { key: 'pacs_medicados', name: 'Pacs medicados', isReverso: true, isP: true },
  { key: 'medicacoes_por_paciente', name: 'MedicaÃ§Ãµes por paciente', isReverso: true, isP: false },
  { key: 'pacs_exames_lab', name: 'Pacs c/ exames laboratoriais', isReverso: true, isP: true },
  { key: 'lab_por_paciente', name: 'LaboratÃ³rio por paciente', isReverso: true, isP: false },
  { key: 'pacs_exames_tc', name: 'Pacs c/ exames de TC', isReverso: true, isP: true },
  { key: 'tcs_por_paciente', name: 'TCs por paciente', isReverso: true, isP: false },
  { key: 'triagem_acima_meta', name: 'Triagem acima da meta', isReverso: true, isP: true },
  { key: 'consulta_acima_meta', name: 'Consulta acima da meta', isReverso: true, isP: true },
  { key: 'medicacao_acima_meta', name: 'MedicaÃ§Ã£o acima da meta', isReverso: true, isP: true },
  { key: 'reavaliacao_acima_meta', name: 'ReavaliaÃ§Ã£o acima da meta', isReverso: true, isP: true },
  { key: 'permanencia_acima_meta', name: 'PermanÃªncia acima da meta', isReverso: true, isP: true },
  { key: 'desfecho_medico', name: 'Desfecho do mÃ©dico do atend.', isReverso: false, isP: true },
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

/** Meses (YYYY-MM) que intersectam [parsePeriodStart(query), hoje] â€” alinhado ao filtro 30 / 90 / ano. */
function monthKeysOverlappingQueryPeriod(query = {}) {
  const start = parsePeriodStart(query);
  const end = parsePeriodEnd(query);
  const keys = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= endMonth) {
    keys.push(toMonthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  if (!keys.length) keys.push(toMonthKey(end));
  // ECharts linha/barras precisam de â‰¥2 categorias; com 7 dias no mesmo mÃªs sÃ³ havia 1 chave.
  while (keys.length > 0 && keys.length < 2) {
    const prev = shiftMonthKey(keys[0], -1);
    if (prev === keys[0]) break;
    keys.unshift(prev);
  }
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
    t: { v: 0, ytd: 0, sec: '(â€”)' },
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

/** Desloca YYYY-MM por deltaMonths (ex.: -1 = mÃªs anterior). */
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

/** Meses extras: m-1 do primeiro mÃªs (VAR. da 1Âª coluna) e janeiro do ano do Ãºltimo mÃªs (YTD). */
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
      /** PBI % conversÃ£o: numerador no mÃªs de DT_INTERNACAO (nÃ£o no mÃªs da DATA do atendimento). */
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
 * Agrega os 3 meses da grade num Ãºnico pacote â€” â€œTotalâ€ da matriz (VALOR sintÃ©tico do perÃ­odo).
 * Recalcula razÃµes sobre volumes fundidos (ex.: medicaÃ§Ãµes/paciente â‰  mÃ©dia das taxas mensais).
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
 * Unidades com PS â€” cadastro oficial (cÃ³digo + nome + UF).
 * RÃ³tulo exibido: {codigo} - {unidadeNome}_{regional}. Lista via fetchView (SQLite).
 */
const DEMO_UNIDADES_PS = [
  { codigo: '001', unidadeId: '001', unidadeNome: 'PS HOSPITAL VITÃ“RIA', regional: 'ES' },
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

function parseUnidadeFromOptionLabel(value, label) {
  const unidadeId = String(value ?? '').trim();
  const raw = String(label ?? '').trim();
  let codigo = unidadeId;
  let unidadeNome = raw;
  let regional = '';

  const m = raw.match(/^(\d+)\s*-\s*(.+?)(?:_([A-Za-z]{2}))?$/);
  if (m) {
    codigo = m[1] || unidadeId;
    unidadeNome = String(m[2] || '').trim();
    regional = String(m[3] || '').trim().toUpperCase();
  } else {
    const u = raw.match(/_(\w{2})$/);
    if (u) {
      regional = String(u[1] || '').trim().toUpperCase();
      unidadeNome = raw.replace(/_(\w{2})$/, '').trim();
    }
  }

  return {
    codigo: codigo || unidadeId,
    unidadeId,
    unidadeNome: unidadeNome || unidadeId,
    regional,
  };
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

/**
 * Nome de estado (cadastro) ou UF → sigla de 2 letras, igual ao `value` do Topbar (ES, RJ, DF…).
 * Evita lista de unidades vazia quando `tbl_unidades.uf` vem por extenso.
 */
/** Código IBGE da UF (2 dígitos) → sigla — quando o cadastro guarda "53" em vez de "DF". */
const IBGE_CODIGO_PARA_UF = Object.freeze({
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '18': 'MA',
  '19': 'PI',
  '20': 'CE',
  '21': 'RN',
  '22': 'PB',
  '23': 'PE',
  '24': 'AL',
  '25': 'SE',
  '26': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
});

const NOME_ESTADO_PARA_UF = Object.freeze({
  ACRE: 'AC',
  ALAGOAS: 'AL',
  AMAPA: 'AP',
  AMAZONAS: 'AM',
  BAHIA: 'BA',
  CEARA: 'CE',
  'DISTRITO FEDERAL': 'DF',
  BRASILIA: 'DF',
  'ESPIRITO SANTO': 'ES',
  GOIAS: 'GO',
  MARANHAO: 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  PARA: 'PA',
  PARAIBA: 'PB',
  PARANA: 'PR',
  PERNAMBUCO: 'PE',
  PIAUI: 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  RONDONIA: 'RO',
  RORAIMA: 'RR',
  'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP',
  SERGIPE: 'SE',
  TOCANTINS: 'TO',
});

function normalizeUfRegional(raw) {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.length === 2 && /^[A-Z]{2}$/.test(s)) return s;
  if (/^\d{2}$/.test(s) && IBGE_CODIGO_PARA_UF[s]) return IBGE_CODIGO_PARA_UF[s];
  if (NOME_ESTADO_PARA_UF[s]) return NOME_ESTADO_PARA_UF[s];
  return s;
}

function regionalFilterMatches(unitRegional, queryRegional) {
  if (!queryRegional) return true;
  return normalizeUfRegional(unitRegional) === normalizeUfRegional(queryRegional);
}

/** Lista para filtro do cabeÃ§alho: respeita regional; nÃ£o filtra por unidade (o select precisa de todas da regional). */
function listUnidadesPsParaFiltro(query = {}) {
  let list = [...DEMO_UNIDADES_PS];
  if (query.regional) list = list.filter((u) => regionalFilterMatches(u.regional, query.regional));
  return sortUnidadesPorCodigo(list);
}

/** Unidades no contexto da matriz (regional + opcionalmente uma unidade sÃ³). */
function filterUnidadesPsMatriz(query = {}) {
  let list = [...DEMO_UNIDADES_PS];
  if (query.regional) list = list.filter((u) => regionalFilterMatches(u.regional, query.regional));
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

function metasPorVolumesMatrixForQuery(query = {}, unitsOverride?: Array<{ unidadeId?: unknown }>) {
  const { months, mesKeys } = defaultRollingMonths();
  const units =
    Array.isArray(unitsOverride) && unitsOverride.length > 0 ? unitsOverride : filterUnidadesPsMatriz(query);
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
 * Colunas da grade â€œindicadores por unidadeâ€ (PS) â€” alinhado ao painel do BI.
 * kind: int | pct | decimal | text
 *
 * pctSense (sÃ³ kind pct): como interpretar % para verde/vermelho na UI.
 * - high_good: quanto maior, melhor â†’ verde se valor >= pctGreenAt; vermelho se valor <= pctRedAt
 * - low_good: quanto menor, melhor â†’ verde se valor <= pctGreenAt; vermelho se valor >= pctRedAt
 * Sem pctSense / sem limiares: sÃ³ negrito neutro (evita generalizar 80/40).
 * Limiares sÃ£o metas de referÃªncia atÃ© a rÃ©plica SQLite devolver valores por perÃ­odo.
 */
const METRICAS_POR_UNIDADE_COLUNAS = [
  { key: 'atendimentos', label: 'Atendimentos', kind: 'int' },
  { key: 'altas', label: 'Altas', kind: 'int' },
  { key: 'obitos', label: 'Ã“bitos', kind: 'int' },
  { key: 'pct_evasao', label: '% EvasÃ£o', kind: 'pct', pctSense: 'low_good', pctGreenAt: 8, pctRedAt: 22 },
  {
    key: 'pct_desfecho_sobre_altas',
    label: '% desfecho mÃ©dico (s/ altas)',
    kind: 'pct',
    pctSense: 'high_good',
    pctGreenAt: 82,
    pctRedAt: 58,
  },
  {
    key: 'pct_desfecho_medico',
    label: '% desfecho do mÃ©dico do atend.',
    kind: 'pct',
    pctSense: 'high_good',
    pctGreenAt: 82,
    pctRedAt: 58,
  },
  { key: 'saidas', label: 'SaÃ­das', kind: 'int' },
  { key: 'internacoes', label: 'InternaÃ§Ãµes', kind: 'int' },
  { key: 'pct_conversao', label: '% ConversÃ£o', kind: 'pct', pctSense: 'high_good', pctGreenAt: 12, pctRedAt: 4 },
  { key: 'pct_reavaliacao', label: '% ReavaliaÃ§Ã£o', kind: 'pct', pctSense: 'high_good', pctGreenAt: 22, pctRedAt: 8 },
  {
    key: 'pct_pacientes_medicados',
    label: '% pacientes medicados',
    kind: 'pct',
    pctSense: 'high_good',
    pctGreenAt: 88,
    pctRedAt: 68,
  },
  { key: 'media_medicacoes_por_pac', label: 'MÃ©dia medicaÃ§Ãµes por pac', kind: 'decimal' },
  {
    key: 'pct_medicacoes_rapidas',
    label: '% medicaÃ§Ãµes rÃ¡pidas',
    kind: 'pct',
    pctSense: 'high_good',
    pctGreenAt: 72,
    pctRedAt: 42,
  },
  { key: 'pct_pacientes_lab', label: '% pacientes com laboratÃ³rio', kind: 'pct', pctSense: 'high_good', pctGreenAt: 55, pctRedAt: 28 },
  { key: 'media_lab_por_pac', label: 'MÃ©dia laborat./pac', kind: 'decimal' },
  { key: 'pct_pacientes_rx', label: '% pacientes com RX', kind: 'pct', pctSense: 'high_good', pctGreenAt: 48, pctRedAt: 22 },
  { key: 'pct_pacientes_ecg', label: '% pacientes com ECG', kind: 'pct', pctSense: 'high_good', pctGreenAt: 32, pctRedAt: 14 },
  { key: 'pct_pacientes_tc', label: '% pacientes com TC', kind: 'pct', pctSense: 'high_good', pctGreenAt: 22, pctRedAt: 8 },
  { key: 'media_tcs_por_pac', label: 'MÃ©dia TCs/pac', kind: 'decimal' },
  { key: 'pct_pacientes_us', label: '% pacientes com US', kind: 'pct', pctSense: 'high_good', pctGreenAt: 28, pctRedAt: 10 },
];

function emptyMetricasPorUnidadeValores() {
  const valores = {};
  METRICAS_POR_UNIDADE_COLUNAS.forEach((c) => {
    valores[c.key] = c.kind === 'text' ? '' : 0;
  });
  return valores;
}

function metricasPorUnidadeForQuery(query = {}, unitsOverride?: Array<{ unidadeId?: unknown }>) {
  const units =
    Array.isArray(unitsOverride) && unitsOverride.length > 0 ? unitsOverride : filterUnidadesPsMatriz(query);
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
 * Faixa de totais consolidados (mesmas dimensÃµes da grade por unidade, valores absolutos).
 * Query: ?period=&regional=&unidade= â€” agregaÃ§Ã£o conforme dados na rÃ©plica.
 */
const GERENCIA_TOTAIS_PS_DEF = [
  { key: 'atendimentos', label: 'Atendimentos' },
  { key: 'altas', label: 'Altas' },
  { key: 'obitos', label: 'Ã“bitos' },
  { key: 'evasoes', label: 'EvasÃµes' },
  { key: 'desfecho', label: 'Desfecho' },
  { key: 'desfecho_medico', label: 'Desfecho mÃ©dico do atend.' },
  { key: 'saidas', label: 'SaÃ­das' },
  { key: 'internacoes', label: 'InternaÃ§Ãµes' },
  { key: 'conversoes', label: 'ConversÃµes' },
  { key: 'reavaliacoes', label: 'ReavaliaÃ§Ãµes' },
  { key: 'pacientes_medicados', label: 'Pacientes medicados' },
  { key: 'medicacoes', label: 'MedicaÃ§Ãµes' },
  { key: 'medicacoes_rapidas', label: 'MedicaÃ§Ãµes rÃ¡pidas' },
  { key: 'pacientes_lab', label: 'Pacientes c/ laboratÃ³rio' },
  { key: 'exames_lab', label: 'Exames laboratÃ³rio' },
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
 * Jornada: tempo mÃ©dio por etapa (min) â€” colunas alinhadas ao BI.
 * columnBg: cor do destaque sÃ³ quando valor > slaMaxMinutos (fora da meta). Na meta = visual neutro.
 * slaMaxMinutos: null atÃ© dados ou configuraÃ§Ã£o definirem o SLA (min). Com null, nÃ£o hÃ¡ destaque.
 */
const TEMPO_MEDIO_ETAPAS_COLS = [
  { key: 'totem_triagem', label: 'Totem â†’ Triagem', icons: ['Ticket', 'Megaphone'], columnBg: null, slaMaxMinutos: null },
  { key: 'totem_consulta', label: 'Totem â†’ Consulta', icons: ['Ticket', 'Stethoscope'], columnBg: null, slaMaxMinutos: null },
  { key: 'presc_medicacao', label: 'PrescriÃ§Ã£o â†’ MedicaÃ§Ã£o', icons: ['ClipboardList', 'Pill'], columnBg: null, slaMaxMinutos: null },
  {
    key: 'presc_rx_ecg',
    label: 'PrescriÃ§Ã£o â†’ RevisÃ£o (ExecuÃ§Ã£o)',
    icons: ['ClipboardList', 'ScanLine'],
    columnBg: null,
    slaMaxMinutos: null,
  },
  {
    key: 'presc_tc_us',
    label: 'PrescriÃ§Ã£o â†’ TC/US (Laudo)',
    icons: ['ClipboardList', 'Scan'],
    columnBg: 'blue',
    slaMaxMinutos: null,
  },
  {
    key: 'pedido_reavaliacao',
    label: 'Pedido â†’ ReavaliaÃ§Ã£o',
    icons: ['PencilLine', 'RefreshCw'],
    columnBg: 'green',
    slaMaxMinutos: null,
  },
  { key: 'permanencia_total', label: 'PermanÃªncia total', icons: ['Building2', 'Clock'], columnBg: null, slaMaxMinutos: null },
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
    titulo: 'Tempo mÃ©dio por etapa (min)',
    etapas: TEMPO_MEDIO_ETAPAS_COLS,
    filtroUnidadeOpcoes: [{ value: '', label: 'Todas' }],
    linhas,
    totais,
    meta: { schemaVersion: 1 },
  };
}

function cloneGerenciaBundleJson(bundle) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(bundle);
  } catch {
    /* ignore */
  }
  return JSON.parse(JSON.stringify(bundle));
}

function unitIdNormForSlice(id) {
  const s = String(id ?? '').trim();
  if (!s) return '';
  const n = parseInt(s, 10);
  if (!Number.isNaN(n)) return String(n).padStart(3, '0');
  return s.padStart(3, '0');
}

/** Eco dos filtros pedidos — deve coincidir com o URL; o wrap do resolver sobrescreve o JSON em cache para evitar desalinhamento com regional/unidade. */
function queryEchoFromGerenciaQuery(q: Record<string, unknown> = {}) {
  const pRaw = q.period;
  const period = pRaw != null && String(pRaw).trim() !== '' ? String(pRaw).trim() : '7';
  const regional = q.regional != null && String(q.regional).trim() !== '' ? String(q.regional).trim() : '';
  const unidade = q.unidade != null && String(q.unidade).trim() !== '' ? String(q.unidade).trim() : '';
  return { period, regional, unidade };
}

function rollupMetasPorVolumesRowAfterSubFilter(row) {
  const subs = row.subItems || [];
  if (!subs.length) {
    row.m1 = { v: 0, d: 0 };
    row.m2 = { v: 0, d: 0 };
    row.m3 = { v: 0, d: 0 };
    row.t = { v: 0, ytd: 0, sec: '(0)' };
    return;
  }
  const sum = (fn) => subs.reduce((a, s) => a + asNumber(fn(s)), 0);
  const v1 = sum((s) => s.m1?.v);
  const v2 = sum((s) => s.m2?.v);
  const v3 = sum((s) => s.m3?.v);
  row.m1 = { v: v1, d: 0 };
  row.m2 = { v: v2, d: v2 - v1 };
  row.m3 = { v: v3, d: v3 - v2 };
  row.t = { v: v3, ytd: v3, sec: `(${v3})` };
}

function recomputeTotaisPsFromMetricasLinhas(linhas, prevMeta) {
  const keys = GERENCIA_TOTAIS_PS_DEF.map((d) => d.key);
  const sums = {};
  keys.forEach((k) => {
    sums[k] = 0;
  });
  for (const line of linhas || []) {
    const v = line.valores || {};
    keys.forEach((k) => {
      const n = Number(v[k]);
      if (Number.isFinite(n)) sums[k] += n;
    });
  }
  return {
    cards: GERENCIA_TOTAIS_PS_DEF.map(({ key, label }) => ({
      key,
      label,
      value: asNumber(sums[key]),
      format: 'int',
    })),
    meta: prevMeta && typeof prevMeta === 'object' ? { ...prevMeta } : { schemaVersion: 2, titulo: 'Totais PS (filtro atual)' },
  };
}

function recomputeTempoTotaisFromLinhas(linhas) {
  const tot = valoresTempoMedioZerados();
  const keys = TEMPO_MEDIO_ETAPAS_COLS.map((c) => c.key);
  const list = linhas || [];
  keys.forEach((k) => {
    let s = 0;
    let n = 0;
    list.forEach((L) => {
      const v = asNumber(L.valores?.[k]);
      if (Number.isFinite(v)) {
        s += v;
        n += 1;
      }
    });
    tot[k] = n ? Math.round(s / n) : 0;
  });
  return tot;
}

/**
 * Recorta bundle nacional (todas as unidades no payload) para o filtro regional/unidade — só JS, sem DuckDB.
 * @param unitsFromCadastro — resultado de `filterUnitsByQuery(loadUnidadesPsFromDb(), q)`; sem isto usa só DEMO e os IDs raramente batem com `metricasPorUnidade` real → slice falhava e o front ficava sem payload válido.
 */
function sliceGerenciaBundleForQuery(
  baseBundle: Record<string, unknown>,
  q: Record<string, unknown>,
  unitsFromCadastro?: Array<{ unidadeId?: unknown }>,
) {
  if (!baseBundle || baseBundle.schemaVersion !== 1) return null;
  const unitsInScope =
    Array.isArray(unitsFromCadastro) && unitsFromCadastro.length > 0
      ? sortUnidadesPorCodigo([...unitsFromCadastro])
      : filterUnidadesPsMatriz(q);
  if (!unitsInScope?.length) return null;
  const idSet = new Set(unitsInScope.map((u) => unitIdNormForSlice(u.unidadeId)));
  const keepLine = (row) => row && idSet.has(unitIdNormForSlice(row.unidadeId));

  const b = cloneGerenciaBundleJson(baseBundle);

  if (b.metricasPorUnidade?.linhas) {
    b.metricasPorUnidade.linhas = b.metricasPorUnidade.linhas.filter(keepLine);
  }
  /** Linhas vazias após filtro: ainda devolve bundle (totais zerados) em vez de null — evita cair só em cache com eco errado no cliente. */
  if (!b.metricasPorUnidade?.linhas) b.metricasPorUnidade = { ...(b.metricasPorUnidade as object), linhas: [] };

  b.totaisPs = recomputeTotaisPsFromMetricasLinhas(b.metricasPorUnidade.linhas, b.totaisPs?.meta);

  if (b.tempoMedioEtapas?.linhas) {
    b.tempoMedioEtapas.linhas = b.tempoMedioEtapas.linhas.filter(keepLine);
    b.tempoMedioEtapas.totais = recomputeTempoTotaisFromLinhas(b.tempoMedioEtapas.linhas);
  }
  const unitsOptions = listUnidadesPsParaFiltro(q);
  if (b.tempoMedioEtapas) {
    b.tempoMedioEtapas.filtroUnidadeOpcoes = [
      { value: '', label: 'Todas' },
      ...unitsOptions.map((u) => ({ value: u.unidadeId, label: labelUnidadePs(u) })),
    ];
  }

  if (b.metasPorVolumes?.data) {
    b.metasPorVolumes.data.forEach((row) => {
      if (!row.subItems) return;
      row.subItems = row.subItems.filter((s) => idSet.has(unitIdNormForSlice(s.unidadeId)));
      rollupMetasPorVolumesRowAfterSubFilter(row);
    });
  }

  if (b.metasConformesPorUnidade?.series) {
    b.metasConformesPorUnidade.series = b.metasConformesPorUnidade.series.filter(keepLine);
  }

  if (b.metasAcompanhamentoByMetric && typeof b.metasAcompanhamentoByMetric === 'object') {
    Object.keys(b.metasAcompanhamentoByMetric).forEach((mk) => {
      const block = b.metasAcompanhamentoByMetric[mk];
      if (!block?.series) return;
      block.series = block.series.filter(keepLine);
      const flat = block.series.flatMap((s) => s.data || []);
      if (block.gauge && flat.length) {
        block.gauge.value = flat.reduce((a, x) => a + asNumber(x), 0) / flat.length;
      }
    });
  }

  b.unidadesPs = {
    options: unitsOptions.map((u) => ({ value: u.unidadeId, label: labelUnidadePs(u) })),
    meta: b.unidadesPs?.meta || { schemaVersion: 1 },
  };

  b.queryEcho = queryEchoFromGerenciaQuery(q);

  return b;
}

/** Labels fixos abr/25 â€¦ mar/26 (alinhado ao painel de referÃªncia). */
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

/** Cor estÃ¡vel por Ã­ndice da unidade (legenda = mesma cor da linha). */
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
 * Meta de referÃªncia por mÃ©trica (faixa de ribbon / gauge atÃ© a rÃ©plica preencher valores).
 * sense: derivado de isReverso â€” low_good = quanto menor melhor; high_good = quanto maior melhor.
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

function nKey(...parts) {
  return parts
    .map((p) => String(p ?? '').trim())
    .filter((s) => s !== '')
    .join('|');
}

function distinctCountBy(rows, keyFn) {
  const s = new Set();
  rows.forEach((r) => {
    const k = String(keyFn(r) ?? '').trim();
    if (!k) return;
    s.add(k);
  });
  return s.size;
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
}

function ratioPct(num, den) {
  if (!den) return 0;
  return (num / den) * 100;
}

/** Power BI: fluxo[DESTINO] = "Internado" (case-insensitive). Export CSV pode usar DESFECHO no mesmo papel. */
function isDestinoInternadoPbi(r) {
  const v = String(firstNonEmpty(r?.DESTINO, r?.DESFECHO) ?? '').trim();
  return v.toLowerCase() === 'internado';
}

/** CD_MATERIAL excluÃ­dos em `Media medicacoes por pac` (Medidas.tmdl). */
const PBI_VIAS_EXCLUDE_CD_MATERIAL = new Set([84278, 84288, 84153, 84271]);

/**
 * Power BI: % desfecho â€” DISTINCTCOUNT onde DT_DESFECHO preenchido e MEDICO_DESFECHO = MEDICO_ATENDIMENTO.
 */
function desfechoMedicoAtendDistinctCountPbi(fluxRows) {
  const s = new Set();
  fluxRows.forEach((r) => {
    if (!pickDate(r, ['DT_DESFECHO'])) return;
    const md = normUpper(firstNonEmpty(r.MEDICO_DESFECHO, r.MEDICO_ALTA, r.MEDICO_AUDITORIA));
    const ma = normUpper(firstNonEmpty(r.MEDICO_ATENDIMENTO, r.MEDICO_ALTA, r.MEDICO_AUDITORIA));
    if (!md || !ma || md !== ma) return;
    const atendimentoKey = nKey(r.NR_ATENDIMENTO, r.NR_ATENDIMENTO_URG, r.NR_ATENDIMENTO_INT);
    if (!atendimentoKey) return;
    s.add(atendimentoKey);
  });
  return s.size;
}

/**
 * Power BI: DATEDIFF(DT_SOLIC_REAVALIACAO, referÃªncia, MINUTE) em `% Atend > Tempo reavaliacao (0)`.
 * ReferÃªncia = menor nÃ£o-nula entre DT_EVO_PRESC e DT_FIM_REAVALIACAO (lÃ³gica SWITCH do DAX).
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
    const nr = nKey(r.NR_ATENDIMENTO, r.NR_ATENDIMENTO_URG, r.NR_ATENDIMENTO_INT);
    if (!nr) return;
    if (!byNr.has(nr)) byNr.set(nr, new Set());
    const presc = firstNonEmpty(r.NR_PRESCRICAO, r.NR_SEQ_MAT_CPOE, r.CD_MATERIAL);
    byNr.get(nr).add(`${presc}|${cd}`);
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

function getRowValIgnoreCase(row, name) {
  if (!row || typeof row !== 'object') return undefined;
  const t = String(name).toLowerCase();
  for (const [k, v] of Object.entries(row)) {
    if (String(k).toLowerCase() === t) return v;
  }
  return undefined;
}

/** Primeiro valor não vazio entre colunas alternativas (cadastro varia por origem CSV/PBI). */
function pickFirstNonEmptyField(row, names) {
  for (const n of names) {
    const v = getRowValIgnoreCase(row, n);
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s !== '') return s;
  }
  return '';
}

/** Postgres / PBI: coluna ps pode ser boolean, 0/1, 't'/'f', 'S'/'N', etc. */
function rowIsPsAtivo(r) {
  if (!r || typeof r !== 'object') return true;
  let v = getRowValIgnoreCase(r, 'ps');
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
    for (const alt of ['tem_ps', 'fl_ps', 'ind_ps', 'ps_ativo']) {
      const a = getRowValIgnoreCase(r, alt);
      if (a !== undefined && a !== null && !(typeof a === 'string' && a.trim() === '')) {
        v = a;
        break;
      }
    }
  }
  if (v == null) return true;
  if (v === true || v === 1) return true;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === 't' || s === '1' || s === 's' || s === 'sim' || s === 'yes') return true;
  return false;
}

/** Sem cache em memória no Node: lista de unidades vem direto da fonte/camada de dados. */

/** UF / estado: nomes de coluna comuns em exports PBI e cadastros legados. */
function pickRawUfFromCadastroRow(r) {
  return pickFirstNonEmptyField(r, [
    'uf',
    'sigla_uf',
    'sg_uf',
    'uf_sigla',
    'estado',
    'sg_estado',
    'nome_uf',
    'cd_uf',
    'codigo_uf',
    'cod_uf',
    'cod_uf_ibge',
    'ibge_uf',
  ]);
}

function pickCdEstabelecimentoFromCadastroRow(r) {
  const s = pickFirstNonEmptyField(r, [
    'cd_estabelecimento',
    'cd_estab_urg',
    'cd_estab',
    'cd_unidade',
    'id',
  ]);
  return s;
}

function pickNomeUnidadeFromCadastroRow(r) {
  const s = pickFirstNonEmptyField(r, ['nome', 'nome_fantasia', 'nm_estabelecimento', 'unidade', 'descricao']);
  return s;
}

async function loadUnidadesPsFromDbUncached() {
  const candidates = ['tbl_unidades', 'tbl_unidades_teste', 'tbl_unidades_prod'];
  for (const table of candidates) {
    /** `SELECT *` evita falha quando o CSV não tem exatamente id/nome/uf/ps com esses nomes. */
    const rows = await readRepository.safeView(table, { columns: '*' });
    if (!rows.length) continue;
    const mapped = rows
      .filter((r) => rowIsPsAtivo(r))
      .map((r) => {
        const rawUf = pickRawUfFromCadastroRow(r);
        const cd = pickCdEstabelecimentoFromCadastroRow(r);
        const nome = pickNomeUnidadeFromCadastroRow(r) || String(getRowValIgnoreCase(r, 'id') ?? '').trim();
        const regNorm = normalizeUfRegional(rawUf);
        const regional = regNorm || (rawUf ? String(rawUf).trim().toUpperCase() : '');
        return {
          codigo: cd,
          unidadeId: cd,
          unidadeNome: nome,
          regional,
        };
      })
      .filter((u) => u.unidadeId);
    if (mapped.length) return sortUnidadesPorCodigo(mapped);
  }
  return sortUnidadesPorCodigo(DEMO_UNIDADES_PS);
}

/** Tempo máx. a aguardar `ps_resumo` no aperitivo lite (ms) — omissão curta para não bloquear a UX. */
function gerenciaLiteSnapshotCapMs() {
  const n = Number(process.env.GERENCIA_LITE_SNAPSHOT_MS ?? '450');
  return Number.isFinite(n) && n >= 80 ? Math.min(Math.floor(n), 5000) : 450;
}

/** Resolve `promise` ou `[]` após `ms` (snapshot opcional não pode segurar o primeiro paint). */
function snapshotRowsOrEmpty(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve([]), ms);
    }),
  ]);
}

async function loadUnidadesPsFromDb() {
  return loadUnidadesPsFromDbUncached();
}

async function loadUnidadesPsFromAperitivoCache(query = {}) {
  try {
    const natKey = aperitivoStaleCacheKey(nationalSevenDayQuery());
    let nat = await loadAperitivoCacheByKey(natKey);
    if (!nat) nat = await loadAperitivoCacheByKey(GERENCIA_APERITIVO_LEGACY_KEY);
    const opts = Array.isArray(nat?.unidadesPs?.options) ? nat.unidadesPs.options : [];
    if (!opts.length) return [];
    const mapped = opts
      .map((o) => parseUnidadeFromOptionLabel(o?.value, o?.label))
      .filter((u) => String(u.unidadeId || '').trim() !== '');
    if (!mapped.length) return [];
    return filterUnitsByQuery(mapped, query);
  } catch {
    return [];
  }
}

function filterUnitsByQuery(units, query = {}) {
  let out = [...units];
  if (query.regional) out = out.filter((u) => regionalFilterMatches(u.regional, query.regional));
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

/** Chaves equivalentes para cruzar fact (CD numÃ©rico) com cadastro (ex.: 1 vs 001). */
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

/** Resolve linha factual â†’ meta da unidade (id com zeros ou sÃ³ nome). */
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
 * Linhas por unidade e mÃªs (eixo DATA no fluxo) + slice de internaÃ§Ã£o no mÃªs (PBI % conversÃ£o).
 * Usado nos grÃ¡ficos de 12 meses (acompanhamento / % conformes).
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

function metaLimitRowsByKey(rows, keyText, fallback) {
  const found = rows.find((r) => containsAny(r.CHAVE, [keyText]));
  return asNumber(found?.VALOR_MIN) || fallback;
}

function reduceMetrics(rows, ctx) {
  const fluxRows = rows.fluxRows || [];
  const fluxRowCount = fluxRows.length;
  const atendimentosDistinct = distinctCountBy(fluxRows, (r) =>
    nKey(r.NR_ATENDIMENTO, r.NR_ATENDIMENTO_URG, r.NR_ATENDIMENTO_INT),
  );
  const atendimentos = atendimentosDistinct || fluxRowCount;
  const altas = rows.altasRows.length;
  const obitos = rows.altasRows.filter((r) => containsAny(r.TIPO_DESFECHO || r.DS_MOTIVO_ALTA, ['OBITO'])).length;
  const evasoes = rows.altasRows.filter((r) => containsAny(r.TIPO_DESFECHO || r.DS_MOTIVO_ALTA, ['EVADI', 'EVAS'])).length;
  /** PBI: COUNT internados no contexto de mÃªs de internaÃ§Ã£o (sÃ©rie) ou fluxo com DESTINO no mesmo slice (perÃ­odo Ãºnico). */
  const internadosFluxCount =
    rows.fluxInternacaoMesRows != null
      ? rows.fluxInternacaoMesRows.length
      : fluxRows.filter(isDestinoInternadoPbi).length;
  const internacoes = internadosFluxCount;
  const conversoesDistinct = distinctCountBy(rows.convRows, (r) =>
    nKey(r.NR_ATENDIMENTO_URG, r.NR_ATENDIMENTO_INT, r.NR_ATEND_ALTA),
  );
  const conversoes = conversoesDistinct || rows.convRows.length;
  const saidas = altas + evasoes + obitos;
  const reavaliacoesDistinct = distinctCountBy(rows.reavRows, (r) =>
    nKey(r.NR_ATENDIMENTO, r.NR_ATENDIMENTO_URG, r.NR_ATENDIMENTO_INT),
  );
  const reavaliacoes = reavaliacoesDistinct || rows.reavRows.length;

  const viasRows = rows.viasRows || [];
  const pacientesMedicadosViasDistinct = distinctCountBy(viasRows, (r) =>
    nKey(r.NR_ATENDIMENTO, r.NR_ATENDIMENTO_URG, r.NR_ATENDIMENTO_INT),
  );
  const pacientesMedicadosMedDistinct = distinctCountBy(rows.medRows, (r) =>
    nKey(r.NR_ATENDIMENTO, r.NR_ATENDIMENTO_URG, r.NR_ATENDIMENTO_INT),
  );
  const pacientesMedicadosVias = pacientesMedicadosViasDistinct || viasRows.length;
  const pacientesMedicadosMed = pacientesMedicadosMedDistinct || rows.medRows.length;
  const pacientesMedicados = viasRows.length ? pacientesMedicadosVias : pacientesMedicadosMed;

  const medicacoes = rows.medRows.length;
  const pacientesLabDistinct = distinctCountBy(rows.labRows, (r) =>
    nKey(r.NR_ATENDIMENTO, r.NR_ATENDIMENTO_URG, r.NR_ATENDIMENTO_INT),
  );
  const pacientesLab = pacientesLabDistinct || rows.labRows.length;
  const examesLab = rows.labRows.length;
  const rxRows = rows.rxRows.filter((r) => containsAny(r.TIPO || r.EXAME, ['RX']));
  const ecgRows = rows.rxRows.filter((r) => containsAny(r.TIPO || r.EXAME, ['ECG']));
  const pacientesRxDistinct = distinctCountBy(rxRows, (r) =>
    nKey(r.NR_ATENDIMENTO, r.NR_ATENDIMENTO_URG, r.NR_ATENDIMENTO_INT),
  );
  const pacientesEcgDistinct = distinctCountBy(ecgRows, (r) =>
    nKey(r.NR_ATENDIMENTO, r.NR_ATENDIMENTO_URG, r.NR_ATENDIMENTO_INT),
  );
  const pacientesRx = pacientesRxDistinct || rxRows.length;
  const pacientesEcg = pacientesEcgDistinct || ecgRows.length;
  const tcRows = rows.tcusRows.filter((r) => containsAny(r.TIPO || r.EXAME, ['TC', 'TOMO']));
  const usRows = rows.tcusRows.filter((r) => containsAny(r.TIPO || r.EXAME, ['US', 'ULTRA']));
  const pacientesTcDistinct = distinctCountBy(tcRows, (r) =>
    nKey(r.NR_ATENDIMENTO, r.NR_ATENDIMENTO_URG, r.NR_ATENDIMENTO_INT),
  );
  const pacientesUsDistinct = distinctCountBy(usRows, (r) =>
    nKey(r.NR_ATENDIMENTO, r.NR_ATENDIMENTO_URG, r.NR_ATENDIMENTO_INT),
  );
  const pacientesTc = pacientesTcDistinct || tcRows.length;
  const pacientesUs = pacientesUsDistinct || usRows.length;
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

  /** Ref. â€œmedicaÃ§Ãµes/pacienteâ€: linhas Vias (PBI) ou fallback prescriÃ§Ãµes. */
  const medicacoes_ref_linhas = viasRows.length ? viasRows.length : medicacoes;

  /** Ref. matriz â€” alinhado aos denominadores PBI `(0)`. */
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
 * Agrupa por unidade restringindo ao mÃªs yyyy-mm.
 * `applyPeriodClip`: meses da sÃ©rie principal â€” tambÃ©m exige isInPeriod (filtro do topo).
 * Chaves de apoio (mÃªs anterior / jan) usam applyPeriodClip=false para VAR e YTD coerentes.
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
  if (!dd && !nn) return '(â€”)';
  if (!dd) return `(${nn})`;
  return `(${nn}/${dd})`;
}

/** Texto (ref.) por indicador, a partir de um `reduceMetrics` (ex.: janela 3 meses fundida). */
function metasPorVolumesRefSec(m, key) {
  if (!m) return '(â€”)';
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

/** (ref.) na linha pai = soma dos pares n/d de cada unidade (mesmo critÃ©rio da coluna Valor sintÃ©tica). */
function metasPorVolumesRefSecParent(unitSynthMs, key) {
  if (!unitSynthMs?.length) return '(â€”)';
  let n = 0;
  let d = 0;
  unitSynthMs.forEach((m) => {
    const p = pairForMetasPorVolumesRefAgg(m, key);
    n += p[0];
    d += p[1];
  });
  return fmtMetasPorVolumesRefPair(n, d);
}

/** (ref.) de um mÃªs agregando todas as unidades â€” soma dos pares n/d de cada unidade naquele mÃªs. */
function metasPorVolumesRefSecMonthAllUnits(rowsByMonthByUnit, monthKey, unitIds, ds, key) {
  if (!unitIds?.length) return '(â€”)';
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
    const cmp = ind.isReverso ? 'â‰¤' : 'â‰¥';
    const titulo = ind.isReverso
      ? `Meta: ${cmp} ${v}% (quanto menor, melhor)`
      : `Meta: ${cmp} ${v}% (quanto maior, melhor)`;
    return { texto: `${cmp} ${v}%`, titulo };
  }
  return {
    texto: `â‰¤ ${v}`,
    titulo: `Meta: â‰¤ ${v} (quanto menor, melhor)`,
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
    titulo: 'Metas de acompanhamento da gestÃ£o',
    catalog: METAS_POR_VOLUMES_INDICADORES.map((x) => ({
      key: x.key,
      label: x.name,
      isP: x.isP,
      isReverso: x.isReverso,
    })),
    selectedKey: metricKey,
    gauge: {
      title: `${indResolved.name} global no perÃ­odo`,
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

/** TendÃªncia global % metas conformes por unidade â€” conforme dados na rÃ©plica. */
function metasConformesPorUnidadeForQuery(query = {}, unitsOverride?: Array<{ unidadeId?: unknown }>) {
  const units =
    Array.isArray(unitsOverride) && unitsOverride.length > 0 ? unitsOverride : filterUnidadesPsMatriz(query);
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

/** Valor numérico de uma métrica a partir do objeto agregado `reduceMetrics` (Metas acompanhamento). */
function metasAcompPickMetric(m: Record<string, unknown>, metricKey: string): number {
  switch (metricKey) {
    case 'conversao':
      return asNumber(m.pct_conversao);
    case 'pacs_medicados':
      return asNumber(m.pct_pacientes_medicados);
    case 'medicacoes_por_paciente':
      return asNumber(m.media_medicacoes_por_pac);
    case 'pacs_exames_lab':
      return asNumber(m.pct_pacientes_lab);
    case 'lab_por_paciente':
      return asNumber(m.media_lab_por_pac);
    case 'pacs_exames_tc':
      return asNumber(m.pct_pacientes_tc);
    case 'tcs_por_paciente':
      return asNumber(m.media_tcs_por_pac);
    case 'triagem_acima_meta':
      return asNumber(m.triagem_acima_meta_pct);
    case 'consulta_acima_meta':
      return asNumber(m.consulta_acima_meta_pct);
    case 'medicacao_acima_meta':
      return asNumber(m.medicacao_acima_meta_pct);
    case 'reavaliacao_acima_meta':
      return asNumber(m.reavaliacao_acima_meta_pct);
    case 'permanencia_acima_meta':
      return asNumber(m.permanencia_acima_meta_pct);
    case 'desfecho_medico':
      return asNumber(m.pct_desfecho_medico);
    default:
      return 0;
  }
}

/**
 * Todas as séries "Metas de acompanhamento" num único passe sobre o dataset —
 * evita N× reduceMetrics/buildMonthlyGerenciaRowPack no bundle (ganho vs. Power BI em tempo de resposta).
 */
async function buildMetasAcompanhamentoByMetricAll(query: Record<string, unknown> = {}) {
  const allUnits = await loadUnidadesPsFromDb();
  const units = filterUnitsByQuery(allUnits, query);
  const unitMap = unitMetaMap(allUnits);
  const pred = buildRowPredicate(query, unitMap);
  const ds = await loadGerenciaDatasets(query);
  const monthKeys = monthKeysOverlappingQueryPeriod(query);
  const months = monthsLabelsFromKeys(monthKeys);

  const cellM = units.map((u) =>
    monthKeys.map((mk) => reduceMetrics(buildMonthlyGerenciaRowPack(ds, pred, unitMap, u.unidadeId, mk, query), ds)),
  );
  const periodM = units.map((u) =>
    reduceMetrics(mergeGerenciaMonthlyRowPacks(ds, pred, unitMap, u.unidadeId, monthKeys, query), ds),
  );

  const catalog = METAS_POR_VOLUMES_INDICADORES.map((x) => ({
    key: x.key,
    label: x.name,
    isP: x.isP,
    isReverso: x.isReverso,
  }));

  const out: Record<string, unknown> = {};
  for (let i = 0; i < METAS_POR_VOLUMES_INDICADORES.length; i += 1) {
    const indResolved = METAS_POR_VOLUMES_INDICADORES[i];
    const metricKey = indResolved.key;
    const cfg = METAS_ACOMP_POR_KEY[metricKey as keyof typeof METAS_ACOMP_POR_KEY] || { meta: 0 };
    const sense = indResolved.isReverso ? 'low_good' : 'high_good';
    const ribbonCmp = sense === 'low_good' ? '<' : '>';
    const series = units.map((u, ui) => ({
      unidadeId: u.unidadeId,
      name: labelUnidadePs(u),
      color: METAS_ACOMP_CORES_UNIDADE[ui % METAS_ACOMP_CORES_UNIDADE.length],
      data: monthKeys.map((_, mj) => metasAcompPickMetric(cellM[ui][mj] as Record<string, unknown>, metricKey)),
    }));
    const periodValByUnit = units.map((_, ui) => metasAcompPickMetric(periodM[ui] as Record<string, unknown>, metricKey));
    const globalVal = periodValByUnit.length
      ? periodValByUnit.reduce((a, b) => a + b, 0) / periodValByUnit.length
      : 0;
    const gaugeMax = indResolved.isP ? 100 : Math.max(10, Number(cfg.meta) * 1.5 || 10);

    out[metricKey] = {
      titulo: 'Metas de acompanhamento da gestao',
      catalog,
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
  return out;
}

const APERITIVO_SEED_FILE = path.join(process.cwd(), 'data', 'gerencia-aperitivo-7d.seed.json');

/**
 * Bundle 7d sem base — números plausíveis para simular aperitivo “sempre em cache” (cold start / dev).
 * Mesma forma que buildGerenciaDashboardBundleCore (sem cacheOrchestration).
 * `units` / `unitsOptions` permitem alimentar o seed com todas as unidades do cadastro (CSV/DuckDB).
 */
function buildGerenciaAperitivoDemoBundleWithUnits(
  q: Record<string, unknown>,
  units: Array<{ unidadeId?: unknown; unidadeNome?: unknown; regional?: unknown; codigo?: unknown }>,
  unitsOptions: Array<{ unidadeId?: unknown; unidadeNome?: unknown; regional?: unknown; codigo?: unknown }>,
) {
  const monthKeysA = monthKeysOverlappingQueryPeriod(q);
  const monthsA = monthsLabelsFromKeys(monthKeysA);

  const demoTotals: Record<string, number> = {
    atendimentos: 18240,
    altas: 15882,
    obitos: 41,
    evasoes: 912,
    desfecho: 14520,
    desfecho_medico: 14520,
    saidas: 15435,
    internacoes: 612,
    conversoes: 556,
    reavaliacoes: 3421,
    pacientes_medicados: 16404,
    medicacoes: 28910,
    medicacoes_rapidas: 17420,
    pacientes_lab: 6200,
    exames_lab: 8810,
    pacientes_rx: 4100,
    pacientes_ecg: 2200,
    pacientes_tc: 890,
    tcs: 1024,
    pacientes_us: 760,
  };

  const totaisPs = {
    cards: GERENCIA_TOTAIS_PS_DEF.map(({ key, label }) => ({
      key,
      label,
      value: asNumber(demoTotals[key]),
      format: 'int',
    })),
    meta: {
      schemaVersion: 2,
      titulo: 'Totais PS (seed 7d)',
      source: 'gerencia_aperitivo_seed_file',
      em_atendimento: 214,
    },
  };

  const tempo = tempoMedioEtapasForQuery(q);
  const baseZ = valoresTempoMedioZerados();
  const etapaKeys = TEMPO_MEDIO_ETAPAS_COLS.map((c) => c.key);
  const tens = (ui: number, ki: number) => 8 + ((ui * 7 + ki * 5) % 38);
  tempo.linhas = units.map((u, ui) => {
    const valores = { ...baseZ };
    etapaKeys.forEach((k, ki) => {
      valores[k] = tens(ui, ki);
    });
    return { unidadeId: u.unidadeId, unidadeLabel: labelUnidadePs(u), valores };
  });
  const totaisT = { ...baseZ };
  etapaKeys.forEach((k) => {
    let s = 0;
    tempo.linhas.forEach((L) => {
      s += asNumber(L.valores[k]);
    });
    totaisT[k] = units.length ? Math.round(s / units.length) : 0;
  });
  tempo.totais = totaisT;
  tempo.filtroUnidadeOpcoes = [
    { value: '', label: 'Todas' },
    ...unitsOptions.map((u) => ({ value: u.unidadeId, label: labelUnidadePs(u) })),
  ];
  tempo.meta = { schemaVersion: 2, source: 'gerencia_aperitivo_seed_file' };

  const metasPorVolumes = metasPorVolumesMatrixForQuery(q, units);
  const fillM = (v1: number, v2: number, v3: number) => ({
    m1: { v: v1, d: 0 },
    m2: { v: v2, d: v2 - v1 },
    m3: { v: v3, d: v3 - v2 },
    t: { v: v3, ytd: v3, sec: `(${v3})` },
  });
  metasPorVolumes.data.forEach((row, ri) => {
    row.subItems.forEach((sub, si) => {
      const seed = ri * 17 + si * 13;
      const v1 = 5 + (seed % 20);
      const v2 = v1 + 2 + (seed % 8);
      const v3 = v2 + 1 + (seed % 6);
      Object.assign(sub, fillM(v1, v2, v3));
    });
    const agg1 = row.subItems.reduce((a, s) => a + asNumber(s.m1?.v), 0);
    const agg2 = row.subItems.reduce((a, s) => a + asNumber(s.m2?.v), 0);
    const agg3 = row.subItems.reduce((a, s) => a + asNumber(s.m3?.v), 0);
    Object.assign(row, fillM(agg1, agg2, agg3));
  });

  const metasConformesPorUnidade = metasConformesPorUnidadeForQuery(q, units);
  metasConformesPorUnidade.series.forEach((s, si) => {
    s.data = s.data.map((_, mi) => 70 + ((si * 3 + mi * 2) % 25));
  });
  metasConformesPorUnidade.meta = {
    schemaVersion: 3,
    filtroUnidades: 'regional_unidade_gerencia',
    demo: true,
    eixoMeses: 'periodo_topo',
  };

  const metricasPorUnidade = metricasPorUnidadeForQuery(q, units);
  metricasPorUnidade.linhas.forEach((lin, li) => {
    const coef = 1 + li * 0.07;
    METRICAS_POR_UNIDADE_COLUNAS.forEach((c, ci) => {
      if (c.kind === 'int') lin.valores[c.key] = Math.round((120 + ci * 11 + li * 17) * coef);
      else if (c.kind === 'decimal') lin.valores[c.key] = +(1.1 + ci * 0.08 + li * 0.03).toFixed(2);
      else if (c.kind === 'pct') lin.valores[c.key] = Math.min(99, 18 + (ci * 5 + li * 3) % 72);
      else lin.valores[c.key] = '';
    });
  });
  metricasPorUnidade.meta = {
    schemaVersion: 2,
    titulo: 'Indicadores por unidade (PS)',
    filtroUnidades: 'regional_unidade_gerencia',
  };

  const unidadesPs = {
    options: unitsOptions.map((u) => ({ value: u.unidadeId, label: labelUnidadePs(u) })),
    meta: { schemaVersion: 1, source: 'gerencia_aperitivo_seed_file' },
  };

  const metasAcompanhamentoByMetric: Record<string, unknown> = {};
  METAS_POR_VOLUMES_INDICADORES.forEach((ind, idx) => {
    const cfg = METAS_ACOMP_POR_KEY[ind.key as keyof typeof METAS_ACOMP_POR_KEY] || { meta: 0 };
    const sense = ind.isReverso ? 'low_good' : 'high_good';
    const ribbonCmp = sense === 'low_good' ? '<' : '>';
    const catalog = METAS_POR_VOLUMES_INDICADORES.map((x) => ({
      key: x.key,
      label: x.name,
      isP: x.isP,
      isReverso: x.isReverso,
    }));
    const series = units.map((u, ui) => ({
      unidadeId: u.unidadeId,
      name: labelUnidadePs(u),
      color: METAS_ACOMP_CORES_UNIDADE[ui % METAS_ACOMP_CORES_UNIDADE.length],
      data: monthKeysA.map((_, mj) => {
        const bas = 8 + ((idx * 5 + ui * 3 + mj * 2) % 35);
        if (ind.isP) return Math.min(99, bas + (ind.isReverso ? 8 : 42));
        return +(0.75 + (bas % 18) * 0.065).toFixed(2);
      }),
    }));
    const flat = series.flatMap((s) => s.data);
    const globalVal = flat.length ? flat.reduce((a, b) => a + b, 0) / flat.length : 0;
    const gaugeMax = ind.isP ? 100 : Math.max(10, Number(cfg.meta) * 1.5 || 10);
    metasAcompanhamentoByMetric[ind.key] = {
      titulo: 'Metas de acompanhamento da gestao',
      catalog,
      selectedKey: ind.key,
      gauge: {
        title: `${ind.name} global no periodo`,
        value: globalVal,
        min: 0,
        max: gaugeMax,
        isPercent: ind.isP,
        sense,
      },
      metaRibbon: {
        target: cfg.meta,
        sense,
        text: `META ${fmtMetaBr(cfg.meta)} ${ribbonCmp} melhor`,
      },
      months: monthsA,
      series,
      meta: {
        schemaVersion: 3,
        filtroUnidades: 'regional_unidade_gerencia',
        demo: true,
        eixoMeses: 'periodo_topo',
      },
    };
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    queryEcho: {
      period: String(q.period),
      regional: q.regional != null && String(q.regional).trim() !== '' ? String(q.regional).trim() : '',
      unidade: q.unidade != null && String(q.unidade).trim() !== '' ? String(q.unidade).trim() : '',
    },
    totaisPs,
    tempoMedioEtapas: tempo,
    metasPorVolumes,
    metasConformesPorUnidade,
    metricasPorUnidade,
    unidadesPs,
    metasAcompanhamentoByMetric,
  };
}

/** Nacional 7d: mesma forma sintética do demo, mas uma linha por unidade vinda do cadastro (`tbl_unidades*` via `loadUnidadesPsFromDb`). */
export async function buildGerenciaAperitivoNationalSeedFromCadastro(query: Record<string, unknown> = {}) {
  const q = { ...query, period: query.period != null && String(query.period).trim() !== '' ? query.period : 7 };
  const allU = await loadUnidadesPsFromDb();
  let units = filterUnitsByQuery(allU, q);
  if (!units.length) units = filterUnidadesPsMatriz(q);
  let unitsOptions = filterUnitsByQuery(allU, { ...q, regional: '', unidade: '' });
  if (!unitsOptions.length) unitsOptions = listUnidadesPsParaFiltro(q);
  return buildGerenciaAperitivoDemoBundleWithUnits(q, units, unitsOptions);
}

export function buildGerenciaAperitivoDemoBundle(query: Record<string, unknown> = {}) {
  const q = { ...query, period: query.period != null && String(query.period).trim() !== '' ? query.period : 7 };
  const units = filterUnidadesPsMatriz(q);
  const unitsOptions = listUnidadesPsParaFiltro(q);
  return buildGerenciaAperitivoDemoBundleWithUnits(q, units, unitsOptions);
}

/**
 * Se o cache aperitivo estiver vazio, preenche a partir de data/gerencia-aperitivo-7d.seed.json
 * ou do bundle demo (cold start). Desligar: GERENCIA_APERITIVO_SEED=0
 */
export async function ensureGerenciaAperitivoSeedLoaded() {
  if (String(process.env.GERENCIA_APERITIVO_SEED || '').trim() === '0') return;
  try {
    const natKey = aperitivoStaleCacheKey(nationalSevenDayQuery());
    const existing = await loadAperitivoCacheByKey(natKey);
    if (existing) {
      primeGerenciaNationalSevenDayCaches(existing);
      return;
    }

    if (existsSync(APERITIVO_SEED_FILE)) {
      const txt = readFileSync(APERITIVO_SEED_FILE, 'utf8');
      const parsed = JSON.parse(txt);
      const bundle =
        parsed && typeof parsed === 'object' && parsed.bundle && typeof parsed.bundle === 'object'
          ? parsed.bundle
          : parsed;
      if (!bundle || bundle.schemaVersion !== 1 || !bundle.totaisPs) {
        console.warn('[gerencia] aperitivo: seed JSON invalido, usando bundle demo');
        const demo = buildGerenciaAperitivoDemoBundle({ period: 7 });
        await saveAperitivoCacheByKey(natKey, demo);
        await saveAperitivoCacheByKey(GERENCIA_APERITIVO_LEGACY_KEY, demo);
        primeGerenciaNationalSevenDayCaches(demo);
        console.log('[gerencia] aperitivo: cache preenchido (bundle demo sintético).');
        return;
      }
      if (!bundle.queryEcho) bundle.queryEcho = {};
      if (!bundle.queryEcho.period) bundle.queryEcho.period = '7';
      await saveAperitivoCacheByKey(natKey, bundle);
      await saveAperitivoCacheByKey(GERENCIA_APERITIVO_LEGACY_KEY, bundle);
      primeGerenciaNationalSevenDayCaches(bundle);
      console.log('[gerencia] aperitivo: seed JSON 7d carregado em cache <-', APERITIVO_SEED_FILE);
      return;
    }

    const demo = buildGerenciaAperitivoDemoBundle({ period: 7 });
    await saveAperitivoCacheByKey(natKey, demo);
    await saveAperitivoCacheByKey(GERENCIA_APERITIVO_LEGACY_KEY, demo);
    primeGerenciaNationalSevenDayCaches(demo);
    console.log('[gerencia] aperitivo: cache preenchido (bundle demo; crie data/gerencia-aperitivo-7d.seed.json com npm run gerencia:aperitivo-seed-write).');
  } catch (e) {
    console.warn('[gerencia] aperitivo seed:', (e as Error)?.message || e);
  }
}

/**
 * Prewarm real do aperitivo 7d no boot (DuckDB/Postgres), substituindo seed/demo quando disponível.
 * Desligar: GERENCIA_APERITIVO_PREWARM_ON_BOOT=0
 */
export async function ensureGerenciaAperitivoHotBootLoaded() {
  if (String(process.env.GERENCIA_APERITIVO_PREWARM_ON_BOOT || '1').trim() === '0') return;
  const t0 = Date.now();
  try {
    const prewarmPeriod = (() => {
      const n = Number(process.env.GERENCIA_APERITIVO_PREWARM_PERIOD ?? '1');
      return Number.isFinite(n) && n >= 1 && n <= 60 ? Math.floor(n) : 1;
    })();
    const qNat = { period: prewarmPeriod, regional: '', unidade: '' };
    ensureGerenciaWarmPlan();
    const full = await liveService.buildGerenciaDashboardBundleCore(qNat);
    await saveAperitivoCacheByKey(aperitivoStaleCacheKey(qNat), full);
    await saveAperitivoCacheByKey(GERENCIA_APERITIVO_LEGACY_KEY, full);
    primeGerenciaNationalSevenDayCaches(full);

    const prewarmRegionals = String(process.env.GERENCIA_APERITIVO_PREWARM_REGIONALS_ON_BOOT || '1').trim() !== '0';
    const prewarmUnits = String(process.env.GERENCIA_APERITIVO_PREWARM_UNITS_ON_BOOT || '1').trim() !== '0';
    const maxUnits = (() => {
      const n = Number(process.env.GERENCIA_APERITIVO_PREWARM_MAX_UNITS ?? '5000');
      return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 5000) : 5000;
    })();

    let regionalCount = 0;
    if (prewarmRegionals || prewarmUnits) {
      const allUnits = await loadUnidadesPsFromDb();
      const regionals = Array.from(
        new Set(
          (allUnits || [])
            .map((u) => normalizeUfRegional(u?.regional))
            .filter((r) => String(r || '').trim() !== ''),
        ),
      ).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

      for (const regional of regionals) {
        const qRegional = { period: prewarmPeriod, regional, unidade: '' };
        const unitsInRegional = filterUnitsByQuery(allUnits, qRegional);
        if (prewarmRegionals) {
          const slicedRegional = sliceGerenciaBundleForQuery(full, qRegional, unitsInRegional);
          if (slicedRegional) {
            await saveAperitivoCacheByKey(aperitivoStaleCacheKey(qRegional), slicedRegional);
            regionalCount += 1;
          }
        }
      }

      // 2º plano: filtros por unidade (não bloqueia o boot da API).
      if (prewarmUnits) {
        void (async () => {
          const tUnits = Date.now();
          let unitCount = 0;
          for (const regional of regionals) {
            const qRegional = { period: prewarmPeriod, regional, unidade: '' };
            const unitsInRegional = filterUnitsByQuery(allUnits, qRegional);
            for (const u of unitsInRegional) {
              if (unitCount >= maxUnits) break;
              const unidadeId = String(u?.unidadeId ?? '').trim();
              if (!unidadeId) continue;
              const qUnit = { period: prewarmPeriod, regional, unidade: unidadeId };
              const slicedUnit = sliceGerenciaBundleForQuery(full, qUnit, [u]);
              if (!slicedUnit) continue;
              await saveAperitivoCacheByKey(aperitivoStaleCacheKey(qUnit), slicedUnit);
              unitCount += 1;
            }
            if (unitCount >= maxUnits) break;
          }
          console.log(
            `[gerencia] aperitivo: prewarm d-${prewarmPeriod} unidades em 2º plano pronto em ${Date.now() - tUnits}ms (unidades=${unitCount}).`,
          );
        })();
      }
    }

    console.log(
      `[gerencia] aperitivo: prewarm d-${prewarmPeriod} base pronto em ${Date.now() - t0}ms (regionais=${regionalCount}).`,
    );
  } catch (e) {
    console.warn('[gerencia] aperitivo prewarm boot:', (e as Error)?.message || e);
  }
}

/**
 * Prewarm do bundle 30d:
 * - base imediata (nacional + regionais)
 * - unidades em 2º plano
 */
export async function ensureGerenciaPeriod30HotBootLoaded() {
  if (String(process.env.GERENCIA_30D_PREWARM_ON_BOOT || '1').trim() === '0') return;
  const t0 = Date.now();
  try {
    const period30 = (() => {
      const n = Number(process.env.GERENCIA_30D_PREWARM_PERIOD ?? '30');
      return Number.isFinite(n) && n >= 8 && n <= 60 ? Math.floor(n) : 30;
    })();
    const prewarmRegionals = String(process.env.GERENCIA_30D_PREWARM_REGIONALS_ON_BOOT || '1').trim() !== '0';
    const prewarmUnits = String(process.env.GERENCIA_30D_PREWARM_UNITS_ON_BOOT || '1').trim() !== '0';
    const maxUnits = (() => {
      const n = Number(process.env.GERENCIA_30D_PREWARM_MAX_UNITS ?? '5000');
      return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 5000) : 5000;
    })();

    const qNat = { period: period30, regional: '', unidade: '' };
    ensureGerenciaWarmPlan();
    const full = await liveService.buildGerenciaDashboardBundleCore(qNat);
    await saveGerenciaBundleCacheByKey(gerenciaBundleStaleCacheKey(qNat), full);

    let regionalCount = 0;
    const allUnits = await loadUnidadesPsFromDb();
    const regionals = Array.from(
      new Set(
        (allUnits || [])
          .map((u) => normalizeUfRegional(u?.regional))
          .filter((r) => String(r || '').trim() !== ''),
      ),
    ).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

    if (prewarmRegionals) {
      for (const regional of regionals) {
        const qRegional = { period: period30, regional, unidade: '' };
        const unitsInRegional = filterUnitsByQuery(allUnits, qRegional);
        const slicedRegional = sliceGerenciaBundleForQuery(full, qRegional, unitsInRegional);
        if (!slicedRegional) continue;
        await saveGerenciaBundleCacheByKey(gerenciaBundleStaleCacheKey(qRegional), slicedRegional);
        regionalCount += 1;
      }
    }

    if (prewarmUnits) {
      void (async () => {
        const tu = Date.now();
        let unitCount = 0;
        for (const regional of regionals) {
          const qRegional = { period: period30, regional, unidade: '' };
          const unitsInRegional = filterUnitsByQuery(allUnits, qRegional);
          for (const u of unitsInRegional) {
            if (unitCount >= maxUnits) break;
            const unidadeId = String(u?.unidadeId ?? '').trim();
            if (!unidadeId) continue;
            const qUnit = { period: period30, regional, unidade: unidadeId };
            const slicedUnit = sliceGerenciaBundleForQuery(full, qUnit, [u]);
            if (!slicedUnit) continue;
            await saveGerenciaBundleCacheByKey(gerenciaBundleStaleCacheKey(qUnit), slicedUnit);
            unitCount += 1;
          }
          if (unitCount >= maxUnits) break;
        }
        console.log(
          `[gerencia] 30d: prewarm unidades em 2º plano pronto em ${Date.now() - tu}ms (unidades=${unitCount}).`,
        );
      })();
    }

    console.log(
      `[gerencia] 30d: prewarm base pronto em ${Date.now() - t0}ms (regionais=${regionalCount}).`,
    );
  } catch (e) {
    console.warn('[gerencia] 30d prewarm boot:', (e as Error)?.message || e);
  }
}

class LiveService {
  /** Uma construção 7d em voo por chave de filtro (evita martelar DuckDB). */
  static _gerenciaSevenDayBgInflight = new Set<string>();
  /** Deduplicação de builds completos (>7d) por chave de filtro. */
  static _gerenciaFullBundleInflight = new Map<string, Promise<Record<string, unknown>>>();

  /**
   * Bundle completo 7d + gravação no cache aperitivo — corre em background após resposta instantânea.
   */
  _scheduleSevenDayFullBundleBackground(
    q: Record<string, unknown>,
    meta: { requestedPeriod: number; effectivePeriod: number; cappedToMax60: boolean },
  ) {
    const cacheKey = aperitivoStaleCacheKey(q);
    if (LiveService._gerenciaSevenDayBgInflight.has(cacheKey)) return;
    LiveService._gerenciaSevenDayBgInflight.add(cacheKey);
    void (async () => {
      try {
        ensureGerenciaWarmPlan();
        const full = await this.buildGerenciaDashboardBundleCore(q);
        const hotCoverageDays = getGerenciaHotCoverageDays(q);
        const warmStatus = getGerenciaWarmStatus();
        full.cacheOrchestration = {
          source: hotCoverageDays > 0 ? `hot_window_${hotCoverageDays}d` : 'db_on_demand',
          requestedPeriod: meta.requestedPeriod,
          effectivePeriod: meta.effectivePeriod,
          cappedToMax60: meta.cappedToMax60,
          hotCoverageDays,
          warmStatus,
          fullBundlePending: false,
        };
        await saveAperitivoCacheByKey(cacheKey, full);
        if (isDefaultGerenciaScope(q)) {
          await saveAperitivoCacheByKey(aperitivoStaleCacheKey(nationalSevenDayQuery()), full);
          await saveAperitivoCacheByKey(GERENCIA_APERITIVO_LEGACY_KEY, full);
        }
        domainEventBus.emit(DomainEvents.GerenciaDashboardBundleBuilt, {
          query: q,
          cache_source: full.cacheOrchestration?.source,
          hot_coverage_days: hotCoverageDays,
        });
      } catch (err) {
        console.warn('[gerencia] background full bundle (7d):', err instanceof Error ? err.message : err);
      } finally {
        LiveService._gerenciaSevenDayBgInflight.delete(cacheKey);
      }
    })();
  }

  /** 7 dias: cache por filtro, slice em memória a partir do nacional, ou demo instantâneo. */
  async resolveGerenciaSevenDayBundle(
    q: Record<string, unknown>,
    meta: {
      requestedPeriod: number;
      effectivePeriod: number;
      cappedToMax60: boolean;
      hotCoverageDays: number;
      warmStatus: unknown;
    },
  ) {
    const echoN = queryEchoFromGerenciaQuery(q);
    const wrap = (bundle: Record<string, unknown>, source: string, pending = false) => ({
      ...bundle,
      queryEcho: echoN,
      cacheOrchestration: {
        source,
        requestedPeriod: meta.requestedPeriod,
        effectivePeriod: meta.effectivePeriod,
        cappedToMax60: meta.cappedToMax60,
        hotCoverageDays: meta.hotCoverageDays,
        warmStatus: meta.warmStatus,
        fullBundlePending: pending,
      },
    });

    const key = aperitivoStaleCacheKey(q);
    const cached = await loadAperitivoCacheByKey(key);
    if (cached) {
      incGerenciaPerf('aperitivo_cache_hit');
      return wrap(cached, 'aperitivo_json_cache', false);
    }

    const natKey = aperitivoStaleCacheKey(nationalSevenDayQuery());
    const national = await (async () => {
      let n = await loadAperitivoCacheByKey(natKey);
      if (!n) n = await loadAperitivoCacheByKey(GERENCIA_APERITIVO_LEGACY_KEY);
      return n;
    })();

    if (national) {
      // Caminho rápido: evita I/O no cadastro na primeira troca de filtro.
      const quickSlice = sliceGerenciaBundleForQuery(national, q);
      if (quickSlice) {
        incGerenciaPerf('aperitivo_scope_slice_hit');
        // Com unidade concreta o slice do nacional já basta — não disparar DuckDB em background a cada troca.
        const scopedUnidade = String(q.unidade ?? '').trim();
        if (!scopedUnidade) this._scheduleSevenDayFullBundleBackground(q, meta);
        return wrap(quickSlice, 'aperitivo_scope_slice', false);
      }

      // Fallback de precisão: usa cadastro quando o slice rápido não conseguiu casar IDs/escopo.
      const allUnitsRaw = await loadUnidadesPsFromDb();
      const unitsFromCadastro = filterUnitsByQuery(allUnitsRaw, q);
      const slicedWithCadastro = sliceGerenciaBundleForQuery(
        national,
        q,
        unitsFromCadastro.length > 0 ? unitsFromCadastro : undefined,
      );
      if (slicedWithCadastro) {
        incGerenciaPerf('aperitivo_scope_slice_hit');
        const scopedUnidade = String(q.unidade ?? '').trim();
        if (!scopedUnidade) this._scheduleSevenDayFullBundleBackground(q, meta);
        return wrap(slicedWithCadastro, 'aperitivo_scope_slice', false);
      }
    }

    const demo = buildGerenciaAperitivoDemoBundle(q);
    incGerenciaPerf('aperitivo_demo_fallback');
    if (!String(q.unidade ?? '').trim()) this._scheduleSevenDayFullBundleBackground(q, meta);
    return wrap(demo, 'aperitivo_instant_demo', false);
  }

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
   * Unidades que possuem PS â€” para o filtro do cabeÃ§alho na visÃ£o GerÃªncia.
   * Mesmo shape de getKpiUnidades: { unidadeId, unidadeNome, regional }.
   */
  async getGerenciaUnidadesPs(query = {}) {
    const rawRg = query.regional;
    const regional =
      Array.isArray(rawRg) && rawRg.length ? String(rawRg[0] ?? '').trim() : String(rawRg ?? '').trim();
    const qf = regional ? { regional } : {};

    const fromCache = await loadUnidadesPsFromAperitivoCache(qf);
    if (fromCache.length) return fromCache;

    const units = await loadUnidadesPsFromDb();
    let out = filterUnitsByQuery(units, qf);
    /**
     * Cadastro real pode ter `uf`/`ps` incompatíveis com o filtro do topo — a lista ficava vazia.
     * Nesse caso usa as unidades DEMO da mesma regional (matriz alinhada ao BI).
     */
    if (regional && !out.length) {
      const dem = filterUnitsByQuery(DEMO_UNIDADES_PS, qf);
      if (dem.length) return dem;
    }
    return out;
  }

  /**
   * Matriz consolidada â€œMetas por volumesâ€ + drill por unidade (subItems).
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
      data: attachMetasPorVolumesUiTones(data),
      meta: {
        schemaVersion: 7,
        titulo: 'Metas por volumes',
        filtroUnidades: 'apenas_unidades_com_ps',
        unidadesNoContexto: units.length,
        eixoMeses: 'periodo_topo',
        uiTones: 'mpVol-v1',
      },
    };
  }

  /**
   * Uma linha por unidade PS com volumes e percentuais (dados na rÃ©plica).
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

  /** Jornada PS: mÃ©dias em minutos por etapa e por unidade. Query: period, regional, unidade, filtro */
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
   * Painel â€œMetas de acompanhamentoâ€: catÃ¡logo de mÃ©tricas + gauge global + sÃ©rie mensal por unidade.
   * Query: period, regional, unidade, metric (key do indicador, ex. conversao).
   * Valores conforme fetchView na rÃ©plica SQLite.
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

    /** Gauge = mÃ©dia do indicador no perÃ­odo inteiro (volumes fundidos), por unidade. */
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
   * % metas conformes por unidade â€” meses alinhados ao filtro de perÃ­odo (30 / 90 / ano).
   * Conforme tabelas/views existentes na rÃ©plica SQLite.
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
   * Drill explÃ­cito por indicador (opcional se a view principal nÃ£o trouxer subItems).
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
    const baseInd = ind || METAS_POR_VOLUMES_INDICADORES[0];
    const flags = { isP: Boolean(baseInd?.isP), isReverso: Boolean(baseInd?.isReverso) };
    return {
      indicadorKey,
      indicadorNome: ind?.name ?? String(indicadorKey),
      months,
      mesKeys,
      unidades: attachMetasPorVolumesPorIndicadorUiTones(unidades, flags),
      meta: { uiTones: 'mpVol-v1' },
    };
  }

  /**
   * Payload unico da Gerencia: datasets partilhados (DuckDB/Postgres/CSV) + agregacao no Node;
   * o React faz um GET (dashboard-bundle) e pinta tudo.
   */
  async buildGerenciaDashboardBundleCore(q = {}) {
    await loadGerenciaDatasets(q);
    const [metasAcompanhamentoByMetric, parts] = await Promise.all([
      buildMetasAcompanhamentoByMetricAll(q),
      Promise.all([
        this.getGerenciaTotaisPs(q),
        this.getGerenciaTempoMedioEtapas(q),
        this.getGerenciaMetasPorVolumes(q),
        this.getGerenciaMetasConformesPorUnidade(q),
        this.getGerenciaMetricasPorUnidade(q),
        this.getGerenciaUnidadesPs(q),
      ]),
    ]);
    const bundle = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      queryEcho: {
        period: q.period != null && String(q.period).trim() !== '' ? String(q.period).trim() : '',
        regional: q.regional != null && String(q.regional).trim() !== '' ? String(q.regional).trim() : '',
        unidade: q.unidade != null && String(q.unidade).trim() !== '' ? String(q.unidade).trim() : '',
      },
      totaisPs: parts[0],
      tempoMedioEtapas: parts[1],
      metasPorVolumes: parts[2],
      metasConformesPorUnidade: parts[3],
      metricasPorUnidade: parts[4],
      unidadesPs: parts[5],
      metasAcompanhamentoByMetric: metasAcompanhamentoByMetric as Record<string, unknown>,
    };
    return bundle;
  }

  async buildGerenciaAperitivoLite(q = {}) {
    const cap = gerenciaLiteSnapshotCapMs();
    const [allU, unitRows] = await Promise.all([
      loadUnidadesPsFromDb(),
      snapshotRowsOrEmpty(
        readRepository.safeView('ps_resumo_unidades_snapshot_prod', {
          columns:
            'cd_estabelecimento,hoje,ativos,internacao_qtd,triagem_acima_meta,consulta_acima_meta,permanencia_acima_meta,medicacao_acima_meta,reavaliacao_acima_meta',
        }),
        cap,
      ),
    ]);
    const unitsFromDb = Array.isArray(allU) && allU.length > 0;
    const unitsOptions = unitsFromDb ? filterUnitsByQuery(allU, { regional: q.regional }) : listUnidadesPsParaFiltro(q);
    const units = unitsFromDb ? filterUnitsByQuery(allU, q) : filterUnidadesPsMatriz(q);
    const byCd = new Map();
    for (const r of unitRows || []) {
      const cd = String(readCell(r, 'cd_estabelecimento', 'CD_ESTABELECIMENTO') ?? '').padStart(3, '0');
      if (!cd) continue;
      byCd.set(cd, r);
    }

    let atendimentos = 0;
    let internacoes = 0;
    let emAtendimento = 0;
    let triagemAcimaMeta = 0;
    let consultaAcimaMeta = 0;
    let permanenciaAcimaMeta = 0;
    let medicacaoAcimaMeta = 0;
    let reavaliacaoAcimaMeta = 0;
    units.forEach((u) => {
      const row = byCd.get(String(u.unidadeId).padStart(3, '0'));
      if (!row) return;
      atendimentos += numCell(row, 'hoje', 'HOJE');
      emAtendimento += numCell(row, 'ativos', 'ATIVOS');
      internacoes += numCell(row, 'internacao_qtd', 'INTERNACAO_QTD');
      triagemAcimaMeta += numCell(row, 'triagem_acima_meta', 'TRIAGEM_ACIMA_META');
      consultaAcimaMeta += numCell(row, 'consulta_acima_meta', 'CONSULTA_ACIMA_META');
      permanenciaAcimaMeta += numCell(row, 'permanencia_acima_meta', 'PERMANENCIA_ACIMA_META');
      medicacaoAcimaMeta += numCell(row, 'medicacao_acima_meta', 'MEDICACAO_ACIMA_META');
      reavaliacaoAcimaMeta += numCell(row, 'reavaliacao_acima_meta', 'REAVALIACAO_ACIMA_META');
    });

    const values = {
      atendimentos,
      altas: 0,
      obitos: 0,
      evasoes: 0,
      desfecho: 0,
      desfecho_medico: 0,
      saidas: 0,
      internacoes,
      conversoes: 0,
      reavaliacoes: reavaliacaoAcimaMeta,
      pacientes_medicados: 0,
      medicacoes: 0,
      medicacoes_rapidas: 0,
      pacientes_lab: 0,
      exames_lab: 0,
      pacientes_rx: 0,
      pacientes_ecg: 0,
      pacientes_tc: 0,
      tcs: 0,
      pacientes_us: 0,
    };

    const tempoRows = units.map((u) => ({
      unidadeId: u.unidadeId,
      unidadeLabel: labelUnidadePs(u),
      valores: {
        totem_triagem: 0,
        totem_consulta: 0,
        presc_medicacao: 0,
        presc_rx_ecg: 0,
        presc_tc_us: 0,
        pedido_reavaliacao: 0,
        permanencia_total: 0,
      },
    }));

    const months = defaultRollingMonths().mesKeys.slice(-2);
    const monthLabels = monthsLabelsFromKeys(months);

    const metasAcompanhamentoByMetric = {};
    METAS_POR_VOLUMES_INDICADORES.forEach((ind) => {
      const cfg = METAS_ACOMP_POR_KEY[ind.key] || { meta: 0 };
      const sense = ind.isReverso ? 'low_good' : 'high_good';
      metasAcompanhamentoByMetric[ind.key] = {
        titulo: 'Metas de acompanhamento da gestao',
        catalog: METAS_POR_VOLUMES_INDICADORES.map((x) => ({
          key: x.key,
          label: x.name,
          isP: x.isP,
          isReverso: x.isReverso,
        })),
        selectedKey: ind.key,
        gauge: {
          title: `${ind.name} global no periodo`,
          value: 0,
          min: 0,
          max: ind.isP ? 100 : Math.max(10, Number(cfg.meta) * 1.5 || 10),
          isPercent: ind.isP,
          sense,
        },
        metaRibbon: {
          target: cfg.meta,
          sense,
          text: `META ${fmtMetaBr(cfg.meta)} ${sense === 'low_good' ? '<' : '>'} melhor`,
        },
        months: monthLabels,
        series: units.map((u, idx) => ({
          unidadeId: u.unidadeId,
          name: labelUnidadePs(u),
          color: METAS_ACOMP_CORES_UNIDADE[idx % METAS_ACOMP_CORES_UNIDADE.length],
          data: monthLabels.map(() => 0),
        })),
        meta: {
          schemaVersion: 3,
          filtroUnidades: 'regional_unidade_gerencia',
          demo: false,
          eixoMeses: 'periodo_topo',
        },
      };
    });

    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      queryEcho: {
        period: q.period != null && String(q.period).trim() !== '' ? String(q.period).trim() : '7',
        regional: q.regional != null && String(q.regional).trim() !== '' ? String(q.regional).trim() : '',
        unidade: q.unidade != null && String(q.unidade).trim() !== '' ? String(q.unidade).trim() : '',
      },
      totaisPs: {
        cards: GERENCIA_TOTAIS_PS_DEF.map(({ key, label }) => ({
          key,
          label,
          value: asNumber(values[key]),
          format: 'int',
        })),
        meta: {
          schemaVersion: 2,
          titulo: 'Totais PS (aperitivo)',
          source: 'ps_resumo_unidades_snapshot_prod',
          em_atendimento: emAtendimento,
        },
      },
      tempoMedioEtapas: {
        titulo: 'Tempo medio por etapa (min)',
        etapas: TEMPO_MEDIO_ETAPAS_COLS.map((e) => ({ ...e })),
        filtroUnidadeOpcoes: [{ value: '', label: 'Todas' }, ...unitsOptions.map((u) => ({ value: u.unidadeId, label: labelUnidadePs(u) }))],
        linhas: tempoRows,
        totais: {
          totem_triagem: 0,
          totem_consulta: 0,
          presc_medicacao: 0,
          presc_rx_ecg: 0,
          presc_tc_us: 0,
          pedido_reavaliacao: 0,
          permanencia_total: 0,
        },
        meta: { schemaVersion: 2, source: 'aperitivo_lite' },
      },
      metasPorVolumes: metasPorVolumesMatrixForQuery(q),
      metasConformesPorUnidade: {
        titulo: '% de metas conformes por unidade',
        months: monthLabels,
        isPercent: true,
        series: units.map((u, idx) => ({
          unidadeId: u.unidadeId,
          name: labelUnidadePs(u),
          color: METAS_ACOMP_CORES_UNIDADE[idx % METAS_ACOMP_CORES_UNIDADE.length],
          data: monthLabels.map(() => 0),
        })),
        meta: { schemaVersion: 3, filtroUnidades: 'regional_unidade_gerencia', demo: false, eixoMeses: 'periodo_topo' },
      },
      metricasPorUnidade: metricasPorUnidadeForQuery(q),
      unidadesPs: {
        options: unitsOptions.map((u) => ({ value: u.unidadeId, label: labelUnidadePs(u) })),
        meta: { schemaVersion: 1, source: 'aperitivo_lite' },
      },
      metasAcompanhamentoByMetric,
    };
  }

  /**
   * Um unico payload da Gerencia com orquestracao de cache:
   * - aperitivo (7 dias) em JSON pronto para primeiro carregamento
   * - aquecimento de 30 dias na primeira onda
   * - segunda onda em 10 minutos para 60 dias
   */
  async getGerenciaDashboardBundle(query = {}) {
    ensureGerenciaWarmPlan();
    const { q, requestedPeriod, effectivePeriod, capped } = normalizeGerenciaQuery(query);
    const hotCoverageDays = getGerenciaHotCoverageDays(q);
    const warmStatus = getGerenciaWarmStatus();

    if (effectivePeriod <= 7) {
      return this.resolveGerenciaSevenDayBundle(q, {
        requestedPeriod,
        effectivePeriod,
        cappedToMax60: capped,
        hotCoverageDays,
        warmStatus,
      });
    }

    const fullKey = gerenciaBundleStaleCacheKey(q);
    const cachedFull = await loadGerenciaBundleCacheByKey(fullKey);
    if (cachedFull) {
      incGerenciaPerf('bundle_redis_hit');
      markGerenciaBundleBuild(0, 'redis_bundle_cache');
      cachedFull.queryEcho = queryEchoFromGerenciaQuery(q);
      cachedFull.cacheOrchestration = {
        source: 'redis_bundle_cache',
        requestedPeriod,
        effectivePeriod,
        cappedToMax60: capped,
        hotCoverageDays,
        warmStatus,
        fullBundlePending: false,
      };
      return cachedFull;
    }
    incGerenciaPerf('bundle_redis_miss');

    const existingInflight = LiveService._gerenciaFullBundleInflight.get(fullKey);
    if (existingInflight) {
      incGerenciaPerf('bundle_inflight_dedup_hit');
      const dedup = await existingInflight;
      dedup.queryEcho = queryEchoFromGerenciaQuery(q);
      dedup.cacheOrchestration = {
        source: 'inflight_dedup_cache',
        requestedPeriod,
        effectivePeriod,
        cappedToMax60: capped,
        hotCoverageDays,
        warmStatus,
        fullBundlePending: false,
      };
      return dedup;
    }

    const buildPromise = (async () => {
      const t0 = Date.now();
      try {
        const bundle = await this.buildGerenciaDashboardBundleCore(q);
        bundle.cacheOrchestration = {
          source: hotCoverageDays > 0 ? `hot_window_${hotCoverageDays}d` : 'db_on_demand',
          requestedPeriod,
          effectivePeriod,
          cappedToMax60: capped,
          hotCoverageDays,
          warmStatus,
          fullBundlePending: false,
        };
        await saveGerenciaBundleCacheByKey(fullKey, bundle);
        domainEventBus.emit(DomainEvents.GerenciaDashboardBundleBuilt, {
          query: q,
          cache_source: bundle.cacheOrchestration?.source,
          hot_coverage_days: hotCoverageDays,
        });
        incGerenciaPerf('bundle_build_ok');
        markGerenciaBundleBuild(Date.now() - t0, String(bundle.cacheOrchestration?.source || 'db_on_demand'));
        return bundle;
      } catch (e) {
        incGerenciaPerf('bundle_build_err');
        throw e;
      }
    })();

    LiveService._gerenciaFullBundleInflight.set(fullKey, buildPromise);
    try {
      const bundle = await buildPromise;
      return bundle;
    } finally {
      LiveService._gerenciaFullBundleInflight.delete(fullKey);
    }
  }

  async getGerenciaAperitivo(query = {}) {
    ensureGerenciaWarmPlan();
    const q = { ...query, period: 7 };
    return this.resolveGerenciaSevenDayBundle(q, {
      requestedPeriod: 7,
      effectivePeriod: 7,
      cappedToMax60: false,
      hotCoverageDays: getGerenciaHotCoverageDays(q),
      warmStatus: getGerenciaWarmStatus(),
    });
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

/** Modo estrito sem cache em memória no Node: função mantida por compatibilidade de chamadas. */
function primeGerenciaNationalSevenDayCaches(innerBundle: Record<string, unknown>): void {
  void innerBundle;
}

const liveService = new LiveService();
export default liveService;
