import React, { useMemo } from 'react';
import KpiCard from '../KpiCard';
import DynamicChart from '../charts/DynamicChart';
import { useApi } from '../../hooks/useApi';

const CirurgiasSection = ({ filters }) => {
  const params = useMemo(() => ({ period: filters.period, regional: filters.regional }), [filters]);
  const { data: esp, loading: lEsp } = useApi('cirurgia/especialidade', params);
  const { data: evo, loading: lEvo } = useApi('cirurgia/evolucao',      params);
  const { data: kpis, loading: lKpi }= useApi('cc/kpis',                params);

  const espChart = useMemo(() => ({
    labels: (esp || []).map(e => e.especialidade),
    values: (esp || []).map(e => Number(e.quantidade || 0)),
  }), [esp]);

  const evoChart = useMemo(() => {
    const sorted = [...(evo || [])].sort((a, b) => a.mesRef < b.mesRef ? -1 : 1);
    return {
      labels: sorted.map(e => new Date(e.mesRef).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })),
      datasets: [
        { label: 'Eletivas',   data: sorted.map(e => Number(e.eletivas  || 0)) },
        { label: 'Urgências',  data: sorted.map(e => Number(e.urgencias || 0)) },
      ],
    };
  }, [evo]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Tempo de Cirurgia" value={kpis?.tempoCirurgiaMin}  loading={lKpi} suffix=" min" />
        <KpiCard label="Tempo de Sala"     value={kpis?.tempoSalaMin}      loading={lKpi} suffix=" min" />
        <KpiCard label="Total Cirurgias"   value={kpis?.totalCirurgias}    loading={lKpi} accent="emerald" />
        <KpiCard label="Atraso > 30min"    value={kpis?.atraso30}          loading={lKpi} suffix="%" accent="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DynamicChart title="Mix por Especialidade" data={espChart} defaultType="pie"  loading={lEsp} className="h-80" />
        <DynamicChart title="Evolução 12 Meses"     data={evoChart} defaultType="line" loading={lEvo} className="h-80" />
      </div>
    </div>
  );
};

export default CirurgiasSection;
