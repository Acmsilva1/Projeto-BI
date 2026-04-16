/**
 * Repositório Gerência — orquestra leituras paralelas das fact tables (cache TTL curto).
 */
import { gerenciaDatasetCacheKey, gerenciaFetchOpts } from '../domain/gerencia/sqlContext.js';
import { readRepository } from './readRepository.js';

const GERENCIA_DS_TTL_MS = 25_000;
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
  let inflight = gerenciaDsInflightByKey.get(cacheKey);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const fo = (logical: string) => gerenciaFetchOpts(logical, query);
      const specs = FACT_LOGICALS.map((logical) => ({ logical, options: fo(logical) }));
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
      gerenciaDsCache.set(cacheKey, { data: out, at: Date.now() });
      return out;
    } finally {
      gerenciaDsInflightByKey.delete(cacheKey);
    }
  })();

  gerenciaDsInflightByKey.set(cacheKey, inflight);
  return inflight;
}
