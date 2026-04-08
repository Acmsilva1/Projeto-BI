CREATE TABLE IF NOT EXISTS fato_financeiro_mensal (
  id BIGSERIAL PRIMARY KEY,
  mes_ref DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  receita NUMERIC(14,2) NOT NULL,
  despesa NUMERIC(14,2) NOT NULL,
  meta_receita NUMERIC(14,2) NOT NULL,
  glosa_percent NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mes_ref, unidade_id)
);
