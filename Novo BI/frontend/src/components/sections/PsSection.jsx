/**
 * Stub — PsSection.jsx
 * Módulo de Pronto Socorro
 */
import React, { useMemo } from 'react';
import KpiCard     from '../KpiCard';
import DynamicChart from '../charts/DynamicChart';
import { useApi }  from '../../hooks/useApi';

const PsSection = ({ filters }) => {
  const params = useMemo(() => ({ period: filters.period, regional: filters.regional }), [filters]);

  const { data: volumes, loading: lVol } = useApi('ps/volumes', params);
  const { data: kpis,   loading: lKpi } = useApi('ps/kpis',    params);
  const { data: matrix, loading: lMat } = useApi('ps/matrix',  params);

  const slaChart = useMemo(() => ({
    labels: ['Triagem', 'Consulta', 'Medicação', 'Reavaliação', 'RX/ECG', 'TC/US', 'Permanência'],
    values: [],  // virá via ps/slas futuramente
  }), []);

  const matrixChart = useMemo(() => ({
    labels: (matrix || []).map(r => (r.unidade || r.unidadeNome || '').replace('PS ', '').slice(0,14)),
    datasets: [
      { label: 'Triagem %',   data: (matrix || []).map(r => Number(r.triagemPercent  || 0)) },
      { label: 'Consulta %',  data: (matrix || []).map(r => Number(r.consultaPercent || 0)) },
      { label: 'Medicação %', data: (matrix || []).map(r => Number(r.medicacaoPercent|| 0)) },
    ],
  }), [matrix]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Atendimentos"      value={volumes?.atendimentos}          loading={lVol} />
        <KpiCard label="Evasões"           value={volumes?.evasoes}               loading={lVol} accent="rose" />
        <KpiCard label="Conv. Internação"  value={volumes?.conversaoInternacao}   loading={lVol} suffix="%" accent="amber" />
        <KpiCard label="Prescrições"       value={volumes?.prescricoes}           loading={lVol} accent="emerald" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Tempo Permanência" value={kpis?.tempoPermanenciaMin}  loading={lKpi} suffix=" min" />
        <KpiCard label="Tempo Consulta"    value={kpis?.tempoConsultaMin}     loading={lKpi} suffix=" min" />
        <KpiCard label="Altas PS"          value={kpis?.altas}                loading={lKpi} accent="emerald" />
        <KpiCard label="Óbitos PS"         value={kpis?.obitos}               loading={lKpi} accent="rose" />
      </div>

      <DynamicChart
        title="Matriz de Fora de SLA por Unidade (%)"
        data={matrixChart}
        defaultType="bar"
        loading={lMat}
        className="h-80"
      />
    </div>
  );
};

export default PsSection;
