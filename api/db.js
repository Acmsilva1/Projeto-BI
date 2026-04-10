/**
 * Fonte única de dados: SQLite local (réplica com dados sintéticos).
 *
 * SQLITE_PATH: absoluto, ou relativo à raiz do repositório (pai de api/), não ao cwd.
 * Padrão: db local/db_testes_replica.sqlite3
 */
const fs = require('fs');
const path = require('path');
const { createSqliteDataLayer, defaultSqlitePath } = require('./db_sqlite');

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
      'Coloque db_testes_replica.sqlite3 em "db local/" na raiz do repositório ou defina SQLITE_PATH no .env.',
  );
}

console.log('[db] SQLite:', sqlitePath);
const { fetchView } = createSqliteDataLayer(sqlitePath);

module.exports = { fetchView };
