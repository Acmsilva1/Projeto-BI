#!/usr/bin/env node
/**
 * CSV -> Supabase/PostgreSQL:
 * - cria schemas
 * - recria tabelas a partir dos headers dos CSV (colunas em snake_case minúsculo)
 * - carrega os dados em lotes
 *
 * Uso:
 *   npm run pipeline:supabase -- --dry-run
 *   npm run pipeline:supabase -- --dir ../dados --mode replace
 *
 * Requer:
 *   DATABASE_URL no ambiente (.env na raiz/BACKEND já é carregado por loadEnv)
 */
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import '../config/loadEnv.js';
import { parseCsv, stripBom } from '../lib/parsr/csv.js';
import { LOGICAL_TO_SQLITE_TABLE, repoRoot } from '../models/db_sqlite.js';

type Mode = 'replace' | 'truncate' | 'append';

type CliOptions = {
  dir: string;
  delimiter: string;
  dryRun: boolean;
  mode: Mode;
  batchSize: number;
};

function resolveDatabaseUrlFromEnv(): string {
  const direct = String(process.env.DATABASE_URL || '').trim();
  if (direct) {
    try {
      const u = new URL(direct);
      const sslmode = String(u.searchParams.get('sslmode') || '').toLowerCase();
      const compat = String(u.searchParams.get('uselibpqcompat') || '').toLowerCase();
      if (sslmode === 'require' && compat !== 'true') {
        u.searchParams.set('uselibpqcompat', 'true');
      }
      return u.toString();
    } catch {
      return direct;
    }
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const pwd = String(process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD || '').trim();
  const user = String(process.env.SUPABASE_DB_USER || 'postgres').trim();
  const dbName = String(process.env.SUPABASE_DB_NAME || 'postgres').trim();
  const port = Number(process.env.SUPABASE_DB_PORT || 5432);
  const sslmode = String(process.env.SUPABASE_SSLMODE || 'require').trim();

  if (!supabaseUrl || !pwd) return '';

  let ref = '';
  try {
    const u = new URL(supabaseUrl);
    ref = String(u.hostname || '').split('.')[0] || '';
  } catch {
    return '';
  }
  if (!ref) return '';

  const host = String(process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`).trim();
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pwd)}@${host}:${port}/${encodeURIComponent(dbName)}?sslmode=${encodeURIComponent(sslmode)}&uselibpqcompat=true`;
}

function parseArgs(argv: string[]): CliOptions {
  const out: CliOptions = {
    dir: path.join(repoRoot, 'dados'),
    delimiter: ',',
    dryRun: false,
    mode: 'replace',
    batchSize: 500,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = String(argv[i] || '');
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--dir' && argv[i + 1]) {
      out.dir = path.resolve(String(argv[i + 1]));
      i += 1;
    } else if (a === '--delimiter' && argv[i + 1]) {
      out.delimiter = String(argv[i + 1] || ',');
      i += 1;
    } else if (a === '--mode' && argv[i + 1]) {
      const m = String(argv[i + 1] || '').trim().toLowerCase();
      if (m === 'replace' || m === 'truncate' || m === 'append') out.mode = m;
      i += 1;
    } else if (a === '--batch-size' && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n > 0) out.batchSize = Math.floor(n);
      i += 1;
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp(): void {
  console.log(`
Hospital BI - CSV -> Supabase/PostgreSQL

Uso:
  npm run pipeline:supabase -- [opções]

Opções:
  --dir <pasta>         Pasta dos .csv (omissão: <repo>/dados)
  --delimiter <char>    Separador CSV (, ou ;)
  --mode <modo>         replace | truncate | append (omissão: replace)
  --batch-size <n>      Linhas por INSERT (omissão: 500)
  --dry-run             Só valida e mostra plano, sem escrever no BD
  --help                Esta ajuda

Importante:
  - DATABASE_URL precisa apontar para o Postgres do Supabase.
  - Em mode=replace, cada tabela é recriada (DROP + CREATE).
`);
}

function quoteIdent(name: string): string {
  const s = String(name || '').trim();
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) {
    throw new Error(`Identificador PostgreSQL inválido: ${s}`);
  }
  return `"${s.replace(/"/g, '""')}"`;
}

function parseSchemaTable(dotted: string): { schema: string; table: string } {
  const s = String(dotted || '').trim();
  const i = s.indexOf('.');
  if (i <= 0 || i === s.length - 1) {
    throw new Error(`Nome schema.tabela inválido: ${s}`);
  }
  return { schema: s.slice(0, i), table: s.slice(i + 1) };
}

function normalizeColumnName(raw: string, index: number, used: Set<string>): string {
  const base = stripBom(String(raw || ''))
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  let out = base;
  if (!out) out = `col_${index + 1}`;
  if (/^[0-9]/.test(out)) out = `c_${out}`;
  if (!/^[a-z_][a-z0-9_]*$/.test(out)) out = `col_${index + 1}`;

  let finalName = out;
  let n = 2;
  while (used.has(finalName)) {
    finalName = `${out}_${n}`;
    n += 1;
  }
  used.add(finalName);
  return finalName;
}

function rowsFromCsv(filePath: string, delimiter: string): { headers: string[]; rows: string[][] } {
  const text = fs.readFileSync(filePath, 'utf8');
  const matrix = parseCsv(text, delimiter);
  if (!matrix.length) return { headers: [], rows: [] };
  const headers = matrix[0].map((h) => String(h ?? '').trim());
  const rows = matrix.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  return { headers, rows };
}

async function ensureSchema(pool: Pool, schema: string): Promise<void> {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`);
}

async function recreateOrPrepareTable(
  pool: Pool,
  schema: string,
  table: string,
  columns: string[],
  mode: Mode,
): Promise<void> {
  const full = `${quoteIdent(schema)}.${quoteIdent(table)}`;
  if (mode === 'replace') {
    await pool.query(`DROP TABLE IF EXISTS ${full}`);
    const colsSql = columns.map((c) => `${quoteIdent(c)} text`).join(', ');
    await pool.query(`CREATE TABLE ${full} (${colsSql})`);
    return;
  }
  const colsSql = columns.map((c) => `${quoteIdent(c)} text`).join(', ');
  await pool.query(`CREATE TABLE IF NOT EXISTS ${full} (${colsSql})`);
  if (mode === 'truncate') {
    await pool.query(`TRUNCATE TABLE ${full}`);
  }
}

async function insertInBatches(
  pool: Pool,
  schema: string,
  table: string,
  columns: string[],
  rows: string[][],
  batchSize: number,
): Promise<number> {
  if (!rows.length) return 0;
  const full = `${quoteIdent(schema)}.${quoteIdent(table)}`;
  const cols = columns.map((c) => quoteIdent(c)).join(', ');
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const params: Array<string | null> = [];
    const valuesSql = batch
      .map((cells, rowIdx) => {
        const holders = columns.map((_, colIdx) => {
          const v = cells[colIdx];
          params.push(v == null || String(v).trim() === '' ? null : String(v));
          return `$${rowIdx * columns.length + colIdx + 1}`;
        });
        return `(${holders.join(', ')})`;
      })
      .join(', ');

    const sql = `INSERT INTO ${full} (${cols}) VALUES ${valuesSql}`;
    await pool.query(sql, params);
    inserted += batch.length;
  }
  return inserted;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  const dbUrl = resolveDatabaseUrlFromEnv();
  if (!opts.dryRun && !dbUrl) {
    throw new Error(
      'Conexão não definida. Use DATABASE_URL ou SUPABASE_URL + SUPABASE_DB_PASSWORD no .env.',
    );
  }
  if (!fs.existsSync(opts.dir)) {
    throw new Error(`Pasta de CSV não existe: ${opts.dir}`);
  }

  const pool = opts.dryRun
    ? null
    : new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      });

  const logicalNames = Object.keys(LOGICAL_TO_SQLITE_TABLE).sort();
  let totalInserted = 0;

  try {
    for (const logical of logicalNames) {
      const dotted = LOGICAL_TO_SQLITE_TABLE[logical];
      const { schema, table } = parseSchemaTable(dotted);
      const csvPath = path.join(opts.dir, `${logical}.csv`);

      if (!fs.existsSync(csvPath)) {
        console.warn(`[supabase:csv] CSV não encontrado, ignorado: ${logical}.csv`);
        continue;
      }

      const { headers, rows } = rowsFromCsv(csvPath, opts.delimiter);
      if (!headers.length) {
        console.warn(`[supabase:csv] CSV vazio, ignorado: ${path.basename(csvPath)}`);
        continue;
      }

      const used = new Set<string>();
      const normalizedCols = headers.map((h, idx) => normalizeColumnName(h, idx, used));

      if (opts.dryRun) {
        console.log(
          `[dry-run] ${path.basename(csvPath)} -> ${schema}.${table} | cols=${normalizedCols.length} rows=${rows.length} mode=${opts.mode}`,
        );
        continue;
      }

      await ensureSchema(pool!, schema);
      await recreateOrPrepareTable(pool!, schema, table, normalizedCols, opts.mode);
      const inserted = await insertInBatches(pool!, schema, table, normalizedCols, rows, opts.batchSize);
      totalInserted += inserted;
      console.log(
        `[supabase:csv] ${path.basename(csvPath)} -> ${schema}.${table}: ${inserted} linhas`,
      );
    }
  } finally {
    if (pool) await pool.end();
  }

  if (!opts.dryRun) {
    console.log(`[supabase:csv] Concluído. Total inserido: ${totalInserted} linhas`);
  }
}

main().catch((e) => {
  console.error('[supabase:csv] Falha:', e?.message || e);
  process.exit(1);
});
