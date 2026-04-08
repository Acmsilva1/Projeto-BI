CREATE OR REPLACE VIEW vw_realtime_cirurgia_heatmap AS
SELECT
  h.referencia_data,
  h.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  h.hora_label,
  h.dia_semana,
  h.utilizacao_percent
FROM fato_cirurgia_heatmap h
JOIN dim_unidade u ON u.id = h.unidade_id
WHERE h.referencia_data = (SELECT MAX(referencia_data) FROM fato_cirurgia_heatmap);
