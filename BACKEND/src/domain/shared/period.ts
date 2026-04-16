/**
 * Regras de intervalo de datas partilhadas (filtro `period` da API).
 */

export function parsePeriodStart(query: Record<string, unknown> = {}): Date {
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

export function isInPeriod(rowDate: Date | null, query: Record<string, unknown> = {}): boolean {
  if (!rowDate) return false;
  return rowDate >= parsePeriodStart(query);
}
