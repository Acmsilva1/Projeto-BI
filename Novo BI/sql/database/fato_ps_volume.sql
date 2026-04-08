CREATE TABLE IF NOT EXISTS fato_ps_volume (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  atendimentos INTEGER NOT NULL,
  exames_laboratoriais INTEGER NOT NULL,
  rx_ecg INTEGER NOT NULL,
  tc_us INTEGER NOT NULL,
  prescricoes INTEGER NOT NULL,
  evasoes INTEGER NOT NULL,
  conversao_internacao NUMERIC(5,2) NOT NULL,
  reavaliacoes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
