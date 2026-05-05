/**
 * Reconstrói `banco local/tbl_intern_movimentacoes.parquet` a partir de
 * `tbl_intern_movimentacoes.csv` na raiz do Projeto-BI ou em `banco local/`.
 *
 * Uso: na pasta api → `node scripts/rebuild-movimentacoes-parquet-from-csv.mjs`
 */
import duckdb from "duckdb";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const csvCandidates = [
  path.join(repoRoot, "tbl_intern_movimentacoes.csv"),
  path.join(repoRoot, "banco local", "tbl_intern_movimentacoes.csv")
];
const pqPath = path.join(repoRoot, "banco local", "tbl_intern_movimentacoes.parquet").replace(/\\/g, "/");

const esc = (p) => p.replace(/'/g, "''");

function run(db, sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function all(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows ?? []);
    });
  });
}

async function main() {
  if (process.env.SKIP_MOVIMENTACOES_PARQUET === "1") {
    console.log("[dataset] SKIP_MOVIMENTACOES_PARQUET=1 — ignorado.");
    return;
  }
  const csvPathRaw = csvCandidates.find((p) => fs.existsSync(p));
  if (!csvPathRaw) {
    console.warn("[dataset] CSV não encontrado (skip). Procurei:", csvCandidates.join(" | "));
    return;
  }
  const csvPath = csvPathRaw.replace(/\\/g, "/");
  fs.mkdirSync(path.dirname(pqPath), { recursive: true });
  const db = new duckdb.Database(":memory:");
  const copySql = `
    COPY (
      SELECT * FROM read_csv_auto('${esc(csvPath)}', HEADER=true, SAMPLE_SIZE=-1, IGNORE_ERRORS=true)
    ) TO '${esc(pqPath)}' (FORMAT PARQUET);
  `;
  await run(db, copySql);
  const [cnt] = await all(db, `SELECT count(*)::BIGINT AS n FROM read_parquet('${esc(pqPath)}')`);
  const desc = await all(db, `DESCRIBE SELECT * FROM read_parquet('${esc(pqPath)}')`);
  console.log("Parquet escrito:", pqPath);
  console.log("Linhas:", cnt);
  console.log(
    "Colunas:",
    desc.map((r) => `${r.column_name}:${r.column_type}`).join(", ")
  );
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
