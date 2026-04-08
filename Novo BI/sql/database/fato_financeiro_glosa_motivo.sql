CREATE TABLE IF NOT EXISTS fato_financeiro_glosa_motivo (
  id BIGSERIAL PRIMARY KEY,
  mes_ref DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  motivo TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mes_ref, unidade_id, motivo)
);
