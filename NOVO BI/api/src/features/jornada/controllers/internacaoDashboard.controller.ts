import type { Request, Response } from "express";
import {
  getInternacaoFiltrosPayload,
  getInternacaoMetasPayload,
  getInternacaoTopoPayload,
  getInternacaoVariadosPayload
} from "../services/internacaoDashboard.service.js";

function readLimit(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "200", 10);
  if (!Number.isFinite(parsed)) return 200;
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

function readCommonOptions(request: Request): {
  limit: number;
  periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;
  regional?: string;
  unidade?: string;
} {
  return {
    limit: readLimit(request.query.limit as string | string[] | undefined),
    periodDays: readPeriod(request.query.period as string | string[] | undefined),
    regional: readText(request.query.regional as string | string[] | undefined),
    unidade: readText(request.query.unidade as string | string[] | undefined)
  };
}

export async function internacaoFiltrosController(request: Request, response: Response): Promise<void> {
  try {
    const payload = await getInternacaoFiltrosPayload(readCommonOptions(request));
    response.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar internacao.";
    response.status(400).json({ ok: false, error: message });
  }
}

export async function internacaoTopoController(request: Request, response: Response): Promise<void> {
  try {
    const payload = await getInternacaoTopoPayload(readCommonOptions(request));
    response.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar internacao.";
    response.status(400).json({ ok: false, error: message });
  }
}

export async function internacaoMetasController(request: Request, response: Response): Promise<void> {
  try {
    const payload = await getInternacaoMetasPayload(readCommonOptions(request));
    response.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar internacao.";
    response.status(400).json({ ok: false, error: message });
  }
}

export async function internacaoVariadosController(request: Request, response: Response): Promise<void> {
  try {
    const payload = await getInternacaoVariadosPayload(readCommonOptions(request));
    response.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar internacao.";
    response.status(400).json({ ok: false, error: message });
  }
}

