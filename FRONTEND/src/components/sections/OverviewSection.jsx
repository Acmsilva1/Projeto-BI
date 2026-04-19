import React, { useMemo, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { onGerenciaUx, GerenciaUxEvents } from '../../messaging/gerenciaUxBus.js';
import GerenciaTotaisCards from '../GerenciaTotaisCards';
import TempoMedioEtapasTable from '../TempoMedioEtapasTable';
import MetasAcompanhamentoGestao from '../MetasAcompanhamentoGestao';
import MetasConformesPorUnidadeChart from '../MetasConformesPorUnidadeChart';
import MetasPorVolumesTable from '../MetasPorVolumesTable';
import MetricasPorUnidadeTable from '../MetricasPorUnidadeTable';

const PERIOD_LABELS = {
  1: 'D-1 (ontem)',
  7: 'ultimos 7 dias',
  30: 'ultimos 30 dias',
  60: 'ultimos 60 dias',
};

const WAIT_PHRASES = [
  'Estamos preparando o painel com cuidado cirurgico.',
  'O Node esta servindo o aperitivo enquanto organiza os lotes maiores.',
  'Calibrando numeros, alinhando metricas e aquecendo o cache.',
  'Quase la: consolidando dados para uma leitura mais rapida no proximo clique.',
  'Respira que vem insight bom: estamos fechando a consulta no motor de dados.',
];

function periodLabel(p) {
  const n = Number(p);
  if (PERIOD_LABELS[n]) return PERIOD_LABELS[n];
  if (Number.isFinite(n) && n > 0) return `ultimos ${n} dias`;
  return 'periodo selecionado';
}

function filtersMatchEcho(bundle, filters) {
  const q = bundle?.queryEcho;
  if (!q) return true;
  const pe = String(q.period ?? '').trim();
  const pf = String(filters.period ?? '').trim();
  /** Eco por vezes omite período; Gerência default 7d no topo. */
  const periodOk =
    pe === pf ||
    (pe === '' && (pf === '1' || pf === '7' || pf === '')) ||
    (pf === '' && (pe === '1' || pe === '7'));
  const re = String(q.regional ?? '');
  const rf = String(filters.regional ?? '');
  const ue = String(q.unidade ?? '');
  const uf = String(filters.unidade ?? '');
  return periodOk && re === rf && ue === uf;
}

function useCreativePhrase(active) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => {
      setIdx((x) => (x + 1) % WAIT_PHRASES.length);
    }, 3800);
    return () => clearInterval(id);
  }, [active]);
  return WAIT_PHRASES[idx];
}

/** Layout aproximado do painel — percecao de velocidade maior do que um spinner isolado. */
function GerenciaLoadingSkeleton({ phrase }) {
  return (
    <div className="flex min-h-[42vh] flex-col gap-5 rounded-2xl border border-app-border bg-app-elevated/30 px-3 py-6 sm:px-5" aria-busy>
      <div className="flex items-center gap-3">
        <Loader2 className="h-8 w-8 shrink-0 animate-spin text-pipeline-live" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-app-fg">A abrir a Gerencia</p>
          <p className="mt-0.5 text-xs leading-relaxed text-app-muted">{phrase}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((k) => (
          <div key={k} className="h-24 animate-pulse rounded-2xl bg-app-border/35 sm:h-28" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-app-border/30" />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-52 animate-pulse rounded-2xl bg-app-border/25" />
        <div className="h-52 animate-pulse rounded-2xl bg-app-border/25" />
      </div>
    </div>
  );
}

/** Visao Gerencia: backend orquestra cache 7/30/60, React apenas apresenta. */
export default function OverviewSection({ filters }) {
  const formatSync = (ts) => {
    if (!ts) return 'Ainda nao sincronizado';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return 'Ainda nao sincronizado';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  /** Incrementa enquanto `fullBundlePending` para mudar a URL e nao ficar preso ao cache em memoria do useApi. */
  const [bundleBgPoll, setBundleBgPoll] = useState(0);

  /** Ao mudar filtro, zera `_bg` — evita loop de fetch com `fullBundlePending` do pedido anterior. */
  useEffect(() => {
    setBundleBgPoll(0);
  }, [filters.period, filters.regional, filters.unidade]);

  const params = useMemo(
    () => ({
      period: filters.period,
      regional: filters.regional,
      unidade: filters.unidade,
      ...(bundleBgPoll > 0 ? { _bg: bundleBgPoll } : {}),
    }),
    [filters.period, filters.regional, filters.unidade, bundleBgPoll],
  );

  /** Aperitivo (<=7d): um pedido (dashboard-bundle) e UX de carregamento rápido. */
  const bundleApiOptions = useMemo(() => {
    const isAperitivo = Number(filters.period) <= 7;
    return {
      ttl: isAperitivo ? 120_000 : 12_000,
      timeoutMs: 600_000,
      uxGerencia: true,
    };
  }, [filters.period]);

  const {
    data: bundleRaw,
    loading,
    error,
    isSyncing: bundleSyncing,
    lastSyncAt: bundleSyncAt,
    lastRequestMs,
  } = useApi('gerencia/dashboard-bundle', params, bundleApiOptions);

  useEffect(() => {
    if (!import.meta.env?.DEV) return undefined;
    const off = onGerenciaUx(GerenciaUxEvents.RequestAborted, (d) => {
      console.debug('[gerencia-ux] pedido abortado', d?.reason, d?.url);
    });
    return off;
  }, []);

  /** DuckDB em background: poling com teto — evita URL/_bg a mudar sem fim (loop de fetch). */
  const BUNDLE_BG_POLL_CAP = 48;
  useEffect(() => {
    const pending = Boolean(bundleRaw?.cacheOrchestration?.fullBundlePending);
    if (!pending) {
      setBundleBgPoll(0);
      return undefined;
    }
    const kick = setTimeout(() => setBundleBgPoll((n) => (n === 0 ? 1 : n)), 260);
    const id = setInterval(
      () => setBundleBgPoll((n) => (n >= BUNDLE_BG_POLL_CAP ? n : n + 1)),
      1100,
    );
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, [bundleRaw?.cacheOrchestration?.fullBundlePending]);

  const dashboardMatchesFilters = Boolean(
    bundleRaw?.queryEcho && filtersMatchEcho(bundleRaw, filters),
  );
  /** Só reutilizar payload cujo eco coincide (evita ecrã “congelado” com dados do filtro anterior). */
  const bundleRawUsable =
    bundleRaw &&
    (!bundleRaw.queryEcho || filtersMatchEcho(bundleRaw, filters));
  const bundle =
    (dashboardMatchesFilters ? bundleRaw : null) || (bundleRawUsable ? bundleRaw : null) || null;
  const isSyncing = Boolean(bundleSyncing);
  const lastSyncAt = bundleSyncAt;
  /** Em aperitivo (<=7d) o backend responde por cache/slice — não mostrar faixa “Atualizando…” ao mudar regional/unidade. */
  const staleWhileLoading = Boolean(
    loading &&
      bundle &&
      bundle.queryEcho &&
      !filtersMatchEcho(bundle, filters) &&
      Number(filters.period) > 7,
  );
  const phrase = useCreativePhrase(Boolean(loading || isSyncing));
  const cacheSource = String(bundle?.cacheOrchestration?.source || '');
  const dbOnDemand = cacheSource === 'db_on_demand';
  const pendingFullBundle = Boolean(bundle?.cacheOrchestration?.fullBundlePending);

  if (error && !bundle) {
    return (
      <div className="rounded-2xl border border-rose-500/35 bg-rose-950/20 px-4 py-6 text-sm text-rose-100" role="alert">
        {error}
      </div>
    );
  }

  if (!bundle && loading) {
    return <GerenciaLoadingSkeleton phrase={phrase} />;
  }

  if (!bundle) return null;

  return (
    <div
      className={`relative flex flex-col gap-6 rounded-2xl bg-[radial-gradient(ellipse_90%_60%_at_50%_-15%,color-mix(in_srgb,var(--primary)_14%,transparent)_0%,transparent_55%)] px-0 py-0.5 transition-opacity ${loading && !staleWhileLoading ? 'opacity-75' : ''} ${staleWhileLoading ? 'opacity-90' : ''}`}
      aria-busy={loading}
    >
      <div className="sticky top-0 z-[6] -mb-2 flex items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-slate-950/55 px-4 py-2.5 text-xs text-sky-100 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" aria-hidden /> : <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />}
          <span className="font-semibold">
            {pendingFullBundle ? 'Aperitivo no ecra — dados completos a carregar' : isSyncing ? 'Sincronizando dados...' : 'Dados sincronizados'}
          </span>
        </div>
        <div className="text-[11px] text-sky-200/90 text-right">
          <div>Ultima sincronizacao: {formatSync(lastSyncAt)}</div>
          <div>
            Fonte: {String(bundle?.cacheOrchestration?.source || 'network')}
            {Number.isFinite(lastRequestMs) ? ` • ${lastRequestMs} ms` : ''}
          </div>
        </div>
      </div>
      {pendingFullBundle ? (
        <div
          className="sticky top-0 z-[5] mb-2 flex items-center gap-3 rounded-xl border border-cyan-500/35 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-50 shadow-md backdrop-blur-sm"
          role="status"
        >
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-300" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-cyan-100">A carregar dados completos (7 dias)</p>
            <p className="mt-0.5 text-xs leading-snug text-cyan-200/90">
              O DuckDB e o Node estao a montar o dataset em segundo plano; os numeros vao atualizar sozinhos.
            </p>
          </div>
        </div>
      ) : null}
      {staleWhileLoading ? (
        <div
          className="sticky top-0 z-[5] mb-2 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-950/35 px-4 py-3 text-sm text-amber-50 shadow-md backdrop-blur-sm"
          role="status"
        >
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-300" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-amber-100">
              Atualizando {periodLabel(filters.period)}...
            </p>
            <p className="mt-0.5 text-xs leading-snug text-amber-200/90">
              {dbOnDemand
                ? 'Consulta fora do cache quente. Estamos buscando direto no banco local com prioridade.'
                : phrase}
            </p>
          </div>
        </div>
      ) : null}
      <div
        key={`${filters.period}|${filters.regional}|${filters.unidade}|${String(bundle?.generatedAt ?? '')}`}
        className="flex flex-col gap-6"
      >
        <GerenciaTotaisCards filters={filters} prefetched={bundle.totaisPs} />
        <TempoMedioEtapasTable filters={filters} prefetched={bundle.tempoMedioEtapas} />
        <MetasAcompanhamentoGestao filters={filters} prefetchedByMetric={bundle.metasAcompanhamentoByMetric} />
        <MetasPorVolumesTable filters={filters} prefetched={bundle.metasPorVolumes} />
        <MetasConformesPorUnidadeChart filters={filters} prefetched={bundle.metasConformesPorUnidade} />
        <MetricasPorUnidadeTable filters={filters} prefetched={bundle.metricasPorUnidade} />
      </div>
    </div>
  );
}
