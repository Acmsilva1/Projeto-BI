import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { getDuckDbViewRows, listDuckDbViews } from "./duckdb.service.js";

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

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (quoted && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

function normalizeViewName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
}

async function readCsvRows(fileName: string, limit: number): Promise<Record<string, unknown>[]> {
  const raw = await fs.readFile(path.resolve(env.csvDataDir, fileName), "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0] ?? "").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, unknown>[] = [];
  const safeLimit = Math.max(1, Math.min(limit, 1000));
  for (let i = 1; i < lines.length && rows.length < safeLimit; i += 1) {
    const values = parseCsvLine(lines[i] ?? "");
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j += 1) {
      const key = headers[j];
      if (!key) continue;
      row[key] = (values[j] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

async function listCsvViews(): Promise<Array<{ view: string; file: string }>> {
  const files = await fs.readdir(env.csvDataDir);
  return files
    .filter((file) => file.toLowerCase().endsWith(".csv"))
    .map((file) => ({ file, view: normalizeViewName(file.replace(/\.csv$/i, "")) }))
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
      // fallback para CSV-memory
    }
  }

  const views = await listCsvViews();
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
      // fallback para CSV-memory
    }
  }

  const views = await listCsvViews();
  const match = views.find((v) => v.view === normalizeViewName(viewName));
  if (!match) {
    throw new Error(`View nao encontrada: ${viewName}`);
  }

  const rows = await readCsvRows(match.file, safeLimit);
  return {
    ok: true,
    view: match.view,
    rows,
    count: rows.length,
    limit: safeLimit
  };
}
