-- Conversão PS × internação por mês (referencia_data = primeiro dia do mês)
CREATE TABLE IF NOT EXISTS fato_ps_conversao_mensal (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  atendimentos INTEGER NOT NULL,
  internacoes INTEGER NOT NULL,
  taxa_conversao_pct NUMERIC(6,2) NOT NULL,
  tempo_medio_ps_internacao_horas NUMERIC(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_ps_conv_ref ON fato_ps_conversao_mensal (referencia_data DESC);
CREATE INDEX IF NOT EXISTS idx_ps_conv_unidade ON fato_ps_conversao_mensal (unidade_id);
