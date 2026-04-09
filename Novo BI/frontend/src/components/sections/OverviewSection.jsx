import React from 'react';
import GerenciaTotaisCards from '../GerenciaTotaisCards';
import TempoMedioEtapasTable from '../TempoMedioEtapasTable';
import MetasAcompanhamentoGestao from '../MetasAcompanhamentoGestao';
import MetasConformesPorUnidadeChart from '../MetasConformesPorUnidadeChart';
import MetasPorVolumesTable from '../MetasPorVolumesTable';
import MetricasPorUnidadeTable from '../MetricasPorUnidadeTable';

/** Visão Gerência — totais, jornada tempo/etapa, metas e indicadores por unidade. */
export default function OverviewSection({ filters }) {
  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-[radial-gradient(ellipse_90%_60%_at_50%_-15%,color-mix(in_srgb,var(--primary)_14%,transparent)_0%,transparent_55%)] px-0 py-0.5">
      <GerenciaTotaisCards filters={filters} />
      <TempoMedioEtapasTable filters={filters} />
      <MetasAcompanhamentoGestao filters={filters} />
      <MetasPorVolumesTable filters={filters} />
      <MetasConformesPorUnidadeChart filters={filters} />
      <MetricasPorUnidadeTable filters={filters} />
    </div>
  );
}
