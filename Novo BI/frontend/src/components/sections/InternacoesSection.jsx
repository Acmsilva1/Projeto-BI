import React from 'react';
import ModuleShell from '../ModuleShell';

/** Consome JSON em /api/v1/ocupacao/*. */
export default function InternacoesSection() {
  return (
    <ModuleShell
      title="Internação"
      subtitle="Rotas ocupacao/setor, kpis, resumo, internacoes, tendencia, qualidade — todas no envelope { ok, data }."
    />
  );
}
