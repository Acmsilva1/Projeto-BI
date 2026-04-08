CREATE OR REPLACE VIEW vw_realtime_ps_matrix AS
SELECT
  m.referencia_data,
  m.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  m.triagem_percent,
  m.consulta_percent,
  m.medicacao_percent,
  m.imagem_percent,
  m.alta_percent
FROM fato_ps_matrix m
JOIN dim_unidade u ON u.id = m.unidade_id
WHERE m.referencia_data = (SELECT MAX(referencia_data) FROM fato_ps_matrix);
