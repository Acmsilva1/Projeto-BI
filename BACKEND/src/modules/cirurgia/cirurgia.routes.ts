/**
 * Rotas v1 — Cirurgia.
 */
import type { Express } from 'express';
import express from 'express';
import liveService from '../../services/liveService.js';
import { asyncJsonRoute } from '../../views/apiResponse.js';

const route = asyncJsonRoute;

export function mountCirurgiaV1Routes(app: Express): void {
  const cirurgiaRouter = express.Router();
  cirurgiaRouter.get('/especialidade', route(() => liveService.getCirurgiaEspecialidade()));
  cirurgiaRouter.get('/evolucao', route(() => liveService.getCirurgiaEvolucao()));
  cirurgiaRouter.get('/tempo-centro', route(() => liveService.getCirurgiaTempoCentro()));
  app.use('/api/v1/cirurgia', cirurgiaRouter);
}
