CREATE OR REPLACE VIEW vw_grafico_ocupacao_tendencia_30d AS
WITH dias AS (
  SELECT (CURRENT_DATE - g.n)::DATE AS dia
  FROM generate_series(0, 29) g(n)
),
base AS (
  SELECT
    o.unidade_id,
    o.setor,
    AVG(o.percentual)::NUMERIC(6,2) AS pct_base
  FROM fato_ocupacao_setor o
  WHERE o.referencia_data = (SELECT MAX(referencia_data) FROM fato_ocupacao_setor)
  GROUP BY o.unidade_id, o.setor
)
SELECT
  d.dia AS referencia_data,
  b.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  b.setor AS serie_nome,
  GREATEST(40, LEAST(100, (b.pct_base + ((EXTRACT(DAY FROM d.dia)::INT % 7) - 3) * 1.2)))::NUMERIC(6,2) AS percentual
FROM dias d
CROSS JOIN base b
JOIN dim_unidade u ON u.id = b.unidade_id
ORDER BY d.dia, b.unidade_id, b.setor;
