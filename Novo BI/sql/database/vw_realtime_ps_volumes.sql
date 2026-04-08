CREATE OR REPLACE VIEW vw_realtime_ps_volumes AS
SELECT
  v.referencia_data,
  v.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  v.atendimentos,
  v.exames_laboratoriais,
  v.rx_ecg,
  v.tc_us,
  v.prescricoes,
  v.evasoes,
  v.conversao_internacao,
  v.reavaliacoes
FROM fato_ps_volume v
JOIN dim_unidade u ON u.id = v.unidade_id
WHERE v.referencia_data = (SELECT MAX(referencia_data) FROM fato_ps_volume);
