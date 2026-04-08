CREATE TABLE IF NOT EXISTS fato_ocupacao_setor (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  setor TEXT NOT NULL,
  leitos_total INTEGER NOT NULL,
  leitos_ocupados INTEGER NOT NULL,
  percentual NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, setor)
);
