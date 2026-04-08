CREATE TABLE IF NOT EXISTS fato_cirurgia_tempo_dia (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  dia_semana SMALLINT NOT NULL,
  media_tempo_min INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, dia_semana)
);
