/**
 * Acesso ao Postgres via Supabase PostgREST.
 *
 * Contrato: cada "view" já reflete ETL/agregação no banco. Este módulo só
 * aplica filtros HTTP e faz SELECT — sem lógica pesada de BI aqui.
 */
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const dbHost = process.env.DB_HOST;
const dbPort = Number(process.env.DB_PORT || 5432);
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_READ_USER || process.env.DB_WRITE_USER;
const dbPassword = process.env.DB_READ_PASSWORD || process.env.DB_WRITE_PASSWORD;
const sslMode = String(process.env.PGSSLMODE || '').toLowerCase();
const pool = dbHost && dbName && dbUser && dbPassword
  ? new Pool({
      host: dbHost,
      port: dbPort,
      database: dbName,
      user: dbUser,
      password: dbPassword,
      ssl: sslMode === 'require' ? { rejectUnauthorized: false } : undefined,
      max: 10,
    })
  : null;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (!pool && !supabase) {
  throw new Error(
    'Config de banco ausente. Defina DB_HOST/DB_NAME/DB_READ_USER/DB_READ_PASSWORD no .env.',
  );
}

function quoteIdent(id) {
  const s = String(id || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) throw new Error(`Identificador invalido: ${s}`);
  return `"${s}"`;
}

function sanitizeColumns(columns) {
  const raw = String(columns || '*').trim();
  if (raw === '*') return '*';
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => quoteIdent(c))
    .join(', ');
}

function periodStartFrom(filters = {}) {
  const days = Number(filters.period);
  if (!Number.isFinite(days) || days <= 0) return null;
  if (days === 365) {
    const n = new Date();
    return new Date(n.getFullYear(), 0, 1).toISOString().slice(0, 10);
  }
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function applyFilters(builder, filters = {}, options = {}) {
  const { includePeriod = true } = options;
  if (filters.unidade) builder = builder.eq('unidade_id', filters.unidade);
  if (filters.regional) builder = builder.eq('regional', filters.regional);
  if (filters.setor) builder = builder.ilike('setor', `%${filters.setor}%`);
  if (filters.convenio) builder = builder.eq('convenio', filters.convenio);
  if (filters.status) builder = builder.eq('status', filters.status);
  if (includePeriod) {
    const isoDate = periodStartFrom(filters);
    if (isoDate) builder = builder.gte('referencia_data', isoDate);
  }
  return builder;
}

function buildPgWhere(filters = {}, includePeriod = true) {
  const clauses = [];
  const params = [];
  let p = 1;
  if (filters.unidade) {
    clauses.push(`unidade_id = $${p}`);
    params.push(String(filters.unidade));
    p += 1;
  }
  if (filters.regional) {
    clauses.push(`regional = $${p}`);
    params.push(String(filters.regional));
    p += 1;
  }
  if (filters.setor) {
    clauses.push(`setor ILIKE $${p}`);
    params.push(`%${String(filters.setor)}%`);
    p += 1;
  }
  if (filters.convenio) {
    clauses.push(`convenio = $${p}`);
    params.push(String(filters.convenio));
    p += 1;
  }
  if (filters.status) {
    clauses.push(`status = $${p}`);
    params.push(String(filters.status));
    p += 1;
  }
  if (includePeriod) {
    const start = periodStartFrom(filters);
    if (start) {
      clauses.push(`referencia_data >= $${p}`);
      params.push(start);
    }
  }
  return { clauses, params };
}

async function fetchView(viewName, filters = {}, options = {}) {
  const {
    columns = '*',
    orderBy,
    ascending = true,
    limit,
  } = options;

  if (pool) {
    const table = quoteIdent(viewName);
    const cols = sanitizeColumns(columns);
    const runPg = async (withPeriod) => {
      const { clauses, params } = buildPgWhere(filters, withPeriod);
      const whereSql = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
      const orderSql = orderBy ? ` ORDER BY ${quoteIdent(orderBy)} ${ascending ? 'ASC' : 'DESC'}` : '';
      const lim = Number(limit);
      const limitSql = Number.isFinite(lim) && lim > 0 ? ` LIMIT ${Math.floor(lim)}` : '';
      const sql = `SELECT ${cols} FROM ${table}${whereSql}${orderSql}${limitSql}`;
      const res = await pool.query(sql, params);
      return res.rows || [];
    };
    try {
      return await runPg(true);
    } catch (error) {
      const msg = String(error.message || '').toLowerCase();
      if (filters.period && msg.includes('referencia_data') && msg.includes('column')) {
        return runPg(false);
      }
      throw new Error(`Postgres ${viewName}: ${error.message}`);
    }
  }

  if (!supabase) {
    throw new Error('Sem conexão ativa com banco.');
  }

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
  pool,
  supabase,
  fetchView,
};


