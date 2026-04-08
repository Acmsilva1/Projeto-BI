CREATE OR REPLACE VIEW vw_realtime_kpi AS
SELECT
  k.referencia_data,
  k.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  k.taxa_ocupacao,
  k.tempo_medio_internacao,
  k.cirurgias_mes,
  k.taxa_readmissao,
  k.satisfacao_paciente,
  k.faturamento_mes,
  k.leitos_disponiveis,
  k.pacientes_ativos
FROM fato_kpi_snapshot k
JOIN dim_unidade u ON u.id = k.unidade_id
WHERE k.referencia_data = (SELECT MAX(referencia_data) FROM fato_kpi_snapshot);
