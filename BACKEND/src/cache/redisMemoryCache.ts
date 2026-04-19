/**
 * Cache stale (somente Redis em modo estrito).
 * - Sem fallback para memória local no processo Node.
 * - Se Redis estiver indisponível, cache stale fica desligado.
 */
import { createClient } from 'redis';
import crypto from 'node:crypto';

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
let activeBackend: 'redis' | 'none' = 'none';
let initDone = false;

export function getStaleCacheBackend(): 'redis' | 'none' {
  return activeBackend;
}

export function isRedisConnected(): boolean {
  return Boolean(redisClient?.isOpen);
}

export async function initStaleCache(): Promise<void> {
  if (initDone) return;
  try {
    if (envBool('CACHE_FORCE_MEMORY', false)) {
      activeBackend = 'none';
      console.log('[cache] CACHE_FORCE_MEMORY=1 — memória local desativada em modo estrito; cache stale desligado.');
      return;
    }

    const url = String(process.env.REDIS_URL || '').trim();
    if (!url) {
      activeBackend = 'none';
      console.log('[cache] REDIS_URL vazio — cache stale desligado (sem memória local).');
      return;
    }

    const timeoutMs = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 4000);

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
      console.log('[cache] Redis ligado (stale cache exclusivo).');
    } catch (e) {
      redisClient = null;
      activeBackend = 'none';
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[cache] Redis indisponível — cache stale desligado:', msg);
    }
  } finally {
    initDone = true;
  }
}

function stableOptionsJson(options: Record<string, unknown>): string {
  const norm: Record<string, unknown> = { ...options };
  for (const k of Object.keys(norm)) {
    const v = norm[k];
    if (v instanceof Date) norm[k] = v.toISOString();
  }
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
    activeBackend = 'none';
    return null;
  }
}

async function redisSet(key: string, value: string, ttl: number): Promise<void> {
  if (!redisClient?.isOpen) return;
  try {
    await redisClient.set(key, value, { EX: ttl });
  } catch {
    activeBackend = 'none';
  }
}

export async function cacheGetStale(key: string): Promise<string | null> {
  if (!redisClient?.isOpen) return null;
  return redisGet(key);
}

export async function cacheSetStale(key: string, value: string): Promise<void> {
  const ttl = ttlSec();
  if (activeBackend === 'redis' && redisClient?.isOpen) await redisSet(key, value, ttl);
}

