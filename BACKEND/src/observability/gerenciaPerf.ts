type CounterKey =
  | 'bundle_redis_hit'
  | 'bundle_redis_miss'
  | 'bundle_inflight_dedup_hit'
  | 'bundle_build_ok'
  | 'bundle_build_err'
  | 'aperitivo_cache_hit'
  | 'aperitivo_scope_slice_hit'
  | 'aperitivo_demo_fallback';

const counters: Record<CounterKey, number> = {
  bundle_redis_hit: 0,
  bundle_redis_miss: 0,
  bundle_inflight_dedup_hit: 0,
  bundle_build_ok: 0,
  bundle_build_err: 0,
  aperitivo_cache_hit: 0,
  aperitivo_scope_slice_hit: 0,
  aperitivo_demo_fallback: 0,
};

let lastBundleBuildMs: number | null = null;
let lastBundleSource: string | null = null;

export function incGerenciaPerf(key: CounterKey): void {
  counters[key] += 1;
}

export function markGerenciaBundleBuild(ms: number, source: string): void {
  if (Number.isFinite(ms) && ms >= 0) lastBundleBuildMs = Math.round(ms);
  lastBundleSource = String(source || '').trim() || null;
}

export function getGerenciaPerfSnapshot() {
  return {
    counters: { ...counters },
    last_bundle_build_ms: lastBundleBuildMs,
    last_bundle_source: lastBundleSource,
  };
}

