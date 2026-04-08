CREATE OR REPLACE VIEW vw_realtime_cc_performance AS
SELECT
  c.referencia_data,
  c.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  c.atraso_30_min,
  c.ociosidade_sala,
  c.subutilizacao_filtrado,
  c.taxa_reabordagem,
  c.total_cirurgias
FROM fato_cc_performance c
JOIN dim_unidade u ON u.id = c.unidade_id
WHERE c.referencia_data = (SELECT MAX(referencia_data) FROM fato_cc_performance);
