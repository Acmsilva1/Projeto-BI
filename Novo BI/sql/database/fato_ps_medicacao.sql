-- Medicação PS: via, velocidade (rápida/lenta), item e quantidade
CREATE TABLE IF NOT EXISTS fato_ps_medicacao (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  via TEXT NOT NULL,
  velocidade TEXT NOT NULL,
  medicamento TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, via, velocidade, medicamento)
);

CREATE INDEX IF NOT EXISTS idx_ps_med_ref ON fato_ps_medicacao (referencia_data DESC);
CREATE INDEX IF NOT EXISTS idx_ps_med_unidade ON fato_ps_medicacao (unidade_id);
