CREATE OR REPLACE VIEW vw_realtime_internacao_kpis AS
SELECT
  k.referencia_data,
  k.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  k.altas_acumuladas,
  k.obitos_acumulados,
  k.tempo_medio_permanencia,
  k.taxa_readmissao
FROM fato_internacao_kpi k
JOIN dim_unidade u ON u.id = k.unidade_id
WHERE k.referencia_data = (SELECT MAX(referencia_data) FROM fato_internacao_kpi);
