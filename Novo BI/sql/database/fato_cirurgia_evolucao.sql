CREATE TABLE IF NOT EXISTS fato_cirurgia_evolucao (
  id BIGSERIAL PRIMARY KEY,
  mes_ref DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  eletivas INTEGER NOT NULL,
  urgencias INTEGER NOT NULL,
  meta INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mes_ref, unidade_id)
);
