import { tableFromArrays, tableToIPC } from "apache-arrow";

export const ARROW_STREAM_CONTENT_TYPE = "application/vnd.apache.arrow.stream";

type ArrowCell = string | number | boolean | null;

function normalizeArrowCell(value: unknown): ArrowCell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function resolveColumnMode(values: ArrowCell[]): "number" | "boolean" | "string" {
  const kinds = new Set<"number" | "boolean" | "string">();
  for (const value of values) {
    if (value === null) continue;
    if (typeof value === "number") kinds.add("number");
    else if (typeof value === "boolean") kinds.add("boolean");
    else kinds.add("string");
    if (kinds.size > 1) return "string";
  }
  if (kinds.has("number")) return "number";
  if (kinds.has("boolean")) return "boolean";
  return "string";
}

export function serializeRowsToArrow(rows: Record<string, unknown>[]): Uint8Array {
  const fieldNames: string[] = [];
  const seenFields = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seenFields.has(key)) continue;
      seenFields.add(key);
      fieldNames.push(key);
    }
  }

  if (fieldNames.length === 0) {
    const table = tableFromArrays({ __empty: [] as string[] });
    return tableToIPC(table, "stream");
  }

  const arrays: Record<string, Array<string | number | boolean | null>> = {};
  for (const field of fieldNames) {
    const normalized = rows.map((row) => normalizeArrowCell(row[field]));
    const mode = resolveColumnMode(normalized);
    arrays[field] = normalized.map((value) => {
      if (value === null) return null;
      if (mode === "number") return typeof value === "number" ? value : null;
      if (mode === "boolean") return typeof value === "boolean" ? value : null;
      return String(value);
    });
  }

  const table = tableFromArrays(arrays);
  return tableToIPC(table, "stream");
}

export function wantsArrowResponse(acceptHeader: string | undefined, formatParam: string | undefined): boolean {
  if ((formatParam ?? "").toLowerCase() === "arrow") return true;
  return (acceptHeader ?? "").toLowerCase().includes(ARROW_STREAM_CONTENT_TYPE);
}
