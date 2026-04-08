CREATE OR REPLACE VIEW vw_realtime_ps_fluxos AS
SELECT
  f.referencia_data,
  f.unidade_id,
  u.regional,
  f.dia_semana,
  f.hora AS hora_dia,
  f.atendimentos,
  f.tempo_medio_min
FROM fato_ps_fluxo f
JOIN dim_unidade u ON u.id = f.unidade_id;
