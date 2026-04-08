CREATE OR REPLACE VIEW vw_realtime_financeiro_convenio AS
SELECT
  c.mes_ref,
  c.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  c.convenio,
  c.valor,
  c.cor_hex
FROM fato_financeiro_convenio c
JOIN dim_unidade u ON u.id = c.unidade_id
WHERE c.mes_ref = (SELECT MAX(mes_ref) FROM fato_financeiro_convenio);
