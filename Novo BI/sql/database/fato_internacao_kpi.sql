CREATE TABLE IF NOT EXISTS fato_internacao_kpi (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  altas_acumuladas INTEGER NOT NULL,
  obitos_acumulados INTEGER NOT NULL,
  tempo_medio_permanencia NUMERIC(5,2) NOT NULL,
  taxa_readmissao NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id)
);
