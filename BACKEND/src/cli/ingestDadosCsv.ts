#!/usr/bin/env node
/**
 * Pipeline opcional (CSV → SQLite réplica). Com DATA_SOURCE=csv na API não é necessário — a API lê os CSV em memória.
 *
 * Como corre:
 *   1. Coloque ficheiros `.csv` na pasta `dados/` na raiz do repositório (ao lado de `db local/`).
 *   2. Nome do ficheiro = nome lógico da API (ex.: `tbl_tempos_entrada_consulta_saida.csv`).
 *   3. Primeira linha = cabeçalho com nomes das colunas iguais às da tabela SQLite.
 *   4. Na pasta BACKEND: `npm run pipeline:dados`
 *
 * Opções: --dir <pasta>  --sqlite <caminho.sqlite3>  --delimiter ;  --dry-run  --help
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { defaultSqlitePath, LOGICAL_TO_SQLITE_TABLE, repoRoot } from '../models/db_sqlite.js';
import { parseCsv } from '../lib/parsr/csv.js';

function quotePhysicalTable(dotted: string): string {
  const s = String(dotted || '').trim();
  if (!/^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i.test(s)) {
    throw new Error(`Nome de tabela inválido: ${s}`);
  }
  return `"${s.replace(/"/g, '""')}"`;
}

function quoteIdent(name: string): string {
  const s = String(name || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
    throw new Error(`Nome de coluna inválido no CSV: ${s}`);
  }
  return `"${s}"`;
}

function parseArgs(argv: string[]) {
  const out: {
    dir: string;
    sqlite: string;
    delimiter: string;
    dryRun: boolean;
    help: boolean;
  } = {
    dir: path.join(repoRoot, 'dados'),
    sqlite: defaultSqlitePath(),
    delimiter: ',',
    dryRun: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--dir' && argv[i + 1]) {
      out.dir = path.resolve(argv[i + 1]);
      i += 1;
    } else if (a === '--sqlite' && argv[i + 1]) {
      out.sqlite = path.resolve(argv[i + 1]);
      i += 1;
    } else if (a === '--delimiter' && argv[i + 1]) {
      out.delimiter = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function printHelp(): void {
  console.log(`
Hospital BI — ingestão CSV → SQLite (réplica)

Uso:
  npm run pipeline:dados -- [opções]

Opções:
  --dir <pasta>       Pasta com .csv (omissão: <raiz-repo>/dados)
  --sqlite <ficheiro> Caminho do .sqlite3 (omissão: db local/db_testes_replica.sqlite3)
  --delimiter <char>  Separador (; ou ,). Omissão: ,
  --dry-run           Só lista ficheiros e linhas, não grava na BD
  --help              Esta ajuda

Nomes de ficheiro: <nome_logico>.csv onde nome_logico está em LOGICAL_TO_SQLITE_TABLE
(ex.: tbl_tempos_entrada_consulta_saida.csv, meta_tempos.csv).
`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (!opts.dryRun && !fs.existsSync(opts.sqlite)) {
    console.error('[pipeline:dados] SQLite não encontrado:', opts.sqlite);
    process.exit(1);
  }

  if (!fs.existsSync(opts.dir)) {
    console.error('[pipeline:dados] Pasta de dados não existe:', opts.dir);
    console.error('Crie a pasta e coloque os .csv (ex.: mkdir dados na raiz do repo).');
    process.exit(1);
  }

  const files = fs
    .readdirSync(opts.dir)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .sort();

  if (!files.length) {
    console.log('[pipeline:dados] Nenhum .csv em', opts.dir);
    process.exit(0);
  }

  const db = opts.dryRun
    ? null
    : new DatabaseSync(opts.sqlite, { enableForeignKeyConstraints: false });
  let totalRows = 0;

  for (const file of files) {
    const base = path.basename(file, path.extname(file));
    const physical = LOGICAL_TO_SQLITE_TABLE[base];
    if (!physical) {
      console.warn(`[pipeline:dados] Ignorado (nome lógico desconhecido): ${file}`);
      continue;
    }

    const fullPath = path.join(opts.dir, file);
    const text = fs.readFileSync(fullPath, 'utf8');
    const matrix = parseCsv(text, opts.delimiter);
    if (!matrix.length) {
      console.warn(`[pipeline:dados] Vazio: ${file}`);
      continue;
    }

    const headers = matrix[0].map((h) => String(h ?? '').trim());
    const dataRows = matrix.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== ''));

    const tableSql = quotePhysicalTable(physical);
    const colsSql = headers.map(quoteIdent).join(', ');
    const placeholders = headers.map(() => '?').join(', ');
    const insertSql = `INSERT INTO ${tableSql} (${colsSql}) VALUES (${placeholders})`;

    if (opts.dryRun) {
      console.log(`[dry-run] ${file} → ${physical}: ${dataRows.length} linhas de dados`);
      totalRows += dataRows.length;
      continue;
    }

    const del = db!.prepare(`DELETE FROM ${tableSql}`);
    const ins = db!.prepare(insertSql);

    db!.exec('BEGIN IMMEDIATE');
    try {
      del.run();
      for (const cells of dataRows) {
        const values = headers.map((_, j) => {
          const v = cells[j];
          if (v == null || String(v).trim() === '') return null;
          return String(v);
        });
        ins.run(...values);
      }
      db!.exec('COMMIT');
    } catch (e) {
      db!.exec('ROLLBACK');
      console.error(`[pipeline:dados] Erro em ${file}:`, e);
      process.exit(1);
    }

    console.log(`[pipeline:dados] ${file} → ${physical}: ${dataRows.length} linhas inseridas`);
    totalRows += dataRows.length;
  }

  console.log('[pipeline:dados] Concluído. Total de linhas inseridas:', totalRows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
