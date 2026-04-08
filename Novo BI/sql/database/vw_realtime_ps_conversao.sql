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
