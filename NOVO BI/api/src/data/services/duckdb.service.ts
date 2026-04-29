import fs from "node:fs/promises";
import path from "node:path";
import duckdb from "duckdb";
import { env } from "../../core/config/env.js";
import { normalizeRowValues } from "../utils/datasetTableLoader.js";

type DuckDbStatus = {
  status: "disabled" | "ready" | "error";
  csvDir: string;
  dbPath: string;
  viewsLoaded: number;
  lastError: string | null;
};

type DuckDbRuntime = {
  initPromise: Promise<void> | null;
  database: duckdb.Database | null;
  viewsByName: Map<string, string>;
  status: DuckDbStatus;
};

type SupportedFileType = "csv" | "parquet";

const runtime: DuckDbRuntime = {
  initPromise: null,
  database: null,
  viewsByName: new Map<string, string>(),
  status: {
    status: env.dataGateway === "duckdb" ? "error" : "disabled",
    csvDir: env.csvDataDir,
    dbPath: env.duckdbPath,
    viewsLoaded: 0,
    lastError: env.dataGateway === "duckdb" ? "DuckDB nao inicializado." : null
  }
};

function normalizeViewName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
}

function sqlEscapeText(value: string): string {
  return value.replaceAll("\\", "/").replaceAll("'", "''");
}

function sqlEscapeIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function getSupportedFileType(fileName: string): SupportedFileType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".parquet")) return "parquet";
  if (lower.endsWith(".csv")) return "csv";
  return null;
}

function buildViewSql(fileType: SupportedFileType, escapedView: string, escapedFile: string): string {
  if (fileType === "parquet") {
    return `CREATE OR REPLACE VIEW ${escapedView} AS SELECT * FROM read_parquet('${escapedFile}');`;
  }

  return `CREATE OR REPLACE VIEW ${escapedView} AS SELECT * FROM read_csv_auto('${escapedFile}', HEADER=true, ALL_VARCHAR=true, SAMPLE_SIZE=-1, IGNORE_ERRORS=true);`;
}

function runQuery(database: duckdb.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    database.run(sql, (error: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function allQuery(database: duckdb.Database, sql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    database.all(sql, (error: Error | null, rows: Record<string, unknown>[]) => {
      if (error) reject(error);
      else resolve((rows ?? []).map((r) => normalizeRowValues(r)));
    });
  });
}

async function buildViews(database: duckdb.Database): Promise<{ viewsByName: Map<string, string>; errors: string[] }> {
  const files = await fs.readdir(env.csvDataDir);
  /** Por nome base: Parquet prevalece sobre CSV. */
  const chosen = new Map<string, { file: string; fileType: SupportedFileType }>();
  for (const file of files) {
    const fileType = getSupportedFileType(file);
    if (!fileType) continue;
    const baseName = fileType === "parquet" ? file.replace(/\.parquet$/i, "") : file.replace(/\.csv$/i, "");
    const prev = chosen.get(baseName);
    if (!prev || (prev.fileType === "csv" && fileType === "parquet")) {
      chosen.set(baseName, { file, fileType });
    }
  }
  const typedFiles = [...chosen.values()].sort((a, b) => a.file.localeCompare(b.file));

  const viewsByName = new Map<string, string>();
  const errors: string[] = [];
  for (const { file, fileType } of typedFiles) {
    const baseName = fileType === "parquet" ? file.replace(/\.parquet$/i, "") : file.replace(/\.csv$/i, "");
    const viewName = normalizeViewName(baseName);
    const filePath = path.resolve(env.csvDataDir, file);
    const escapedFile = sqlEscapeText(filePath);
    const escapedView = sqlEscapeIdentifier(viewName);
    try {
      await runQuery(database, buildViewSql(fileType, escapedView, escapedFile));
      viewsByName.set(viewName, file);
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha desconhecida";
      errors.push(`${file}: ${message}`);
    }
  }
  return { viewsByName, errors };
}

async function initializeDuckDb(): Promise<void> {
  if (env.dataGateway !== "duckdb") {
    runtime.status = {
      status: "disabled",
      csvDir: env.csvDataDir,
      dbPath: env.duckdbPath,
      viewsLoaded: 0,
      lastError: null
    };
    return;
  }

  try {
    if (env.duckdbPath !== ":memory:") {
      await fs.mkdir(path.dirname(env.duckdbPath), { recursive: true });
    }
    const database = new duckdb.Database(env.duckdbPath);
    runtime.database = database;
    await runQuery(database, "PRAGMA threads=4;");
    const { viewsByName, errors } = await buildViews(database);
    if (viewsByName.size === 0) {
      throw new Error(errors[0] ?? "Nenhum arquivo suportado (.csv/.parquet) foi carregado no DuckDB.");
    }

    runtime.viewsByName = viewsByName;
    runtime.status = {
      status: "ready",
      csvDir: env.csvDataDir,
      dbPath: env.duckdbPath,
      viewsLoaded: viewsByName.size,
      lastError: errors.length > 0 ? `Arquivos com falha: ${errors.slice(0, 3).join(" | ")}` : null
    };
  } catch (error) {
    runtime.database = null;
    runtime.viewsByName.clear();
    runtime.status = {
      status: "error",
      csvDir: env.csvDataDir,
      dbPath: env.duckdbPath,
      viewsLoaded: 0,
      lastError: error instanceof Error ? error.message : "Falha ao inicializar DuckDB."
    };
    throw error;
  }
}

export async function ensureDuckDbReady(): Promise<void> {
  if (runtime.database && runtime.status.status === "ready") return;
  if (!runtime.initPromise) {
    runtime.initPromise = initializeDuckDb().finally(() => {
      runtime.initPromise = null;
    });
  }
  await runtime.initPromise;
}

export async function listDuckDbViews(): Promise<string[]> {
  await ensureDuckDbReady();
  return [...runtime.viewsByName.keys()].sort((a, b) => a.localeCompare(b));
}

export async function getDuckDbViewRows(viewName: string, limit: number): Promise<Record<string, unknown>[]> {
  await ensureDuckDbReady();
  const database = runtime.database;
  if (!database) {
    throw new Error("DuckDB indisponivel.");
  }
  const normalizedView = normalizeViewName(viewName);
  if (!runtime.viewsByName.has(normalizedView)) {
    throw new Error(`View nao encontrada: ${viewName}`);
  }
  const safeLimit = Math.max(1, Math.min(limit, 5000));
  const rows = await allQuery(
    database,
    `SELECT * FROM ${sqlEscapeIdentifier(normalizedView)} LIMIT ${safeLimit};`
  );
  return rows;
}

export async function queryDuckDb(sql: string): Promise<Record<string, unknown>[]> {
  await ensureDuckDbReady();
  const database = runtime.database;
  if (!database) {
    throw new Error("DuckDB indisponivel.");
  }
  return allQuery(database, sql);
}

export function getDuckDbStatus(): DuckDbStatus {
  return { ...runtime.status };
}
