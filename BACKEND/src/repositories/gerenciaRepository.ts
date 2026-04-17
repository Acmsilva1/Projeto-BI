/**
 * Repositorio Gerencia:
 * - leitura das fact tables
 * - cache curto por chave de periodo
 * - "hot windows" 30/60 dias (memoria + Redis)
 * - orquestracao de aquecimento progressivo para aliviar DuckDB
 */
import { cacheGetStale, cacheSetStale } from '../cache/redisMemoryCache.js';
import { gerenciaDatasetCacheKey, gerenciaFetchOpts } from '../domain/gerencia/sqlContext.js';
import { DomainEvents } from '../domain/messages/events.js';
import { parsePeriodEnd, parsePeriodStart } from '../domain/shared/period.js';
import { domainEventBus } from '../messaging/domainEventBus.js';
import { readRepository } from './readRepository.js';

const GERENCIA_DS_TTL_MS = (() => {
  const n = Number(process.env.GERENCIA_DATASET_TTL_MS ?? '120000');
  return Number.isFinite(n) && n >= 5000 ? Math.min(Math.floor(n), 600_000) : 120_000;
})();

const GERENCIA_HOT_WINDOW_TTL_MS = (() => {
  const n = Number(process.env.GERENCIA_HOT_WINDOW_TTL_MS ?? String(6 * 60 * 60 * 1000));
  return Number.isFinite(n) && n >= 60_000 ? Math.min(Math.floor(n), 24 * 60 * 60 * 1000) : 6 * 60 * 60 * 1000;
})();

const GERENCIA_WARM_SECOND_WAVE_DELAY_MS = (() => {
  const n = Number(process.env.GERENCIA_WARM_SECOND_WAVE_DELAY_MS ?? '600000');
  return Number.isFinite(n) && n >= 30_000 ? Math.min(Math.floor(n), 60 * 60 * 1000) : 600_000;
})();

const GERENCIA_MAX_PERIOD_DAYS = 60;
const HOT_WINDOWS = [30, 60] as const;

export type GerenciaDataset = {
  fluxRows: Record<string, unknown>[];
  medRows: Record<string, unknown>[];
  labRows: Record<string, unknown>[];
  rxRows: Record<string, unknown>[];
  tcusRows: Record<string, unknown>[];
  reavRows: Record<string, unknown>[];
  altasRows: Record<string, unknown>[];
  convRows: Record<string, unknown>[];
  viasRows: Record<string, unknown>[];
  metasRows: Record<string, unknown>[];
};

export type GerenciaWarmStatus = {
  started: boolean;
  wave30Ready: boolean;
  wave60Ready: boolean;
  startedAt: string | null;
  wave30At: string | null;
  wave60At: string | null;
  wave60ScheduledAt: string | null;
  lastError: string | null;
};

const FACT_LOGICALS = [
  'tbl_tempos_entrada_consulta_saida',
  'tbl_tempos_medicacao',
  'tbl_tempos_laboratorio',
  'tbl_tempos_rx_e_ecg',
  'tbl_tempos_tc_e_us',
  'tbl_tempos_reavaliacao',
  'tbl_altas_ps',
  'tbl_intern_conversoes',
  'tbl_vias_medicamentos',
  'meta_tempos',
] as const;

const gerenciaDsCache = new Map<string, { data: GerenciaDataset; at: number }>();
const gerenciaDsInflightByKey = new Map<string, Promise<GerenciaDataset>>();
const hotWindowMem = new Map<number, { data: GerenciaDataset; at: number }>();
const hotWindowInflight = new Map<number, Promise<GerenciaDataset>>();
let dateAnchorCache: { at: number; iso: string } | null = null;
const DATE_ANCHOR_TTL_MS = 5 * 60 * 1000;

const warmStatus: {
  started: boolean;
  startedAt: number | null;
  wave30At: number | null;
  wave60At: number | null;
  wave60ScheduledAt: number | null;
  lastError: string | null;
} = {
  started: false,
  startedAt: null,
  wave30At: null,
  wave60At: null,
  wave60ScheduledAt: null,
  lastError: null,
};

function toIso(ts: number | null): string | null {
  return Number.isFinite(ts as number) ? new Date(ts as number).toISOString() : null;
}

function hotWindowRedisKey(days: number): string {
  return `hospital-bi:gerencia:hot-window:v1:${days}`;
}

function normalizePeriodDays(query: Record<string, unknown> = {}): number {
  const p = Number(query.period);
  if (!Number.isFinite(p) || p <= 0) return 7;
  if (p === 366) return GERENCIA_MAX_PERIOD_DAYS;
  return Math.max(1, Math.min(Math.floor(p), GERENCIA_MAX_PERIOD_DAYS));
}

function hasExplicitDateTo(query: Record<string, unknown> = {}): boolean {
  if (query.date_to != null && String(query.date_to).trim() !== '') return true;
  if (query.dateTo != null && String(query.dateTo).trim() !== '') return true;
  return false;
}

function parseMaybeDate(v: unknown): Date | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function datasetLatestAnchorIso(ds: GerenciaDataset | null | undefined): string | null {
  if (!ds) return null;
  let best: Date | null = null;
  const probes: Array<{ rows: Record<string, unknown>[]; fields: string[] }> = [
    { rows: ds.fluxRows || [], fields: ['DATA', 'DT_ENTRADA'] },
    { rows: ds.medRows || [], fields: ['DATA', 'DT_PRESCRICAO'] },
    { rows: ds.viasRows || [], fields: ['DATA', 'DT_LIBERACAO'] },
    { rows: ds.labRows || [], fields: ['DATA', 'DT_EXAME', 'DT_SOLICITACAO'] },
    { rows: ds.rxRows || [], fields: ['DATA', 'DT_EXAME', 'DT_SOLICITACAO'] },
    { rows: ds.tcusRows || [], fields: ['DATA', 'DT_LIBERACAO', 'DT_REALIZADO', 'DT_EXAME'] },
    { rows: ds.reavRows || [], fields: ['DATA', 'DT_SOLIC_REAVALIACAO', 'DT_FIM_REAVALIACAO'] },
    { rows: ds.altasRows || [], fields: ['DT_ALTA', 'DT_ENTRADA'] },
    { rows: ds.convRows || [], fields: ['DT_INTERNACAO', 'DT_ALTA', 'DT_ENTRADA'] },
  ];
  for (const p of probes) {
    for (let i = p.rows.length - 1; i >= 0; i -= 1) {
      const row = p.rows[i];
      for (const f of p.fields) {
        const d = parseMaybeDate(row?.[f] ?? row?.[String(f).toUpperCase()]);
        if (!d) continue;
        if (!best || d > best) best = d;
      }
      if (best) break;
    }
  }
  return best ? best.toISOString() : null;
}

function ensureQueryDateAnchorFromDataset(query: Record<string, unknown>, ds: GerenciaDataset): void {
  if (hasExplicitDateTo(query)) return;
  const anchor = datasetLatestAnchorIso(ds);
  if (!anchor) return;
  query.date_to = anchor;
}

async function resolveLatestDataAnchor(): Promise<string | null> {
  if (dateAnchorCache && Date.now() - dateAnchorCache.at < DATE_ANCHOR_TTL_MS) {
    return dateAnchorCache.iso;
  }
  const probes: Array<{ logical: string; col: string }> = [
    { logical: 'tbl_tempos_entrada_consulta_saida', col: 'DATA' },
    { logical: 'tbl_tempos_entrada_consulta_saida', col: 'DT_ENTRADA' },
    { logical: 'tbl_vias_medicamentos', col: 'DATA' },
    { logical: 'tbl_altas_ps', col: 'DT_ALTA' },
    { logical: 'tbl_intern_conversoes', col: 'DT_ENTRADA' },
  ];
  let best: Date | null = null;
  for (const p of probes) {
    try {
      const rows = await readRepository.safeView(p.logical, {
        columns: p.col,
        orderBy: p.col,
        ascending: false,
        limit: 1,
      });
      const d = parseMaybeDate(rows?.[0]?.[p.col] ?? rows?.[0]?.[String(p.col).toUpperCase()]);
      if (!d) continue;
      if (!best || d > best) best = d;
    } catch {
      /* ignore probe failure */
    }
  }
  if (!best) return null;
  const iso = best.toISOString();
  dateAnchorCache = { at: Date.now(), iso };
  return iso;
}

async function attachAnchorToQuery(query: Record<string, unknown>): Promise<void> {
  if (!query || typeof query !== 'object') return;
  if (query.date_to != null && String(query.date_to).trim() !== '') return;
  if (query.dateTo != null && String(query.dateTo).trim() !== '') return;
  const anchor = await resolveLatestDataAnchor();
  if (!anchor) return;
  query.date_to = anchor;
}

function hotWindowFresh(hit: { at: number } | null | undefined): boolean {
  if (!hit) return false;
  return Date.now() - hit.at <= GERENCIA_HOT_WINDOW_TTL_MS;
}

async function loadHotWindowFromRedis(days: number): Promise<{ data: GerenciaDataset; at: number } | null> {
  try {
    const raw = await cacheGetStale(hotWindowRedisKey(days));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: GerenciaDataset };
    if (!parsed || typeof parsed !== 'object' || !parsed.data || !Number.isFinite(parsed.at)) return null;
    if (!hotWindowFresh(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveHotWindow(days: number, data: GerenciaDataset): Promise<void> {
  const payload = { at: Date.now(), data };
  hotWindowMem.set(days, payload);
  try {
    await cacheSetStale(hotWindowRedisKey(days), JSON.stringify(payload));
  } catch {
    /* ignore cache persistence failure */
  }
}

function pickHotCoverage(periodDays: number): 0 | 30 | 60 {
  if (periodDays <= 30 && hotWindowFresh(hotWindowMem.get(30))) return 30;
  if (periodDays <= 60 && hotWindowFresh(hotWindowMem.get(60))) return 60;
  return 0;
}

async function ensureHotWindowFromStorage(days: 30 | 60): Promise<void> {
  const mem = hotWindowMem.get(days);
  if (hotWindowFresh(mem)) return;
  const redisHit = await loadHotWindowFromRedis(days);
  if (redisHit) hotWindowMem.set(days, redisHit);
}

async function loadGerenciaDatasetRaw(query: Record<string, unknown> = {}): Promise<GerenciaDataset> {
  const q = { ...query };
  if ((q.date_to == null || String(q.date_to).trim() === '') && (q.dateTo == null || String(q.dateTo).trim() === '')) {
    const anchor = await resolveLatestDataAnchor();
    if (anchor) q.date_to = anchor;
  }

  const cacheKey = gerenciaDatasetCacheKey(q);
  const now = Date.now();
  const hit = gerenciaDsCache.get(cacheKey);
  if (hit && now - hit.at < GERENCIA_DS_TTL_MS) return hit.data;

  const existing = gerenciaDsInflightByKey.get(cacheKey);
  if (existing) return existing;

  let resolveLoad!: (value: GerenciaDataset) => void;
  let rejectLoad!: (reason?: unknown) => void;
  const inflight = new Promise<GerenciaDataset>((resolve, reject) => {
    resolveLoad = resolve;
    rejectLoad = reject;
  });
  gerenciaDsInflightByKey.set(cacheKey, inflight);

  void (async () => {
    try {
      const fo = (logical: string) => gerenciaFetchOpts(logical, q);
      const specs = FACT_LOGICALS.map((logical) => ({ logical, options: fo(logical) }));
      const dateFrom = parsePeriodStart(q);
      const dateTo = parsePeriodEnd(q);
      domainEventBus.emit(DomainEvents.GerenciaDataSliceRequested, {
        period: q.period,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        tables: [...FACT_LOGICALS],
      });
      const rows = await readRepository.safeViewParallel(specs);
      const [fluxRows, medRows, labRows, rxRows, tcusRows, reavRows, altasRows, convRows, viasRows, metasRows] =
        rows;
      const out: GerenciaDataset = {
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
      domainEventBus.emit(DomainEvents.GerenciaDataSliceLoaded, {
        period: q.period,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        rowCounts: {
          tbl_tempos_entrada_consulta_saida: fluxRows.length,
          tbl_tempos_medicacao: medRows.length,
          tbl_tempos_laboratorio: labRows.length,
          tbl_tempos_rx_e_ecg: rxRows.length,
          tbl_tempos_tc_e_us: tcusRows.length,
          tbl_tempos_reavaliacao: reavRows.length,
          tbl_altas_ps: altasRows.length,
          tbl_intern_conversoes: convRows.length,
          tbl_vias_medicamentos: (viasRows || []).length,
          meta_tempos: metasRows.length,
        },
      });
      gerenciaDsCache.set(cacheKey, { data: out, at: Date.now() });
      resolveLoad(out);
    } catch (err) {
      rejectLoad(err);
    } finally {
      gerenciaDsInflightByKey.delete(cacheKey);
    }
  })();

  return inflight;
}

async function warmWindow(days: 30 | 60): Promise<GerenciaDataset> {
  const mem = hotWindowMem.get(days);
  if (hotWindowFresh(mem)) return mem.data;

  const redisHit = await loadHotWindowFromRedis(days);
  if (redisHit) {
    hotWindowMem.set(days, redisHit);
    return redisHit.data;
  }

  const existing = hotWindowInflight.get(days);
  if (existing) return existing;

  const p = (async () => {
    try {
      const data = await loadGerenciaDatasetRaw({ period: days });
      await saveHotWindow(days, data);
      if (days === 30) warmStatus.wave30At = Date.now();
      if (days === 60) warmStatus.wave60At = Date.now();
      return data;
    } catch (e) {
      warmStatus.lastError = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      hotWindowInflight.delete(days);
    }
  })();
  hotWindowInflight.set(days, p);
  return p;
}

export function ensureGerenciaWarmPlan(): void {
  if (warmStatus.started) return;
  warmStatus.started = true;
  warmStatus.startedAt = Date.now();

  void warmWindow(30);

  warmStatus.wave60ScheduledAt = Date.now() + GERENCIA_WARM_SECOND_WAVE_DELAY_MS;
  setTimeout(() => {
    void warmWindow(60);
  }, GERENCIA_WARM_SECOND_WAVE_DELAY_MS);
}

export function getGerenciaWarmStatus(): GerenciaWarmStatus {
  return {
    started: warmStatus.started,
    wave30Ready: hotWindowFresh(hotWindowMem.get(30)),
    wave60Ready: hotWindowFresh(hotWindowMem.get(60)),
    startedAt: toIso(warmStatus.startedAt),
    wave30At: toIso(warmStatus.wave30At),
    wave60At: toIso(warmStatus.wave60At),
    wave60ScheduledAt: toIso(warmStatus.wave60ScheduledAt),
    lastError: warmStatus.lastError,
  };
}

export function getGerenciaMaxPeriodDays(): number {
  return GERENCIA_MAX_PERIOD_DAYS;
}

export function getGerenciaHotCoverageDays(query: Record<string, unknown> = {}): 0 | 30 | 60 {
  return pickHotCoverage(normalizePeriodDays(query));
}

export async function loadGerenciaDatasets(query: Record<string, unknown> = {}): Promise<GerenciaDataset> {
  ensureGerenciaWarmPlan();
  await attachAnchorToQuery(query);

  await ensureHotWindowFromStorage(30);
  await ensureHotWindowFromStorage(60);

  const periodDays = normalizePeriodDays(query);
  const coverage = pickHotCoverage(periodDays);
  if (coverage === 30) {
    const ds = hotWindowMem.get(30)!.data;
    ensureQueryDateAnchorFromDataset(query, ds);
    return ds;
  }
  if (coverage === 60) {
    const ds = hotWindowMem.get(60)!.data;
    ensureQueryDateAnchorFromDataset(query, ds);
    return ds;
  }

  if (periodDays <= 30 && !hotWindowInflight.get(30)) void warmWindow(30);
  if (periodDays <= 60 && !hotWindowInflight.get(60) && hotWindowFresh(hotWindowMem.get(30))) {
    // segunda onda ainda não pronta: dispara sob demanda para acelerar filtro 60.
    void warmWindow(60);
  }

  const ds = await loadGerenciaDatasetRaw({ ...query, period: periodDays });
  ensureQueryDateAnchorFromDataset(query, ds);
  return ds;
}

export async function warmGerenciaWindowNow(days: 30 | 60): Promise<void> {
  ensureGerenciaWarmPlan();
  await warmWindow(days);
}
