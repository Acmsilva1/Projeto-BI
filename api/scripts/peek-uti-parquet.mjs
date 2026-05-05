/**
 * Uso único: inspecionar parquets locais vs heurística UTI do board semântico.
 * node scripts/peek-uti-parquet.mjs
 */
import duckdb from "duckdb";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..", "banco local");
const pqMov = path.join(root, "tbl_intern_movimentacoes.parquet").replace(/\\/g, "/");
const pqInt = path.join(root, "tbl_intern_internacoes.parquet").replace(/\\/g, "/");

const esc = (p) => p.replace(/'/g, "''");

function run(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows ?? []);
    });
  });
}

/** Só colunas que existem no ficheiro (evita Binder Error). */
function buildClsExprFromDescribe(descRows) {
  const cmap = new Map();
  for (const r of descRows) {
    const raw = String(r.column_name ?? "")
      .trim()
      .replace(/^"|"$/g, "");
    if (raw) cmap.set(raw.toLowerCase(), raw);
  }
  const pick = (...cands) => {
    for (const c of cands) {
      const o = cmap.get(c.toLowerCase());
      if (o) return o;
    }
    return null;
  };
  const qcol = (o) => `nullif(trim(cast("${o.replace(/"/g, '""')}" AS VARCHAR)), '')`;
  const parts = [];
  for (const g of [
    ["ds_classificacao", "DS_CLASSIFICACAO"],
    ["nm_setor", "NM_SETOR"],
    ["setor", "SETOR"],
    ["unidade", "UNIDADE"],
    ["tipo", "TIPO"],
    ["tp_atendimento", "TP_ATENDIMENTO"],
    ["cd_unidade_atendimento", "CD_UNIDADE_ATENDIMENTO"],
    ["leito", "LEITO"],
    ["nm_abreviado", "NM_ABREVIADO"],
    ["classificacao", "CLASSIFICACAO"]
  ]) {
    const o = pick(g[0], g[1]);
    if (o) parts.push(qcol(o));
  }
  if (parts.length === 0) return `upper(trim(concat_ws(' ', nullif(trim(cast(classificacao AS VARCHAR)), ''))))`;
  return `upper(trim(concat_ws(' ', ${parts.join(", ")})))`;
}

function utiPredFor(clsExprInner) {
  return `(${clsExprInner} IN ('UTI', 'UPC', 'UTI EXTRA', 'CTI', 'UCO')
  OR strpos(${clsExprInner}, 'UTI') > 0
  OR strpos(${clsExprInner}, 'UPC') > 0
  OR strpos(${clsExprInner}, 'CTI') > 0
  OR (strpos(${clsExprInner}, 'INTENSIV') > 0 AND strpos(${clsExprInner}, 'SEMI') = 0)
  OR (strpos(${clsExprInner}, 'TERAPIA') > 0 AND strpos(${clsExprInner}, 'INTENS') > 0))`;
}

async function main() {
  const db = new duckdb.Database(":memory:");
  const fromMov = `read_parquet('${esc(pqMov)}')`;
  const fromInt = `read_parquet('${esc(pqInt)}')`;

  console.log("Parquet mov:", pqMov);
  const descM = await run(db, `DESCRIBE SELECT * FROM ${fromMov}`);
  console.log("\n--- Colunas tbl_intern_movimentacoes ---");
  console.table(descM.map((r) => ({ column: r.column_name, type: r.column_type })));

  const clsExpr = buildClsExprFromDescribe(descM);
  const utiPred = utiPredFor(clsExpr);
  console.log("\nclsExpr (dinâmico):", clsExpr.slice(0, 120) + (clsExpr.length > 120 ? "…" : ""));

  const [cnt] = await run(db, `SELECT count(*)::BIGINT AS n FROM ${fromMov}`);
  console.log("\nTotal linhas movimentações:", cnt);

  let uti = { n: 0n };
  if (Number(cnt.n) > 0) {
    [uti] = await run(db, `SELECT count(*)::BIGINT AS n FROM ${fromMov} WHERE ${utiPred}`);
    console.log("Linhas onde texto agregado bate heurística UTI/UPC/CTI:", uti);

    const top = await run(
      db,
      `SELECT ${clsExpr} AS cls_u, count(*)::BIGINT AS n
       FROM ${fromMov}
       GROUP BY 1
       ORDER BY n DESC NULLS LAST
       LIMIT 20`
    );
    console.log("\nTop 20 valores cls_u:");
    console.table(top);

    const pickCol = (...names) => names.find((n) => descM.some((r) => String(r.column_name).toLowerCase() === n));
    const cClass = pickCol("classificacao", "CLASSIFICACAO");
    const cDs = pickCol("ds_classificacao", "DS_CLASSIFICACAO");
    const cSet = pickCol("setor", "SETOR");
    const cDt = pickCol("dt_historico", "DT_HISTORICO");
    const cHr = pickCol("hr_historico", "HR_HISTORICO");
    const sel = [cClass, cDs, cSet, cDt, cHr].filter(Boolean).map((c) => `"${c}"`).join(", ");
    if (sel) {
      const utiSamples = await run(
        db,
        `SELECT ${sel} FROM ${fromMov} WHERE ${utiPred} LIMIT 8`
      );
      console.log("\nAmostra linhas UTI-like (8):");
      console.table(utiSamples);
    }
  } else {
    console.log("(Sem linhas — não há como calcular UTI por movimentação neste ficheiro.)");
  }

  const descI = await run(db, `DESCRIBE SELECT * FROM ${fromInt}`);
  const [intCnt] = await run(db, `SELECT count(*)::BIGINT AS n FROM ${fromInt}`);
  console.log("\nTotal linhas internações:", intCnt);
  const classifCols = descI
    .map((r) => String(r.column_name ?? ""))
    .filter((n) => /classif|setor/i.test(n));
  console.log("\n--- Colunas internações (classif/setor no nome) ---");
  console.log(classifCols.join(", ") || "(nenhuma)");

  const intClsExpr = buildClsExprFromDescribe(descI);
  if (Number(intCnt.n) > 0) {
    try {
      const intUtiPred = utiPredFor(intClsExpr);
      const [r] = await run(db, `SELECT count(*)::BIGINT AS n FROM ${fromInt} WHERE ${intUtiPred}`);
      console.log("\nInternações com cls agregado UTI-like (subset colunas tipo mov):", r);
    } catch (e) {
      console.warn("Query internação UTI falhou:", e.message);
    }
    const cs = `upper(trim(cast(CLASSIF_SETOR AS VARCHAR)))`;
    const predCs = utiPredFor(cs);
    try {
      const [r2] = await run(db, `SELECT count(*)::BIGINT AS n FROM ${fromInt} WHERE ${predCs}`);
      console.log("Internações só CLASSIF_SETOR (como no board i.CLASSIF_SETOR):", r2);
    } catch (e) {
      console.warn("CLASSIF_SETOR UTI:", e.message);
    }
  }

  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
