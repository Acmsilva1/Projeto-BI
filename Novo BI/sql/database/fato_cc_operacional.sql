CREATE TABLE IF NOT EXISTS fato_cc_operacional (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  tempo_cirurgia_min NUMERIC(8,2) NOT NULL,
  tempo_sala_min NUMERIC(8,2) NOT NULL,
  tempo_anestesia_min NUMERIC(8,2) NOT NULL,
  altas_cc INTEGER NOT NULL,
  obitos_cc INTEGER NOT NULL,
  eletivas INTEGER NOT NULL,
  urgencias INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id)
);
