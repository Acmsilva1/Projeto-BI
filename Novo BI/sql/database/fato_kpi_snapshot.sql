CREATE TABLE IF NOT EXISTS fato_kpi_snapshot (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT REFERENCES dim_unidade(id),
  regional CHAR(2),
  taxa_ocupacao NUMERIC(5,2) NOT NULL,
  tempo_medio_internacao NUMERIC(5,2) NOT NULL,
  cirurgias_mes INTEGER NOT NULL,
  taxa_readmissao NUMERIC(5,2) NOT NULL,
  satisfacao_paciente NUMERIC(5,2) NOT NULL,
  faturamento_mes NUMERIC(14,2) NOT NULL,
  leitos_disponiveis INTEGER NOT NULL,
  pacientes_ativos INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
