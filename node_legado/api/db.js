/**
 * Fonte de dados da API:
 * - PostgreSQL se existir DATABASE_URL ou PGHOST/PG_HOST (mesmas tabelas que o PBI / réplica).
 * - Caso contrário: SQLite (SQLITE_PATH ou padrão db local/db_testes_replica.sqlite3).
 *
 * Mapa lógico → schema.tabela: db_sqlite.js (LOGICAL_TO_SQLITE_TABLE).
 */
const fs = require('fs');
const path = require('path');
const { createSqliteDataLayer, defaultSqlitePath } = require('./db_sqlite');

function wantsPostgres() {
  const u = String(process.env.DATABASE_URL || '').trim();
  const h = String(process.env.PGHOST || process.env.PG_HOST || process.env.DB_HOST || '').trim();
  return Boolean(u || h);
}

let fetchView;

if (wantsPostgres()) {
  const { createPostgresDataLayer } = require('./db_postgres');
  const layer = createPostgresDataLayer();
  fetchView = layer.fetchView;
  const safeUrl = process.env.DATABASE_URL
    ? '(DATABASE_URL)'
    : `${process.env.PGHOST || process.env.PG_HOST || process.env.DB_HOST}:${process.env.PGPORT || process.env.PG_PORT || process.env.DB_PORT || '5432'}/${process.env.PGDATABASE || process.env.PG_DATABASE || process.env.DB_NAME || ''}`;
  console.log('[db] PostgreSQL:', safeUrl);
} else {
  const repoRoot = path.join(__dirname, '..');
  const rawPath = process.env.SQLITE_PATH;
  const sqlitePath = rawPath
    ? path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(repoRoot, rawPath)
    : defaultSqlitePath();

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(
      `[db] Arquivo SQLite não encontrado: ${sqlitePath}. ` +
        'Coloque db_testes_replica.sqlite3 em "db local/" na raiz, defina SQLITE_PATH, ' +
        'ou configure PostgreSQL (DATABASE_URL ou PGHOST + PGDATABASE + PGUSER + PGPASSWORD).',
    );
  }

  console.log('[db] SQLite:', sqlitePath);
  ({ fetchView } = createSqliteDataLayer(sqlitePath));
}

module.exports = { fetchView };
