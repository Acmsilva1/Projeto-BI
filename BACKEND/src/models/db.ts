import '../config/loadEnv.js';

/**
 * Fonte de dados da API:
 * - PostgreSQL se existir DATABASE_URL ou PGHOST/PG_HOST.
 * - Senão: CSV direto em `dados/` se DATA_SOURCE=csv, CSV_DATOS_DIR, ou réplica SQLite ausente com .csv em dados/.
 * - Senão: SQLite (SQLITE_PATH ou padrão na raiz do repo).
 */
import fs from 'node:fs';
import path from 'node:path';
import { setDataSourceKind } from './dataSource.js';
import { createCsvDataLayer, resolveCsvDatosDir } from './db_csv.js';
import { createSqliteDataLayer, defaultSqlitePath, repoRoot } from './db_sqlite.js';
import { createPostgresDataLayer } from './db_postgres.js';

export type FetchViewFn = (
  viewName: string,
  filters?: Record<string, unknown>,
  options?: import('./db_sqlite.js').FetchViewOptions,
) => Promise<Record<string, unknown>[]>;

function wantsPostgres(): boolean {
  const u = String(process.env.DATABASE_URL || '').trim();
  const h = String(process.env.PGHOST || process.env.PG_HOST || process.env.DB_HOST || '').trim();
  return Boolean(u || h);
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

if (wantsPostgres()) {
  const layer = createPostgresDataLayer();
  fetchView = layer.fetchView;
  setDataSourceKind('postgres');
  const safeUrl = process.env.DATABASE_URL
    ? '(DATABASE_URL)'
    : `${process.env.PGHOST || process.env.PG_HOST || process.env.DB_HOST}:${process.env.PGPORT || process.env.PG_PORT || process.env.DB_PORT || '5432'}/${process.env.PGDATABASE || process.env.PG_DATABASE || process.env.DB_NAME || ''}`;
  console.log('[db] PostgreSQL:', safeUrl);
} else {
  const rawPath = process.env.SQLITE_PATH;
  const sqlitePath = rawPath
    ? path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(repoRoot, rawPath)
    : defaultSqlitePath();

  const csvDir = resolveCsvDatosDir();
  const useCsv =
    wantsCsvExplicit() || (!fs.existsSync(sqlitePath) && datosDirHasCsv(path.join(repoRoot, 'dados')));

  if (useCsv) {
    if (!fs.existsSync(csvDir)) {
      console.warn('[db] Modo CSV: pasta não existe (views vazias até criar):', csvDir);
    }
    ({ fetchView } = createCsvDataLayer(csvDir));
    setDataSourceKind('csv');
    console.log('[db] CSV (leitura direta, agregação no Node):', csvDir);
  } else if (!fs.existsSync(sqlitePath)) {
    throw new Error(
      `[db] Sem base de dados: ficheiro SQLite não encontrado (${sqlitePath}). ` +
        'Opções: defina DATA_SOURCE=csv e coloque .csv em dados/ (nomes lógicos), ou configure PostgreSQL, ' +
        'ou crie a réplica em "db local/".',
    );
  } else {
    ({ fetchView } = createSqliteDataLayer(sqlitePath));
    setDataSourceKind('sqlite');
    console.log('[db] SQLite:', sqlitePath);
  }
}

export { fetchView };
