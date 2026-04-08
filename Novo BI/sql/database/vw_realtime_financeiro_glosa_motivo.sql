CREATE OR REPLACE VIEW vw_realtime_financeiro_glosa_motivo AS
SELECT
  g.mes_ref,
  g.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  g.motivo,
  g.valor
FROM fato_financeiro_glosa_motivo g
JOIN dim_unidade u ON u.id = g.unidade_id
WHERE g.mes_ref = (SELECT MAX(mes_ref) FROM fato_financeiro_glosa_motivo);
