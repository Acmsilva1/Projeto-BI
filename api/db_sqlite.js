/**
 * Réplica de testes em SQLite: tabelas com nome físico "schema.tabela" (um único identificador).
 * Usa node:sqlite (Node.js 22+; experimental no 24).
 */
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

/** Nomes lógicos usados pelo live_service → tabela no arquivo .sqlite3 */
const LOGICAL_TO_SQLITE_TABLE = {
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

function defaultSqlitePath() {
  return path.join(__dirname, '..', 'db local', 'db_testes_replica.sqlite3');
}

function quoteSqliteIdent(id) {
  const s = String(id || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
    throw new Error(`Identificador invalido: ${s}`);
  }
  return `"${s}"`;
}

function quoteSqlitePhysicalTable(dotted) {
  const s = String(dotted || '').trim();
  if (!/^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i.test(s)) {
    throw new Error(`Nome de tabela SQLite invalido: ${s}`);
  }
  return `"${s.replace(/"/g, '""')}"`;
}

function sanitizeColumns(columns) {
  const raw = String(columns || '*').trim();
  if (raw === '*') return '*';
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => quoteSqliteIdent(c))
    .join(', ');
}

/**
 * Colunas acidentais tipo "cd_estabelecimento:1" (import) → expõe cd_estabelecimento para o JS.
 */
function normalizeSqliteRow(row) {
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

function openDatabase(absPath) {
  const fs = require('fs');
  if (!fs.existsSync(absPath)) {
    throw new Error(`Arquivo SQLite nao encontrado: ${absPath}`);
  }
  return new DatabaseSync(absPath, { enableForeignKeyConstraints: false });
}

function createSqliteDataLayer(sqliteFilePath) {
  const db = openDatabase(sqliteFilePath);

  async function fetchView(viewName, filters = {}, options = {}) {
    void filters;
    const logical = String(viewName || '').trim();
    const sqliteTable = LOGICAL_TO_SQLITE_TABLE[logical];
    if (!sqliteTable) {
      throw new Error(`SQLite: objeto nao mapeado: ${logical}`);
    }

    const {
      columns = '*',
      orderBy,
      ascending = true,
      limit,
    } = options;

    const cols = sanitizeColumns(columns);
    const tableSql = quoteSqlitePhysicalTable(sqliteTable);
    let sql = `SELECT ${cols} FROM ${tableSql}`;

    if (orderBy) {
      sql += ` ORDER BY ${quoteSqliteIdent(orderBy)} ${ascending ? 'ASC' : 'DESC'}`;
    }

    const lim = Number(limit);
    if (Number.isFinite(lim) && lim > 0) {
      sql += ` LIMIT ${Math.floor(lim)}`;
    }

    const stmt = db.prepare(sql);
    const rows = stmt.all();
    return rows.map(normalizeSqliteRow);
  }

  return { fetchView };
}

module.exports = {
  LOGICAL_TO_SQLITE_TABLE,
  defaultSqlitePath,
  createSqliteDataLayer,
};
