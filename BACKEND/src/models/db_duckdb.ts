/**
 * Camada DuckDB — mesma assinatura de fetchView das camadas SQLite/Postgres/CSV.
 * Usa DuckDB como engine local para consultar os CSV em `dados/`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parsePeriodEnd } from '../domain/shared/period.js';
import { LOGICAL_TO_SQLITE_TABLE, repoRoot, type FetchViewOptions } from './db_sqlite.js';

const require = createRequire(import.meta.url);
const UNIDADES_LOGICAL = new Set(['tbl_unidades', 'tbl_unidades_teste', 'tbl_unidades_prod']);

type DuckDbDb = {
  run: (
    sql: string,
    paramsOrCb?: unknown[] | ((err: unknown) => void),
    cb?: (err: unknown) => void,
  ) => void;
  all: (
    sql: string,
    paramsOrCb?: unknown[] | ((err: unknown, rows?: Record<string, unknown>[]) => void),
    cb?: (err: unknown, rows?: Record<string, unknown>[]) => void,
  ) => void;
};

type DuckDbDatabaseCtor = new (
  filename: string,
  cb?: (err: unknown) => void,
) => DuckDbDb;

function quoteDuckIdent(id: string): string {
  const s = String(id || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
    throw new Error(`Identificador DuckDB inválido: ${s}`);
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
    .map((c) => quoteDuckIdent(c))
    .join(', ');
}

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
  if (o.cd_estabelecimento == null && o.CD_ESTABELECIMENTO == null) {
    const badKey = Object.keys(o).find((k) => /^cd_estabelecimento:/i.test(k));
    if (badKey != null && o[badKey] != null) {
      o.cd_estabelecimento = o[badKey];
    }
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

function csvFileForLogical(csvDir: string, logical: string): string {
  return path.join(csvDir, `${logical}.csv`);
}

function sqlPathLiteral(p: string): string {
  return `'${String(p || '').replace(/'/g, "''")}'`;
}

function sqlTextLiteral(v: string): string {
  return `'${String(v || '').replace(/'/g, "''")}'`;
}

function runAsync(db: DuckDbDb, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Array.isArray(params) && params.length > 0) {
      db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
      return;
    }
    db.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function allAsync(db: DuckDbDb, sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    if (Array.isArray(params) && params.length > 0) {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(Array.isArray(rows) ? rows : []);
      });
      return;
    }
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

function resolveDuckDbCtor(): DuckDbDatabaseCtor {
  try {
    const mod = require('duckdb') as { Database: DuckDbDatabaseCtor };
    if (!mod?.Database) throw new Error('Pacote sem export Database');
    return mod.Database;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `[db_duckdb] Falha ao carregar pacote "duckdb": ${msg}. ` +
        'Instale em BACKEND com: npm install duckdb',
    );
  }
}

export function resolveDuckdbPath(): string {
  const raw = String(process.env.DUCKDB_PATH || '').trim();
  if (!raw) return path.join(repoRoot, 'db local', 'hospital_bi.duckdb');
  if (raw === ':memory:') return raw;
  return path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
}

export function createDuckdbDataLayer(duckdbPath: string, csvDir: string) {
  const absCsvDir = path.isAbsolute(csvDir) ? csvDir : path.resolve(repoRoot, csvDir);
  if (duckdbPath !== ':memory:') {
    const parent = path.dirname(duckdbPath);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
  }

  const Database = resolveDuckDbCtor();
  let resolveReady!: () => void;
  let rejectReady!: (reason?: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const db = new Database(duckdbPath, (err) => {
    if (err) rejectReady(err);
    else resolveReady();
  });

  async function ensureViews(): Promise<void> {
    await ready;
    for (const [logical, dotted] of Object.entries(LOGICAL_TO_SQLITE_TABLE)) {
      const fp = csvFileForLogical(absCsvDir, logical);
      if (!fs.existsSync(fp)) continue;
      const { schema, table } = parseSchemaTable(dotted);
      const schemaSql = quoteDuckIdent(schema);
      const tableSql = quoteDuckIdent(table);
      const fpSql = sqlPathLiteral(fp);
      await runAsync(db, `CREATE SCHEMA IF NOT EXISTS ${schemaSql}`);
      await runAsync(
        db,
        `CREATE OR REPLACE VIEW ${schemaSql}.${tableSql} AS ` +
          `SELECT * FROM read_csv_auto(${fpSql}, HEADER=true, ALL_VARCHAR=true)`,
      );
    }
  }

  let initPromise: Promise<void> | null = null;
  function ensureInitialized(): Promise<void> {
    if (!initPromise) initPromise = ensureViews();
    return initPromise;
  }

  async function fetchView(
    viewName: string,
    filters: Record<string, unknown> = {},
    options: FetchViewOptions = {},
  ): Promise<Record<string, unknown>[]> {
    void filters;
    await ensureInitialized();

    const logical = String(viewName || '').trim();
    const dotted = LOGICAL_TO_SQLITE_TABLE[logical];
    if (!dotted) {
      throw new Error(`DuckDB: objeto não mapeado: ${logical}`);
    }
    const fp = csvFileForLogical(absCsvDir, logical);
    if (!fs.existsSync(fp)) return [];

    const { schema, table } = parseSchemaTable(dotted);
    const { columns = '*', orderBy, ascending = true, limit, dateFrom, dateTo, dateColumns } = options;
    const cols = sanitizeColumns(columns);
    const fromSql = `${quoteDuckIdent(schema)}.${quoteDuckIdent(table)}`;
    let sql = `SELECT ${cols} FROM ${fromSql}`;
    const params: unknown[] = [];

    if (dateFrom instanceof Date && Array.isArray(dateColumns) && dateColumns.length > 0) {
      const isoFrom = dateFrom.toISOString();
      const isoTo = dateTo instanceof Date ? dateTo.toISOString() : parsePeriodEnd().toISOString();
      if (dateTo instanceof Date) {
        const orExpr = dateColumns
          .map((c) => {
            const qi = quoteDuckIdent(String(c).trim());
            return `(TRY_CAST(${qi} AS TIMESTAMP) >= TRY_CAST(${sqlTextLiteral(isoFrom)} AS TIMESTAMP) AND TRY_CAST(${qi} AS TIMESTAMP) <= TRY_CAST(${sqlTextLiteral(isoTo)} AS TIMESTAMP))`;
          })
          .join(' OR ');
        sql += ` WHERE (${orExpr})`;
      } else {
        const orExpr = dateColumns
          .map((c) => {
            const qi = quoteDuckIdent(String(c).trim());
            return `TRY_CAST(${qi} AS TIMESTAMP) >= TRY_CAST(${sqlTextLiteral(isoFrom)} AS TIMESTAMP)`;
          })
          .join(' OR ');
        sql += ` WHERE (${orExpr})`;
      }
    }

    if (orderBy) {
      sql += ` ORDER BY ${quoteDuckIdent(orderBy)} ${ascending ? 'ASC' : 'DESC'}`;
    }

    const lim = Number(limit);
    if (Number.isFinite(lim) && lim > 0) {
      sql += ` LIMIT ${Math.floor(lim)}`;
    }

    const rows = await allAsync(db, sql, params);
    return rows.map((r) => normalizeSqliteStyleRow(normalizeRow(logical, r)));
  }

  return { fetchView };
}
