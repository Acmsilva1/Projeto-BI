CREATE TABLE IF NOT EXISTS fato_ps_matrix (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  triagem_percent NUMERIC(6,2) NOT NULL,
  consulta_percent NUMERIC(6,2) NOT NULL,
  medicacao_percent NUMERIC(6,2) NOT NULL,
  imagem_percent NUMERIC(6,2) NOT NULL,
  alta_percent NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id)
);
