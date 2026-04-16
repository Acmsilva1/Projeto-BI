/**
 * Rotas v1 — núcleo: KPI, overview, raiz /api inválida, meta stack, health.
 */
import type { Express, Request, Response } from 'express';
import {
  getStaleCacheBackend,
  isRedisConnected,
} from '../../cache/redisMemoryCache.js';
import { getDataSourceKind } from '../../models/dataSource.js';
import liveService from '../../services/liveService.js';
import { asyncJsonRoute } from '../../views/apiResponse.js';

const route = asyncJsonRoute;

export function mountInvalidApiRoot(app: Express): void {
  app.get(['/api', '/api/'], (_req: Request, res: Response) => {
    res.status(404).json({
      ok: false,
      error: 'Rota inválida. Use prefixo /api/v1 (ex.: GET /api/v1/kpi).',
    });
  });
}

export function mountCoreV1Routes(app: Express): void {
  app.get('/api/v1/kpi', route(() => liveService.getKPIs()));
  app.get('/api/v1/kpi/unidades', route(() => liveService.getKpiUnidades()));
  app.get('/api/v1/overview/indicadores', route(() => liveService.getIndicadoresGerais()));
  app.get('/api/v1/overview/metas-volumes', route((req) => liveService.getOverviewMetasVolumes(req.query)));
}

export function mountStackMetaAndHealth(app: Express): void {
  app.get('/api/v1/_meta/stack', (_req: Request, res: Response) => {
    const src = getDataSourceKind();
    const cacheBackend = getStaleCacheBackend();
    res.json({
      ok: true,
      data: {
        polars: null,
        redis: isRedisConnected(),
        stale_cache_backend: cacheBackend,
        postgres_pool: Boolean(process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST),
        data_source: src,
        csv_direct: src === 'csv',
        live_service_engine: 'nodejs_typescript',
      },
    });
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      api: 'v1',
      description:
        'Express + TypeScript (MVC) — dados: PostgreSQL, SQLite réplica, ou CSV em dados/ (leitura no Node; React consome a API).',
    });
  });
}
