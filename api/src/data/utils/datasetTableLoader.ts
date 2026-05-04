import fs from "node:fs";
import path from "node:path";
import duckdb from "duckdb";
import { env } from "../../core/config/env.js";

export type ResolvedTable = { fullPath: string; kind: "parquet" | "csv" };

export function sqlEscapeDatasetPath(absPath: string): string {
  return path.resolve(absPath).replace(/\\/g, "/").replace(/'/g, "''");
}

/** Preferência: `.parquet`, senão `.csv` (mesmo nome base). */
export function resolveDatasetTableByBase(dataDir: string, base: string): ResolvedTable | null {
  const pq = path.join(dataDir, `${base}.parquet`);
  const csv = path.join(dataDir, `${base}.csv`);
  if (fs.existsSync(pq)) return { fullPath: pq, kind: "parquet" };
  if (fs.existsSync(csv)) return { fullPath: csv, kind: "csv" };
  return null;
}

export function resolveExistingNamedFile(dataDir: string, fileName: string): ResolvedTable | null {
  const full = path.join(dataDir, fileName);
  if (!fs.existsSync(full)) return null;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".parquet")) return { fullPath: full, kind: "parquet" };
  if (lower.endsWith(".csv")) return { fullPath: full, kind: "csv" };
  return null;
}

function promisifyConnAll(conn: duckdb.Connection, sql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    conn.all(sql, (err: Error | null, rows: Record<string, unknown>[]) => {
      if (err) reject(err);
      else resolve(rows ?? []);
    });
  });
}

function normalizeCell(v: unknown): unknown {
  if (typeof v === "bigint") {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : v.toString();
  }
  if (v instanceof Date) return v.toISOString();
  return v;
}

export function rowToStringRecord(r: Record<string, unknown>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    const nv = normalizeCell(v);
    if (nv === null || nv === undefined) o[k] = "";
    else o[k] = String(nv);
  }
  return o;
}

export function normalizeRowValues(r: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    out[k] = normalizeCell(v);
  }
  return out;
}

function buildFromClause(resolved: ResolvedTable): string {
  const esc = sqlEscapeDatasetPath(resolved.fullPath);
  if (resolved.kind === "parquet") {
    return `read_parquet('${esc}')`;
  }
  const sample = env.csvReadSampleSize;
  const sampleArg = sample < 0 ? "SAMPLE_SIZE=-1" : `SAMPLE_SIZE=${sample}`;
  return `read_csv_auto('${esc}', HEADER=true, ALL_VARCHAR=true, ${sampleArg}, IGNORE_ERRORS=true)`;
}

function closeConn(conn: duckdb.Connection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.close((err: Error | null | undefined) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Carrega várias tabelas em paralelo (várias conexões DuckDB no mesmo DB em memória).
 * Reduz tempo de parede vs. um `await` por tabela em sequência.
 */
export async function loadDatasetBasesInParallel(
  db: duckdb.Database,
  dataDir: string,
  bases: readonly string[],
  concurrency: number
): Promise<Record<string, string>[][]> {
  const results: Record<string, string>[][] = new Array(bases.length);
  let next = 0;

  async function loadIndex(i: number): Promise<void> {
    const base = bases[i]!;
    const r = resolveDatasetTableByBase(dataDir, base);
    if (!r) {
      results[i] = [];
      return;
    }
    const c = db.connect();
    try {
      results[i] = await loadFullTableAsStringRowsConn(c, r);
    } finally {
      await closeConn(c);
    }
  }

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= bases.length) return;
      await loadIndex(i);
    }
  }

  const workers = Math.min(Math.max(1, concurrency), bases.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/** Carrega tabela completa como strings (uma query na conexão fornecida). */
export async function loadFullTableAsStringRowsConn(
  conn: duckdb.Connection,
  resolved: ResolvedTable
): Promise<Record<string, string>[]> {
  const sql = `SELECT * FROM ${buildFromClause(resolved)}`;
  const raw = await promisifyConnAll(conn, sql);
  return raw.map((r) => rowToStringRecord(r));
}

export async function queryLimitedRowsConn(
  conn: duckdb.Connection,
  resolved: ResolvedTable,
  limit: number
): Promise<Record<string, unknown>[]> {
  const safe = Math.max(1, Math.min(limit, 5000));
  const sql = `SELECT * FROM ${buildFromClause(resolved)} LIMIT ${safe}`;
  const raw = await promisifyConnAll(conn, sql);
  return raw.map((r) => normalizeRowValues(r));
}

export async function withMemoryDatasetDb<T>(fn: (db: duckdb.Database, conn: duckdb.Connection) => Promise<T>): Promise<T> {
  const db = new duckdb.Database(":memory:");
  const conn = db.connect();
  try {
    return await fn(db, conn);
  } finally {
    await new Promise<void>((resolve, reject) => {
      db.close((err: Error | null | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
