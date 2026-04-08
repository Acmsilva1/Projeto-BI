CREATE OR REPLACE VIEW vw_realtime_ps_kpis AS
SELECT
  p.referencia_data,
  p.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  p.tempo_permanencia_min,
  p.tempo_consulta_min,
  p.exames_total,
  p.medicacao_total,
  p.conversao_internacao,
  p.altas_ps,
  p.obitos_ps
FROM fato_ps_operacional p
JOIN dim_unidade u ON u.id = p.unidade_id
WHERE p.referencia_data = (SELECT MAX(referencia_data) FROM fato_ps_operacional);
