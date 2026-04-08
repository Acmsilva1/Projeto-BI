CREATE OR REPLACE VIEW vw_realtime_ps_perfil AS
SELECT
  p.referencia_data,
  p.unidade_id,
  u.regional,
  p.categoria AS perfil_categoria,
  p.valor_dimensao AS perfil_valor,
  p.quantidade
FROM fato_ps_perfil p
JOIN dim_unidade u ON u.id = p.unidade_id;
