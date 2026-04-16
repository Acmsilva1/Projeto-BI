/**
 * Camada CSV — mesma assinatura que fetchView em SQLite/Postgres.
 * Ficheiros: <CSV_DATOS_DIR ou repo/dados>/<nome_logico>.csv (nome lógico = chave em LOGICAL_TO_SQLITE_TABLE).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../lib/parsr/csv.js';
import { LOGICAL_TO_SQLITE_TABLE, repoRoot, type FetchViewOptions } from './db_sqlite.js';

const UNIDADES_LOGICAL = new Set(['tbl_unidades', 'tbl_unidades_teste', 'tbl_unidades_prod']);

const tableCache = new Map<string, { mtimeMs: number; rows: Record<string, unknown>[] }>();

function normalizeRow(logical: string, row: Record<string, unknown>): Record<string, unknown> {
  if (UNIDADES_LOGICAL.has(logical)) {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      o[String(k).toLowerCase()] = v;
    }
    return o;
  }
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    o[String(k).toUpperCase()] = v;
  }
  return o;
}

function normalizeSqliteStyleRow(row: Record<string, unknown>): Record<string, unknown> {
  if (!row || typeof row !== 'object') return row;
  const o = row;
  if (o.cd_estabelecimento == null && o.CD_ESTABELECIMENTO != null) {
    o.cd_estabelecimento = o.CD_ESTABELECIMENTO;
  }
  if (o.cd_estabelecimento == null && o.CD_ESTABELECIMENTO == null) {
    const badKey = Object.keys(o).find((k) => /^cd_estabelecimento:/i.test(k));
    if (badKey != null && o[badKey] != null) {
      o.cd_estabelecimento = o[badKey];
    }
  }
  return o;
}

function toDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function rowMatchesDateFrom(
  row: Record<string, unknown>,
  dateFrom: Date,
  dateColumns: string[],
): boolean {
  const t = dateFrom.getTime();
  for (const col of dateColumns) {
    const variants = [col, col.toUpperCase(), col.toLowerCase()];
    for (const k of variants) {
      const d = toDate(row[k]);
      if (d && d.getTime() >= t) return true;
    }
  }
  return false;
}

function resolveCell(row: Record<string, unknown>, col: string): unknown {
  if (col in row) return row[col];
  const u = col.toUpperCase();
  if (u in row) return row[u];
  const low = col.toLowerCase();
  if (low in row) return row[low];
  return undefined;
}

function loadTable(csvDir: string, logical: string): Record<string, unknown>[] {
  if (!LOGICAL_TO_SQLITE_TABLE[logical]) {
    throw new Error(`CSV: objeto não mapeado: ${logical}`);
  }
  const fp = path.join(csvDir, `${logical}.csv`);
  if (!fs.existsSync(fp)) {
    return [];
  }
  const st = fs.statSync(fp);
  const hit = tableCache.get(fp);
  if (hit && hit.mtimeMs === st.mtimeMs) {
    return hit.rows;
  }
  const text = fs.readFileSync(fp, 'utf8');
  const matrix = parseCsv(text);
  if (!matrix.length) {
    tableCache.set(fp, { mtimeMs: st.mtimeMs, rows: [] });
    return [];
  }
  const headers = matrix[0].map((h) => String(h ?? '').trim()).filter(Boolean);
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const cells = matrix[i];
    if (!cells?.some((c) => String(c ?? '').trim() !== '')) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      obj[h] = cells[j] != null ? cells[j] : '';
    });
    const norm = normalizeSqliteStyleRow(normalizeRow(logical, obj));
    rows.push(norm);
  }
  tableCache.set(fp, { mtimeMs: st.mtimeMs, rows });
  return rows;
}

export function resolveCsvDatosDir(): string {
  const raw = String(process.env.CSV_DATOS_DIR || '').trim();
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
  }
  return path.join(repoRoot, 'dados');
}

export function createCsvDataLayer(csvDir: string) {
  const absDir = path.isAbsolute(csvDir) ? csvDir : path.resolve(repoRoot, csvDir);

  async function fetchView(
    viewName: string,
    filters: Record<string, unknown> = {},
    options: FetchViewOptions = {},
  ): Promise<Record<string, unknown>[]> {
    void filters;
    const logical = String(viewName || '').trim();
    if (!LOGICAL_TO_SQLITE_TABLE[logical]) {
      throw new Error(`CSV: objeto não mapeado: ${logical}`);
    }

    let rows = loadTable(absDir, logical);

    const { columns = '*', orderBy, ascending = true, limit, dateFrom, dateColumns } = options;

    if (dateFrom instanceof Date && Array.isArray(dateColumns) && dateColumns.length > 0) {
      rows = rows.filter((r) => rowMatchesDateFrom(r, dateFrom, dateColumns));
    }

    if (columns && String(columns).trim() !== '*') {
      const want = String(columns)
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      rows = rows.map((r) => {
        const o: Record<string, unknown> = {};
        for (const c of want) {
          o[c] = resolveCell(r, c);
        }
        return o;
      });
    }

    if (orderBy) {
      const key = String(orderBy).trim();
      rows = [...rows].sort((a, b) => {
        const va = resolveCell(a, key);
        const vb = resolveCell(b, key);
        const na = Number(va);
        const nb = Number(vb);
        if (Number.isFinite(na) && Number.isFinite(nb) && String(va) === String(na) && String(vb) === String(nb)) {
          return ascending ? na - nb : nb - na;
        }
        const sa = String(va ?? '');
        const sb = String(vb ?? '');
        const cmp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
        return ascending ? cmp : -cmp;
      });
    }

    const lim = Number(limit);
    if (Number.isFinite(lim) && lim > 0) {
      rows = rows.slice(0, Math.floor(lim));
    }

    return rows;
  }

  return { fetchView };
}
