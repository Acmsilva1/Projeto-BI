/**
 * Smoke: força modo CSV (ignora Postgres no .env) e carrega o bundle Gerência.
 * Uso: npx tsx scripts/smoke-csv-gerencia.ts
 */
import '../src/config/loadEnv.js';

for (const k of ['DATABASE_URL', 'PGHOST', 'PG_HOST', 'DB_HOST']) {
  delete process.env[k];
}
process.env.DATA_SOURCE = 'csv';
if (!String(process.env.GERENCIA_MESSAGING_DEBUG || '').trim()) {
  process.env.GERENCIA_MESSAGING_DEBUG = '1';
}

const { registerGerenciaDataSliceMessaging } = await import('../src/messaging/registerGerenciaDataSliceMessaging.js');
registerGerenciaDataSliceMessaging();

const { loadGerenciaDatasets } = await import('../src/repositories/gerenciaRepository.js');

const t0 = Date.now();
const ds = await loadGerenciaDatasets({ period: 90 });
console.log(
  JSON.stringify(
    {
      ms: Date.now() - t0,
      flux: ds.fluxRows.length,
      med: ds.medRows.length,
      lab: ds.labRows.length,
      rx: ds.rxRows.length,
      tcus: ds.tcusRows.length,
      reav: ds.reavRows.length,
      altas: ds.altasRows.length,
      conv: ds.convRows.length,
      vias: ds.viasRows.length,
      meta: ds.metasRows.length,
      sampleFluxKeys: ds.fluxRows[0] ? Object.keys(ds.fluxRows[0]).slice(0, 6) : [],
    },
    null,
    2,
  ),
);
