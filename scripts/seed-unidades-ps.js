/**
 * Substitui cadastro de unidades no SQLite por apenas as 9 unidades PS indicadas.
 * Uso: na raiz do repositório: node scripts/seed-unidades-ps.js
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'db local', 'db_testes_replica.sqlite3');

if (!fs.existsSync(dbPath)) {
  console.error('[seed] Arquivo não encontrado:', dbPath);
  process.exit(1);
}

/** [cd_estabelecimento, nome sem sufixo regional, uf] → rótulo "{cd} - {nome}_{uf}" */
const UNITS = [
  [1, 'PS HOSPITAL VITÓRIA', 'ES'],
  [3, 'PS VILA VELHA', 'ES'],
  [13, 'PS SIG', 'DF'],
  [25, 'PS BARRA DA TIJUCA', 'RJ'],
  [26, 'PS BOTAFOGO', 'RJ'],
  [31, 'PS GUTIERREZ', 'MG'],
  [33, 'PS PAMPULHA', 'MG'],
  [39, 'PS TAGUATINGA', 'DF'],
  [45, 'PS CAMPO GRANDE', 'RJ'],
];

const TBL_MAIN = 'cmc_hospital.tbl_unidades';
const TBL_TEST = 'cmc_hospital.tbl_unidades_teste';
const TBL_PROD = 'central_command.tbl_unidades_prod';

const db = new DatabaseSync(dbPath);

function cnpjFor(cd) {
  return String(cd).padStart(14, '0');
}

db.exec('BEGIN IMMEDIATE');
db.prepare(`DELETE FROM "${TBL_MAIN}"`).run();
db.prepare(`DELETE FROM "${TBL_TEST}"`).run();
db.prepare(`DELETE FROM "${TBL_PROD}"`).run();

const insertSql = `INSERT INTO "${TBL_MAIN}"
  (id, cnpj, nome, cep, logradouro, bairro, cidade, uf, cd_estabelecimento, ps)
  VALUES (@id, @cnpj, @nome, @cep, @logradouro, @bairro, @cidade, @uf, @cd, 1)`;
const stmt = db.prepare(insertSql);

for (const [cd, nome, uf] of UNITS) {
  stmt.run({
    id: cd,
    cnpj: cnpjFor(cd),
    nome,
    cep: '01001000',
    logradouro: '—',
    bairro: '—',
    cidade: '—',
    uf,
    cd,
  });
}

db.exec('COMMIT');
console.log('[seed] Unidades PS na tabela', TBL_MAIN, ':', UNITS.length, 'linhas (outras tabelas de unidades esvaziadas).');
console.log('[seed] Exemplos de rótulo: 001 - PS HOSPITAL VITÓRIA_ES, 003 - PS VILA VELHA_ES, …');
