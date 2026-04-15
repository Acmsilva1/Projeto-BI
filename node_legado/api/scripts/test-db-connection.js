/**
 * Testa conexão com a mesma ordem de .env que server.js.
 * Não imprime passwords. Exit 0 = OK, 1 = falha.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const apiDir = path.join(__dirname, '..');
const repoRoot = path.join(apiDir, '..');

const envCandidates = [
  path.join(repoRoot, 'pipeline', '.env'),
  path.join(repoRoot, '.env'),
  path.join(apiDir, '.env'),
];

envCandidates.forEach((p) => {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: false });
    console.log('[test-db] Carregado:', p);
  }
});

function wantsPostgres() {
  return Boolean(
    String(process.env.DATABASE_URL || '').trim() ||
      String(process.env.PGHOST || process.env.PG_HOST || process.env.DB_HOST || '').trim(),
  );
}

async function main() {
  if (!wantsPostgres()) {
    console.log('[test-db] Nenhum DATABASE_URL, PGHOST/PG_HOST ou DB_HOST — não há Postgres configurado neste .env.');
    console.log('[test-db] Para testar SQLite, use o ficheiro em SQLITE_PATH ou db local/db_testes_replica.sqlite3.');
    process.exitCode = 1;
    return;
  }

  const { createPostgresDataLayer } = require('../db_postgres');
  const { LOGICAL_TO_SQLITE_TABLE } = require('../db_sqlite');

  let layer;
  try {
    layer = createPostgresDataLayer();
  } catch (e) {
    console.error('[test-db] Config inválida:', e.message);
    process.exitCode = 1;
    return;
  }

  const { pool, fetchView } = layer;

  try {
    const ping = await pool.query('SELECT 1 AS ok, current_database() AS db, current_user AS usr');
    const row = ping.rows[0];
    console.log('[test-db] Ping SQL:', { ok: row.ok, database: row.db, user: row.usr });
  } catch (e) {
    console.error('[test-db] Falha ao conectar:', e.message);
    process.exitCode = 1;
    await pool.end().catch(() => {});
    return;
  }

  const probeLogical = 'tbl_tempos_entrada_consulta_saida';
  try {
    const rows = await fetchView(probeLogical, {}, { limit: 1 });
    console.log('[test-db] Amostra', probeLogical + ':', rows.length ? `${Object.keys(rows[0]).length} colunas na 1ª linha` : '0 linhas (tabela vazia ou sem permissão)');
  } catch (e) {
    console.error('[test-db] Falha ao ler', probeLogical + ':', e.message);
    process.exitCode = 1;
    await pool.end().catch(() => {});
    return;
  }

  const logicalKeys = Object.keys(LOGICAL_TO_SQLITE_TABLE);
  let ok = 0;
  let fail = 0;
  for (const key of logicalKeys) {
    try {
      await fetchView(key, {}, { limit: 1 });
      ok += 1;
    } catch {
      fail += 1;
      console.warn('[test-db] Aviso: não foi possível ler', key);
    }
  }
  console.log('[test-db] Objetos mapeados:', logicalKeys.length, '| OK:', ok, '| falha:', fail);

  await pool.end().catch(() => {});
  console.log('[test-db] Conexão viável.');
}

main().catch((e) => {
  console.error('[test-db]', e);
  process.exitCode = 1;
});
