import type { Request, Response } from "express";
import { getHealthPayload, getPingPayload } from "../services/core.service.js";

export async function healthController(_: Request, response: Response): Promise<void> {
  const payload = await getHealthPayload();
  response.status(200).json(payload);
}

export function pingController(_: Request, response: Response): void {
  response.status(200).json(getPingPayload());
}
