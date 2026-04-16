/**
 * Rotas v1 — Financeiro.
 */
import type { Express } from 'express';
import express from 'express';
import liveService from '../../services/liveService.js';
import { asyncJsonRoute } from '../../views/apiResponse.js';

const route = asyncJsonRoute;

export function mountFinanceiroV1Routes(app: Express): void {
  const finRouter = express.Router();
  finRouter.get('/resumo', route(() => liveService.getFinanceiroResumo()));
  finRouter.get('/convenio', route(() => liveService.getFinanceiroConvenio()));
  finRouter.get('/glosas', route(() => liveService.getFinanceiroGlosas()));
  app.use('/api/v1/financeiro', finRouter);
}
