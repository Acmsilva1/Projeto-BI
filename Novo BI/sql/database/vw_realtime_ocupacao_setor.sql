CREATE OR REPLACE VIEW vw_realtime_ocupacao_setor AS
SELECT
  o.referencia_data,
  o.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  o.setor,
  o.leitos_total,
  o.leitos_ocupados,
  o.percentual
FROM fato_ocupacao_setor o
JOIN dim_unidade u ON u.id = o.unidade_id
WHERE o.referencia_data = (SELECT MAX(referencia_data) FROM fato_ocupacao_setor);
