import type { Request, Response } from "express";
import {
  getDashboardCatalogPayload,
  getDashboardQueryPayload,
  scheduleGerencialContextPrewarm
} from "../services/dashboard.service.js";
import { ARROW_STREAM_CONTENT_TYPE, serializeRowsToArrow, wantsArrowResponse } from "../../../shared/utils/arrow.js";

function readLimit(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "200", 10);
  if (!Number.isFinite(parsed)) {
    return 200;
  }
  return parsed;
}

function readPeriod(value: string | string[] | undefined): 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365 {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);
  if (parsed === 1) return 1;
  if (parsed === 7) return 7;
  if (parsed === 15) return 15;
  if (parsed === 30) return 30;
  if (parsed === 60) return 60;
  if (parsed === 90) return 90;
  if (parsed === 180) return 180;
  if (parsed === 365) return 365;
  return 1;
}

function readText(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return undefined;
  const normalized = rawValue.trim();
  if (!normalized || normalized.toUpperCase() === "ALL") return undefined;
  return normalized;
}

export async function dashboardCatalogController(_: Request, response: Response): Promise<void> {
  const payload = await getDashboardCatalogPayload();
  response.status(200).json(payload);
}

/** Pre-calcula contextos CSV-memory dos outros periodos (mesmo regional/unidade) em background. */
export function gerencialContextPrewarmController(request: Request, response: Response): void {
  const activeRaw = request.query.activePeriod as string | string[] | undefined;
  const first = Array.isArray(activeRaw) ? activeRaw[0] : activeRaw;
  const parsed = Number.parseInt(first ?? "1", 10);
  const activePeriodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365 =
    parsed === 1
      ? 1
      : parsed === 7
        ? 7
        : parsed === 15
          ? 15
          : parsed === 30
            ? 30
            : parsed === 60
              ? 60
              : parsed === 90
                ? 90
                : parsed === 180
                  ? 180
                  : parsed === 365
                    ? 365
                    : 1;
  const regional = readText(request.query.regional as string | string[] | undefined);
  const unidade = readText(request.query.unidade as string | string[] | undefined);
  scheduleGerencialContextPrewarm({ activePeriodDays, regional, unidade });
  response.status(202).json({ ok: true, scheduled: true, activePeriodDays });
}

export async function dashboardQueryController(request: Request, response: Response): Promise<void> {
  try {
    const slugParam = request.params.slug as string | string[] | undefined;
    const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

    if (!slug) {
      response.status(400).json({ ok: false, error: "Parâmetro slug é obrigatório." });
      return;
    }

    const limit = readLimit(request.query.limit as string | string[] | undefined);
    const periodDays = readPeriod(request.query.period as string | string[] | undefined);
    const regional = readText(request.query.regional as string | string[] | undefined);
    const unidade = readText(request.query.unidade as string | string[] | undefined);
    const indicadorRaw = request.query.indicador as string | string[] | undefined;
    const indicadorKey = Array.isArray(indicadorRaw) ? indicadorRaw[0] : indicadorRaw;
    const mesRaw = request.query.mes as string | string[] | undefined;
    const semanaRaw = request.query.semana as string | string[] | undefined;
    const mes = Array.isArray(mesRaw) ? mesRaw[0] : mesRaw;
    const semana = Array.isArray(semanaRaw) ? semanaRaw[0] : semanaRaw;
    const payload = await getDashboardQueryPayload(slug, {
      limit,
      periodDays,
      regional,
      unidade,
      indicadorKey: typeof indicadorKey === "string" ? indicadorKey : undefined,
      mes: typeof mes === "string" ? mes : undefined,
      semana: typeof semana === "string" ? semana : undefined
    });

    const formatParamRaw = request.query.format as string | string[] | undefined;
    const formatParam = Array.isArray(formatParamRaw) ? formatParamRaw[0] : formatParamRaw;

    if (wantsArrowResponse(request.headers.accept, formatParam)) {
      let arrow: Uint8Array;
      try {
        arrow = serializeRowsToArrow(payload.rows);
      } catch (serializationError) {
        const detail =
          serializationError instanceof Error ? serializationError.message : "falha ao serializar Arrow";
        throw new Error(`Serializacao Arrow falhou (${slug}): ${detail}`);
      }
      response.setHeader("Content-Type", ARROW_STREAM_CONTENT_TYPE);
      response.setHeader("X-Row-Count", String(payload.rowCount));
      response.setHeader("X-Slug", payload.slug);
      response.setHeader("X-Source-View", payload.sourceView);
      response.setHeader("X-Period-Days", String(payload.appliedFilters.periodDays));
      response.setHeader("X-Regional", payload.appliedFilters.regional ?? "");
      response.setHeader("X-Unidade", payload.appliedFilters.unidade ?? "");
      response.status(200).send(Buffer.from(arrow));
      return;
    }

    response.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar dashboard.";
    response.status(400).json({ ok: false, error: message });
  }
}
