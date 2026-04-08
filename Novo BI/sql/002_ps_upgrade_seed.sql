-- Seed sintético PS upgrade — executar após CREATE das tabelas fato_ps_* e views.
-- Ajuste SET search_path se usar schema hospital_bi.

INSERT INTO fato_ps_perfil (referencia_data, unidade_id, categoria, valor_dimensao, quantidade)
SELECT d::date,
  u.id,
  c.cat,
  c.val,
  (50 + floor(random() * 800))::int
FROM generate_series(current_date - 35, current_date, '1 day'::interval) AS d
CROSS JOIN dim_unidade u
CROSS JOIN (
  VALUES
    ('faixa_etaria', '0-17'),
    ('faixa_etaria', '18-39'),
    ('faixa_etaria', '40-59'),
    ('faixa_etaria', '60+'),
    ('sexo', 'F'),
    ('sexo', 'M'),
    ('sexo', 'NI'),
    ('desfecho_medico', 'Alta'),
    ('desfecho_medico', 'Internação'),
    ('desfecho_medico', 'Transferência'),
    ('desfecho_medico', 'Óbito')
) AS c(cat, val)
ON CONFLICT (referencia_data, unidade_id, categoria, valor_dimensao) DO NOTHING;

INSERT INTO fato_ps_fluxo (referencia_data, unidade_id, dia_semana, hora, atendimentos, tempo_medio_min)
SELECT gs.d::date,
  u.id,
  (EXTRACT(DOW FROM gs.d::date))::smallint,
  h.h::smallint,
  (5 + floor(random() * 120))::int,
  (25 + random() * 95)::numeric(8, 2)
FROM generate_series(current_date - 35, current_date, '1 day'::interval) AS gs(d)
CROSS JOIN dim_unidade u
CROSS JOIN generate_series(7, 22) AS h(h)
WHERE random() > 0.35
ON CONFLICT (referencia_data, unidade_id, dia_semana, hora) DO NOTHING;

INSERT INTO fato_ps_medicacao (referencia_data, unidade_id, via, velocidade, medicamento, quantidade)
SELECT d::date,
  u.id,
  m.via,
  m.vel,
  m.med,
  (80 + floor(random() * 2500))::int
FROM generate_series(current_date - 35, current_date, '1 day'::interval) AS d
CROSS JOIN dim_unidade u
CROSS JOIN (
  VALUES
    ('EV', 'rápida', 'Dipirona'),
    ('EV', 'rápida', 'Ondansetrona'),
    ('EV', 'lenta', 'Ceftriaxona'),
    ('EV', 'lenta', 'Cloreto de sódio 0,9%'),
    ('VO', 'rápida', 'Paracetamol'),
    ('VO', 'lenta', 'IBP'),
    ('IM', 'rápida', 'Diclofenaco'),
    ('SC', 'rápida', 'Insulina regular'),
    ('EV', 'rápida', 'Metoclopramida'),
    ('EV', 'lenta', 'Omeprazol'),
    ('EV', 'rápida', 'Tramadol'),
    ('VO', 'rápida', 'Amoxicilina')
) AS m(via, vel, med)
WHERE random() > 0.2
ON CONFLICT (referencia_data, unidade_id, via, velocidade, medicamento) DO NOTHING;

INSERT INTO fato_ps_conversao_mensal (
  referencia_data, unidade_id, atendimentos, internacoes, taxa_conversao_pct, tempo_medio_ps_internacao_horas
)
SELECT (date_trunc('month', m)::date),
  u.id,
  a.att,
  i.intn,
  ROUND((i.intn::numeric / NULLIF(a.att, 0)) * 100, 2),
  ROUND((2.5 + random() * 12)::numeric, 2)
FROM generate_series(date_trunc('month', current_date - interval '11 months'), date_trunc('month', current_date), '1 month'::interval) AS m
CROSS JOIN dim_unidade u
CROSS JOIN LATERAL (
  SELECT
    (8000 + floor(random() * 22000))::int AS att,
    (200 + floor(random() * 1400))::int AS intn
) x
ON CONFLICT (referencia_data, unidade_id) DO NOTHING;
