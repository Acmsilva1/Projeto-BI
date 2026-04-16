/**
 * Cache stale (Redis ou memória local).
 * - Redis offline / erro → opera em Map em memória no mesmo processo.
 * - Escrita de “stale” após leituras OK ao BD; leitura em fallback quando o BD falha (ver ReadRepository).
 */
import { createClient } from 'redis';
import crypto from 'node:crypto';

const memory = new Map<string, { value: string; exp: number }>();

function envBool(name: string, defaultTrue = true): boolean {
  const v = String(process.env[name] ?? '').trim().toLowerCase();
  if (v === '' || v === 'default') return defaultTrue;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function ttlSec(): number {
  const n = Number(process.env.DB_FALLBACK_STALE_TTL_SEC || 86400);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 7 * 24 * 3600) : 86400;
}

type RedisCli = ReturnType<typeof createClient>;
let redisClient: RedisCli | null = null;
let activeBackend: 'redis' | 'memory' = 'memory';
let initDone = false;

function memGet(key: string): string | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

function memSet(key: string, value: string, ttl: number): void {
  memory.set(key, { value, exp: Date.now() + ttl * 1000 });
}

export function getStaleCacheBackend(): 'redis' | 'memory' {
  return activeBackend;
}

export function isRedisConnected(): boolean {
  return Boolean(redisClient?.isOpen);
}

export async function initStaleCache(): Promise<void> {
  if (initDone) return;
  try {
    if (envBool('CACHE_FORCE_MEMORY', false)) {
      activeBackend = 'memory';
      console.log('[cache] CACHE_FORCE_MEMORY=1 — só memória local.');
      return;
    }

    const url = String(process.env.REDIS_URL || '').trim();
    if (!url) {
      activeBackend = 'memory';
      console.log('[cache] REDIS_URL vazio — cache stale só em memória local.');
      return;
    }

    const timeoutMs = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 4000);
    const useMemoryOnFail = envBool('REDIS_OFFLINE_USE_MEMORY', true);

    try {
      const c = createClient({
        url,
        socket: { connectTimeout: timeoutMs },
      });
      c.on('error', (err) => {
        console.warn('[cache] Redis erro de cliente:', err.message);
      });
      await c.connect();
      await c.ping();
      redisClient = c;
      activeBackend = 'redis';
      console.log('[cache] Redis ligado (stale fallback disponível).');
    } catch (e) {
      redisClient = null;
      activeBackend = 'memory';
      const msg = e instanceof Error ? e.message : String(e);
      if (useMemoryOnFail) {
        console.warn('[cache] Redis indisponível — a usar memória local:', msg);
      } else {
        console.warn('[cache] Redis indisponível e REDIS_OFFLINE_USE_MEMORY desativado:', msg);
      }
    }
  } finally {
    initDone = true;
  }
}

function stableOptionsJson(options: Record<string, unknown>): string {
  const norm: Record<string, unknown> = { ...options };
  const df = norm.dateFrom;
  if (df instanceof Date) norm.dateFrom = df.toISOString();
  const keys = Object.keys(norm).sort();
  return JSON.stringify(keys.map((k) => [k, norm[k]]));
}

export function staleCacheKey(viewName: string, options: Record<string, unknown>): string {
  const h = crypto.createHash('sha256').update(stableOptionsJson(options)).digest('hex').slice(0, 24);
  return `hospital-bi:stale:${viewName}:${h}`;
}

async function redisGet(key: string): Promise<string | null> {
  if (!redisClient?.isOpen) return null;
  try {
    return await redisClient.get(key);
  } catch {
    activeBackend = 'memory';
    return null;
  }
}

async function redisSet(key: string, value: string, ttl: number): Promise<void> {
  if (!redisClient?.isOpen) return;
  try {
    await redisClient.set(key, value, { EX: ttl });
  } catch {
    activeBackend = 'memory';
  }
}

export async function cacheGetStale(key: string): Promise<string | null> {
  if (redisClient?.isOpen) {
    const v = await redisGet(key);
    if (v != null) return v;
  }
  return memGet(key);
}

export async function cacheSetStale(key: string, value: string): Promise<void> {
  const ttl = ttlSec();
  if (activeBackend === 'redis' && redisClient?.isOpen) {
    await redisSet(key, value, ttl);
  }
  memSet(key, value, ttl);
}
