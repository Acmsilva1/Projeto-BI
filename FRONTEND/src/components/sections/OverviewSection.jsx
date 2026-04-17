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
  const pe = String(q.period ?? '');
  const pf = String(filters.period ?? '');
  const re = String(q.regional ?? '');
  const rf = String(filters.regional ?? '');
  const ue = String(q.unidade ?? '');
  const uf = String(filters.unidade ?? '');
  return pe === pf && re === rf && ue === uf;
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

/** Visao Gerencia: backend orquestra cache 7/30/60, React apenas apresenta. */
export default function OverviewSection({ filters }) {
  const formatSync = (ts) => {
    if (!ts) return 'Ainda nao sincronizado';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return 'Ainda nao sincronizado';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const params = useMemo(
    () => ({
      period: filters.period,
      regional: filters.regional,
      unidade: filters.unidade,
    }),
    [filters.period, filters.regional, filters.unidade],
  );

  const aperitivoEnabled =
    Number(filters.period) === 7 &&
    String(filters.regional || '').trim() === '' &&
    String(filters.unidade || '').trim() === '';

  const { data: aperitivo, isSyncing: aperitivoSyncing, lastSyncAt: aperitivoSyncAt } = useApi('gerencia/aperitivo', {}, {
    ttl: 60_000,
    enabled: aperitivoEnabled,
    persistLocal: true,
    localTtlMs: 60 * 60_000,
    revalidateLocal: true,
  });
  const {
    data: bundleRaw,
    loading,
    error,
    isSyncing: bundleSyncing,
    lastSyncAt: bundleSyncAt,
  } = useApi('gerencia/dashboard-bundle', params, {
    ttl: 20_000,
    timeoutMs: 600_000,
    uxGerencia: true,
    persistLocal: true,
    localTtlMs: 30 * 60_000,
    revalidateLocal: true,
  });

  useEffect(() => {
    if (!import.meta.env?.DEV) return undefined;
    const off = onGerenciaUx(GerenciaUxEvents.RequestAborted, (d) => {
      console.debug('[gerencia-ux] pedido abortado', d?.reason, d?.url);
    });
    return off;
  }, []);

  const bundle = bundleRaw || (loading ? aperitivo : null);
  const isSyncing = Boolean(bundleSyncing || aperitivoSyncing);
  const lastSyncAt = bundleSyncAt || aperitivoSyncAt;
  const staleWhileLoading = Boolean(loading && bundle && bundle.queryEcho && !filtersMatchEcho(bundle, filters));
  const phrase = useCreativePhrase(Boolean(loading));
  const cacheSource = String(bundle?.cacheOrchestration?.source || '');
  const dbOnDemand = cacheSource === 'db_on_demand';

  if (error && !bundle) {
    return (
      <div className="rounded-2xl border border-rose-500/35 bg-rose-950/20 px-4 py-6 text-sm text-rose-100" role="alert">
        {error}
      </div>
    );
  }

  if (!bundle && loading) {
    return (
      <div className="flex min-h-[42vh] flex-col items-center justify-center gap-4 rounded-2xl border border-app-border bg-app-elevated/40 px-6 py-12 text-app-muted">
        <Loader2 className="h-10 w-10 shrink-0 animate-spin text-pipeline-live" aria-hidden />
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold text-app-fg">A preparar o painel da Gerencia</p>
          <p className="mt-1 text-xs leading-relaxed">
            {phrase}
          </p>
        </div>
      </div>
    );
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
          <span className="font-semibold">{isSyncing ? 'Sincronizando dados...' : 'Dados sincronizados'}</span>
        </div>
        <span className="text-[11px] text-sky-200/90">
          Ultima sincronizacao: {formatSync(lastSyncAt)}
        </span>
      </div>
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
      <GerenciaTotaisCards filters={filters} prefetched={bundle.totaisPs} />
      <TempoMedioEtapasTable filters={filters} prefetched={bundle.tempoMedioEtapas} />
      <MetasAcompanhamentoGestao filters={filters} prefetchedByMetric={bundle.metasAcompanhamentoByMetric} />
      <MetasPorVolumesTable filters={filters} prefetched={bundle.metasPorVolumes} />
      <MetasConformesPorUnidadeChart filters={filters} prefetched={bundle.metasConformesPorUnidade} />
      <MetricasPorUnidadeTable filters={filters} prefetched={bundle.metricasPorUnidade} />
    </div>
  );
}
