/**
 * useApi.js  — Hook centralizado de acesso à API
 * -------------------------------------------------
 * Faz fetch para o backend Node.js e retorna
 * { data, loading, error }. Usa AbortController
 * para cancelar chamadas quando o componente desmonta.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const BASE_URL = 'http://127.0.0.1:3001/api/v1';

// Normaliza filtros globais em query string
function buildQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) q.set(k, v);
  });
  return q.toString() ? `?${q.toString()}` : '';
}

// Cache simples em memória (chave = url)
const _cache = new Map();

export function useApi(endpoint, params = {}, { ttl = 30_000 } = {}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const abortRef              = useRef(null);

  const fetchData = useCallback(async () => {
    const url = `${BASE_URL}/${endpoint}${buildQuery(params)}`;

    // Cache hit
    const cached = _cache.get(url);
    if (cached && Date.now() - cached.ts < ttl) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    // Nova requisição
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const res  = await fetch(url, { signal: abortRef.current.signal });
      const json = await res.json();

      if (!json.ok) throw new Error(json.error || 'Erro na API');

      _cache.set(url, { data: json.data, ts: Date.now() });
      setData(json.data);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, JSON.stringify(params), ttl]); // eslint-disable-line

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
