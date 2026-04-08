import React, { useMemo } from 'react';
import KpiCard from '../KpiCard';
import DynamicChart from '../charts/DynamicChart';
import { useApi } from '../../hooks/useApi';

const FinanceiroSection = ({ filters }) => {
  const params = useMemo(() => ({ period: filters.period, regional: filters.regional }), [filters]);

  const { data: resumo,   loading: lRes } = useApi('financeiro/resumo',  params);
  const { data: convenio, loading: lCon } = useApi('financeiro/convenio', params);
  const { data: glosas,   loading: lGlo } = useApi('financeiro/glosas',   params);

  /* ── Formatação dos dados de gráficos ── */
  const resumoChart = useMemo(() => ({
    labels: resumo?.labels || [],
    datasets: [
      { label: 'Receita',  data: resumo?.receitas || [] },
      { label: 'Despesa',  data: resumo?.despesas || [] },
    ],
  }), [resumo]);

  const convenioChart = useMemo(() => ({
    labels: convenio?.labels || [],
    values: convenio?.valores || [],
  }), [convenio]);

  const glosasChart = useMemo(() => ({
    labels: (glosas?.porMotivo || []).map(g => g.motivo),
    values: (glosas?.porMotivo || []).map(g => Number(g.valor || 0)),
  }), [glosas]);

  /* ── KPIs sintéticos da view ── */
  const totalReceita = useMemo(() =>
    (resumo?.receitas || []).reduce((acc, r) => acc + Number(r || 0), 0),
  [resumo]);

  const totalDespesa = useMemo(() =>
    (resumo?.despesas || []).reduce((acc, r) => acc + Number(r || 0), 0),
  [resumo]);

  const mediaGlosa = useMemo(() => {
    if (!resumo?.glosasPercent?.length) return null;
    return (resumo.glosasPercent.reduce((a, r) => a + Number(r || 0), 0) / resumo.glosasPercent.length).toFixed(1);
  }, [resumo]);

  const fmt = (v) => (v / 1_000_000).toFixed(1);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Receita Total (R$)"  value={fmt(totalReceita)} suffix="M"  loading={lRes} accent="emerald" />
        <KpiCard label="Despesa Total (R$)"  value={fmt(totalDespesa)} suffix="M"  loading={lRes} accent="rose" />
        <KpiCard label="Margem Bruta"
          value={totalReceita > 0 ? ((1 - totalDespesa / totalReceita) * 100).toFixed(1) : '--'}
          suffix="%" loading={lRes} accent="hospital" />
        <KpiCard label="% Glosa Média"       value={mediaGlosa}        suffix="%"  loading={lRes} accent="amber" />
      </div>

      {/* Charts linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DynamicChart
          title="Fluxo Receita vs Despesa (12 meses)"
          data={resumoChart}
          defaultType="line"
          loading={lRes}
          className="h-80"
        />
        <DynamicChart
          title="Mix por Convênio"
          data={convenioChart}
          defaultType="donut"
          loading={lCon}
          className="h-80"
        />
      </div>

      {/* Charts linha 2 */}
      <DynamicChart
        title="Motivos de Glosa (Top 5)"
        data={glosasChart}
        defaultType="bar"
        loading={lGlo}
        className="h-64"
      />
    </div>
  );
};

export default FinanceiroSection;
