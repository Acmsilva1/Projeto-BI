CREATE OR REPLACE VIEW vw_realtime_ps_medicacao AS
SELECT
  m.referencia_data,
  m.unidade_id,
  u.regional,
  m.via,
  m.velocidade,
  m.medicamento,
  m.quantidade
FROM fato_ps_medicacao m
JOIN dim_unidade u ON u.id = m.unidade_id;
