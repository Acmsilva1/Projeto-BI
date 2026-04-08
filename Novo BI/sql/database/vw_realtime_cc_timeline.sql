CREATE OR REPLACE VIEW vw_realtime_cc_timeline AS
SELECT
  t.referencia_data,
  t.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  t.nr_cirurgia,
  t.sala_nome,
  t.sequencia,
  t.evento_nome,
  t.evento_data
FROM fato_cc_timeline_evento t
JOIN dim_unidade u ON u.id = t.unidade_id
WHERE t.referencia_data = (SELECT MAX(referencia_data) FROM fato_cc_timeline_evento)
ORDER BY t.unidade_id, t.nr_cirurgia, t.sequencia;
