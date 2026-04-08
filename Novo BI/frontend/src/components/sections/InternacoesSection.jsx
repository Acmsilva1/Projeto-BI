import React, { useMemo } from 'react';
import KpiCard from '../KpiCard';
import DynamicChart from '../charts/DynamicChart';
import SectionBanner from '../SectionBanner';
import { useApi } from '../../hooks/useApi';

const InternacoesSection = ({ filters }) => {
  const params = useMemo(
    () => ({ period: filters.period, regional: filters.regional, unidade: filters.unidade }),
    [filters],
  );
  const { data: kpis, loading: lKpi } = useApi('ocupacao/kpis', params);
  const { data: resumo, loading: lRes } = useApi('ocupacao/resumo', params);
  const { data: tend, loading: lTen } = useApi('ocupacao/tendencia', params);

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

  const tendenciaChart = useMemo(() => {
    const labels = tend?.labels || [];
    const series = tend?.series || [];
    if (!series.length) return { labels, datasets: [] };
    return {
      labels,
      datasets: series.map((s) => ({
        label: s.nome,
        data: s.dados || [],
      })),
    };
  }, [tend]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <SectionBanner titulo="Internações / UTI" subtitulo="Ocupação, desfechos e tendência" cor="emerald" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Internações"      value={resumo?.quantidadeInternacoes} loading={lRes} />
        <KpiCard label="Altas"            value={kpis?.altasAcumuladas}          loading={lKpi} accent="emerald" />
        <KpiCard label="Óbitos"           value={kpis?.obitosAcumulados}         loading={lKpi} accent="rose" />
        <KpiCard label="Média Permanência" value={kpis?.tempoMedioPermanencia}   loading={lKpi} suffix=" dias" accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DynamicChart title="Desfecho da internação" data={desfechoChart} defaultType="bar" loading={lRes} className="h-72" />
        <DynamicChart title="Perfil assistencial" data={perfilChart} defaultType="donut" loading={lRes} className="h-72" />
      </div>

      <DynamicChart
        title="Tendência de ocupação (30 dias)"
        data={tendenciaChart}
        defaultType="line"
        loading={lTen}
        className="h-80"
      />
    </div>
  );
};

export default InternacoesSection;
