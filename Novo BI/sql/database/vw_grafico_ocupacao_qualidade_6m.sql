CREATE OR REPLACE VIEW vw_grafico_ocupacao_qualidade_6m AS
WITH meses AS (
  SELECT (date_trunc('month', CURRENT_DATE)::DATE - (g.n || ' months')::INTERVAL)::DATE AS mes_ref
  FROM generate_series(0, 5) g(n)
)
SELECT
  m.mes_ref,
  (1.7 + (EXTRACT(MONTH FROM m.mes_ref)::INT % 4) * 0.2)::NUMERIC(5,2) AS infeccao_hospitalar,
  (0.5 + (EXTRACT(MONTH FROM m.mes_ref)::INT % 3) * 0.1)::NUMERIC(5,2) AS quedas,
  (0.8 + (EXTRACT(MONTH FROM m.mes_ref)::INT % 4) * 0.1)::NUMERIC(5,2) AS ulceras_pressao,
  (86 + (EXTRACT(MONTH FROM m.mes_ref)::INT % 10))::NUMERIC(5,2) AS nps,
  2.0::NUMERIC(5,2) AS meta,
  90.0::NUMERIC(5,2) AS meta_nps
FROM meses m
ORDER BY m.mes_ref;
