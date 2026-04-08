import React, { useMemo } from 'react';
import KpiCard from '../KpiCard';
import DynamicChart from '../charts/DynamicChart';
import SectionBanner from '../SectionBanner';
import { useApi } from '../../hooks/useApi';

const CirurgiasSection = ({ filters }) => {
  const params = useMemo(
    () => ({ period: filters.period, regional: filters.regional, unidade: filters.unidade }),
    [filters],
  );
  const { data: esp, loading: lEsp } = useApi('cirurgia/especialidade', params);
  const { data: evo, loading: lEvo } = useApi('cirurgia/evolucao',      params);
  const { data: kpis, loading: lKpi } = useApi('cc/kpis', params);
  const { data: perf, loading: lPerf } = useApi('cc/performance', params);

  const espChart = useMemo(() => ({
    labels: esp?.labels || [],
    values: esp?.dados || [],
  }), [esp]);

  const evoChart = useMemo(() => ({
    labels: evo?.labels || [],
    datasets: [
      { label: 'Eletivas',   data: evo?.eletivas  || [] },
      { label: 'Urgências',  data: evo?.urgencias || [] },
    ],
  }), [evo]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <SectionBanner titulo="Centro Cirúrgico" subtitulo="CC · produtividade, mix e evolução" cor="violet" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Tempo de cirurgia" value={kpis?.tempoCirurgiaMin} loading={lKpi} suffix=" min" />
        <KpiCard label="Tempo de sala" value={kpis?.tempoSalaMin} loading={lKpi} suffix=" min" />
        <KpiCard label="Total cirurgias" value={kpis?.totalCirurgias} loading={lKpi} accent="emerald" />
        <KpiCard
          label="Atraso > 30 min"
          value={perf?.atraso30min ?? '—'}
          loading={lPerf}
          suffix="%"
          accent="amber"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DynamicChart title="Mix por Especialidade" data={espChart} defaultType="pie"  loading={lEsp} className="h-80" />
        <DynamicChart title="Evolução 12 Meses"     data={evoChart} defaultType="line" loading={lEvo} className="h-80" />
      </div>
    </div>
  );
};

export default CirurgiasSection;
