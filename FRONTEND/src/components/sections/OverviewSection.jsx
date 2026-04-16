import React, { useMemo, useEffect } from 'react';
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
  7: 'últimos 7 dias',
  30: 'últimos 30 dias',
  90: 'últimos 90 dias',
  365: 'últimos 12 meses',
  1095: 'últimos 3 anos',
  366: 'ano civil (jan–hoje)',
};

function periodLabel(p) {
  const n = Number(p);
  if (PERIOD_LABELS[n]) return PERIOD_LABELS[n];
  if (Number.isFinite(n) && n > 0) return `últimos ${n} dias`;
  return 'período selecionado';
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

/** Visão Gerência — um GET `dashboard-bundle`: o Node agrega tudo; o React pinta de uma vez. */
export default function OverviewSection({ filters }) {
  const params = useMemo(
    () => ({
      period: filters.period,
      regional: filters.regional,
      unidade: filters.unidade,
    }),
    [filters.period, filters.regional, filters.unidade],
  );

  const { data: bundle, loading, error } = useApi('gerencia/dashboard-bundle', params, {
    ttl: 20_000,
    timeoutMs: 600_000,
    uxGerencia: true,
  });

  useEffect(() => {
    if (!import.meta.env?.DEV) return undefined;
    const off = onGerenciaUx(GerenciaUxEvents.RequestAborted, (d) => {
      console.debug('[gerencia-ux] pedido abortado', d?.reason, d?.url);
    });
    return off;
  }, []);

  const staleWhileLoading =
    Boolean(loading && bundle && bundle.queryEcho && !filtersMatchEcho(bundle, filters));

  if (error && !bundle) {
    return (
      <div
        className="rounded-2xl border border-rose-500/35 bg-rose-950/20 px-4 py-6 text-sm text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!bundle && loading) {
    return (
      <div className="flex min-h-[42vh] flex-col items-center justify-center gap-4 rounded-2xl border border-app-border bg-app-elevated/40 px-6 py-12 text-app-muted">
        <Loader2 className="h-10 w-10 shrink-0 animate-spin text-pipeline-live" aria-hidden />
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold text-app-fg">A preparar o painel da Gerência</p>
          <p className="mt-1 text-xs leading-relaxed">
            O servidor está a ler as views e a calcular totais, tabelas e gráficos num único pacote. Na
            primeira carga isto pode demorar consoante o volume na base.
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
      {staleWhileLoading ? (
        <div
          className="sticky top-0 z-[5] mb-2 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-950/35 px-4 py-3 text-sm text-amber-50 shadow-md backdrop-blur-sm"
          role="status"
        >
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-300" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-amber-100">A carregar {periodLabel(filters.period)}…</p>
            <p className="mt-0.5 text-xs leading-snug text-amber-200/90">
              O pedido anterior foi cancelado. Os números abaixo são do último período já recebido até a nova resposta
              chegar.
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
