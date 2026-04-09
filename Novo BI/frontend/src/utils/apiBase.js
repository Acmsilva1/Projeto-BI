/**
 * Base da API v1.
 * - Dev (sem .env): `/api/v1` → proxy do Vite → Node :3001
 * - VITE_API_BASE: origem ou prefixo (sem duplicar /api/v1)
 *   Ex.: http://127.0.0.1:3001 | /api | http://host:3001/api/v1
 */
export function getApiV1Base() {
  const raw = import.meta.env.VITE_API_BASE;
  if (raw == null || String(raw).trim() === '') {
    if (import.meta.env.DEV) return '/api/v1';
    return 'http://127.0.0.1:3001/api/v1';
  }

  let base = String(raw).trim().replace(/\/+$/, '');
  if (/\/api\/v1$/i.test(base)) return base;
  if (/\/api$/i.test(base)) return `${base}/v1`;
  return `${base}/api/v1`;
}

export function buildApiQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) q.set(k, String(v));
  });
  return q.toString() ? `?${q.toString()}` : '';
}
