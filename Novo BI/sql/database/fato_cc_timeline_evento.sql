CREATE TABLE IF NOT EXISTS fato_cc_timeline_evento (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  nr_cirurgia TEXT NOT NULL,
  sala_nome TEXT NOT NULL,
  sequencia SMALLINT NOT NULL,
  evento_nome TEXT NOT NULL,
  evento_data TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
