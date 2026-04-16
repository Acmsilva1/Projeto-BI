import React from 'react';
import ModuleShell from '../ModuleShell';

/** Consome JSON em /api/v1/cirurgia/* e /api/v1/cc/*. */
export default function CirurgiasSection() {
  return (
    <ModuleShell
      title="Centro Cirúrgico"
      subtitle="Preencha as rotas cirurgia/especialidade, evolucao, tempo-centro e cc/performance, kpis, timeline com JSON em data."
    />
  );
}
