import React from 'react';
import MetasPorVolumesTable from '../MetasPorVolumesTable';

/** Visão Gerência — matriz “Metas por volumes” (GET /api/v1/gerencia/metas-por-volumes). */
export default function OverviewSection({ filters }) {
  return (
    <div className="flex flex-col gap-6">
      <MetasPorVolumesTable filters={filters} />
    </div>
  );
}
