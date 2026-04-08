CREATE OR REPLACE VIEW vw_realtime_internacoes AS
SELECT
  i.id,
  i.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  i.paciente_ref,
  i.setor,
  i.convenio,
  i.dias_internacao,
  i.data_entrada,
  i.status
FROM fato_internacao i
JOIN dim_unidade u ON u.id = i.unidade_id;
