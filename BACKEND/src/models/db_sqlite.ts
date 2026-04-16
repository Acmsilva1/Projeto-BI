/**
 * Réplica de testes em SQLite: tabelas com nome físico "schema.tabela".
 * Usa node:sqlite (Node.js 22+).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Raiz do repositório (…/Projeto-BI). */
export const repoRoot = path.join(__dirname, '..', '..', '..');

/** Nomes lógicos usados pelo live_service → tabela no arquivo .sqlite3 */
export const LOGICAL_TO_SQLITE_TABLE: Record<string, string> = {
  vw_painel_ps_base: 'cmc_hospital.vw_painel_ps_base',
  ps_resumo_unidades_snapshot_prod: 'cmc_hospital.ps_resumo_unidades_snapshot_prod',
  tbl_tempos_entrada_consulta_saida: 'cmc_hospital.tbl_tempos_entrada_consulta_saida',
  tbl_tempos_medicacao: 'cmc_hospital.tbl_tempos_medicacao',
  tbl_tempos_laboratorio: 'cmc_hospital.tbl_tempos_laboratorio',
  tbl_tempos_rx_e_ecg: 'cmc_hospital.tbl_tempos_rx_e_ecg',
  tbl_tempos_tc_e_us: 'cmc_hospital.tbl_tempos_tc_e_us',
  tbl_tempos_reavaliacao: 'cmc_hospital.tbl_tempos_reavaliacao',
  tbl_altas_ps: 'cmc_hospital.tbl_altas_ps',
  tbl_intern_conversoes: 'cmc_hospital.tbl_intern_conversoes',
  tbl_vias_medicamentos: 'cmc_hospital.tbl_vias_medicamentos',
  meta_tempos: 'cmc_hospital.meta_tempos',
  tbl_unidades: 'cmc_hospital.tbl_unidades',
  tbl_unidades_teste: 'cmc_hospital.tbl_unidades_teste',
  tbl_unidades_prod: 'central_command.tbl_unidades_prod',
};

export function defaultSqlitePath(): string {
  return path.join(repoRoot, 'db local', 'db_testes_replica.sqlite3');
}

function quoteSqliteIdent(id: string): string {
  const s = String(id || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
    throw new Error(`Identificador invalido: ${s}`);
  }
  return `"${s}"`;
}

function quoteSqlitePhysicalTable(dotted: string): string {
  const s = String(dotted || '').trim();
  if (!/^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i.test(s)) {
    throw new Error(`Nome de tabela SQLite invalido: ${s}`);
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
    .map((c) => quoteSqliteIdent(c))
    .join(', ');
}

function normalizeSqliteRow(row: Record<string, unknown>): Record<string, unknown> {
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

function openDatabase(absPath: string): InstanceType<typeof DatabaseSync> {
  if (!fs.existsSync(absPath)) {
    throw new Error(`Arquivo SQLite nao encontrado: ${absPath}`);
  }
  return new DatabaseSync(absPath, { enableForeignKeyConstraints: false });
}

export type FetchViewOptions = {
  columns?: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  dateFrom?: Date;
  dateColumns?: string[];
};

export function createSqliteDataLayer(sqliteFilePath: string) {
  const db = openDatabase(sqliteFilePath);

  async function fetchView(
    viewName: string,
    filters: Record<string, unknown> = {},
    options: FetchViewOptions = {},
  ): Promise<Record<string, unknown>[]> {
    void filters;
    const logical = String(viewName || '').trim();
    const sqliteTable = LOGICAL_TO_SQLITE_TABLE[logical];
    if (!sqliteTable) {
      throw new Error(`SQLite: objeto nao mapeado: ${logical}`);
    }

    const { columns = '*', orderBy, ascending = true, limit, dateFrom, dateColumns } = options;

    const cols = sanitizeColumns(columns);
    const tableSql = quoteSqlitePhysicalTable(sqliteTable);
    let sql = `SELECT ${cols} FROM ${tableSql}`;

    const bindArgs: number[] = [];
    if (dateFrom instanceof Date && Array.isArray(dateColumns) && dateColumns.length > 0) {
      const tsec = Math.floor(dateFrom.getTime() / 1000);
      const orExpr = dateColumns
        .map((c) => {
          const n = String(c).trim();
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) {
            throw new Error(`SQLite: nome de coluna inválido em filtro de data: ${n}`);
          }
          return `strftime('%s', ${n}) >= ?`;
        })
        .join(' OR ');
      sql += ` WHERE (${orExpr})`;
      dateColumns.forEach(() => bindArgs.push(tsec));
    }

    if (orderBy) {
      sql += ` ORDER BY ${quoteSqliteIdent(orderBy)} ${ascending ? 'ASC' : 'DESC'}`;
    }

    const lim = Number(limit);
    if (Number.isFinite(lim) && lim > 0) {
      sql += ` LIMIT ${Math.floor(lim)}`;
    }

    const stmt = db.prepare(sql);
    const rows = bindArgs.length ? stmt.all(...bindArgs) : stmt.all();
    return (rows as Record<string, unknown>[]).map((r) => normalizeSqliteRow(r));
  }

  return { fetchView };
}
