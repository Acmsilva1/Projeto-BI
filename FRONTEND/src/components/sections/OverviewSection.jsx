import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import GerenciaTotaisCards from '../GerenciaTotaisCards';
import TempoMedioEtapasTable from '../TempoMedioEtapasTable';
import MetasAcompanhamentoGestao from '../MetasAcompanhamentoGestao';
import MetasConformesPorUnidadeChart from '../MetasConformesPorUnidadeChart';
import MetasPorVolumesTable from '../MetasPorVolumesTable';
import MetricasPorUnidadeTable from '../MetricasPorUnidadeTable';

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
  });

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
      className={`flex flex-col gap-6 rounded-2xl bg-[radial-gradient(ellipse_90%_60%_at_50%_-15%,color-mix(in_srgb,var(--primary)_14%,transparent)_0%,transparent_55%)] px-0 py-0.5 transition-opacity ${loading ? 'opacity-75' : ''}`}
      aria-busy={loading}
    >
      <GerenciaTotaisCards filters={filters} prefetched={bundle.totaisPs} />
      <TempoMedioEtapasTable filters={filters} prefetched={bundle.tempoMedioEtapas} />
      <MetasAcompanhamentoGestao filters={filters} prefetchedByMetric={bundle.metasAcompanhamentoByMetric} />
      <MetasPorVolumesTable filters={filters} prefetched={bundle.metasPorVolumes} />
      <MetasConformesPorUnidadeChart filters={filters} prefetched={bundle.metasConformesPorUnidade} />
      <MetricasPorUnidadeTable filters={filters} prefetched={bundle.metricasPorUnidade} />
    </div>
  );
}
