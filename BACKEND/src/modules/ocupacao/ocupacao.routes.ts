/**
 * Rotas v1 — Ocupação / internação.
 */
import type { Express } from 'express';
import express from 'express';
import liveService from '../../services/liveService.js';
import { asyncJsonRoute } from '../../views/apiResponse.js';

const route = asyncJsonRoute;

export function mountOcupacaoV1Routes(app: Express): void {
  const ocupRouter = express.Router();
  ocupRouter.get('/setor', route(() => liveService.getOcupacaoSetor()));
  ocupRouter.get('/kpis', route(() => liveService.getInternacaoKPIs()));
  ocupRouter.get('/resumo', route(() => liveService.getInternacaoResumo()));
  ocupRouter.get('/internacoes', route(() => liveService.getInternacoes()));
  ocupRouter.get('/tendencia', route(() => liveService.getOcupacaoTendencia()));
  ocupRouter.get('/qualidade', route(() => liveService.getOcupacaoQualidade()));
  app.use('/api/v1/ocupacao', ocupRouter);
}
