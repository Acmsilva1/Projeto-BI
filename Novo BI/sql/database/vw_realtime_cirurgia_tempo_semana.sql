CREATE OR REPLACE VIEW vw_realtime_cirurgia_tempo_semana AS
SELECT
  t.referencia_data,
  t.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  t.dia_semana,
  t.media_tempo_min
FROM fato_cirurgia_tempo_dia t
JOIN dim_unidade u ON u.id = t.unidade_id
WHERE t.referencia_data = (SELECT MAX(referencia_data) FROM fato_cirurgia_tempo_dia);
