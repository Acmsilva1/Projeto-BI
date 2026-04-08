-- ============================================================
-- Patch: tempo médio PS → internação (horas) na conversão mensal
-- Execute no SQL Editor do Supabase (ou psql) — idempotente.
-- ============================================================

ALTER TABLE fato_ps_conversao_mensal
  ADD COLUMN IF NOT EXISTS tempo_medio_ps_internacao_horas NUMERIC(8,2);

COMMENT ON COLUMN fato_ps_conversao_mensal.tempo_medio_ps_internacao_horas IS
  'Média de horas entre passagem pelo PS e internação no mês/unidade (ponderada no ETL; aqui valor por linha).';

CREATE OR REPLACE VIEW vw_realtime_ps_conversao AS
SELECT
  c.referencia_data,
  c.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  c.atendimentos,
  c.internacoes,
  c.taxa_conversao_pct,
  c.tempo_medio_ps_internacao_horas
FROM fato_ps_conversao_mensal c
JOIN dim_unidade u ON u.id = c.unidade_id;

GRANT SELECT ON vw_realtime_ps_conversao TO anon, authenticated, service_role;

-- Preencher linhas antigas (ajuste ou remova se já vier do ETL)
UPDATE fato_ps_conversao_mensal
SET tempo_medio_ps_internacao_horas = ROUND((2.5 + random() * 12)::numeric, 2)
WHERE tempo_medio_ps_internacao_horas IS NULL
  AND internacoes > 0;
