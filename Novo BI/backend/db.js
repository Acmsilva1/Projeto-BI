/**
 * Acesso ao Postgres via Supabase PostgREST.
 *
 * Contrato: cada "view" já reflete ETL/agregação no banco. Este módulo só
 * aplica filtros HTTP e faz SELECT — sem lógica pesada de BI aqui.
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Config Supabase ausente. Defina SUPABASE_URL e SUPABASE_KEY no .env.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

function applyFilters(builder, filters = {}, options = {}) {
  const { includePeriod = true } = options;
  if (filters.unidade) builder = builder.eq('unidade_id', filters.unidade);
  if (filters.regional) builder = builder.eq('regional', filters.regional);
  if (filters.setor) builder = builder.ilike('setor', `%${filters.setor}%`);
  if (filters.convenio) builder = builder.eq('convenio', filters.convenio);
  if (filters.status) builder = builder.eq('status', filters.status);
  if (includePeriod && filters.period) {
    const days = Number(filters.period);
    if (!Number.isNaN(days) && days > 0) {
      const start = new Date();
      start.setDate(start.getDate() - days);
      const isoDate = start.toISOString().slice(0, 10);
      builder = builder.gte('referencia_data', isoDate);
    }
  }
  return builder;
}

async function fetchView(viewName, filters = {}, options = {}) {
  const {
    columns = '*',
    orderBy,
    ascending = true,
    limit,
  } = options;

  const runQuery = async (withPeriod) => {
    let builder = supabase.from(viewName).select(columns);
    builder = applyFilters(builder, filters, { includePeriod: withPeriod });

    if (orderBy) builder = builder.order(orderBy, { ascending });
    if (limit) builder = builder.limit(limit);

    return builder;
  };
  let { data, error } = await runQuery(true);
  if (error && filters.period) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('referencia_data') && msg.includes('column')) {
      ({ data, error } = await runQuery(false));
    }
  }
  if (error) throw new Error(`Supabase ${viewName}: ${error.message}`);
  return data || [];
}

module.exports = {
  supabase,
  fetchView,
};


