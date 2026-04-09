import React from 'react';
import ModuleShell from '../ModuleShell';
import { GraficosContainer } from '@/graficos';

/** Consome JSON: GET /api/v1/kpi, overview/indicadores, overview/metas-volumes → { ok, data }. */
export default function OverviewSection() {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <ModuleShell
        title="Gerência"
        subtitle="Implemente no backend o payload em data para essas rotas; o hook useApi já espera resposta JSON { ok: true, data }."
      />
      <GraficosContainer
        title="Modelos de gráficos"
        description="Selecione o tipo. Nos módulos, importe de src/graficos (ex.: LineModel, buildOptionById) e passe o objeto vindo da API."
        height={420}
      />
    </div>
  );
}
