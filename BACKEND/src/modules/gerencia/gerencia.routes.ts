/**
 * Rotas v1 — Gerência (dashboard, metas, totais PS).
 */
import type { Express } from 'express';
import liveService from '../../services/liveService.js';
import { asyncJsonRoute } from '../../views/apiResponse.js';

const route = asyncJsonRoute;

export function mountGerenciaV1Routes(app: Express): void {
  app.get('/api/v1/gerencia/unidades-ps', route((req) => liveService.getGerenciaUnidadesPs(req.query)));
  app.get('/api/v1/gerencia/metas-por-volumes', route((req) => liveService.getGerenciaMetasPorVolumes(req.query)));
  app.get('/api/v1/gerencia/metricas-por-unidade', route((req) => liveService.getGerenciaMetricasPorUnidade(req.query)));
  app.get('/api/v1/gerencia/totais-ps', route((req) => liveService.getGerenciaTotaisPs(req.query)));
  app.get('/api/v1/gerencia/tempo-medio-etapas', route((req) => liveService.getGerenciaTempoMedioEtapas(req.query)));
  app.get(
    '/api/v1/gerencia/metas-acompanhamento-gestao',
    route((req) => liveService.getGerenciaMetasAcompanhamentoGestao(req.query)),
  );
  app.get(
    '/api/v1/gerencia/metas-conformes-por-unidade',
    route((req) => liveService.getGerenciaMetasConformesPorUnidade(req.query)),
  );
  app.get(
    '/api/v1/gerencia/metas-por-volumes/indicador/:indicadorKey/unidades',
    route((req) => liveService.getGerenciaMetasPorVolumesPorIndicador(req.params.indicadorKey, req.query)),
  );
  app.get('/api/v1/gerencia/dashboard-bundle', route((req) => liveService.getGerenciaDashboardBundle(req.query)));
}
