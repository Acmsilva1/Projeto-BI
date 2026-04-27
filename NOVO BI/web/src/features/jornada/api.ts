import { tableFromIPC } from "apache-arrow";
import { buildApiUrl } from "./apiBase";

const ARROW_STREAM_CONTENT_TYPE = "application/vnd.apache.arrow.stream";

export type ApiHealth = {
  ok: boolean;
  service: string;
  version: string;
  dataGateway: string;
  duckdb?: {
    status: string;
    csvDir: string;
    dbPath: string;
    viewsLoaded: number;
    lastError: string | null;
  };
  timestamp: string;
};

export async function fetchApiHealth(signal?: AbortSignal): Promise<ApiHealth> {
  const response = await fetch(buildApiUrl("/api/v1/health"), { signal });
  if (!response.ok) {
    throw new Error(`Falha ao consultar API (${response.status})`);
  }
  return (await response.json()) as ApiHealth;
}

export type DashboardRowsPayload = {
  ok: true;
  slug: string;
  sourceView: string;
  appliedFilters?: {
    periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;
    regional: string | null;
    unidade: string | null;
    indicadorKey?: string | null;
    mes?: string | null;
    semana?: string | null;
  };
  rowCount: number;
  rows: Record<string, unknown>[];
};

function parseArrowCell(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed) as unknown;
      } catch {
        return value;
      }
    }
  }
  return value;
}

function parseArrowRows(buffer: ArrayBuffer): Record<string, unknown>[] {
  const table = tableFromIPC(new Uint8Array(buffer));
  if (table.numRows === 0) return [];

  const fieldNames = table.schema.fields.map((field) => field.name).filter((name) => name !== "__empty");
  if (fieldNames.length === 0) return [];

  const rows: Record<string, unknown>[] = [];
  for (let rowIndex = 0; rowIndex < table.numRows; rowIndex += 1) {
    const row: Record<string, unknown> = {};
    for (const fieldName of fieldNames) {
      const vector = table.getChild(fieldName);
      row[fieldName] = parseArrowCell(vector?.get(rowIndex));
    }
    rows.push(row);
  }
  return rows;
}

export async function fetchDashboardRows(
  slug: string,
  options?: {
    limit?: number;
    period?: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;
    regional?: string;
    unidade?: string;
    signal?: AbortSignal;
  }
): Promise<DashboardRowsPayload> {
  const queryParams = new URLSearchParams();
  if (options?.limit) queryParams.set("limit", String(options.limit));
  if (options?.period) queryParams.set("period", String(options.period));
  if (options?.regional) queryParams.set("regional", options.regional);
  if (options?.unidade) queryParams.set("unidade", options.unidade);
  queryParams.set("format", "arrow");
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  const response = await fetch(buildApiUrl(`/api/v1/dashboard/${encodeURIComponent(slug)}${query}`), {
    signal: options?.signal,
    headers: {
      Accept: `${ARROW_STREAM_CONTENT_TYPE}, application/json`
    }
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar dashboard "${slug}" (${response.status})`);
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes(ARROW_STREAM_CONTENT_TYPE)) {
    const rows = parseArrowRows(await response.arrayBuffer());
    const rowCount = Number(response.headers.get("x-row-count") ?? rows.length);
    const headerPeriod = Number(response.headers.get("x-period-days") ?? options?.period ?? 1);
    const periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365 =
      headerPeriod === 1
        ? 1
        : headerPeriod === 7
          ? 7
          : headerPeriod === 15
            ? 15
            : headerPeriod === 30
              ? 30
              : headerPeriod === 60
                ? 60
                : headerPeriod === 90
                  ? 90
                  : headerPeriod === 180
                    ? 180
                    : headerPeriod === 365
                      ? 365
                      : 1;

    return {
      ok: true,
      slug: response.headers.get("x-slug") ?? slug,
      sourceView: response.headers.get("x-source-view") ?? "arrow_stream",
      appliedFilters: {
        periodDays,
        regional: response.headers.get("x-regional") || null,
        unidade: response.headers.get("x-unidade") || null
      },
      rowCount: Number.isFinite(rowCount) ? rowCount : rows.length,
      rows
    };
  }

  return (await response.json()) as DashboardRowsPayload;
}

/**
 * Alguns ambientes serializam arrays como objetos `{ "0": a, "1": b }` em vez de `[a,b]`.
 * Sem isto, `rows[0]` fica `undefined` e o painel `kpi_panel` nunca e lido.
 */
function coerceRowsToArray(rows: unknown): Record<string, unknown>[] {
  if (rows === null || rows === undefined) return [];
  if (Array.isArray(rows)) {
    return rows.filter((r) => r != null) as Record<string, unknown>[];
  }
  if (typeof rows !== "object") return [];
  const o = rows as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => /^\d+$/.test(k));
  if (keys.length === 0) return [];
  return keys.sort((a, b) => Number(a) - Number(b)).map((k) => o[k] as Record<string, unknown>);
}

function normalizeDashboardJsonBody(body: unknown, slug: string): DashboardRowsPayload {
  const raw = body as Record<string, unknown>;
  if (!raw || typeof raw !== "object") {
    throw new Error(`Resposta JSON invalida para "${slug}".`);
  }
  const nested = raw.data;
  const rowsSource =
    raw.rows !== undefined
      ? raw.rows
      : nested && typeof nested === "object" && nested !== null && "rows" in nested
        ? (nested as { rows: unknown }).rows
        : undefined;
  const rows = coerceRowsToArray(rowsSource);
  const base = raw as unknown as DashboardRowsPayload;
  return {
    ...base,
    rows,
    rowCount: Number.isFinite(Number(raw.rowCount)) ? Number(raw.rowCount) : rows.length
  };
}

/** Resposta JSON (sem Arrow) — útil para payloads aninhados como Metas por volume. */
export async function fetchDashboardJson(
  slug: string,
  options?: {
    limit?: number;
    period?: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;
    regional?: string;
    unidade?: string;
    indicador?: string;
    mes?: string;
    semana?: string;
    signal?: AbortSignal;
  }
): Promise<DashboardRowsPayload> {
  const queryParams = new URLSearchParams();
  if (options?.limit) queryParams.set("limit", String(options.limit));
  if (options?.period) queryParams.set("period", String(options.period));
  if (options?.regional) queryParams.set("regional", options.regional);
  if (options?.unidade) queryParams.set("unidade", options.unidade);
  if (options?.indicador) queryParams.set("indicador", options.indicador);
  if (options?.mes) queryParams.set("mes", options.mes);
  if (options?.semana) queryParams.set("semana", options.semana);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  const response = await fetch(buildApiUrl(`/api/v1/dashboard/${encodeURIComponent(slug)}${query}`), {
    signal: options?.signal,
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Falha ao consultar dashboard "${slug}" (${response.status})`);
  }
  const body: unknown = await response.json();
  return normalizeDashboardJsonBody(body, slug);
}

/**
 * Pede ao servidor o pre-calculo dos **outros** periodos gerenciais (mesmo regional/unidade),
 * em background, para a troca de pill reutilizar `computeContext` ja materializado.
 */
export function requestGerencialContextPrewarm(options: {
  activePeriod: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;
  regional: string;
  unidade: string;
}): void {
  const p = new URLSearchParams();
  p.set("activePeriod", String(options.activePeriod));
  if (options.regional && options.regional !== "ALL") p.set("regional", options.regional);
  if (options.unidade && options.unidade !== "ALL") p.set("unidade", options.unidade);
  void fetch(buildApiUrl(`/api/v1/dashboard/prewarm/gerencial-context?${p.toString()}`), { method: "POST" }).catch(() => {
    /* opcional; nao bloqueia a UI */
  });
}

export type PsHeatmapChegadasResponse = {
  ok: true;
  rows: Record<string, unknown>[];
  rowCount: number;
  sourceView: string;
  applied: { mes: string; unidade: string; regional: string | null };
};

export async function fetchPsHeatmapChegadas(options: {
  mes: string;
  unidade: string;
  regional?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<PsHeatmapChegadasResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set("mes", options.mes.trim());
  queryParams.set("unidade", options.unidade.trim());
  if (options.regional) queryParams.set("regional", options.regional);
  if (options.limit) queryParams.set("limit", String(options.limit));
  const response = await fetch(buildApiUrl(`/api/v1/ps-heatmap/chegadas?${queryParams.toString()}`), {
    signal: options.signal,
    headers: { Accept: "application/json" }
  });
  const body = (await response.json()) as { ok?: boolean; error?: string } & Partial<PsHeatmapChegadasResponse>;
  if (!response.ok || body.ok !== true) {
    throw new Error(typeof body.error === "string" ? body.error : `Falha HTTP ${response.status}`);
  }
  const rows = coerceRowsToArray(body.rows);
  const applied = body.applied ?? { mes: options.mes, unidade: options.unidade, regional: null };
  return {
    ok: true,
    rows,
    rowCount: Number.isFinite(Number(body.rowCount)) ? Number(body.rowCount) : rows.length,
    sourceView: String(body.sourceView ?? ""),
    applied
  };
}
