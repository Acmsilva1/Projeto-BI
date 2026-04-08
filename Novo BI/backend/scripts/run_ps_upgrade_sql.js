/**
 * Aplica tabelas/views/seed do upgrade PS no Postgres (Supabase ou local).
 * Requer DATABASE_URI no .env (Supabase → Settings → Database → Connection string → URI).
 * Use a senha do banco, não a anon key.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DATABASE_URI = process.env.DATABASE_URI || process.env.DATABASE_URL;

const SQL_ROOT = path.join(__dirname, '..', '..', 'sql');
const DB_FILES = [
  path.join(SQL_ROOT, 'database', 'fato_ps_perfil.sql'),
  path.join(SQL_ROOT, 'database', 'fato_ps_fluxo.sql'),
  path.join(SQL_ROOT, 'database', 'fato_ps_medicacao.sql'),
  path.join(SQL_ROOT, 'database', 'fato_ps_conversao_mensal.sql'),
  path.join(SQL_ROOT, 'database', 'vw_realtime_ps_perfil.sql'),
  path.join(SQL_ROOT, 'database', 'vw_realtime_ps_fluxos.sql'),
  path.join(SQL_ROOT, 'database', 'vw_realtime_ps_medicacao.sql'),
  path.join(SQL_ROOT, 'database', 'vw_realtime_ps_conversao.sql'),
  path.join(SQL_ROOT, 'ps_upgrade_grants.sql'),
];

const SEED_FILE = path.join(SQL_ROOT, '002_ps_upgrade_seed.sql');

async function run() {
  if (!DATABASE_URI) {
    console.error(
      '[ERRO] Defina DATABASE_URI (ou DATABASE_URL) no backend/.env com a connection string Postgres do Supabase.',
    );
    console.error('       Dashboard → Project Settings → Database → Connection string → URI (modo Session ou Transaction).');
    process.exit(1);
  }

  const client = new Client({
    connectionString: DATABASE_URI,
    ssl: DATABASE_URI.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('[OK] Conectado ao banco.');

  for (const file of DB_FILES) {
    if (!fs.existsSync(file)) {
      console.warn('[SKIP] Arquivo não encontrado:', file);
      continue;
    }
    const sql = fs.readFileSync(file, 'utf8').trim();
    if (!sql) continue;
    console.log('[RUN]', path.basename(file));
    await client.query(sql);
  }

  if (fs.existsSync(SEED_FILE)) {
    console.log('[RUN]', path.basename(SEED_FILE));
    await client.query(fs.readFileSync(SEED_FILE, 'utf8'));
  }

  await client.end();
  console.log('[OK] Migração PS upgrade concluída.');
}

run().catch((err) => {
  console.error('[FALHA]', err.message);
  process.exit(1);
});
