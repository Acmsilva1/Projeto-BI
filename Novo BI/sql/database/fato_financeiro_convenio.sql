CREATE TABLE IF NOT EXISTS fato_financeiro_convenio (
  id BIGSERIAL PRIMARY KEY,
  mes_ref DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  convenio TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  cor_hex TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mes_ref, unidade_id, convenio)
);
