import type { Request, Response } from "express";
import { getPsChegadasHeatmapPayload } from "../services/dashboard.service.js";
import { ARROW_STREAM_CONTENT_TYPE, serializeRowsToArrow, wantsArrowResponse } from "../../../shared/utils/arrow.js";

function readLimit(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "2500", 10);
  if (!Number.isFinite(parsed)) return 2500;
  return parsed;
}

function readText(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return undefined;
  const normalized = rawValue.trim();
  if (!normalized || normalized.toUpperCase() === "ALL") return undefined;
  return normalized;
}

export async function psHeatmapChegadasController(request: Request, response: Response): Promise<void> {
  try {
    const mes = readText(request.query.mes as string | string[] | undefined);
    const unidade = readText(request.query.unidade as string | string[] | undefined);
    if (!mes || !unidade) {
      response.status(400).json({
        ok: false,
        error: "Informe mes (YYYY-MM) e unidade. O mapa de calor nao e consultado sem esses filtros."
      });
      return;
    }

    const regional = readText(request.query.regional as string | string[] | undefined);
    const limit = readLimit(request.query.limit as string | string[] | undefined);
    const payload = await getPsChegadasHeatmapPayload({ mes, unidade, regional, limit });

    const formatParamRaw = request.query.format as string | string[] | undefined;
    const formatParam = Array.isArray(formatParamRaw) ? formatParamRaw[0] : formatParamRaw;

    if (wantsArrowResponse(request.headers.accept, formatParam)) {
      const arrow = serializeRowsToArrow(payload.rows);
      response.setHeader("Content-Type", ARROW_STREAM_CONTENT_TYPE);
      response.setHeader("X-Row-Count", String(payload.rowCount));
      response.setHeader("X-Source-View", payload.sourceView);
      response.setHeader("X-Mes", payload.applied.mes);
      response.setHeader("X-Unidade", payload.applied.unidade);
      response.setHeader("X-Regional", payload.applied.regional ?? "");
      response.status(200).send(Buffer.from(arrow));
      return;
    }

    response.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar mapa de calor.";
    response.status(400).json({ ok: false, error: message });
  }
}
