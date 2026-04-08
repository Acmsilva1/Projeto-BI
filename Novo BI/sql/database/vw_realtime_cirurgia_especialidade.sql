CREATE OR REPLACE VIEW vw_realtime_cirurgia_especialidade AS
SELECT
  c.mes_ref,
  c.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  c.especialidade,
  c.quantidade,
  c.meta
FROM fato_cirurgia_especialidade c
JOIN dim_unidade u ON u.id = c.unidade_id
WHERE c.mes_ref = (SELECT MAX(mes_ref) FROM fato_cirurgia_especialidade);
