/**
 * Rotas v1 — Pronto-socorro (stubs / agregados leves).
 */
import type { Express } from 'express';
import express from 'express';
import liveService from '../../services/liveService.js';
import { asyncJsonRoute } from '../../views/apiResponse.js';

const route = asyncJsonRoute;

export function mountPsV1Routes(app: Express): void {
  const psRouter = express.Router();
  psRouter.get('/volumes', route(() => liveService.getPSVolumes()));
  psRouter.get('/kpis', route(() => liveService.getPSKpis()));
  psRouter.get('/slas', route(() => liveService.getPSSlas()));
  psRouter.get('/matrix', route(() => liveService.getPSMatrix()));
  psRouter.get('/history', route(() => liveService.getPSHistory()));
  psRouter.get('/perfil', route(() => liveService.getPSPerfil()));
  psRouter.get('/fluxos', route(() => liveService.getPSFluxos()));
  psRouter.get('/medicacao', route(() => liveService.getPSMedicacao()));
  psRouter.get('/conversao', route(() => liveService.getPSConversao()));
  app.use('/api/v1/ps', psRouter);
}
