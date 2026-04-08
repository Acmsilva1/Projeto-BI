CREATE TABLE IF NOT EXISTS fato_ps_operacional (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  tempo_permanencia_min NUMERIC(8,2) NOT NULL,
  tempo_consulta_min NUMERIC(8,2) NOT NULL,
  exames_total INTEGER NOT NULL,
  medicacao_total INTEGER NOT NULL,
  conversao_internacao NUMERIC(6,2) NOT NULL,
  altas_ps INTEGER NOT NULL,
  obitos_ps INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id)
);
