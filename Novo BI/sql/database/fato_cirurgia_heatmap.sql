CREATE TABLE IF NOT EXISTS fato_cirurgia_heatmap (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  hora_label TEXT NOT NULL,
  dia_semana SMALLINT NOT NULL,
  utilizacao_percent NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, hora_label, dia_semana)
);
