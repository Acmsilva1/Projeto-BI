import type { Request, Response } from "express";
import { getPsMedicacaoPayload } from "../services/dashboard.service.js";

function readText(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return undefined;
  const normalized = rawValue.trim();
  if (!normalized || normalized.toUpperCase() === "ALL") return undefined;
  return normalized;
}

export async function psMedicacaoController(request: Request, response: Response): Promise<void> {
  try {
    const periodDays = Number.parseInt((request.query.period as string) || "1", 10) as any;
    const regional = readText(request.query.regional as string | string[] | undefined);
    const unidade = readText(request.query.unidade as string | string[] | undefined);

    const data = await getPsMedicacaoPayload({ periodDays, regional, unidade });

    response.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar dashboard de medicação.";
    response.status(400).json({ ok: false, error: message });
  }
}
