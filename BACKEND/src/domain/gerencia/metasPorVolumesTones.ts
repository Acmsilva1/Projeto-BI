/**
 * Tons semânticos para a matriz "Metas por volumes" — regra de negócio (domínio Gerência).
 */
export type RowFlags = { isP: boolean; isReverso: boolean };

export type MainTone = 'zero' | 'ok' | 'warn' | 'bad' | 'neutral';
export type DeltaTone = 'flat' | 'up' | 'down';
export type TotalTone = 'muted' | 'ok' | 'bad' | 'neutral';

function toneMainCell(v: unknown, row: RowFlags, firstMonthDelta: unknown): MainTone {
  const n = Number(v);
  const fd = Number(firstMonthDelta);
  const isZero = !Number.isFinite(n) || (n === 0 && Number.isFinite(fd) && fd === 0);
  if (isZero) return 'zero';
  if (row.isP && row.isReverso) {
    if (n <= 5) return 'ok';
    if (n <= 12) return 'warn';
    return 'bad';
  }
  if (row.isP && !row.isReverso) {
    if (n >= 88) return 'ok';
    if (n >= 75) return 'warn';
    return 'bad';
  }
  return 'neutral';
}

function toneDelta(d: unknown): DeltaTone {
  const n = Number(d);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  if (n > 0) return 'up';
  return 'down';
}

function toneTotalV(v: unknown, row: RowFlags): TotalTone {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return 'muted';
  if (row.isP && row.isReverso) return n <= 8 ? 'ok' : 'bad';
  if (row.isP && !row.isReverso) return n >= 85 ? 'ok' : 'bad';
  return 'neutral';
}

function toneYtd(y: unknown, row: Pick<RowFlags, 'isReverso'>): TotalTone {
  const n = Number(y);
  if (!Number.isFinite(n) || n === 0) return 'muted';
  if (row.isReverso) {
    if (n < 0) return 'ok';
    if (n > 0) return 'bad';
    return 'muted';
  }
  if (n > 0) return 'ok';
  if (n < 0) return 'bad';
  return 'muted';
}

function enrichMeses(
  meses: Array<{ v: number; d: number; sec?: string }>,
  row: RowFlags,
): Array<{ v: number; d: number; sec?: string; toneV: MainTone; toneD: DeltaTone }> {
  const firstD = meses[0]?.d;
  return meses.map((cell) => ({
    ...cell,
    toneV: toneMainCell(cell.v, row, firstD),
    toneD: toneDelta(cell.d),
  }));
}

function enrichT(
  t: { v: number; ytd: number; sec?: string },
  row: RowFlags,
): { v: number; ytd: number; sec?: string; toneV: TotalTone; toneYtd: TotalTone } {
  return {
    ...t,
    toneV: toneTotalV(t.v, row),
    toneYtd: toneYtd(t.ytd, row),
  };
}

type MetasRow = {
  isP: boolean;
  isReverso: boolean;
  meses: Array<{ v: number; d: number; sec?: string }>;
  t: { v: number; ytd: number; sec?: string };
  subItems: Array<{
    unidadeId?: string;
    name?: string;
    meses: Array<{ v: number; d: number; sec?: string }>;
    t: { v: number; ytd: number; sec?: string };
  }>;
};

export function attachMetasPorVolumesUiTones(rows: MetasRow[]): MetasRow[] {
  return rows.map((row) => {
    const flags: RowFlags = { isP: Boolean(row.isP), isReverso: Boolean(row.isReverso) };
    const subItems = (row.subItems || []).map((sub) => ({
      ...sub,
      meses: enrichMeses(sub.meses || [], flags),
      t: enrichT(sub.t || { v: 0, ytd: 0, sec: '(0)' }, flags),
    }));
    return {
      ...row,
      meses: enrichMeses(row.meses || [], flags),
      t: enrichT(row.t || { v: 0, ytd: 0, sec: '(0)' }, flags),
      subItems,
    };
  });
}

export function attachMetasPorVolumesPorIndicadorUiTones(
  unidades: Array<{
    unidadeId?: string;
    name?: string;
    meses: Array<{ v: number; d: number; sec?: string }>;
    t: { v: number; ytd: number; sec?: string };
  }>,
  flags: RowFlags,
) {
  return unidades.map((sub) => ({
    ...sub,
    meses: enrichMeses(sub.meses || [], flags),
    t: enrichT(sub.t || { v: 0, ytd: 0, sec: '(0)' }, flags),
  }));
}
