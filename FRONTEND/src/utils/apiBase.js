/**
 * Base da API v1.
 * - Dev (sem .env): `/api/v1` → proxy do Vite → API Node em BACKEND/ (HOSPITAL_BI_API_PORT, ex. 3020)
 * - VITE_API_BASE: origem ou prefixo (sem duplicar /api/v1)
 *   Ex.: http://127.0.0.1:3020 | /api | http://host:3000/api/v1
 */
export function getApiV1Base() {
  const raw = import.meta.env.VITE_API_BASE;
  if (raw == null || String(raw).trim() === '') {
    // Dev: proxy Vite; prod: mesma origem (Express serve o `dist` + API).
    return '/api/v1';
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
