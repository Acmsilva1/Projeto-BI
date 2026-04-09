import React from 'react';
import ModuleShell from '../ModuleShell';

/** Consome JSON em /api/v1/ps/*. */
export default function PsSection() {
  return (
    <ModuleShell
      title="Pronto Socorro"
      subtitle="Monte os GET /api/v1/ps/volumes, kpis, slas, matrix, perfil, fluxos, medicacao, conversao retornando { ok, data }."
    />
  );
}
