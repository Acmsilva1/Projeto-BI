import '../config/loadEnv.js';

/**
 * Fonte de dados da API:
 * - Se DATA_SOURCE for explicito: postgres | duckdb | csv | sqlite.
 * - Sem DATA_SOURCE explicito: PostgreSQL se houver DATABASE_URL/PGHOST.
 * - Sem PostgreSQL: CSV direto em `dados/` quando DATA_SOURCE=csv, CSV_DATOS_DIR,
 *   ou quando SQLite nao existir e houver .csv.
 * - Caso contrario: SQLite.
 */
import fs from 'node:fs';
import path from 'node:path';
import { setDataSourceKind } from './dataSource.js';
import { createCsvDataLayer, resolveCsvDatosDir } from './db_csv.js';
import { createDuckdbDataLayer, resolveDuckdbPath } from './db_duckdb.js';
import { createPostgresDataLayer } from './db_postgres.js';
import { createSqliteDataLayer, defaultSqlitePath, repoRoot } from './db_sqlite.js';

export type FetchViewFn = (
  viewName: string,
  filters?: Record<string, unknown>,
  options?: import('./db_sqlite.js').FetchViewOptions,
) => Promise<Record<string, unknown>[]>;

type ExplicitSource = 'postgres' | 'duckdb' | 'csv' | 'sqlite';

function explicitDataSource(): ExplicitSource | null {
  const v = String(process.env.DATA_SOURCE || '')
    .toLowerCase()
    .trim();
  if (v === 'postgres' || v === 'duckdb' || v === 'csv' || v === 'sqlite') return v;
  return null;
}

function wantsPostgres(): boolean {
  const u = String(process.env.DATABASE_URL || '').trim();
  const h = String(process.env.PGHOST || process.env.PG_HOST || process.env.DB_HOST || '').trim();
  return Boolean(u || h);
}

function wantsDuckdbExplicit(): boolean {
  const v = String(process.env.DATA_SOURCE || '')
    .toLowerCase()
    .trim();
  if (v === 'duckdb') return true;
  return String(process.env.DUCKDB_PATH || '').trim() !== '';
}

function wantsCsvExplicit(): boolean {
  const v = String(process.env.DATA_SOURCE || '').toLowerCase().trim();
  if (v === 'csv') return true;
  return String(process.env.CSV_DATOS_DIR || '').trim() !== '';
}

function datosDirHasCsv(datosDir: string): boolean {
  if (!fs.existsSync(datosDir)) return false;
  return fs.readdirSync(datosDir).some((f) => /\.csv$/i.test(f));
}

let fetchView: FetchViewFn;

const forced = explicitDataSource();

if (forced === 'postgres' || (forced == null && wantsPostgres())) {
  const layer = createPostgresDataLayer();
  fetchView = layer.fetchView;
  setDataSourceKind('postgres');
  const safeUrl = process.env.DATABASE_URL
    ? '(DATABASE_URL)'
    : `${process.env.PGHOST || process.env.PG_HOST || process.env.DB_HOST}:${process.env.PGPORT || process.env.PG_PORT || process.env.DB_PORT || '5432'}/${process.env.PGDATABASE || process.env.PG_DATABASE || process.env.DB_NAME || ''}`;
  console.log('[db] PostgreSQL:', safeUrl);
} else if (forced === 'duckdb' || (forced == null && wantsDuckdbExplicit())) {
  const csvDir = resolveCsvDatosDir();
  const duckdbPath = resolveDuckdbPath();
  const duckLayer = createDuckdbDataLayer(duckdbPath, csvDir);
  const csvLayer = createCsvDataLayer(csvDir);
  let duckAvailable = true;
  const DUCKDB_FAILFAST_MS = (() => {
    const n = Number(process.env.DUCKDB_FAILFAST_MS ?? '1500');
    return Number.isFinite(n) && n >= 100 ? Math.min(Math.floor(n), 10_000) : 1500;
  })();

  function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = setTimeout(() => reject(new Error(`DuckDB timeout > ${ms}ms`)), ms);
      p.then(
        (v) => {
          clearTimeout(id);
          resolve(v);
        },
        (err) => {
          clearTimeout(id);
          reject(err);
        },
      );
    });
  }

  fetchView = async (viewName, filters = {}, options = {}) => {
    if (duckAvailable) {
      try {
        return await withTimeout(duckLayer.fetchView(viewName, filters, options), DUCKDB_FAILFAST_MS);
      } catch (e) {
        duckAvailable = false;
        setDataSourceKind('csv');
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[db] DuckDB indisponivel, fallback para CSV: ${msg}`);
      }
    }
    return csvLayer.fetchView(viewName, filters, options);
  };
  setDataSourceKind('duckdb');
  console.log('[db] DuckDB:', duckdbPath, '| csv_dir:', csvDir);
} else {
  const rawPath = process.env.SQLITE_PATH;
  const sqlitePath = rawPath
    ? path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(repoRoot, rawPath)
    : defaultSqlitePath();

  const csvDir = resolveCsvDatosDir();
  const useCsv =
    forced === 'csv' ||
    (forced == null && (wantsCsvExplicit() || (!fs.existsSync(sqlitePath) && datosDirHasCsv(path.join(repoRoot, 'dados')))));

  if (useCsv) {
    if (!fs.existsSync(csvDir)) {
      console.warn('[db] Modo CSV: pasta nao existe (views vazias ate criar):', csvDir);
    }
    ({ fetchView } = createCsvDataLayer(csvDir));
    setDataSourceKind('csv');
    console.log('[db] CSV (leitura direta, agregacao no Node):', csvDir);
  } else if (forced === 'sqlite' || fs.existsSync(sqlitePath)) {
    ({ fetchView } = createSqliteDataLayer(sqlitePath));
    setDataSourceKind('sqlite');
    console.log('[db] SQLite:', sqlitePath);
  } else if (!fs.existsSync(sqlitePath)) {
    throw new Error(
      `[db] Sem base de dados: ficheiro SQLite nao encontrado (${sqlitePath}). ` +
        'Opcoes: defina DATA_SOURCE=duckdb/csv e coloque .csv em dados/ (nomes logicos), ou configure PostgreSQL, ' +
        'ou crie a replica em "db local/".',
    );
  } else {
    throw new Error(`[db] DATA_SOURCE invalido ou nao suportado: ${String(process.env.DATA_SOURCE || '')}`);
  }
}

export { fetchView };
