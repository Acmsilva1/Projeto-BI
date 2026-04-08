-- Fluxo PS: volume e tempo médio por dia da semana × hora
CREATE TABLE IF NOT EXISTS fato_ps_fluxo (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora SMALLINT NOT NULL CHECK (hora BETWEEN 0 AND 23),
  atendimentos INTEGER NOT NULL,
  tempo_medio_min NUMERIC(8,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, dia_semana, hora)
);

CREATE INDEX IF NOT EXISTS idx_ps_fluxo_ref ON fato_ps_fluxo (referencia_data DESC);
CREATE INDEX IF NOT EXISTS idx_ps_fluxo_unidade ON fato_ps_fluxo (unidade_id);
