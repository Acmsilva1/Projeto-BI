/**
 * Repositório Gerência — orquestra leituras das fact tables (cache TTL curto).
 * Mensageria interna: eventos de fatia temporal (ver `DomainEvents.GerenciaDataSlice*`).
 */
import { DomainEvents } from '../domain/messages/events.js';
import { parsePeriodEnd, parsePeriodStart } from '../domain/shared/period.js';
import { gerenciaDatasetCacheKey, gerenciaFetchOpts } from '../domain/gerencia/sqlContext.js';
import { domainEventBus } from '../messaging/domainEventBus.js';
import { readRepository } from './readRepository.js';

/** TTL do dataset em memória (repetir 30 d / 7 d no mesmo minuto reutiliza leitura). `GERENCIA_DATASET_TTL_MS` sobrepõe. */
const GERENCIA_DS_TTL_MS = (() => {
  const n = Number(process.env.GERENCIA_DATASET_TTL_MS ?? '120000');
  return Number.isFinite(n) && n >= 5000 ? Math.min(Math.floor(n), 600_000) : 120_000;
})();
const gerenciaDsCache = new Map<string, { data: GerenciaDataset; at: number }>();
const gerenciaDsInflightByKey = new Map<string, Promise<GerenciaDataset>>();

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

export async function loadGerenciaDatasets(query: Record<string, unknown> = {}): Promise<GerenciaDataset> {
  const cacheKey = gerenciaDatasetCacheKey(query);
  const now = Date.now();
  const hit = gerenciaDsCache.get(cacheKey);
  if (hit && now - hit.at < GERENCIA_DS_TTL_MS) {
    return hit.data;
  }
  const existing = gerenciaDsInflightByKey.get(cacheKey);
  if (existing) return existing;

  /**
   * Registar `inflight` antes de qualquer await: `getGerenciaDashboardBundle` faz Promise.all com
   * dezenas de handlers; se o map só fosse preenchido após o 1.º await da carga, vários workers
   * iniciavam leituras CSV completas em paralelo (30 d parecia “multiplicado”).
   */
  let resolveLoad!: (value: GerenciaDataset) => void;
  let rejectLoad!: (reason?: unknown) => void;
  const inflight = new Promise<GerenciaDataset>((resolve, reject) => {
    resolveLoad = resolve;
    rejectLoad = reject;
  });
  gerenciaDsInflightByKey.set(cacheKey, inflight);

  void (async () => {
    try {
      const fo = (logical: string) => gerenciaFetchOpts(logical, query);
      const specs = FACT_LOGICALS.map((logical) => ({ logical, options: fo(logical) }));
      const dateFrom = parsePeriodStart(query);
      const dateTo = parsePeriodEnd();
      domainEventBus.emit(DomainEvents.GerenciaDataSliceRequested, {
        period: query.period,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        tables: [...FACT_LOGICALS],
      });
      const rows = await readRepository.safeViewParallel(specs);
      const [
        fluxRows,
        medRows,
        labRows,
        rxRows,
        tcusRows,
        reavRows,
        altasRows,
        convRows,
        viasRows,
        metasRows,
      ] = rows;
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
        period: query.period,
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
