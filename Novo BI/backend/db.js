/**
 * Fonte única de dados: SQLite local (réplica com dados sintéticos).
 *
 * Caminho do arquivo: variável SQLITE_PATH (absoluta ou relativa ao cwd)
 * ou padrão ../db local/db_testes_replica.sqlite3 em relação a este diretório.
 */
const fs = require('fs');
const path = require('path');
const { createSqliteDataLayer, defaultSqlitePath } = require('./db_sqlite');

const rawPath = process.env.SQLITE_PATH;
const sqlitePath = rawPath
  ? path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath)
  : defaultSqlitePath();

if (!fs.existsSync(sqlitePath)) {
  throw new Error(
    `[db] Arquivo SQLite não encontrado: ${sqlitePath}. ` +
      'Coloque db_testes_replica.sqlite3 em "Novo BI/db local/" ou defina SQLITE_PATH no .env.',
  );
}

console.log('[db] SQLite:', sqlitePath);
const { fetchView } = createSqliteDataLayer(sqlitePath);

module.exports = { fetchView };
