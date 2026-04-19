/**
 * Rotas v1: nucleo, meta stack e health.
 */
import type { Express, Request, Response } from 'express';
import { getStaleCacheBackend, isRedisConnected } from '../../cache/redisMemoryCache.js';
import { gerenciaAnchorEndD1Enabled } from '../../domain/shared/period.js';
import { getDataSourceKind } from '../../models/dataSource.js';
import { getGerenciaPerfSnapshot } from '../../observability/gerenciaPerf.js';
import { getGerenciaMaxPeriodDays, getGerenciaWarmStatus } from '../../repositories/gerenciaRepository.js';
import liveService from '../../services/liveService.js';
import { asyncJsonRoute } from '../../views/apiResponse.js';

const route = asyncJsonRoute;

export function mountInvalidApiRoot(app: Express): void {
  app.get(['/api', '/api/'], (_req: Request, res: Response) => {
    res.status(404).json({
      ok: false,
      error: 'Rota invalida. Use prefixo /api/v1 (ex.: GET /api/v1/kpi).',
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
    const warmDelay = Number(process.env.GERENCIA_WARM_SECOND_WAVE_DELAY_MS ?? '600000');
    res.json({
      ok: true,
      data: {
        polars: null,
        redis: isRedisConnected(),
        stale_cache_backend: cacheBackend,
        postgres_pool: Boolean(process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST),
        data_source: src,
        csv_direct: src === 'csv',
        duckdb_local: src === 'duckdb',
        gerencia_max_period_days: getGerenciaMaxPeriodDays(),
        gerencia_anchor_end_d1: gerenciaAnchorEndD1Enabled(),
        gerencia_warm_second_wave_delay_ms: Number.isFinite(warmDelay) ? warmDelay : 600_000,
        gerencia_warm_status: getGerenciaWarmStatus(),
        gerencia_perf: getGerenciaPerfSnapshot(),
        live_service_engine: 'nodejs_typescript',
      },
    });
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      api: 'v1',
      description:
        'Express + TypeScript (MVC) - dados: PostgreSQL, DuckDB, SQLite replica, ou CSV em dados/ (React consome a API).',
    });
  });
}
