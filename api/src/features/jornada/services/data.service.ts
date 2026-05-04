import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../../core/config/env.js";
import {
  queryLimitedRowsConn,
  resolveExistingNamedFile,
  withMemoryDatasetDb
} from "../../../data/utils/datasetTableLoader.js";
import { getDuckDbViewRows, listDuckDbViews } from "../../../data/services/duckdb.service.js";

type RowsPayload = {
  ok: true;
  view: string;
  rows: Record<string, unknown>[];
  count: number;
  limit: number;
};

type ViewsPayload = {
  ok: true;
  count: number;
  views: string[];
};

function normalizeViewName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
}

/** Lista bases com ficheiro Parquet ou CSV (Parquet ganha se ambos existirem). */
async function listDatasetViews(): Promise<Array<{ view: string; file: string }>> {
  const files = await fs.readdir(env.csvDataDir);
  const byBase = new Map<string, string>();
  for (const file of files) {
    const lower = file.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".parquet")) continue;
    const base = lower.endsWith(".parquet") ? file.replace(/\.parquet$/i, "") : file.replace(/\.csv$/i, "");
    if (lower.endsWith(".parquet")) {
      byBase.set(base, file);
    } else if (!byBase.has(base)) {
      byBase.set(base, file);
    }
  }
  return [...byBase.entries()]
    .map(([base, file]) => ({ file, view: normalizeViewName(base) }))
    .sort((a, b) => a.view.localeCompare(b.view));
}

export async function getViewsPayload(): Promise<ViewsPayload> {
  if (env.dataGateway === "duckdb") {
    try {
      const views = await listDuckDbViews();
      return {
        ok: true,
        count: views.length,
        views
      };
    } catch {
      // fallback para leitura direta
    }
  }

  const views = await listDatasetViews();
  return {
    ok: true,
    count: views.length,
    views: views.map((v) => v.view)
  };
}

export async function getViewRowsPayload(viewName: string, limit: number): Promise<RowsPayload> {
  const safeLimit = Math.max(1, Math.min(limit, 1000));

  if (env.dataGateway === "duckdb") {
    try {
      const rows = await getDuckDbViewRows(viewName, safeLimit);
      return {
        ok: true,
        view: normalizeViewName(viewName),
        rows,
        count: rows.length,
        limit: safeLimit
      };
    } catch {
      // fallback
    }
  }

  const views = await listDatasetViews();
  const match = views.find((v) => v.view === normalizeViewName(viewName));
  if (!match) {
    throw new Error(`View nao encontrada: ${viewName}`);
  }

  const resolved = resolveExistingNamedFile(env.csvDataDir, match.file);
  if (!resolved) {
    throw new Error(`Ficheiro nao encontrado: ${match.file}`);
  }

  const rows = await withMemoryDatasetDb(async (_db, conn) =>
    queryLimitedRowsConn(conn, resolved, safeLimit)
  );

  return {
    ok: true,
    view: match.view,
    rows,
    count: rows.length,
    limit: safeLimit
  };
}
