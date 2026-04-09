/**
 * Base da API v1 — mesma regra que useApi (proxy em dev, VITE_API_BASE em prod).
 */
export function getApiV1Base() {
  const fromEnv = import.meta.env.VITE_API_BASE;
  if (fromEnv != null && String(fromEnv).trim() !== '') {
    return `${String(fromEnv).replace(/\/$/, '')}/api/v1`;
  }
  if (import.meta.env.DEV) {
    return '/api/v1';
  }
  return 'http://127.0.0.1:3001/api/v1';
}

export function buildApiQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) q.set(k, String(v));
  });
  return q.toString() ? `?${q.toString()}` : '';
}
