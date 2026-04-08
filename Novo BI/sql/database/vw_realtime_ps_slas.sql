CREATE OR REPLACE VIEW vw_realtime_ps_slas AS
SELECT
  s.referencia_data,
  s.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  s.categoria,
  s.total,
  s.acima,
  s.percentual,
  s.meta_minutos
FROM fato_ps_sla s
JOIN dim_unidade u ON u.id = s.unidade_id
WHERE s.referencia_data = (SELECT MAX(referencia_data) FROM fato_ps_sla);
