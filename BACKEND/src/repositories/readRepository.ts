/**
 * Repositório de leitura — orquestra acesso a views/tabelas lógicas (único ponto para evoluir p/ SQL ficheiro / prepared).
 *
 * Fallback stale: se o BD falhar e DB_FALLBACK_READ_STALE=1, devolve último snapshot (Redis ou memória).
 * Após leitura OK: grava snapshot se DB_FALLBACK_WRITE_STALE=1 (alimenta Redis quando voltar).
 */
import {
  cacheGetStale,
  cacheSetStale,
  staleCacheKey,
} from '../cache/redisMemoryCache.js';
import { getDataSourceKind } from '../models/dataSource.js';
import { fetchView as dbFetchView } from '../models/db.js';
import type { FetchViewOptions } from '../models/db_sqlite.js';

function envFlag(name: string, defaultOn = true): boolean {
  const v = String(process.env[name] ?? '').trim().toLowerCase();
  if (v === '') return defaultOn;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** Leituras CSV em paralelo por lotes (streaming por ficheiro — pico de RAM ≈ conc × maior tabela filtrada). */
function gerenciaCsvParallelConcurrency(): number {
  const raw = String(process.env.GERENCIA_CSV_PARALLEL_FETCHES ?? '').trim();
  const n = raw === '' ? 3 : Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(10, Math.floor(n));
}

export class ReadRepository {
  async safeView(
    viewName: string,
    options: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>[]> {
    const key = staleCacheKey(viewName, options);
    try {
      const rows = await dbFetchView(viewName, {}, options as FetchViewOptions);
      if (envFlag('DB_FALLBACK_WRITE_STALE', true) && rows?.length) {
        try {
          await cacheSetStale(key, JSON.stringify(rows));
        } catch {
          /* ignore cache write */
        }
      }
      return rows;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ReadRepository] fetch ${viewName} failed: ${msg}`);
      if (envFlag('DB_FALLBACK_READ_STALE', true)) {
        try {
          const raw = await cacheGetStale(key);
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>[];
            if (Array.isArray(parsed)) {
              console.warn(`[ReadRepository] DB indisponível — stale cache (Redis/memória) para ${viewName}`);
              return parsed;
            }
          }
        } catch {
          /* ignore stale parse */
        }
      }
      return [];
    }
  }

  /**
   * Orquestração em paralelo (N reads).
   * CSV: lotes de `GERENCIA_CSV_PARALLEL_FETCHES` (omissão 3) — mais rápido que sequencial puro em 30/90 dias.
   * Postgres/SQLite: todos em paralelo.
   */
  async safeViewParallel(
    specs: Array<{ logical: string; options?: Record<string, unknown> }>,
  ): Promise<Record<string, unknown>[][]> {
    if (getDataSourceKind() === 'csv') {
      const conc = gerenciaCsvParallelConcurrency();
      const out: Record<string, unknown>[][] = [];
      if (conc <= 1) {
        for (const s of specs) {
          out.push(await this.safeView(s.logical, s.options ?? {}));
        }
        return out;
      }
      for (let i = 0; i < specs.length; i += conc) {
        const chunk = specs.slice(i, i + conc);
        const part = await Promise.all(chunk.map((s) => this.safeView(s.logical, s.options ?? {})));
        out.push(...part);
      }
      return out;
    }
    return Promise.all(specs.map((s) => this.safeView(s.logical, s.options ?? {})));
  }
}

export const readRepository = new ReadRepository();
