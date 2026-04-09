import React from 'react';
import ModuleShell from '../ModuleShell';

/** Consome JSON: GET /api/v1/kpi, overview/indicadores, overview/metas-volumes → { ok, data }. */
export default function OverviewSection() {
  return (
    <ModuleShell
      title="Gerência"
      subtitle="Implemente no backend o payload em data para essas rotas; o hook useApi já espera resposta JSON { ok: true, data }. Para gráficos, importe de @/graficos (ex.: LineModel, ChartRenderer) quando ligar os dados."
    />
  );
}
