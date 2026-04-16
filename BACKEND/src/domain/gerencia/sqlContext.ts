/**
 * Contexto SQL Gerência — colunas de data por tabela lógica e opções de fetch (pré-repositório / SQL nomeado futuro).
 */
import { DEFAULT_PERIOD_DAYS, parsePeriodEnd, parsePeriodStart } from '../shared/period.js';

export function gerenciaSqlDateFilterEnabled(): boolean {
  const v = process.env.GERENCIA_SQL_DATE_FILTER;
  if (v == null || String(v).trim() === '') return true;
  return String(v).trim() !== '0';
}

/** Colunas de data por tabela lógica (catálogo / PBI). */
export const GERENCIA_FACT_DATE_COLUMNS: Record<string, string[]> = {
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

export function gerenciaFetchOpts(
  logical: string,
  query: Record<string, unknown> = {},
): Record<string, unknown> {
  if (!gerenciaSqlDateFilterEnabled()) return {};
  const cols = GERENCIA_FACT_DATE_COLUMNS[logical];
  if (!cols?.length) return {};
  const dateFrom = parsePeriodStart(query);
  const dateTo = parsePeriodEnd();
  return {
    dateFrom,
    dateTo,
    dateColumns: cols,
  };
}

export function gerenciaDatasetCacheKey(query: Record<string, unknown> = {}): string {
  if (!gerenciaSqlDateFilterEnabled()) return 'full';
  const p = Number(query?.period);
  const periodKey = Number.isFinite(p) && p > 0 ? p : DEFAULT_PERIOD_DAYS;
  return `df:${periodKey}`;
}
