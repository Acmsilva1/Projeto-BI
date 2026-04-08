CREATE TABLE IF NOT EXISTS fato_cc_performance (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  atraso_30_min NUMERIC(6,2) NOT NULL,
  ociosidade_sala NUMERIC(6,2) NOT NULL,
  subutilizacao_filtrado INTEGER NOT NULL,
  taxa_reabordagem NUMERIC(6,2) NOT NULL,
  total_cirurgias INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id)
);
