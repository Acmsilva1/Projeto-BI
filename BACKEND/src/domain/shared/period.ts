/**
 * Regras de intervalo de datas partilhadas (filtro `period` da API).
 * Omissão = poucos dias para arranque rápido (CSV / agregação no Node).
 */
export const DEFAULT_PERIOD_DAYS = 7;

export function parsePeriodStart(query: Record<string, unknown> = {}): Date {
  const days = Number(query.period);
  const now = parsePeriodEnd(query);
  if (days === 366) return new Date(now.getFullYear(), 0, 1);
  if (Number.isFinite(days) && days > 0) {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  }
  const d = new Date(now);
  d.setDate(d.getDate() - DEFAULT_PERIOD_DAYS);
  return d;
}

/** Instantâneo “agora” para fechar a janela [início, fim] do mesmo pedido. */
export function parsePeriodEnd(query: Record<string, unknown> = {}): Date {
  const raw = query.date_to ?? query.dateTo;
  if (raw != null && String(raw).trim() !== '') {
    const d = new Date(String(raw));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function isInPeriod(rowDate: Date | null, query: Record<string, unknown> = {}): boolean {
  if (!rowDate) return false;
  const from = parsePeriodStart(query);
  const to = parsePeriodEnd(query);
  return rowDate >= from && rowDate <= to;
}
