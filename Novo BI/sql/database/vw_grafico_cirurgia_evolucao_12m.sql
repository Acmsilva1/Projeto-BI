CREATE OR REPLACE VIEW vw_grafico_cirurgia_evolucao_12m AS
SELECT
  e.mes_ref,
  e.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  e.eletivas,
  e.urgencias,
  e.meta
FROM fato_cirurgia_evolucao e
JOIN dim_unidade u ON u.id = e.unidade_id
WHERE e.mes_ref >= (date_trunc('month', CURRENT_DATE)::DATE - INTERVAL '11 months')
ORDER BY e.mes_ref, e.unidade_id;
