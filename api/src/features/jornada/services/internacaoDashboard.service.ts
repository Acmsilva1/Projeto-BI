import { queryDuckDb } from "../../../data/services/duckdb.service.js";
import { env } from "../../../core/config/env.js";
import {
  loadFullTableAsStringRowsConn,
  resolveDatasetTableByBase,
  withMemoryDatasetDb
} from "../../../data/utils/datasetTableLoader.js";
import {
  getInternacaoDuckReadPaths,
  getInternacaoDuckTables,
  type InternacaoEndpointKey
} from "../domain/internacao/internacaoDuckDependencies.js";
import { getDashboardQueryPayload } from "./dashboard.service.js";

export type InternacaoQueryPayload = {
  ok: true;
  slug: string;
  sourceView: string;
  appliedFilters: {
    periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;
    regional: string | null;
    unidade: string | null;
  };
  dependencies: {
    endpoint: InternacaoEndpointKey;
    engine: "duckdb" | "csv-memory";
    tables: readonly string[];
    readPaths: string[];
  };
  rowCount: number;
  rows: Record<string, unknown>[];
};

export type InternacaoOptions = {
  limit: number;
  periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;
  regional?: string;
  unidade?: string;
};

export const INTERNACAO_UNIDADES_HABILITADAS = [
  "DF - AGUAS CLARAS",
  "DF - PS SIG",
  "DF - PS TAGUATINGA",
  "ES - BRESSAN",
  "ES - HOSPITAL VITORIA",
  "ES - PS VILA VELHA",
  "MG - FUNCIONARIOS",
  "MG - PAMPULHA",
  "MG BH GUTIERREZ - PS",
  "RJ - PS BARRA DA TIJUCA",
  "RJ - PS BOTAFOGO",
  "RJ - PS CAMPO GRANDE"
] as const;

/**
 * Colunas do Dashboard de Metas — Internação: regional ES → MG → RJ → DF;
 * em DF, Águas Claras ao final (baixo volume típico).
 */
const INTERNACAO_METAS_UNIT_COLUMN_ORDER = [
  "ES - BRESSAN",
  "ES - HOSPITAL VITORIA",
  "ES - PS VILA VELHA",
  "MG - FUNCIONARIOS",
  "MG - PAMPULHA",
  "MG BH GUTIERREZ - PS",
  "RJ - PS BARRA DA TIJUCA",
  "RJ - PS BOTAFOGO",
  "RJ - PS CAMPO GRANDE",
  "DF - PS SIG",
  "DF - PS TAGUATINGA",
  "DF - AGUAS CLARAS"
] as const;

function normalizeUnitKey(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replaceAll(/\s+/g, " ")
    .trim();
}

function sortUnitsForInternacaoMetasTable(units: readonly string[]): string[] {
  const orderIndex = new Map(
    INTERNACAO_METAS_UNIT_COLUMN_ORDER.map((label, index) => [normalizeUnitKey(label), index] as const)
  );
  return [...units].sort((a, b) => {
    const ia = orderIndex.get(normalizeUnitKey(a)) ?? 999;
    const ib = orderIndex.get(normalizeUnitKey(b)) ?? 999;
    if (ia !== ib) return ia - ib;
    return normalizeUnitKey(a).localeCompare(normalizeUnitKey(b), "pt-BR");
  });
}

const INTERNACAO_UNIDADES_KEY_SET = new Set<string>(INTERNACAO_UNIDADES_HABILITADAS.map((value) => normalizeUnitKey(value)));

function isInternacaoUnidade(unidade: string): boolean {
  return INTERNACAO_UNIDADES_KEY_SET.has(normalizeUnitKey(unidade));
}

function esc(value: string): string {
  return value.replaceAll("'", "''");
}

function toSqlList(values: readonly string[]): string {
  return values.map((v) => `'${esc(v)}'`).join(", ");
}

export function buildUnitsFilterSql(options: InternacaoOptions): string {
  const clauses: string[] = [`TRIM(nome) IN (${toSqlList(INTERNACAO_UNIDADES_HABILITADAS)})`];
  if (options.regional) clauses.push(`UPPER(TRIM(uf)) = '${esc(options.regional.toUpperCase())}'`);
  if (options.unidade) clauses.push(`UPPER(TRIM(nome)) = UPPER('${esc(options.unidade)}')`);
  return clauses.join(" AND ");
}

/** Alinhado ao PS: bootstrap 90d; 180/365 expandem até ao teto `GERENCIAL_STORE_RETENTION_DAYS`. */
function internacaoFactsRetentionDays(periodDays: InternacaoOptions["periodDays"]): number {
  return Math.min(env.gerencialStoreRetentionDays, Math.max(90, periodDays));
}

export function duckPeriodWhere(col: string, periodDays: InternacaoOptions["periodDays"]): string {
  if (periodDays === 1) {
    return `${col} IS NOT NULL AND cast(${col} AS DATE) = cast(CURRENT_DATE AS DATE) - INTERVAL 1 DAY`;
  }
  return `${col} IS NOT NULL AND (max_dt IS NULL OR ${col} BETWEEN (max_dt - INTERVAL '${periodDays - 1} DAY') AND max_dt)`;
}

/**
 * Coluna de data/hora em facts (VARCHAR ou timestamp): ISO com espaço, ou pt-BR dd/MM/yyyy.
 * Usado em movimentações e onde o parquet/CSV não normalizou para ISO.
 */
export function duckSqlFlexTimestamp(expr: string): string {
  const v = `trim(cast(${expr} AS VARCHAR))`;
  return `COALESCE(
    TRY_CAST(REPLACE(${v}, ' ', 'T') AS TIMESTAMP),
    TRY_STRPTIME(${v}, '%d/%m/%Y %H:%M:%S'),
    TRY_STRPTIME(${v}, '%d/%m/%Y %H:%M'),
    TRY_STRPTIME(${v}, '%d/%m/%Y'),
    TRY_STRPTIME(${v}, '%Y-%m-%d %H:%M:%S'),
    TRY_STRPTIME(${v}, '%Y-%m-%d %H:%M'),
    TRY_STRPTIME(${v}, '%Y-%m-%d')
  )`;
}

/** Datas em `tbl_intern_internacoes` (alias `i.`): **iguais** ao `getInternacaoTopoPayload`. */
export const SQL_INTERN_I_DT_ENTRADA = "try_cast(replace(i.dt_entrada, ' ', 'T') AS TIMESTAMP)";
export const SQL_INTERN_I_DT_ALTA = "try_cast(replace(i.dt_alta, ' ', 'T') AS TIMESTAMP)";
/** Parquet do modelo expõe `DT_ALTA_MEDICO` (maiúsculas). Identificador sem aspas falha no DuckDB. */
export const SQL_INTERN_I_DT_ALTA_MEDICO =
  "try_cast(replace(trim(cast(i.\"DT_ALTA_MEDICO\" AS VARCHAR)), ' ', 'T') AS TIMESTAMP)";

/** Dias do calendário do mesmo recorte do topo (para Paciente-dia no período, alinhado ao Power BI). */
export function duckTopoPeriodDaysCTE(periodDays: InternacaoOptions["periodDays"]): string {
  if (periodDays === 1) {
    return `period_days AS (
      SELECT (CAST(current_date AS DATE) - INTERVAL 1 DAY) AS ref_day
    )`;
  }
  return `period_anchor AS (
      SELECT COALESCE(
        (SELECT max_dt FROM alta_window),
        (SELECT max_dt FROM intern_window),
        CURRENT_TIMESTAMP
      ) AS anchor
    ),
    period_days AS (
      SELECT unnest(generate_series(
        CAST((SELECT anchor FROM period_anchor) AS DATE) - INTERVAL '${periodDays - 1}' DAY,
        CAST((SELECT anchor FROM period_anchor) AS DATE),
        INTERVAL 1 DAY
      ))::DATE AS ref_day
    )`;
}

function toNum(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** DuckDB / drivers podem devolver aliases com casing diferente do esperado. */
function rowField(row: Record<string, unknown>, canonical: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, canonical)) return row[canonical];
  const want = canonical.toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === want) return row[key];
  }
  return undefined;
}

function mapTopoNullablePct1(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(1));
}

function mapTaxaMortalidadeGeralPct(row: Record<string, unknown>, altasTotal: number, obitosTotal: number): number | null {
  if (altasTotal <= 0) return null;
  const raw = rowField(row, "taxa_mortalidade_geral_pct");
  let n = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
  if (!Number.isFinite(n)) {
    n = (100 * obitosTotal) / altasTotal;
  }
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(2));
}

function buildInternacaoTargetUnitsForTopo(options: InternacaoOptions): string[] {
  const regionalTarget = options.regional?.trim().toUpperCase();
  const unidadeTarget = options.unidade?.trim();
  return INTERNACAO_UNIDADES_HABILITADAS.filter((unit) =>
    regionalTarget ? unit.split("-")[0]?.trim().toUpperCase() === regionalTarget : true
  ).filter((unit) => (unidadeTarget ? normalizeUnitKey(unit) === normalizeUnitKey(unidadeTarget) : true));
}

/** Taxa de ocupação no topo: Σ leitos ocupados / Σ leitos (snapshot tbl_intern_leitos), mesmo recorte dos filtros. */
function aggregateOcupacaoInternacaoFromSupplement(
  targetUnits: string[],
  supplement: Map<string, InternacaoSupplement>
): number | null {
  let sumOcup = 0;
  let sumTot = 0;
  for (const unit of targetUnits) {
    const sup = supplement.get(normalizeUnitKey(unit));
    if (!sup || sup.ocupacao_leitos_total == null || sup.ocupacao_leitos_total <= 0) continue;
    sumOcup += sup.ocupacao_leitos_ocupados ?? 0;
    sumTot += sup.ocupacao_leitos_total;
  }
  if (sumTot <= 0) return null;
  return Number(((sumOcup * 100) / sumTot).toFixed(1));
}

/**
 * Taxa de ocupação lida diretamente das views DuckDB (Parquet), alinhada ao snapshot por unidade do supplement.
 * Vários variantes de nome de coluna por causa de parquet/csv.
 */
async function queryOcupacaoInternacaoPctFromDuckDb(options: InternacaoOptions): Promise<number | null> {
  if (env.dataGateway !== "duckdb") return null;

  const unitsWhere = buildUnitsFilterSql(options);

  const buildSql = (cu: string, cs: string, ca: string, cd: string, cc: string) => `
    WITH base AS (
      SELECT
        upper(trim(cast(l.${cu} AS VARCHAR))) AS uk,
        upper(trim(cast(l.${cs} AS VARCHAR))) AS st,
        COALESCE(
          ${duckSqlFlexTimestamp(`l.${ca}`)},
          ${duckSqlFlexTimestamp(`l.${cd}`)},
          ${duckSqlFlexTimestamp(`l.${cc}`)}
        ) AS dt
      FROM tbl_intern_leitos l
      WHERE upper(trim(cast(l.${cu} AS VARCHAR))) IN (
        SELECT upper(trim(cast(nome AS VARCHAR))) FROM tbl_unidades WHERE ${unitsWhere}
      )
    ),
    mx AS (
      SELECT uk, max(dt) AS max_dt
      FROM base
      GROUP BY uk
    ),
    snap AS (
      SELECT b.uk, b.st
      FROM base b
      INNER JOIN mx ON b.uk = mx.uk
      WHERE mx.max_dt IS NULL OR b.dt = mx.max_dt
    )
    SELECT
      round(
        100.0 * sum(CASE WHEN strpos(coalesce(snap.st, ''), 'LIVRE') = 0 THEN 1 ELSE 0 END) /
        nullif(count(*), 0),
        1
      ) AS ocupacao_internacao_pct
    FROM snap
  `;

  const variants = [
    buildSql('"UNIDADE"', '"STATUS"', '"DT_ATUALIZACAO"', '"DATA"', '"DT_CRIACAO"'),
    buildSql("UNIDADE", "STATUS", "DT_ATUALIZACAO", "DATA", "DT_CRIACAO"),
    buildSql("unidade", "status", "dt_atualizacao", "data", "dt_criacao")
  ];

  for (const sql of variants) {
    try {
      const out = await queryDuckDb(sql);
      const row = out[0] as Record<string, unknown> | undefined;
      if (!row) continue;
      const raw = rowField(row, "ocupacao_internacao_pct");
      if (raw == null || raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      return Number(n.toFixed(1));
    } catch {
      /* tentar próximo conjunto de colunas */
    }
  }
  return null;
}

/** Minutos vindos do DuckDB para TMP do topo; preserva null quando não há média válida. */
function nullableTopoMinutes(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number(n.toFixed(1));
}

function normalizeRowsArray(rows: unknown): Record<string, unknown>[] {
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function pickField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key] ?? "";
    const lowerKey = key.toLowerCase();
    if (row[lowerKey] !== undefined) return row[lowerKey] ?? "";
    const upperKey = key.toUpperCase();
    if (row[upperKey] !== undefined) return row[upperKey] ?? "";
  }
  return "";
}

/** Parquet costuma trazer nomes em maiúsculas (UNIDADE, STATUS); CSV pode misturar casing. */
function pickFieldCi(row: Record<string, string>, logical: string): string {
  const want = logical.toLowerCase();
  for (const [k, v] of Object.entries(row)) {
    if (k.toLowerCase() === want) return v ?? "";
  }
  return "";
}

async function loadInternacaoFiltrosFromDataset(options: InternacaoOptions): Promise<Record<string, unknown>[]> {
  return withMemoryDatasetDb(async (_db, conn) => {
    const resolved = resolveDatasetTableByBase(env.csvDataDir, "tbl_unidades");
    if (!resolved) return [];
    const rows = await loadFullTableAsStringRowsConn(conn, resolved);
    const regionalTarget = options.regional?.trim().toUpperCase();
    const unidadeTarget = options.unidade?.trim();
    const list = rows
      .map((row) => ({
        regional: pickField(row, "uf").trim().toUpperCase(),
        unidade: pickField(row, "nome").trim()
      }))
      .filter((row) => row.regional.length > 0 && row.unidade.length > 0)
      .filter((row) => isInternacaoUnidade(row.unidade))
      .filter((row) => (regionalTarget ? row.regional === regionalTarget : true))
      .filter((row) => (unidadeTarget ? normalizeUnitKey(row.unidade) === normalizeUnitKey(unidadeTarget) : true))
      .sort((a, b) => `${a.regional}|${a.unidade}`.localeCompare(`${b.regional}|${b.unidade}`));

    const unique = new Map<string, { regional: string; unidade: string }>();
    for (const row of list) unique.set(`${row.regional}|${row.unidade}`, row);
    const safeLimit = Math.max(1, Math.min(options.limit || 200, 5000));
    return [...unique.values()].slice(0, safeLimit);
  });
}

type InternacaoSupplement = {
  internacoes: number | null;
  altas_total: number | null;
  obitos_total: number | null;
  /** Óbitos com permanência ≥24h (numerador Tx mortalidade institucional). */
  obitos_institucional_total: number | null;
  tempo_medio_alta_min: number | null;
  taxa_conversao_internacao_pct: number | null;
  taxa_reinternacao_30_pct: number | null;
  taxa_mortalidade_hospitalar_pct: number | null;
  taxa_mortalidade_institucional_pct: number | null;
  ocupacao_internacao_pct: number | null;
  /** Casos de reinternação ≤7d após alta (numerador da taxa CID). */
  reinternacao_num: number | null;
  reinternacao_30_num: number | null;
  /** Altas com reinternação elegível no período (denominador 7d / 30d). */
  reinternacao_den: number | null;
  /** Leitos ocupados no snapshot (numerador da ocupação). */
  ocupacao_leitos_ocupados: number | null;
  /** Total de leitos no snapshot (denominador da ocupação). */
  ocupacao_leitos_total: number | null;
};

function parseDateMs(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw.replace(" ", "T");
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

function inPeriod(ms: number | null, startMs: number, endMs: number): boolean {
  if (ms === null) return false;
  return ms >= startMs && ms <= endMs;
}

function resolvePeriodBounds(dates: number[], periodDays: InternacaoOptions["periodDays"]): { startMs: number; endMs: number } | null {
  if (periodDays === 1) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).getTime();
    return { startMs: start, endMs: end };
  }
  const maxMs = dates.length > 0 ? Math.max(...dates) : 0;
  if (!Number.isFinite(maxMs) || maxMs <= 0) return null;
  const startMs = maxMs - (periodDays - 1) * 24 * 60 * 60 * 1000;
  return { startMs, endMs: maxMs };
}

const INTERNACAO_RETENTION_MS_PER_DAY = 86_400_000;

/** Maior entre entrada e alta (quando existem) — ancora por linha para recorte 90d. */
function internInternacaoRowActivityMs(row: Record<string, string>): number {
  const e = parseDateMs(pickField(row, "dt_entrada"));
  const a = parseDateMs(pickField(row, "dt_alta"));
  const parts = [e, a].filter((x): x is number => x !== null && Number.isFinite(x));
  return parts.length === 0 ? 0 : Math.max(...parts);
}

function internConversoesRowActivityMs(row: Record<string, string>): number {
  const e = parseDateMs(pickField(row, "dt_entrada"));
  const a = parseDateMs(pickField(row, "dt_alta"));
  const parts = [e, a].filter((x): x is number => x !== null && Number.isFinite(x));
  return parts.length === 0 ? 0 : Math.max(...parts);
}

/** Recorte temporal dos facts (dias) após leitura do ficheiro — alinhado ao pill da internação / PS. */
function filterInternFactRowsByGerencialRetention(
  rows: Record<string, string>[],
  activityMs: (row: Record<string, string>) => number,
  retentionDays: number
): Record<string, string>[] {
  let anchor = 0;
  for (const row of rows) {
    const v = activityMs(row);
    if (v > anchor) anchor = v;
  }
  if (anchor <= 0) return rows;
  const days = retentionDays;
  if (!Number.isFinite(days) || days <= 0) return rows;
  const cutoff = anchor - days * INTERNACAO_RETENTION_MS_PER_DAY;
  return rows.filter((row) => {
    const v = activityMs(row);
    if (v <= 0) return true;
    return v >= cutoff;
  });
}

async function loadInternacaoSupplementByUnit(options: InternacaoOptions, targetUnits: string[]): Promise<Map<string, InternacaoSupplement>> {
  return withMemoryDatasetDb(async (_db, conn) => {
    const output = new Map<string, InternacaoSupplement>();
    for (const unit of targetUnits) {
      output.set(normalizeUnitKey(unit), {
        internacoes: null,
        altas_total: null,
        obitos_total: null,
        obitos_institucional_total: null,
        tempo_medio_alta_min: null,
        taxa_conversao_internacao_pct: null,
        taxa_reinternacao_30_pct: null,
        taxa_mortalidade_hospitalar_pct: null,
        taxa_mortalidade_institucional_pct: null,
        ocupacao_internacao_pct: null,
        reinternacao_num: null,
        reinternacao_30_num: null,
        reinternacao_den: null,
        ocupacao_leitos_ocupados: null,
        ocupacao_leitos_total: null
      });
    }

    const unitsResolved = resolveDatasetTableByBase(env.csvDataDir, "tbl_unidades_prod") ?? resolveDatasetTableByBase(env.csvDataDir, "tbl_unidades");
    const internResolved = resolveDatasetTableByBase(env.csvDataDir, "tbl_intern_internacoes");
    const convResolved = resolveDatasetTableByBase(env.csvDataDir, "tbl_intern_conversoes");
    const leitosResolved = resolveDatasetTableByBase(env.csvDataDir, "tbl_intern_leitos");
    if (!unitsResolved) return output;

    const unitRows = await loadFullTableAsStringRowsConn(conn, unitsResolved);
    const byUnitKey = new Map<string, number>();
    for (const row of unitRows) {
      const unit = pickField(row, "nome").trim();
      const cd = Number.parseInt(pickField(row, "cd_estabelecimento"), 10);
      if (!unit || !Number.isFinite(cd)) continue;
      byUnitKey.set(normalizeUnitKey(unit), cd);
    }

    const targetCodes = new Map<string, number>();
    for (const unit of targetUnits) {
      const key = normalizeUnitKey(unit);
      const cd = byUnitKey.get(key);
      if (cd) targetCodes.set(key, cd);
    }
    if (targetCodes.size === 0) return output;

    if (internResolved) {
      const rowsRaw = await loadFullTableAsStringRowsConn(conn, internResolved);
      const rows = filterInternFactRowsByGerencialRetention(
        rowsRaw,
        internInternacaoRowActivityMs,
        internacaoFactsRetentionDays(options.periodDays)
      );
      const perUnit: Record<string, Array<{ entrada: number | null; alta: number | null; obito: boolean }>> = {};
      for (const [key] of targetCodes) perUnit[key] = [];
      for (const row of rows) {
        const cd = Number.parseInt(pickField(row, "cd_estabelecimento"), 10);
        if (!Number.isFinite(cd)) continue;
        const targetKey = [...targetCodes.entries()].find(([, unitCd]) => unitCd === cd)?.[0];
        if (!targetKey) continue;
        const bucket = perUnit[targetKey];
        if (!bucket) continue;
        bucket.push({
          entrada: parseDateMs(pickField(row, "dt_entrada")),
          alta: parseDateMs(pickField(row, "dt_alta")),
          obito: normalizeUnitKey(pickField(row, "motivo_alta_hospitalar")) === normalizeUnitKey("ÓBITO")
        });
      }

      for (const [key, list] of Object.entries(perUnit)) {
        const entradaBounds = resolvePeriodBounds(
          list.map((x) => x.entrada).filter((x): x is number => x !== null),
          options.periodDays
        );
        const altaBounds = resolvePeriodBounds(
          list.map((x) => x.alta).filter((x): x is number => x !== null),
          options.periodDays
        );

        const internacoesCount = entradaBounds ? list.filter((x) => inPeriod(x.entrada, entradaBounds.startMs, entradaBounds.endMs)).length : 0;
        const altasList = altaBounds ? list.filter((x) => inPeriod(x.alta, altaBounds.startMs, altaBounds.endMs)) : [];
        const altasCount = altasList.length;
        const obitosCount = altasList.filter((x) => x.obito).length;
        const obitosInstCount = altasList.filter((x) => {
          if (!x.obito || x.entrada === null || x.alta === null) return false;
          return x.alta - x.entrada >= 24 * 60 * 60 * 1000;
        }).length;
        const tmpValues = altasList
          .filter((x) => x.entrada !== null && x.alta !== null && x.alta > x.entrada)
          .map((x) => ((x.alta as number) - (x.entrada as number)) / 60000)
          .filter((x) => Number.isFinite(x) && x >= 1 && x <= 5256000);
        const tmpAvg = tmpValues.length > 0 ? tmpValues.reduce((a, b) => a + b, 0) / tmpValues.length : null;

        const current = output.get(key);
        if (!current) continue;
        current.internacoes = internacoesCount > 0 ? internacoesCount : null;
        current.altas_total = altasCount > 0 ? altasCount : null;
        current.obitos_total = obitosCount > 0 ? obitosCount : altasCount > 0 ? 0 : null;
        current.obitos_institucional_total = obitosInstCount > 0 ? obitosInstCount : altasCount > 0 ? 0 : null;
        current.taxa_mortalidade_hospitalar_pct =
          altasCount > 0 ? Number(((obitosCount * 100) / altasCount).toFixed(2)) : null;
        current.taxa_mortalidade_institucional_pct =
          altasCount > 0 ? Number(((obitosInstCount * 100) / altasCount).toFixed(2)) : null;
        current.tempo_medio_alta_min = tmpAvg !== null ? Number(tmpAvg.toFixed(1)) : null;
      }
    }

    if (convResolved) {
      const rowsRaw = await loadFullTableAsStringRowsConn(conn, convResolved);
      const rows = filterInternFactRowsByGerencialRetention(
        rowsRaw,
        internConversoesRowActivityMs,
        internacaoFactsRetentionDays(options.periodDays)
      );
      const byUnitPerson = new Map<string, Map<string, Array<{ entrada: number; alta: number | null }>>>();
      for (const [key] of targetCodes) byUnitPerson.set(key, new Map());
      for (const row of rows) {
        const cd = Number.parseInt(pickField(row, "cd_estab_urg"), 10);
        if (!Number.isFinite(cd)) continue;
        const targetKey = [...targetCodes.entries()].find(([, unitCd]) => unitCd === cd)?.[0];
        if (!targetKey) continue;
        const entrada = parseDateMs(pickField(row, "dt_entrada"));
        if (entrada === null) continue;
        const alta = parseDateMs(pickField(row, "dt_alta"));
        const pessoa = pickField(row, "cd_pessoa_fisica");
        if (!pessoa) continue;
        const map = byUnitPerson.get(targetKey)!;
        if (!map.has(pessoa)) map.set(pessoa, []);
        map.get(pessoa)!.push({ entrada, alta });
      }

      for (const [key, personMap] of byUnitPerson) {
        const allEntradas = [...personMap.values()].flat().map((x) => x.entrada);
        const bounds = resolvePeriodBounds(allEntradas, options.periodDays);
        if (!bounds) continue;
        const DAY_MS = 24 * 60 * 60 * 1000;
        let num7 = 0;
        let num30 = 0;
        let den = 0;
        for (const events of personMap.values()) {
          events.sort((a, b) => a.entrada - b.entrada);
          for (let i = 0; i < events.length; i += 1) {
            const e = events[i]!;
            if (!inPeriod(e.entrada, bounds.startMs, bounds.endMs)) continue;
            if (e.alta === null) continue;
            den += 1;
            for (let j = i + 1; j < events.length; j += 1) {
              const n = events[j]!;
              if (n.entrada > e.alta && n.entrada <= e.alta + 7 * DAY_MS) {
                num7 += 1;
                break;
              }
              if (n.entrada > e.alta + 7 * DAY_MS) break;
            }
            for (let j = i + 1; j < events.length; j += 1) {
              const n = events[j]!;
              if (n.entrada > e.alta && n.entrada <= e.alta + 30 * DAY_MS) {
                num30 += 1;
                break;
              }
              if (n.entrada > e.alta + 30 * DAY_MS) break;
            }
          }
        }
        const current = output.get(key);
        if (!current) continue;
        current.reinternacao_num = num7;
        current.reinternacao_30_num = num30;
        current.reinternacao_den = den;
        current.taxa_conversao_internacao_pct = den > 0 ? Number(((num7 * 100) / den).toFixed(1)) : null;
        current.taxa_reinternacao_30_pct = den > 0 ? Number(((num30 * 100) / den).toFixed(1)) : null;
      }
    }

    if (leitosResolved) {
      const rows = await loadFullTableAsStringRowsConn(conn, leitosResolved);
      const byUnit = new Map<string, Array<{ status: string; dt: number | null }>>();
      for (const [key] of targetCodes) byUnit.set(key, []);
      for (const row of rows) {
        const unit = pickFieldCi(row, "unidade").trim();
        const key = normalizeUnitKey(unit);
        if (!byUnit.has(key)) continue;
        byUnit.get(key)!.push({
          status: normalizeUnitKey(pickFieldCi(row, "status")),
          dt: parseDateMs(
            pickFieldCi(row, "dt_atualizacao") || pickFieldCi(row, "data") || pickFieldCi(row, "dt_criacao")
          )
        });
      }
      for (const [key, list] of byUnit) {
        if (list.length === 0) continue;
        const latest = Math.max(...list.map((x) => x.dt ?? 0));
        const snapshot = latest > 0 ? list.filter((x) => (x.dt ?? 0) === latest) : list;
        const total = snapshot.length;
        if (total <= 0) continue;
        const ocupados = snapshot.filter((x) => !x.status.includes("LIVRE")).length;
        const current = output.get(key);
        if (!current) continue;
        current.ocupacao_leitos_ocupados = ocupados;
        current.ocupacao_leitos_total = total;
        current.ocupacao_internacao_pct = Number(((ocupados * 100) / total).toFixed(1));
      }
    }

    return output;
  });
}

function mapRankingToMetasPayload(
  rows: Record<string, unknown>[],
  options: InternacaoOptions,
  supplement: Map<string, InternacaoSupplement>
): InternacaoQueryPayload {
  const regionalTarget = options.regional?.trim().toUpperCase();
  const unidadeTarget = options.unidade?.trim();
  const targetUnits = INTERNACAO_UNIDADES_HABILITADAS
    .filter((unit) => (regionalTarget ? unit.split("-")[0]?.trim().toUpperCase() === regionalTarget : true))
    .filter((unit) => (unidadeTarget ? normalizeUnitKey(unit) === normalizeUnitKey(unidadeTarget) : true));

  const rankingRows = rows.filter((row) => isInternacaoUnidade(String(row.unidade ?? "").trim()));
  const rowByUnitKey = new Map<string, Record<string, unknown>>();
  for (const row of rankingRows) {
    const unit = String(row.unidade ?? "").trim();
    rowByUnitKey.set(normalizeUnitKey(unit), row);
  }

  const units = sortUnitsForInternacaoMetasTable(targetUnits);
  const metricValueForUnit = (unit: string, field: string): number | null => {
    const key = normalizeUnitKey(unit);
    const row = rowByUnitKey.get(key);
    if (row && Object.prototype.hasOwnProperty.call(row, field) && row[field] !== null && row[field] !== "") {
      const n = Number(row[field]);
      if (Number.isFinite(n)) return n;
    }
    const sup = supplement.get(key) as Record<string, number | null> | undefined;
    if (!sup || !(field in sup)) return null;
    const s = sup[field];
    return typeof s === "number" && Number.isFinite(s) ? s : null;
  };

  /** Prioriza taxas calculadas no supplement (coerente com tooltips parciais / Power BI). */
  const metasMetricValue = (unit: string, field: string): number | null => {
    const key = normalizeUnitKey(unit);
    const sup = supplement.get(key);
    if (field === "taxa_conversao_internacao_pct" && sup?.taxa_conversao_internacao_pct != null && Number.isFinite(sup.taxa_conversao_internacao_pct)) {
      return sup.taxa_conversao_internacao_pct;
    }
    if (field === "taxa_reinternacao_30_pct" && sup?.taxa_reinternacao_30_pct != null && Number.isFinite(sup.taxa_reinternacao_30_pct)) {
      return sup.taxa_reinternacao_30_pct;
    }
    if (field === "taxa_mortalidade_hospitalar_pct" && sup?.taxa_mortalidade_hospitalar_pct != null && Number.isFinite(sup.taxa_mortalidade_hospitalar_pct)) {
      return sup.taxa_mortalidade_hospitalar_pct;
    }
    if (field === "taxa_mortalidade_institucional_pct" && sup?.taxa_mortalidade_institucional_pct != null && Number.isFinite(sup.taxa_mortalidade_institucional_pct)) {
      return sup.taxa_mortalidade_institucional_pct;
    }
    if (field === "ocupacao_internacao_pct" && sup?.ocupacao_internacao_pct != null && Number.isFinite(sup.ocupacao_internacao_pct)) {
      return sup.ocupacao_internacao_pct;
    }
    return metricValueForUnit(unit, field);
  };

  const valuesFor = (field: string, opts?: { weightedBy?: string; percentage?: boolean; divideBy?: number }): { values: Array<number | null>; total: number | null } => {
    const values = units.map((unit) => {
      const raw = metasMetricValue(unit, field);
      if (raw === null) return null;
      const divided = opts?.divideBy ? raw / opts.divideBy : raw;
      if (!Number.isFinite(divided)) return null;
      if (opts?.percentage) return Number(divided.toFixed(1));
      if (Number.isInteger(divided)) return Math.round(divided);
      return Number(divided.toFixed(2));
    });

    const unitValues = units
      .map((unit) => ({ unit, value: metasMetricValue(unit, field) }))
      .filter((x) => x.value !== null) as Array<{ unit: string; value: number }>;

    if (unitValues.length === 0) {
      return { values, total: null };
    }

    if (opts?.weightedBy) {
      const weighted = units.reduce((acc, unit) => {
        const value = metasMetricValue(unit, field);
        const weight = metasMetricValue(unit, opts.weightedBy!);
        if (value === null || weight === null || weight <= 0) return acc;
        return acc + value * weight;
      }, 0);
      const weight = units.reduce((acc, unit) => {
        const w = metasMetricValue(unit, opts.weightedBy!);
        return w !== null && w > 0 ? acc + w : acc;
      }, 0);
      if (weight <= 0) return { values, total: null };
      const base = opts.divideBy ? weighted / weight / opts.divideBy : weighted / weight;
      return { values, total: opts.percentage ? Number(base.toFixed(1)) : Number(base.toFixed(2)) };
    }

    const sum = unitValues.reduce((acc, x) => acc + x.value, 0);
    const total = opts?.divideBy ? sum / opts.divideBy : sum;
    return { values, total: Number.isInteger(total) ? Math.round(total) : Number(total.toFixed(2)) };
  };

  const internacoes = valuesFor("internacoes");
  const altas = valuesFor("altas_total");
  const reinternacao7d = valuesFor("taxa_conversao_internacao_pct", { percentage: true, weightedBy: "altas_total" });
  const reinternacao30d = valuesFor("taxa_reinternacao_30_pct", { percentage: true, weightedBy: "altas_total" });
  const tmp = valuesFor("tempo_medio_alta_min", { weightedBy: "altas_total", divideBy: 1440 });
  const ocupacao = valuesFor("ocupacao_internacao_pct", { percentage: true, weightedBy: "pacientes_ativos" });
  const mortalidadeHospitalar = valuesFor("taxa_mortalidade_hospitalar_pct", { percentage: true, weightedBy: "altas_total" });
  const mortalidadeInstitucional = valuesFor("taxa_mortalidade_institucional_pct", { percentage: true, weightedBy: "altas_total" });

  const placeholderIndicadores = { values: units.map(() => null as number | null), total: null as number | null };

  const conversaoTooltipNums = units.map((unit) => {
    const sup = supplement.get(normalizeUnitKey(unit));
    if (!sup || sup.reinternacao_den == null || sup.reinternacao_den <= 0) return null;
    return Math.round(sup.reinternacao_num ?? 0);
  });
  const conversaoTooltipDens = units.map((unit) => {
    const sup = supplement.get(normalizeUnitKey(unit));
    if (!sup || sup.reinternacao_den == null || sup.reinternacao_den <= 0) return null;
    return Math.round(sup.reinternacao_den);
  });
  const ocupacaoTooltipNums = units.map((unit) => {
    const sup = supplement.get(normalizeUnitKey(unit));
    if (!sup || sup.ocupacao_leitos_total == null || sup.ocupacao_leitos_total <= 0) return null;
    return Math.round(sup.ocupacao_leitos_ocupados ?? 0);
  });
  const ocupacaoTooltipDens = units.map((unit) => {
    const sup = supplement.get(normalizeUnitKey(unit));
    if (!sup || sup.ocupacao_leitos_total == null || sup.ocupacao_leitos_total <= 0) return null;
    return Math.round(sup.ocupacao_leitos_total);
  });

  const reinternacao30TooltipNums = units.map((unit) => {
    const sup = supplement.get(normalizeUnitKey(unit));
    if (!sup || sup.reinternacao_den == null || sup.reinternacao_den <= 0) return null;
    return Math.round(sup.reinternacao_30_num ?? 0);
  });
  const reinternacao30TooltipDens = conversaoTooltipDens;

  const mortHospTooltipNums = units.map((unit) => {
    const sup = supplement.get(normalizeUnitKey(unit));
    if (!sup || sup.altas_total == null || sup.altas_total <= 0) return null;
    return Math.round(sup.obitos_total ?? 0);
  });
  const mortHospTooltipDens = units.map((unit) => {
    const sup = supplement.get(normalizeUnitKey(unit));
    if (!sup || sup.altas_total == null || sup.altas_total <= 0) return null;
    return Math.round(sup.altas_total);
  });
  const mortInstTooltipNums = units.map((unit) => {
    const sup = supplement.get(normalizeUnitKey(unit));
    if (!sup || sup.altas_total == null || sup.altas_total <= 0) return null;
    return Math.round(sup.obitos_institucional_total ?? 0);
  });
  const mortInstTooltipDens = mortHospTooltipDens;

  const base = buildPayloadBase("internacao-metas", options, "metas", env.dataGateway);
  return {
    ...base,
    sourceView: "csv_memory:gerencial-unidades-ranking",
    rowCount: 1,
    rows: [
      {
        kind: "internacao-metas",
        units,
        indicators: [
          { key: "internacoes", label: "Qtd de internações", format: "int", values: internacoes.values, total: internacoes.total },
          { key: "altas", label: "Qtd de altas", format: "int", values: altas.values, total: altas.total },
          {
            key: "reinternacao_7d",
            label: "% reinternação 7d / CID",
            format: "percent",
            values: reinternacao7d.values,
            total: reinternacao7d.total,
            numerators: conversaoTooltipNums,
            denominators: conversaoTooltipDens
          },
          {
            key: "reinternacao_30d",
            label: "% reinternação 30d / CID",
            format: "percent",
            values: reinternacao30d.values,
            total: reinternacao30d.total,
            numerators: reinternacao30TooltipNums,
            denominators: reinternacao30TooltipDens
          },
          { key: "tmp", label: "TMP (dias)", format: "days", values: tmp.values, total: tmp.total },
          {
            key: "ocupacao",
            label: "% ocupação hospitalar",
            format: "percent",
            values: ocupacao.values,
            total: ocupacao.total,
            numerators: ocupacaoTooltipNums,
            denominators: ocupacaoTooltipDens
          },
          {
            key: "altas_hosp_2h",
            label: "% altas hosp até 2h",
            format: "percent",
            values: placeholderIndicadores.values,
            total: placeholderIndicadores.total
          },
          {
            key: "altas_medicas_10h",
            label: "% altas médicas até 10h",
            format: "percent",
            values: placeholderIndicadores.values,
            total: placeholderIndicadores.total
          },
          {
            key: "mortalidade_hospitalar",
            label: "% mortalidade hospitalar",
            format: "percent",
            values: mortalidadeHospitalar.values,
            total: mortalidadeHospitalar.total,
            numerators: mortHospTooltipNums,
            denominators: mortHospTooltipDens
          },
          {
            key: "mortalidade_institucional",
            label: "% mortalidade institucional",
            format: "percent",
            values: mortalidadeInstitucional.values,
            total: mortalidadeInstitucional.total,
            numerators: mortInstTooltipNums,
            denominators: mortInstTooltipDens
          },
          {
            key: "reinternacao_uti_48h",
            label: "% reinternação UTI 48h",
            format: "percent",
            values: placeholderIndicadores.values,
            total: placeholderIndicadores.total
          },
          {
            key: "mortalidade_uti",
            label: "% mortalidade UTI",
            format: "percent",
            values: placeholderIndicadores.values,
            total: placeholderIndicadores.total
          },
          {
            key: "tmp_uti",
            label: "TMP UTI (dias)",
            format: "days",
            values: placeholderIndicadores.values,
            total: placeholderIndicadores.total
          }
        ]
      }
    ]
  };
}

export function buildInternacaoPayloadBase(
  slug: string,
  options: InternacaoOptions,
  endpoint: InternacaoEndpointKey,
  engine: "duckdb" | "csv-memory"
): Pick<InternacaoQueryPayload, "ok" | "slug" | "appliedFilters" | "dependencies"> {
  return {
    ok: true,
    slug,
    appliedFilters: {
      periodDays: options.periodDays,
      regional: options.regional ?? null,
      unidade: options.unidade ?? null
    },
    dependencies: {
      endpoint,
      engine,
      tables: getInternacaoDuckTables(endpoint),
      readPaths: getInternacaoDuckReadPaths(env.csvDataDir, endpoint)
    }
  };
}

function buildPayloadBase(
  slug: string,
  options: InternacaoOptions,
  endpoint: InternacaoEndpointKey,
  engine: "duckdb" | "csv-memory"
): Pick<InternacaoQueryPayload, "ok" | "slug" | "appliedFilters" | "dependencies"> {
  return buildInternacaoPayloadBase(slug, options, endpoint, engine);
}

export async function getInternacaoFiltrosPayload(options: InternacaoOptions): Promise<InternacaoQueryPayload> {
  try {
    const safeLimit = Math.max(1, Math.min(options.limit || 200, 5000));
    const unitsFilterSql = buildUnitsFilterSql(options);
    const rows = await queryDuckDb(`
      SELECT DISTINCT
        UPPER(TRIM(uf)) AS regional,
        TRIM(nome) AS unidade
      FROM tbl_unidades
      WHERE ${unitsFilterSql}
      ORDER BY regional, unidade
      LIMIT ${safeLimit}
    `);
    const base = buildPayloadBase("internacao-filtros", options, "filtros", "duckdb");
    return {
      ...base,
      sourceView: "duckdb:tbl_unidades",
      rowCount: rows.length,
      rows
    };
  } catch {
    const filteredRows = await loadInternacaoFiltrosFromDataset(options);
    const base = buildPayloadBase("internacao-filtros", options, "filtros", "csv-memory");
    return {
      ...base,
      sourceView: "csv_memory:tbl_unidades",
      rowCount: filteredRows.length,
      rows: filteredRows
    };
  }
}

export async function getInternacaoTopoPayload(options: InternacaoOptions): Promise<InternacaoQueryPayload> {
  try {
    const unitsFilterSql = buildUnitsFilterSql(options);
    const dtIntern = SQL_INTERN_I_DT_ENTRADA;
    const dtAlta = SQL_INTERN_I_DT_ALTA;
    const dtConvEnt = "try_cast(replace(c.dt_entrada, ' ', 'T') AS TIMESTAMP)";
    const dtConvAlta = "try_cast(replace(c.dt_alta, ' ', 'T') AS TIMESTAMP)";
    const periodDaysCTE = duckTopoPeriodDaysCTE(options.periodDays);

    const rows = await queryDuckDb(`
      WITH unidades AS (
        SELECT try_cast(cd_estabelecimento AS BIGINT) AS cd
        FROM tbl_unidades
        WHERE ${unitsFilterSql}
      ),
      intern_base AS (
        SELECT
          try_cast(i.cd_estabelecimento AS BIGINT) AS cd,
          ${dtIntern} AS dt_ref
        FROM tbl_intern_internacoes i
        WHERE try_cast(i.cd_estabelecimento AS BIGINT) IN (SELECT cd FROM unidades)
      ),
      intern_window AS (SELECT max(dt_ref) AS max_dt FROM intern_base),
      internacoes_agg AS (
        SELECT count(*) AS internacoes_total
        FROM intern_base, intern_window
        WHERE ${duckPeriodWhere("dt_ref", options.periodDays)}
      ),
      alta_base AS (
        SELECT
          try_cast(i.cd_estabelecimento AS BIGINT) AS cd,
          trim(cast(i.nr_atendimento AS VARCHAR)) AS nr_atendimento,
          ${dtAlta} AS dt_ref,
          ${dtIntern} AS dt_entrada,
          upper(trim(coalesce(cast(i.motivo_alta_hospitalar AS VARCHAR), ''))) AS motivo_u,
          ${SQL_INTERN_I_DT_ALTA_MEDICO} AS dt_med_ts
        FROM tbl_intern_internacoes i
        WHERE try_cast(i.cd_estabelecimento AS BIGINT) IN (SELECT cd FROM unidades)
      ),
      alta_window AS (SELECT max(dt_ref) AS max_dt FROM alta_base),
      ${periodDaysCTE},
      mov_base AS (
        SELECT
          try_cast(cd_estabelecimento AS BIGINT) AS cd,
          trim(cast(nr_atendimento AS VARCHAR)) AS nr_atendimento,
          try_cast(replace(dt_historico, ' ', 'T') AS TIMESTAMP) AS dt_hist,
          try_cast(replace(dt_fim_historico, ' ', 'T') AS TIMESTAMP) AS dt_fim
        FROM tbl_intern_movimentacoes m
        WHERE try_cast(cd_estabelecimento AS BIGINT) IN (SELECT cd FROM unidades)
          AND nr_atendimento IS NOT NULL
          AND trim(cast(nr_atendimento AS VARCHAR)) <> ''
          AND dt_historico IS NOT NULL
          AND trim(cast(dt_historico AS VARCHAR)) <> ''
      ),
      paciente_dia_agg AS (
        SELECT coalesce(sum(day_cnt), 0) AS paciente_dias
        FROM (
          SELECT
            d.ref_day,
            count(DISTINCT m.nr_atendimento) AS day_cnt
          FROM period_days d
          CROSS JOIN mov_base m
          WHERE m.dt_hist < CAST(d.ref_day AS TIMESTAMP)
            AND coalesce(m.dt_fim, current_timestamp) >= CAST(d.ref_day AS TIMESTAMP)
          GROUP BY d.ref_day
        ) daily
      ),
      altas_agg AS (
        SELECT
          count(DISTINCT nr_atendimento) FILTER (
            WHERE dt_ref IS NOT NULL AND trim(nr_atendimento) <> ''
          ) AS altas_total
        FROM alta_base, alta_window
        WHERE ${duckPeriodWhere("dt_ref", options.periodDays)}
      ),
      obitos_agg AS (
        SELECT
          count(DISTINCT nr_atendimento) FILTER (
            WHERE dt_ref IS NOT NULL AND trim(nr_atendimento) <> ''
              AND (
                motivo_u IN ('ÓBITO', 'OBITO')
                OR strpos(lower(replace(replace(motivo_u, 'Ó', 'O'), 'Ô', 'O')), 'obito') > 0
              )
          ) AS obitos_total
        FROM alta_base, alta_window
        WHERE ${duckPeriodWhere("dt_ref", options.periodDays)}
      ),
      reintern_base AS (
        SELECT
          try_cast(c.cd_estab_urg AS BIGINT) AS cd,
          c.cd_pessoa_fisica,
          ${dtConvEnt} AS dt_entrada,
          ${dtConvAlta} AS dt_alta
        FROM tbl_intern_conversoes c
        WHERE try_cast(c.cd_estab_urg AS BIGINT) IN (SELECT cd FROM unidades)
      ),
      reintern_window AS (SELECT max(dt_entrada) AS max_dt FROM reintern_base),
      reintern_periodo AS (
        SELECT *
        FROM reintern_base, reintern_window
        WHERE ${duckPeriodWhere("dt_entrada", options.periodDays)}
      ),
      reintern_calc AS (
        SELECT
          count(*) FILTER (
            WHERE exists (
              SELECT 1
              FROM reintern_base nxt
              WHERE nxt.cd_pessoa_fisica = r.cd_pessoa_fisica
                AND nxt.dt_entrada > r.dt_alta
                AND nxt.dt_entrada <= r.dt_alta + INTERVAL 7 DAY
            )
          ) AS reintern_7d,
          count(*) FILTER (WHERE r.dt_alta IS NOT NULL) AS altas_para_reintern
        FROM reintern_periodo r
      ),
      alta_med_periodo AS (
        SELECT
          trim(cast(a.nr_atendimento AS VARCHAR)) AS nr_atendimento,
          a.dt_ref AS dt_ref,
          a.dt_med_ts AS dt_med_ts,
          a.motivo_u AS motivo_u
        FROM alta_base a, alta_window
        WHERE ${duckPeriodWhere("a.dt_ref", options.periodDays)}
          AND a.dt_ref IS NOT NULL
          AND trim(cast(a.nr_atendimento AS VARCHAR)) <> ''
      ),
      alta_med_enriched AS (
        SELECT
          p.*,
          CASE
            WHEN p.dt_med_ts IS NULL THEN NULL
            WHEN p.dt_med_ts > p.dt_ref THEN p.dt_ref
            ELSE p.dt_med_ts
          END AS dt_medica_condic,
          NOT (
            p.motivo_u IN ('ÓBITO', 'OBITO')
            OR strpos(lower(replace(replace(p.motivo_u, 'Ó', 'O'), 'Ô', 'O')), 'obito') > 0
          ) AS nao_obito
        FROM alta_med_periodo p
      ),
      alta_med_agg AS (
        SELECT
          count(DISTINCT nr_atendimento) FILTER (WHERE nao_obito AND dt_med_ts IS NOT NULL) AS den_10h,
          count(DISTINCT nr_atendimento) FILTER (
            WHERE nao_obito
              AND dt_medica_condic IS NOT NULL
              AND cast(dt_medica_condic AS TIME) <= cast('10:00:00' AS TIME)
          ) AS num_10h,
          count(DISTINCT nr_atendimento) FILTER (WHERE dt_med_ts IS NOT NULL AND dt_ref IS NOT NULL) AS den_2h,
          count(DISTINCT nr_atendimento) FILTER (
            WHERE dt_medica_condic IS NOT NULL
              AND dt_ref IS NOT NULL
              AND dt_ref <= dt_medica_condic + interval '2 hours'
          ) AS num_2h
        FROM alta_med_enriched
      )
      SELECT
        coalesce((SELECT internacoes_total FROM internacoes_agg), 0) AS internacoes_total,
        coalesce((SELECT altas_total FROM altas_agg), 0) AS altas_total,
        CASE
          WHEN coalesce((SELECT altas_total FROM altas_agg), 0) <= 0 THEN NULL
          WHEN coalesce((SELECT paciente_dias FROM paciente_dia_agg), 0) <= 0 THEN NULL
          ELSE (SELECT paciente_dias FROM paciente_dia_agg) * 1440.0 / (SELECT altas_total FROM altas_agg)
        END AS tempo_medio_alta_min,
        CASE
          WHEN coalesce((SELECT altas_para_reintern FROM reintern_calc), 0) = 0 THEN 0
          ELSE round(
            (coalesce((SELECT reintern_7d FROM reintern_calc), 0) * 100.0) /
            nullif((SELECT altas_para_reintern FROM reintern_calc), 0),
            1
          )
        END AS taxa_conversao_internacao_pct,
        coalesce((SELECT obitos_total FROM obitos_agg), 0) AS obitos_total,
        CASE
          WHEN coalesce((SELECT altas_total FROM altas_agg), 0) <= 0 THEN NULL
          ELSE round(100.0 * coalesce((SELECT obitos_total FROM obitos_agg), 0) / (SELECT altas_total FROM altas_agg), 3)
        END AS taxa_mortalidade_geral_pct,
        CASE
          WHEN coalesce((SELECT den_10h FROM alta_med_agg), 0) <= 0 THEN NULL
          ELSE round(100.0 * (SELECT num_10h FROM alta_med_agg) / (SELECT den_10h FROM alta_med_agg), 1)
        END AS pct_altas_medicas_10h,
        CASE
          WHEN coalesce((SELECT den_2h FROM alta_med_agg), 0) <= 0 THEN NULL
          ELSE round(100.0 * (SELECT num_2h FROM alta_med_agg) / (SELECT den_2h FROM alta_med_agg), 1)
        END AS pct_altas_hosp_2h
    `);

    const targetUnitsTopo = buildInternacaoTargetUnitsForTopo(options);
    let ocupacaoTopoPct = await queryOcupacaoInternacaoPctFromDuckDb(options);
    if (ocupacaoTopoPct === null) {
      const supplementTopo = await loadInternacaoSupplementByUnit(options, targetUnitsTopo);
      ocupacaoTopoPct = aggregateOcupacaoInternacaoFromSupplement(targetUnitsTopo, supplementTopo);
    }

    const base = buildPayloadBase("internacao-topo", options, "topo", "duckdb");
    return {
      ...base,
      sourceView: "duckdb:tbl_intern_internacoes+tbl_intern_conversoes",
      rowCount: rows.length,
      rows: rows.map((row) => {
        const r = row as Record<string, unknown>;
        const altasTotal = Math.round(toNum(rowField(r, "altas_total")));
        const obitosTotal = Math.round(toNum(rowField(r, "obitos_total")));
        return {
          internacoes_total: Math.round(toNum(rowField(r, "internacoes_total"))),
          altas_total: altasTotal,
          tempo_medio_alta_min: nullableTopoMinutes(rowField(r, "tempo_medio_alta_min")),
          taxa_conversao_internacao_pct: Number(toNum(rowField(r, "taxa_conversao_internacao_pct")).toFixed(1)),
          obitos_total: obitosTotal,
          taxa_mortalidade_geral_pct: mapTaxaMortalidadeGeralPct(r, altasTotal, obitosTotal),
          ocupacao_internacao_pct: ocupacaoTopoPct,
          pct_altas_medicas_10h: mapTopoNullablePct1(rowField(r, "pct_altas_medicas_10h")),
          pct_altas_hosp_2h: mapTopoNullablePct1(rowField(r, "pct_altas_hosp_2h"))
        };
      })
    };
  } catch {
    const fallback = await getDashboardQueryPayload("gerencial-kpis-topo", {
      limit: 1,
      periodDays: options.periodDays,
      regional: options.regional,
      unidade: options.unidade
    });
    const row = normalizeRowsArray(fallback.rows)[0] ?? {};
    const r = row as Record<string, unknown>;
    const altasFb = Math.round(toNum(rowField(r, "altas_total")));
    const obitosFb = Math.round(toNum(rowField(r, "obitos_total")));
    const targetUnitsTopo = buildInternacaoTargetUnitsForTopo(options);
    const rawOcu = rowField(r, "ocupacao_internacao_pct");
    let ocupacaoFb: number | null =
      rawOcu != null && rawOcu !== "" && Number.isFinite(Number(rawOcu)) ? Number(toNum(rawOcu).toFixed(1)) : null;
    if (ocupacaoFb === null) {
      ocupacaoFb = await queryOcupacaoInternacaoPctFromDuckDb(options);
    }
    if (ocupacaoFb === null) {
      const supplementTopo = await loadInternacaoSupplementByUnit(options, targetUnitsTopo);
      ocupacaoFb = aggregateOcupacaoInternacaoFromSupplement(targetUnitsTopo, supplementTopo);
    }
    const base = buildPayloadBase("internacao-topo", options, "topo", "csv-memory");
    return {
      ...base,
      sourceView: "csv_memory:gerencial-kpis-topo",
      rowCount: 1,
      rows: [
        {
          internacoes_total: Math.round(toNum(rowField(r, "internacoes_total"))),
          altas_total: altasFb,
          tempo_medio_alta_min: nullableTopoMinutes(rowField(r, "tempo_medio_alta_min")),
          taxa_conversao_internacao_pct: Number(toNum(rowField(r, "taxa_conversao_internacao_pct")).toFixed(1)),
          obitos_total: obitosFb,
          taxa_mortalidade_geral_pct: mapTaxaMortalidadeGeralPct(r, altasFb, obitosFb),
          ocupacao_internacao_pct: ocupacaoFb,
          pct_altas_medicas_10h: mapTopoNullablePct1(rowField(r, "pct_altas_medicas_10h")),
          pct_altas_hosp_2h: mapTopoNullablePct1(rowField(r, "pct_altas_hosp_2h"))
        }
      ]
    };
  }
}

export async function getInternacaoMetasPayload(options: InternacaoOptions): Promise<InternacaoQueryPayload> {
  const regionalTarget = options.regional?.trim().toUpperCase();
  const unidadeTarget = options.unidade?.trim();
  const targetUnits = INTERNACAO_UNIDADES_HABILITADAS
    .filter((unit) => (regionalTarget ? unit.split("-")[0]?.trim().toUpperCase() === regionalTarget : true))
    .filter((unit) => (unidadeTarget ? normalizeUnitKey(unit) === normalizeUnitKey(unidadeTarget) : true));

  const supplement = await loadInternacaoSupplementByUnit(options, targetUnits);
  const fallback = await getDashboardQueryPayload("gerencial-unidades-ranking", {
    limit: Math.max(1, Math.min(options.limit || 200, 2000)),
    periodDays: options.periodDays,
    regional: options.regional,
    unidade: options.unidade
  });
  return mapRankingToMetasPayload(normalizeRowsArray(fallback.rows), options, supplement);
}

type VariadosRow = {
  kind: "internacao-variados";
  sexo: Array<{ label: string; value: number; percent: number }>;
  faixaEtariaSexo: Array<{ faixa: string; feminino: number; masculino: number; total: number }>;
  procedencia: Array<{ label: string; value: number; percent: number }>;
  /** count = episódios de reinternação no prazo; percent = count/baseAltas; baseAltas = altas com data no período (denominador). */
  reinternacoes: Array<{
    label: "30 dias" | "7 dias";
    count: number;
    percent: number;
    baseAltas: number;
  }>;
};

function pct(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Number(((value * 100) / total).toFixed(2));
}

function normalizeSexo(value: string): "FEMININO" | "MASCULINO" | "N/I" {
  const key = normalizeUnitKey(value);
  if (key.startsWith("F")) return "FEMININO";
  if (key.startsWith("M")) return "MASCULINO";
  return "N/I";
}

function faixaFromIdade(rawValue: string): { faixa: string; ordem: number } {
  const idade = Number(rawValue);
  if (!Number.isFinite(idade) || idade < 0) return { faixa: "N/I", ordem: 99 };
  if (idade <= 19) return { faixa: "0-19", ordem: 1 };
  if (idade <= 39) return { faixa: "20-39", ordem: 2 };
  if (idade <= 59) return { faixa: "40-59", ordem: 3 };
  if (idade <= 79) return { faixa: "60-79", ordem: 4 };
  if (idade <= 99) return { faixa: "80-99", ordem: 5 };
  if (idade <= 119) return { faixa: "100-119", ordem: 6 };
  return { faixa: "120+", ordem: 7 };
}

function titleCase(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "Não informado";
  return cleaned
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Ordem e rótulos canônicos iguais ao modelo semântico / relatório legado. */
const PROCEDENCIA_CANONICA = [
  "Residência",
  "Consultório",
  "Outro Hospital",
  "Hospital Próprio",
  "Pronto Socorro",
  "APH (Atend. Pré Hospitalar)"
] as const;

/**
 * Agrupa variações do campo PROCEDENCIA nas categorias oficiais; o que não casar vai para "Outros".
 */
function normalizeProcedenciaLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return "Outros";
  const k = normalizeUnitKey(t)
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (k.includes("APH") || k.includes("PRE HOSPITALAR") || k.includes("PRE HOSP") || k.includes("ATEND PRE")) {
    return "APH (Atend. Pré Hospitalar)";
  }
  if (k.includes("RESID")) return "Residência";
  if (k.includes("CONSULT")) return "Consultório";
  if (k.includes("OUTRO") && k.includes("HOSPITAL")) return "Outro Hospital";
  if (k.includes("HOSPITAL") && k.includes("PROPRIO")) return "Hospital Próprio";
  if (k.includes("PRONTO") && k.includes("SOCORRO")) return "Pronto Socorro";
  if (k === "PS") return "Pronto Socorro";

  return "Outros";
}

function toVariadosPayload(options: InternacaoOptions, entries: Array<Record<string, string>>): InternacaoQueryPayload {
  const bySexo = new Map<"FEMININO" | "MASCULINO" | "N/I", number>([
    ["FEMININO", 0],
    ["MASCULINO", 0],
    ["N/I", 0]
  ]);
  const byFaixaSexo = new Map<string, { ordem: number; feminino: number; masculino: number }>();
  const byPerson = new Map<string, Array<{ entrada: number; alta: number | null }>>();
  const periodDates: number[] = [];

  for (const row of entries) {
    const entrada = parseDateMs(pickField(row, "dt_entrada"));
    if (entrada !== null) periodDates.push(entrada);

    const sexo = normalizeSexo(pickField(row, "sexo"));
    bySexo.set(sexo, (bySexo.get(sexo) ?? 0) + 1);

    const faixa = faixaFromIdade(pickField(row, "idade"));
    const faixaCurrent = byFaixaSexo.get(faixa.faixa) ?? { ordem: faixa.ordem, feminino: 0, masculino: 0 };
    if (sexo === "FEMININO") faixaCurrent.feminino += 1;
    else if (sexo === "MASCULINO") faixaCurrent.masculino += 1;
    byFaixaSexo.set(faixa.faixa, faixaCurrent);

    const pessoa = pickField(row, "cd_pessoa_fisica").trim();
    if (pessoa && entrada !== null) {
      if (!byPerson.has(pessoa)) byPerson.set(pessoa, []);
      byPerson.get(pessoa)!.push({
        entrada,
        alta: parseDateMs(pickField(row, "dt_alta"))
      });
    }
  }

  const bounds = resolvePeriodBounds(periodDates, options.periodDays);
  const filteredByPeriod =
    bounds === null
      ? entries
      : entries.filter((row) => {
          const entrada = parseDateMs(pickField(row, "dt_entrada"));
          return inPeriod(entrada, bounds.startMs, bounds.endMs);
        });

  const totalPeriod = filteredByPeriod.length;
  const sexoPeriod = new Map<"FEMININO" | "MASCULINO" | "N/I", number>([
    ["FEMININO", 0],
    ["MASCULINO", 0],
    ["N/I", 0]
  ]);
  const faixaPeriod = new Map<string, { ordem: number; feminino: number; masculino: number }>();
  const procPeriod = new Map<string, number>();

  for (const row of filteredByPeriod) {
    const sexo = normalizeSexo(pickField(row, "sexo"));
    sexoPeriod.set(sexo, (sexoPeriod.get(sexo) ?? 0) + 1);

    const faixa = faixaFromIdade(pickField(row, "idade"));
    const faixaCurrent = faixaPeriod.get(faixa.faixa) ?? { ordem: faixa.ordem, feminino: 0, masculino: 0 };
    if (sexo === "FEMININO") faixaCurrent.feminino += 1;
    else if (sexo === "MASCULINO") faixaCurrent.masculino += 1;
    faixaPeriod.set(faixa.faixa, faixaCurrent);

    const procedencia = normalizeProcedenciaLabel(pickField(row, "procedencia"));
    procPeriod.set(procedencia, (procPeriod.get(procedencia) ?? 0) + 1);
  }

  let altasDen = 0;
  let reint7 = 0;
  let reint30 = 0;
  if (bounds !== null) {
    for (const events of byPerson.values()) {
      events.sort((a, b) => a.entrada - b.entrada);
      for (let i = 0; i < events.length; i += 1) {
        const current = events[i]!;
        if (!inPeriod(current.entrada, bounds.startMs, bounds.endMs)) continue;
        if (current.alta === null) continue;
        altasDen += 1;
        for (let j = i + 1; j < events.length; j += 1) {
          const next = events[j]!;
          if (next.entrada <= current.alta) continue;
          const deltaMs = next.entrada - current.alta;
          if (deltaMs <= 7 * 24 * 60 * 60 * 1000) {
            reint7 += 1;
            reint30 += 1;
            break;
          }
          if (deltaMs <= 30 * 24 * 60 * 60 * 1000) {
            reint30 += 1;
            break;
          }
          break;
        }
      }
    }
  }

  const sexoPayload = [
    {
      label: "FEMININO",
      value: sexoPeriod.get("FEMININO") ?? 0,
      percent: pct(sexoPeriod.get("FEMININO") ?? 0, totalPeriod)
    },
    {
      label: "MASCULINO",
      value: sexoPeriod.get("MASCULINO") ?? 0,
      percent: pct(sexoPeriod.get("MASCULINO") ?? 0, totalPeriod)
    }
  ];

  const faixaPayload = [...faixaPeriod.entries()]
    .map(([faixa, values]) => ({
      faixa,
      ordem: values.ordem,
      feminino: values.feminino,
      masculino: values.masculino,
      total: values.feminino + values.masculino
    }))
    .sort((a, b) => a.ordem - b.ordem)
    .map(({ ordem: _ordem, ...rest }) => rest);

  const procedenciaTotal = [...procPeriod.values()].reduce((acc, value) => acc + value, 0);
  const outrosCount = procPeriod.get("Outros") ?? 0;
  const procedenciaPayload: VariadosRow["procedencia"] = [
    ...PROCEDENCIA_CANONICA.map((label) => ({
      label,
      value: procPeriod.get(label) ?? 0,
      percent: pct(procPeriod.get(label) ?? 0, procedenciaTotal)
    })),
    ...(outrosCount > 0
      ? [{ label: "Outros" as const, value: outrosCount, percent: pct(outrosCount, procedenciaTotal) }]
      : [])
  ];

  const reinternacoesPayload: VariadosRow["reinternacoes"] = [
    { label: "30 dias", count: reint30, percent: pct(reint30, altasDen), baseAltas: altasDen },
    { label: "7 dias", count: reint7, percent: pct(reint7, altasDen), baseAltas: altasDen }
  ];

  const base = buildPayloadBase("internacao-variados", options, "variados", "csv-memory");
  return {
    ...base,
    sourceView: "csv_memory:tbl_intern_internacoes",
    rowCount: 1,
    rows: [
      {
        kind: "internacao-variados",
        sexo: sexoPayload,
        faixaEtariaSexo: faixaPayload,
        procedencia: procedenciaPayload,
        reinternacoes: reinternacoesPayload
      } satisfies VariadosRow
    ]
  };
}

export async function getInternacaoVariadosPayload(options: InternacaoOptions): Promise<InternacaoQueryPayload> {
  const unitsFilterSql = buildUnitsFilterSql(options);
  const safeLimit = Math.max(1, Math.min(options.limit || 50000, 200000));
  try {
    const dtIntern = "try_cast(replace(i.dt_entrada, ' ', 'T') AS TIMESTAMP)";
    const rows = await queryDuckDb(`
      WITH unidades AS (
        SELECT try_cast(cd_estabelecimento AS BIGINT) AS cd
        FROM tbl_unidades
        WHERE ${unitsFilterSql}
      ),
      intern_base AS (
        SELECT
          try_cast(i.cd_estabelecimento AS BIGINT) AS cd_estabelecimento,
          i.cd_pessoa_fisica,
          i.nr_atendimento,
          i.sexo,
          i.idade,
          i.procedencia,
          i.dt_entrada,
          i.dt_alta,
          ${dtIntern} AS dt_entrada_ts
        FROM tbl_intern_internacoes i
        WHERE try_cast(i.cd_estabelecimento AS BIGINT) IN (SELECT cd FROM unidades)
      ),
      intern_window AS (SELECT max(dt_entrada_ts) AS max_dt FROM intern_base)
      SELECT
        cast(cd_pessoa_fisica AS VARCHAR) AS cd_pessoa_fisica,
        cast(nr_atendimento AS VARCHAR) AS nr_atendimento,
        cast(sexo AS VARCHAR) AS sexo,
        cast(idade AS VARCHAR) AS idade,
        cast(procedencia AS VARCHAR) AS procedencia,
        cast(dt_entrada AS VARCHAR) AS dt_entrada,
        cast(dt_alta AS VARCHAR) AS dt_alta
      FROM intern_base, intern_window
      WHERE ${duckPeriodWhere("dt_entrada_ts", options.periodDays)}
      LIMIT ${safeLimit}
    `);

    const normalizedRows = rows.map((row) => ({
      cd_pessoa_fisica: String(row.cd_pessoa_fisica ?? ""),
      nr_atendimento: String(row.nr_atendimento ?? ""),
      sexo: String(row.sexo ?? ""),
      idade: String(row.idade ?? ""),
      procedencia: String(row.procedencia ?? ""),
      dt_entrada: String(row.dt_entrada ?? ""),
      dt_alta: String(row.dt_alta ?? "")
    }));

    const payload = toVariadosPayload(options, normalizedRows);
    return {
      ...payload,
      dependencies: {
        ...payload.dependencies,
        engine: "duckdb"
      },
      sourceView: "duckdb:tbl_intern_internacoes"
    };
  } catch {
    return withMemoryDatasetDb(async (_db, conn) => {
      const unitsResolved = resolveDatasetTableByBase(env.csvDataDir, "tbl_unidades");
      const internResolved = resolveDatasetTableByBase(env.csvDataDir, "tbl_intern_internacoes");
      if (!unitsResolved || !internResolved) {
        const base = buildPayloadBase("internacao-variados", options, "variados", "csv-memory");
        return {
          ...base,
          sourceView: "csv_memory:tbl_intern_internacoes",
          rowCount: 1,
          rows: [
            {
              kind: "internacao-variados",
              sexo: [],
              faixaEtariaSexo: [],
              procedencia: [],
              reinternacoes: [
                { label: "30 dias", count: 0, percent: 0, baseAltas: 0 },
                { label: "7 dias", count: 0, percent: 0, baseAltas: 0 }
              ]
            } satisfies VariadosRow
          ]
        };
      }

      const unitRows = await loadFullTableAsStringRowsConn(conn, unitsResolved);
      const allowedCodes = new Set<number>();
      for (const row of unitRows) {
        const nome = pickField(row, "nome").trim();
        const uf = pickField(row, "uf").trim().toUpperCase();
        const code = Number.parseInt(pickField(row, "cd_estabelecimento"), 10);
        if (!Number.isFinite(code)) continue;
        if (!isInternacaoUnidade(nome)) continue;
        if (options.regional && uf !== options.regional.trim().toUpperCase()) continue;
        if (options.unidade && normalizeUnitKey(nome) !== normalizeUnitKey(options.unidade)) continue;
        allowedCodes.add(code);
      }
      if (allowedCodes.size === 0) {
        const base = buildPayloadBase("internacao-variados", options, "variados", "csv-memory");
        return {
          ...base,
          sourceView: "csv_memory:tbl_intern_internacoes",
          rowCount: 1,
          rows: [
            {
              kind: "internacao-variados",
              sexo: [],
              faixaEtariaSexo: [],
              procedencia: [],
              reinternacoes: [
                { label: "30 dias", count: 0, percent: 0, baseAltas: 0 },
                { label: "7 dias", count: 0, percent: 0, baseAltas: 0 }
              ]
            } satisfies VariadosRow
          ]
        };
      }

      const internRowsRaw = await loadFullTableAsStringRowsConn(conn, internResolved);
      const internRows = filterInternFactRowsByGerencialRetention(
        internRowsRaw,
        internInternacaoRowActivityMs,
        internacaoFactsRetentionDays(options.periodDays)
      );
      const filtered = internRows
        .filter((row) => {
          const code = Number.parseInt(pickField(row, "cd_estabelecimento"), 10);
          return Number.isFinite(code) && allowedCodes.has(code);
        })
        .slice(0, safeLimit)
        .map((row) => ({
          cd_pessoa_fisica: pickField(row, "cd_pessoa_fisica"),
          nr_atendimento: pickField(row, "nr_atendimento"),
          sexo: pickField(row, "sexo"),
          idade: pickField(row, "idade"),
          procedencia: pickField(row, "procedencia"),
          dt_entrada: pickField(row, "dt_entrada"),
          dt_alta: pickField(row, "dt_alta")
        }));
      return toVariadosPayload(options, filtered);
    });
  }
}

