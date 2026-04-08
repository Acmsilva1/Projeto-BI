CREATE TABLE IF NOT EXISTS fato_ps_sla (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  categoria TEXT NOT NULL,
  total INTEGER NOT NULL,
  acima INTEGER NOT NULL,
  percentual NUMERIC(6,2) NOT NULL,
  meta_minutos INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, categoria)
);
