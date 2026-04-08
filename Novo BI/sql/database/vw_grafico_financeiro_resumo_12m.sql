CREATE OR REPLACE VIEW vw_grafico_financeiro_resumo_12m AS
SELECT
  f.mes_ref,
  f.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  f.receita,
  f.despesa,
  f.meta_receita,
  f.glosa_percent
FROM fato_financeiro_mensal f
JOIN dim_unidade u ON u.id = f.unidade_id
WHERE f.mes_ref >= (date_trunc('month', CURRENT_DATE)::DATE - INTERVAL '11 months')
ORDER BY f.mes_ref, f.unidade_id;
