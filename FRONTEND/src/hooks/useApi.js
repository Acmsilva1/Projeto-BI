/**
 * useApi.js — Hook centralizado de acesso à API (modo estrito sem cache local).
 * - Sem cache em memória no React.
 * - Sem localStorage.
 * - Somente fetch + abort + estado de loading/erro.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getApiV1Base, buildApiQuery } from '../utils/apiBase';
import { emitGerenciaUx, GerenciaUxEvents } from '../messaging/gerenciaUxBus.js';

export function useApi(
  endpoint,
  params = {},
  {
    timeoutMs = 240_000,
    enabled = true,
    uxGerencia = false,
  } = {},
) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(enabled));
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [lastSyncSource, setLastSyncSource] = useState(null);
  const [lastRequestMs, setLastRequestMs] = useState(null);
  const abortRef = useRef(null);
  const abortMetaRef = useRef(null);
  const seqRef = useRef(0);
  const mountedRef = useRef(true);

  const pathNorm = String(endpoint || '').replace(/^\/+/, '');
  const url = useMemo(() => {
    const base = getApiV1Base().replace(/\/+$/, '');
    return `${base}/${pathNorm}${buildApiQuery(params)}`;
  }, [endpoint, pathNorm, JSON.stringify(params)]);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    abortRef.current?.abort();
    const mySeq = ++seqRef.current;
    abortRef.current = new AbortController();
    const ac = abortRef.current;
    const meta = { reason: null };
    abortMetaRef.current = meta;

    if (uxGerencia) {
      emitGerenciaUx(GerenciaUxEvents.RequestStart, { url, params: { ...params } });
    }

    setIsSyncing(true);
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
      const t0 = performance.now();
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
        throw new Error(`${hint} (${res.status}) ${raw.slice(0, 120).replace(/\s+/g, ' ')}`);
      }

      if (!json.ok) throw new Error(json.error || 'Erro na API');
      if (mySeq !== seqRef.current || !mountedRef.current) return;

      setData(json.data);
      setLastSyncAt(Date.now());
      setLastSyncSource('network');
      setLastRequestMs(Math.max(0, Math.round(performance.now() - t0)));
      if (uxGerencia) emitGerenciaUx(GerenciaUxEvents.RequestSettled, { url, params: { ...params } });
    } catch (err) {
      if (err.name === 'AbortError' && uxGerencia) {
        const superseded = mySeq !== seqRef.current;
        emitGerenciaUx(GerenciaUxEvents.RequestAborted, {
          url,
          params: { ...params },
          reason: meta.reason || (superseded ? 'superseded' : 'abort'),
        });
      }
      if (mySeq !== seqRef.current || !mountedRef.current) return;
      if (err.name === 'AbortError') {
        if (meta.reason === 'timeout') {
          const min = Math.max(1, Math.round(timeoutMs / 60_000));
          setError(
            `Tempo limite (${min} min) ao buscar dados. A API ou o banco pode estar lento; confira o terminal da API e a aba Rede do browser.`,
          );
        }
        return;
      }
      setError(err.message);
    } finally {
      if (tid) clearTimeout(tid);
      if (mySeq === seqRef.current && mountedRef.current) {
        setIsSyncing(false);
        setLoading(false);
      }
    }
  }, [url, timeoutMs, enabled, uxGerencia]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setLoading(false);
      setIsSyncing(false);
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

  return { data, loading, error, refetch: fetchData, isSyncing, lastSyncAt, lastSyncSource, lastRequestMs };
}
