CREATE OR REPLACE VIEW vw_realtime_cc_kpis AS
SELECT
  c.referencia_data,
  c.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  c.tempo_cirurgia_min,
  c.tempo_sala_min,
  c.tempo_anestesia_min,
  c.altas_cc,
  c.obitos_cc,
  c.eletivas,
  c.urgencias
FROM fato_cc_operacional c
JOIN dim_unidade u ON u.id = c.unidade_id
WHERE c.referencia_data = (SELECT MAX(referencia_data) FROM fato_cc_operacional);
