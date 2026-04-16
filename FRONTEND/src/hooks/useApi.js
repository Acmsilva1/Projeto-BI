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

export function useApi(endpoint, params = {}, { ttl = 30_000, timeoutMs = 240_000, enabled = true } = {}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(() => Boolean(enabled));
  const [error, setError]     = useState(null);
  const abortRef              = useRef(null);
  const abortMetaRef          = useRef(null);
  const seqRef                = useRef(0);
  const mountedRef            = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    const base = getApiV1Base().replace(/\/+$/, '');
    const path = String(endpoint || '').replace(/^\/+/, '');
    const url = `${base}/${path}${buildApiQuery(params)}`;

    // Cache hit
    const cached = _cache.get(url);
    if (cached && Date.now() - cached.ts < ttl) {
      if (!mountedRef.current) return;
      setData(cached.data);
      setLoading(false);
      return;
    }

    // Nova requisição
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const ac = abortRef.current;
    const meta = { reason: null };
    abortMetaRef.current = meta;
    const mySeq = ++seqRef.current;

    setLoading(true);
    setError(null);

    const tid =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? setTimeout(() => {
            meta.reason = 'timeout';
            ac.abort();
          }, timeoutMs)
        : null;

    try {
      const res = await fetch(url, { signal: ac.signal });
      const raw = await res.text();
      let json;
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        const hint =
          raw.trimStart().startsWith('<!DOCTYPE') || raw.trimStart().startsWith('<html')
            ? 'Recebeu página HTML em vez da API (proxy/backend). Em dev use npm run dev no front e deixe o Node na mesma porta do proxy (ex.: 3020), ou defina VITE_API_BASE.'
            : 'Resposta não é JSON.';
        throw new Error(
          `${hint} (${res.status}) ${raw.slice(0, 120).replace(/\s+/g, ' ')}`,
        );
      }

      if (!json.ok) throw new Error(json.error || 'Erro na API');

      if (mySeq !== seqRef.current) return;

      // Gravar cache antes do mountedRef: no React Strict Mode a resposta pode chegar no “meio” do remount.
      _cache.set(url, { data: json.data, ts: Date.now() });
      if (!mountedRef.current) return;
      setData(json.data);
    } catch (err) {
      if (mySeq !== seqRef.current || !mountedRef.current) return;
      if (err.name === 'AbortError') {
        if (meta.reason === 'timeout') {
          const min = Math.max(1, Math.round(timeoutMs / 60_000));
          setError(
            `Tempo limite (${min} min) ao buscar dados. A API ou o Postgres pode estar lento; confira o terminal da API e a aba Rede do browser.`,
          );
        }
        return;
      }
      setError(err.message);
    } finally {
      if (tid) clearTimeout(tid);
      if (mySeq === seqRef.current && mountedRef.current) setLoading(false);
    }
  }, [endpoint, JSON.stringify(params), ttl, timeoutMs, enabled]); // eslint-disable-line

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setLoading(false);
      setError(null);
      return () => {
        mountedRef.current = false;
        if (abortMetaRef.current) abortMetaRef.current.reason = 'unmount';
        abortRef.current?.abort();
      };
    }
    fetchData();
    return () => {
      mountedRef.current = false;
      if (abortMetaRef.current) abortMetaRef.current.reason = 'unmount';
      abortRef.current?.abort();
    };
  }, [fetchData, enabled]);

  return { data, loading, error, refetch: fetchData };
}
