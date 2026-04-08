/**
 * PsSection — Pronto Socorro (PS), alinhado aos modelos Power BI.
 */
import React, { useMemo } from 'react';
import KpiCard from '../KpiCard';
import DynamicChart from '../charts/DynamicChart';
import HeatmapFluxos from '../charts/HeatmapFluxos';
import ConversaoPbiPanel from '../charts/ConversaoPbiPanel';
import SectionBanner from '../SectionBanner';
import { useApi } from '../../hooks/useApi';

const SLA_ORDER = ['triagem', 'consulta', 'medicacao', 'reavaliacao', 'rx_ecg', 'tc_us', 'permanencia'];

const PsSection = ({ filters }) => {
  const params = useMemo(
    () => ({ period: filters.period, regional: filters.regional, unidade: filters.unidade }),
    [filters],
  );

  const { data: volumes, loading: lVol } = useApi('ps/volumes', params);
  const { data: kpis, loading: lKpi } = useApi('ps/kpis', params);
  const { data: matrix, loading: lMat } = useApi('ps/matrix', params);
  const { data: slas, loading: lSla } = useApi('ps/slas', params);
  const { data: perfil, loading: lPerfil } = useApi('ps/perfil', params);
  const { data: fluxos, loading: lFlux } = useApi('ps/fluxos', params);
  const { data: medicacao, loading: lMed } = useApi('ps/medicacao', params);
  const { data: conversao, loading: lConv } = useApi('ps/conversao', params);

  const slaChart = useMemo(
    () => ({
      labels: ['Triagem', 'Consulta', 'Medicação', 'Reavaliação', 'RX/ECG', 'TC/US', 'Permanência'],
      values: SLA_ORDER.map((k) => Number(slas?.[k]?.percent ?? 0)),
    }),
    [slas],
  );

  const matrixChart = useMemo(
    () => ({
      labels: (matrix || []).map((r) => (r.unidade || r.unidadeNome || '').replace('PS ', '').slice(0, 14)),
      datasets: [
        { label: 'Triagem %', data: (matrix || []).map((r) => Number(r.triagemPercent || 0)) },
        { label: 'Consulta %', data: (matrix || []).map((r) => Number(r.consultaPercent || 0)) },
        { label: 'Medicação %', data: (matrix || []).map((r) => Number(r.medicacaoPercent || 0)) },
      ],
    }),
    [matrix],
  );

  const perfilFaixaChart = useMemo(
    () => ({
      labels: (perfil?.faixaEtaria || []).map((x) => x.label),
      values: (perfil?.faixaEtaria || []).map((x) => x.value),
    }),
    [perfil],
  );

  const perfilSexoChart = useMemo(
    () => ({
      labels: (perfil?.sexo || []).map((x) => x.label),
      values: (perfil?.sexo || []).map((x) => x.value),
    }),
    [perfil],
  );

  const perfilDesfechoChart = useMemo(
    () => ({
      labels: (perfil?.desfechoMedico || []).map((x) => x.label),
      values: (perfil?.desfechoMedico || []).map((x) => x.value),
    }),
    [perfil],
  );

  const fluxosAtendChart = useMemo(
    () => ({
      labels: (fluxos?.resumoPorHora || []).map((r) => `${r.hora}h`),
      values: (fluxos?.resumoPorHora || []).map((r) => r.atendimentos),
    }),
    [fluxos],
  );

  const fluxosTempoChart = useMemo(
    () => ({
      labels: (fluxos?.resumoPorHora || []).map((r) => `${r.hora}h`),
      values: (fluxos?.resumoPorHora || []).map((r) => r.tempoMedioMin),
    }),
    [fluxos],
  );

  const medViaChart = useMemo(
    () => ({
      labels: (medicacao?.porVia || []).map((x) => x.via),
      values: (medicacao?.porVia || []).map((x) => x.quantidade),
    }),
    [medicacao],
  );

  const medVelChart = useMemo(
    () => ({
      labels: ['Rápida', 'Lenta'],
      values: [Number(medicacao?.velocidade?.rapida || 0), Number(medicacao?.velocidade?.lenta || 0)],
    }),
    [medicacao],
  );

  const medTop10Chart = useMemo(
    () => ({
      labels: (medicacao?.top10 || []).map((x) => x.medicamento),
      values: (medicacao?.top10 || []).map((x) => x.quantidade),
    }),
    [medicacao],
  );

  const conversaoMesChart = useMemo(
    () => ({
      labels: conversao?.labels || [],
      values: conversao?.taxaConversaoPct || [],
    }),
    [conversao],
  );

  return (
    <div className="space-y-8 animate-fade-in-up">
      <SectionBanner titulo="Pronto Socorro" subtitulo="PS · volumes, perfil, fluxos, medicação e conversão" cor="hospital" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Atendimentos" value={volumes?.atendimentos} loading={lVol} />
        <KpiCard label="Evasões" value={volumes?.evasoes} loading={lVol} accent="rose" />
        <KpiCard label="Conv. internação" value={volumes?.conversaoInternacao} loading={lVol} suffix="%" accent="amber" />
        <KpiCard label="Prescrições" value={volumes?.prescricoes} loading={lVol} accent="emerald" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Tempo permanência" value={kpis?.tempoPermanenciaMin} loading={lKpi} suffix=" min" />
        <KpiCard label="Tempo consulta" value={kpis?.tempoConsultaMin} loading={lKpi} suffix=" min" />
        <KpiCard label="Altas PS" value={kpis?.altas} loading={lKpi} accent="emerald" />
        <KpiCard label="Óbitos PS" value={kpis?.obitos} loading={lKpi} accent="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DynamicChart
          title="% acima da meta (SLA) por etapa"
          data={slaChart}
          defaultType="bar"
          loading={lSla}
          className="h-80"
        />
        <DynamicChart
          title="Matriz fora de SLA por unidade (%)"
          data={matrixChart}
          defaultType="bar"
          loading={lMat}
          className="h-80"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Perfil PS (agregado)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <DynamicChart title="Faixa etária" data={perfilFaixaChart} defaultType="donut" loading={lPerfil} className="h-72" />
          <DynamicChart title="Sexo" data={perfilSexoChart} defaultType="pie" loading={lPerfil} className="h-72" />
          <DynamicChart title="Desfecho médico" data={perfilDesfechoChart} defaultType="bar" loading={lPerfil} className="h-72" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Fluxos PS</h2>
        <HeatmapFluxos
          title="Quantidade de atendimentos (dia do mês × hora)"
          heatmapCalendario={fluxos?.heatmapCalendario}
          loading={lFlux}
          className="h-[440px]"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DynamicChart title="Atendimentos por hora (período)" data={fluxosAtendChart} defaultType="bar" loading={lFlux} className="h-72" />
          <DynamicChart title="Tempo médio (min) por hora" data={fluxosTempoChart} defaultType="line" loading={lFlux} className="h-72" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Medicação</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <DynamicChart title="Por via" data={medViaChart} defaultType="bar" loading={lMed} className="h-72" />
          <DynamicChart title="Infusão rápida vs lenta" data={medVelChart} defaultType="donut" loading={lMed} className="h-72" />
          <DynamicChart title="Top 10 itens" data={medTop10Chart} defaultType="bar" loading={lMed} className="h-80" />
        </div>
      </section>

      <ConversaoPbiPanel conversao={conversao} loading={lConv} />

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-5 max-w-4xl">
        <DynamicChart title="Taxa de conversão mensal (%)" data={conversaoMesChart} defaultType="line" loading={lConv} className="h-72" />
      </div>
    </div>
  );
};

export default PsSection;
