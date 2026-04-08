/**
 * OverviewSection.jsx — Dashboard de Resumo Geral
 * Consome as views:
 *   vw_realtime_kpi
 *   kpi/unidades  → vw_realtime_kpi (por unidade)
 */
import React, { useMemo } from 'react';
import KpiCard from '../KpiCard';
import DynamicChart from '../charts/DynamicChart';
import { useApi } from '../../hooks/useApi';

const OverviewSection = ({ filters }) => {
  const params = useMemo(() => ({ period: filters.period, regional: filters.regional }), [filters]);

  const { data: kpi,       loading: lKpi }       = useApi('kpi',           params);
  const { data: psKpis,   loading: lPs  }        = useApi('ps/kpis',        params);
  const { data: intRes,   loading: lInt }        = useApi('ocupacao/resumo', params);
  const { data: ccKpis,   loading: lCc  }        = useApi('cc/kpis',        params);
  const { data: unidades, loading: lUni }        = useApi('kpi/unidades',   params);

  /* ── Dados para gráficos ── */
  const operacaoChart = useMemo(() => ({
    labels: ['Conv. PS %', 'CC Eletivas', 'CC Urgências', 'Internações'],
    values: [
      Number(psKpis?.conversaoInternacao || 0),
      Number(ccKpis?.eletivas || 0),
      Number(ccKpis?.urgencias || 0),
      Number(intRes?.quantidadeInternacoes || 0),
    ],
  }), [psKpis, ccKpis, intRes]);

  const internacaoChart = useMemo(() => ({
    labels: ['Clínicos', 'Cirúrgicos', 'Internos', 'Externos'],
    values: [
      Number(intRes?.pacientesClinicos || 0),
      Number(intRes?.pacientesCirurgicos || 0),
      Number(intRes?.pacientesInternos || 0),
      Number(intRes?.pacientesExternos || 0),
    ],
  }), [intRes]);

  const unidadesChart = useMemo(() => ({
    labels: (unidades || []).map(u => (u.unidadeNome || '').replace('PS ', '').slice(0, 16)),
    datasets: [
      { label: 'Ocupação (%)',  data: (unidades || []).map(u => Number(u.taxaOcupacao || 0))    },
      { label: 'Pac. Ativos',  data: (unidades || []).map(u => Number(u.pacientesAtivos || 0)) },
    ],
  }), [unidades]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Pacientes Ativos"  value={kpi?.pacientesAtivos?.valor}  loading={lKpi} accent="hospital" />
        <KpiCard label="Taxa de Ocupação"  value={kpi?.taxaOcupacao?.valor}     loading={lKpi} suffix="%" accent="emerald" />
        <KpiCard label="Cirurgias no Mês"  value={kpi?.cirurgiasNoMes?.valor}   loading={lKpi} accent="amber" />
        <KpiCard label="Internações"       value={intRes?.quantidadeInternacoes} loading={lInt} accent="rose" />
      </div>

      {/* Charts — Linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DynamicChart
          title="Operação Consolidada"
          data={operacaoChart}
          defaultType="bar"
          loading={lPs || lCc || lInt}
          className="h-72"
        />
        <DynamicChart
          title="Composição de Internação"
          data={internacaoChart}
          defaultType="donut"
          loading={lInt}
          className="h-72"
        />
      </div>

      {/* Charts — Linha 2 */}
      <DynamicChart
        title="Desempenho por Unidade"
        data={unidadesChart}
        defaultType="bar"
        loading={lUni}
        className="h-80"
      />
    </div>
  );
};

export default OverviewSection;
