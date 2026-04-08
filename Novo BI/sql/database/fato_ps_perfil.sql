-- Perfil PS agregado (faixa etária, sexo, desfecho médico) — dados agregados para LGPD
CREATE TABLE IF NOT EXISTS fato_ps_perfil (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  categoria TEXT NOT NULL,
  valor_dimensao TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, categoria, valor_dimensao)
);

CREATE INDEX IF NOT EXISTS idx_ps_perfil_ref ON fato_ps_perfil (referencia_data DESC);
CREATE INDEX IF NOT EXISTS idx_ps_perfil_unidade ON fato_ps_perfil (unidade_id);
