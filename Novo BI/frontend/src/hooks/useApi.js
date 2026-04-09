/**
 * useApi.js  — Hook centralizado de acesso à API
 * -------------------------------------------------
 * Faz fetch para o backend Node.js e retorna
 * { data, loading, error }. Usa AbortController
 * para cancelar chamadas quando o componente desmonta.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiV1Base, buildApiQuery } from '../utils/apiBase';

// Cache simples em memória (chave = url)
const _cache = new Map();

export function useApi(endpoint, params = {}, { ttl = 30_000 } = {}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const abortRef              = useRef(null);

  const fetchData = useCallback(async () => {
    const base = getApiV1Base().replace(/\/+$/, '');
    const path = String(endpoint || '').replace(/^\/+/, '');
    const url = `${base}/${path}${buildApiQuery(params)}`;

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
      const res = await fetch(url, { signal: abortRef.current.signal });
      const raw = await res.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        const hint =
          raw.trimStart().startsWith('<!DOCTYPE') || raw.trimStart().startsWith('<html')
            ? 'Recebeu página HTML em vez da API (proxy/backend). Em dev use npm run dev no front e deixe o Node na 3001, ou defina VITE_API_BASE.'
            : 'Resposta não é JSON.';
        throw new Error(
          `${hint} (${res.status}) ${raw.slice(0, 120).replace(/\s+/g, ' ')}`,
        );
      }

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
