import React, { useMemo } from 'react';
import KpiCard from '../KpiCard';
import DynamicChart from '../charts/DynamicChart';
import { useApi } from '../../hooks/useApi';

const InternacoesSection = ({ filters }) => {
  const params = useMemo(() => ({ period: filters.period, regional: filters.regional }), [filters]);
  const { data: kpis,   loading: lKpi } = useApi('ocupacao/kpis',   params);
  const { data: resumo, loading: lRes } = useApi('ocupacao/resumo',  params);

  const desfechoChart = useMemo(() => ({
    labels: ['Internações', 'Altas', 'Óbitos'],
    values: [
      Number(resumo?.quantidadeInternacoes || 0),
      Number(resumo?.altas  || 0),
      Number(resumo?.obitos || 0),
    ],
  }), [resumo]);

  const perfilChart = useMemo(() => ({
    labels: ['Clínicos', 'Cirúrgicos'],
    values: [Number(resumo?.pacientesClinicos || 0), Number(resumo?.pacientesCirurgicos || 0)],
  }), [resumo]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Internações"      value={resumo?.quantidadeInternacoes} loading={lRes} />
        <KpiCard label="Altas"            value={kpis?.altasAcumuladas}          loading={lKpi} accent="emerald" />
        <KpiCard label="Óbitos"           value={kpis?.obitosAcumulados}         loading={lKpi} accent="rose" />
        <KpiCard label="Média Permanência" value={kpis?.tempoMedioPermanencia}   loading={lKpi} suffix=" dias" accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DynamicChart title="Desfecho da Internação" data={desfechoChart} defaultType="bar"   loading={lRes} className="h-72" />
        <DynamicChart title="Perfil Assistencial"     data={perfilChart}   defaultType="donut" loading={lRes} className="h-72" />
      </div>
    </div>
  );
};

export default InternacoesSection;
