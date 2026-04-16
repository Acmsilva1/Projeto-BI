/**
 * Camada PostgreSQL — mesma assinatura que createSqliteDataLayer().fetchView.
 */
import { Pool, type PoolConfig } from 'pg';
import { LOGICAL_TO_SQLITE_TABLE, type FetchViewOptions } from './db_sqlite.js';

const UNIDADES_LOGICAL = new Set(['tbl_unidades', 'tbl_unidades_teste', 'tbl_unidades_prod']);

function sslFromEnv(): false | { rejectUnauthorized: boolean } {
  const mode = String(process.env.PGSSLMODE || process.env.PG_SSLMODE || '').toLowerCase();
  if (mode === 'require' || mode === 'verify-full') return { rejectUnauthorized: mode === 'verify-full' };
  if (process.env.PGSSL === '1' || process.env.PG_SSL === '1') return { rejectUnauthorized: false };
  return false;
}

function stripOuterQuotes(s: string | undefined): string {
  const t = String(s || '').trim();
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1);
  }
  return t;
}

export function resolvePoolConfig(): (PoolConfig & { connectionString?: string }) | null {
  const url = String(process.env.DATABASE_URL || '').trim();
  if (url) {
    return { connectionString: url, ssl: sslFromEnv() };
  }
  const host = String(process.env.PGHOST || process.env.PG_HOST || process.env.DB_HOST || '').trim();
  if (!host) return null;
  const port = parseInt(String(process.env.PGPORT || process.env.PG_PORT || process.env.DB_PORT || '5432'), 10);
  const database = String(
    process.env.PGDATABASE || process.env.PG_DATABASE || process.env.DB_NAME || 'postgres',
  ).trim();
  const user = stripOuterQuotes(
    String(process.env.PGUSER || process.env.PG_USER || process.env.DB_READ_USER || process.env.DB_USER || ''),
  );
  const password = stripOuterQuotes(
    String(
      process.env.PGPASSWORD ||
        process.env.PG_PASSWORD ||
        process.env.DB_READ_PASSWORD ||
        process.env.DB_PASSWORD ||
        '',
    ),
  );
  return {
    host,
    port,
    database,
    user: user || undefined,
    password: password || undefined,
    ssl: sslFromEnv(),
  };
}

function quotePgIdent(part: string): string {
  const s = String(part || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
    throw new Error(`Identificador PostgreSQL inválido: ${s}`);
  }
  return `"${s.replace(/"/g, '""')}"`;
}

function sanitizeColumns(columns: string | undefined): string {
  const raw = String(columns || '*').trim();
  if (raw === '*') return '*';
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => quotePgIdent(c))
    .join(', ');
}

function normalizePgRow(logical: string, row: Record<string, unknown>): Record<string, unknown> {
  if (!row || typeof row !== 'object') return row;
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

function parseSchemaTable(dotted: string): { schema: string; table: string } {
  const s = String(dotted || '').trim();
  const i = s.indexOf('.');
  if (i <= 0 || i === s.length - 1) {
    throw new Error(`Nome schema.tabela inválido: ${dotted}`);
  }
  return { schema: s.slice(0, i), table: s.slice(i + 1) };
}

function statementTimeoutOptions(): string {
  const raw = String(process.env.PG_STATEMENT_TIMEOUT_MS || '300000').trim();
  const ms = parseInt(raw, 10);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const capped = Math.min(Math.max(ms, 1000), 3_600_000);
  return `-c statement_timeout=${capped}`;
}

export function createPostgresDataLayer() {
  const cfg = resolvePoolConfig();
  if (!cfg) {
    throw new Error(
      '[db_postgres] Defina DATABASE_URL, ou PGHOST (+ PGDATABASE/PGUSER/PGPASSWORD), ou DB_HOST (+ DB_NAME/DB_READ_USER/DB_READ_PASSWORD).',
    );
  }
  const st = statementTimeoutOptions();
  let poolCfg: PoolConfig = cfg;
  if (st) {
    if (cfg.connectionString) {
      const sep = String(cfg.connectionString).includes('?') ? '&' : '?';
      poolCfg = {
        ...cfg,
        connectionString: `${cfg.connectionString}${sep}options=${encodeURIComponent(st)}`,
      };
    } else {
      poolCfg = { ...cfg, options: [cfg.options, st].filter(Boolean).join(' ') };
    }
  }
  const pool = new Pool(poolCfg);
  pool.on('error', (err) => {
    console.error('[db] PostgreSQL pool:', err?.message || err);
  });

  async function fetchView(
    viewName: string,
    filters: Record<string, unknown> = {},
    options: FetchViewOptions = {},
  ): Promise<Record<string, unknown>[]> {
    void filters;
    const logical = String(viewName || '').trim();
    const dotted = LOGICAL_TO_SQLITE_TABLE[logical];
    if (!dotted) {
      throw new Error(`PostgreSQL: objeto não mapeado: ${logical}`);
    }
    const { schema, table } = parseSchemaTable(dotted);
    const { columns = '*', orderBy, ascending = true, limit, dateFrom, dateColumns } = options;
    const cols = sanitizeColumns(columns);
    const fromSql = `${quotePgIdent(schema)}.${quotePgIdent(table)}`;
    let sql = `SELECT ${cols} FROM ${fromSql}`;
    const params: string[] = [];
    if (dateFrom instanceof Date && Array.isArray(dateColumns) && dateColumns.length > 0) {
      const iso = dateFrom.toISOString();
      const orExpr = dateColumns
        .map((c) => `${quotePgIdent(String(c).trim().toLowerCase())}::timestamp >= $1::timestamp`)
        .join(' OR ');
      sql += ` WHERE (${orExpr})`;
      params.push(iso);
    }
    if (orderBy) {
      sql += ` ORDER BY ${quotePgIdent(orderBy)} ${ascending ? 'ASC' : 'DESC'}`;
    }
    const lim = Number(limit);
    if (Number.isFinite(lim) && lim > 0) {
      sql += ` LIMIT ${Math.floor(lim)}`;
    }
    const result = params.length ? await pool.query(sql, params) : await pool.query(sql);
    return (result.rows || []).map((r) => normalizePgRow(logical, r as Record<string, unknown>));
  }

  return { fetchView, pool };
}
