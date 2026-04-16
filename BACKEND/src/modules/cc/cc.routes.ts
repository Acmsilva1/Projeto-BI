/**
 * Rotas v1 — Centro cirúrgico / CC.
 */
import type { Express } from 'express';
import express from 'express';
import liveService from '../../services/liveService.js';
import { asyncJsonRoute } from '../../views/apiResponse.js';

const route = asyncJsonRoute;

export function mountCcV1Routes(app: Express): void {
  const ccRouter = express.Router();
  ccRouter.get('/performance', route(() => liveService.getCCPerformance()));
  ccRouter.get('/kpis', route(() => liveService.getCCKpis()));
  ccRouter.get('/timeline', route(() => liveService.getCCPerformanceTimeline()));
  app.use('/api/v1/cc', ccRouter);
}
