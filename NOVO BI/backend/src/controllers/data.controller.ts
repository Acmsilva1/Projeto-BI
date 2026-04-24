import type { Request, Response } from "express";
import { getViewRowsPayload, getViewsPayload } from "../services/data.service.js";
import { ARROW_STREAM_CONTENT_TYPE, serializeRowsToArrow, wantsArrowResponse } from "../utils/arrow.js";

function readLimit(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "100", 10);
  if (!Number.isFinite(parsed)) {
    return 100;
  }
  return parsed;
}

export async function dataViewsController(_: Request, response: Response): Promise<void> {
  const payload = await getViewsPayload();
  response.status(200).json(payload);
}

export async function dataViewRowsController(request: Request, response: Response): Promise<void> {
  try {
    const viewParam = request.params.viewName as string | string[] | undefined;
    const viewName = Array.isArray(viewParam) ? viewParam[0] : viewParam;
    if (!viewName) {
      response.status(400).json({ ok: false, error: "Parâmetro viewName é obrigatório." });
      return;
    }
    const limit = readLimit(request.query.limit as string | string[] | undefined);
    const payload = await getViewRowsPayload(viewName, limit);

    const formatParamRaw = request.query.format as string | string[] | undefined;
    const formatParam = Array.isArray(formatParamRaw) ? formatParamRaw[0] : formatParamRaw;

    if (wantsArrowResponse(request.headers.accept, formatParam)) {
      const arrow = serializeRowsToArrow(payload.rows);
      response.setHeader("Content-Type", ARROW_STREAM_CONTENT_TYPE);
      response.setHeader("X-Row-Count", String(payload.count));
      response.setHeader("X-View", payload.view);
      response.status(200).send(Buffer.from(arrow));
      return;
    }

    response.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar dados.";
    response.status(400).json({ ok: false, error: message });
  }
}
