-- ============================================================
-- Hospital BI — PS upgrade para Supabase (inclui dim_unidade)
-- Cole tudo no SQL Editor e execute de uma vez.
-- ============================================================

-- 1) Dimensão unidade (obrigatória para FKs e views)
CREATE TABLE IF NOT EXISTS dim_unidade (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  regional CHAR(2) NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO dim_unidade (id, nome, regional) VALUES
  ('001', 'PS HOSPITAL VITORIA_ES', 'ES'),
  ('003', 'PS VILA VELHA_ES', 'ES'),
  ('013', 'PS SIG_DF', 'DF'),
  ('025', 'PS BARRA DA TIJUCA_RJ', 'RJ'),
  ('026', 'PS BOTAFOGO_RJ', 'RJ'),
  ('031', 'PS GUTIERREZ_MG', 'MG'),
  ('033', 'PS PAMPULHA_MG', 'MG'),
  ('039', 'PS TAGUATINGA_DF', 'DF'),
  ('045', 'PS CAMPO GRANDE_RJ', 'RJ')
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  regional = EXCLUDED.regional,
  updated_at = NOW();

ALTER TABLE dim_unidade DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON dim_unidade TO anon, authenticated, service_role;

-- 2) Fatos PS upgrade
CREATE TABLE IF NOT EXISTS fato_ps_perfil (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  categoria TEXT NOT NULL,
  valor_dimensao TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, categoria, valor_dimensao)
);
CREATE INDEX IF NOT EXISTS idx_ps_perfil_ref ON fato_ps_perfil (referencia_data DESC);
CREATE INDEX IF NOT EXISTS idx_ps_perfil_unidade ON fato_ps_perfil (unidade_id);

CREATE TABLE IF NOT EXISTS fato_ps_fluxo (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora SMALLINT NOT NULL CHECK (hora BETWEEN 0 AND 23),
  atendimentos INTEGER NOT NULL,
  tempo_medio_min NUMERIC(8,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, dia_semana, hora)
);
CREATE INDEX IF NOT EXISTS idx_ps_fluxo_ref ON fato_ps_fluxo (referencia_data DESC);
CREATE INDEX IF NOT EXISTS idx_ps_fluxo_unidade ON fato_ps_fluxo (unidade_id);

CREATE TABLE IF NOT EXISTS fato_ps_medicacao (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  via TEXT NOT NULL,
  velocidade TEXT NOT NULL,
  medicamento TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, via, velocidade, medicamento)
);
CREATE INDEX IF NOT EXISTS idx_ps_med_ref ON fato_ps_medicacao (referencia_data DESC);
CREATE INDEX IF NOT EXISTS idx_ps_med_unidade ON fato_ps_medicacao (unidade_id);

CREATE TABLE IF NOT EXISTS fato_ps_conversao_mensal (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  atendimentos INTEGER NOT NULL,
  internacoes INTEGER NOT NULL,
  taxa_conversao_pct NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id)
);
ALTER TABLE fato_ps_conversao_mensal
  ADD COLUMN IF NOT EXISTS tempo_medio_ps_internacao_horas NUMERIC(8,2);
CREATE INDEX IF NOT EXISTS idx_ps_conv_ref ON fato_ps_conversao_mensal (referencia_data DESC);
CREATE INDEX IF NOT EXISTS idx_ps_conv_unidade ON fato_ps_conversao_mensal (unidade_id);

-- 3) Views
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

CREATE OR REPLACE VIEW vw_realtime_ps_fluxos AS
SELECT
  f.referencia_data,
  f.unidade_id,
  u.regional,
  f.dia_semana,
  f.hora AS hora_dia,
  f.atendimentos,
  f.tempo_medio_min
FROM fato_ps_fluxo f
JOIN dim_unidade u ON u.id = f.unidade_id;

CREATE OR REPLACE VIEW vw_realtime_ps_medicacao AS
SELECT
  m.referencia_data,
  m.unidade_id,
  u.regional,
  m.via,
  m.velocidade,
  m.medicamento,
  m.quantidade
FROM fato_ps_medicacao m
JOIN dim_unidade u ON u.id = m.unidade_id;

CREATE OR REPLACE VIEW vw_realtime_ps_conversao AS
SELECT
  c.referencia_data,
  c.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  c.atendimentos,
  c.internacoes,
  c.taxa_conversao_pct,
  c.tempo_medio_ps_internacao_horas
FROM fato_ps_conversao_mensal c
JOIN dim_unidade u ON u.id = c.unidade_id;

-- 4) Permissões API
ALTER TABLE IF EXISTS fato_ps_perfil DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fato_ps_fluxo DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fato_ps_medicacao DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fato_ps_conversao_mensal DISABLE ROW LEVEL SECURITY;

GRANT SELECT ON fato_ps_perfil TO anon, authenticated, service_role;
GRANT SELECT ON fato_ps_fluxo TO anon, authenticated, service_role;
GRANT SELECT ON fato_ps_medicacao TO anon, authenticated, service_role;
GRANT SELECT ON fato_ps_conversao_mensal TO anon, authenticated, service_role;
GRANT SELECT ON vw_realtime_ps_perfil TO anon, authenticated, service_role;
GRANT SELECT ON vw_realtime_ps_fluxos TO anon, authenticated, service_role;
GRANT SELECT ON vw_realtime_ps_medicacao TO anon, authenticated, service_role;
GRANT SELECT ON vw_realtime_ps_conversao TO anon, authenticated, service_role;

-- 5) Seed sintético (opcional)
INSERT INTO fato_ps_perfil (referencia_data, unidade_id, categoria, valor_dimensao, quantidade)
SELECT d::date, u.id, c.cat, c.val, (50 + floor(random() * 800))::int
FROM generate_series(current_date - 35, current_date, '1 day'::interval) AS d
CROSS JOIN dim_unidade u
CROSS JOIN (
  VALUES
    ('faixa_etaria', '0-17'), ('faixa_etaria', '18-39'), ('faixa_etaria', '40-59'), ('faixa_etaria', '60+'),
    ('sexo', 'F'), ('sexo', 'M'), ('sexo', 'NI'),
    ('desfecho_medico', 'Alta'), ('desfecho_medico', 'Internação'),
    ('desfecho_medico', 'Transferência'), ('desfecho_medico', 'Óbito')
) AS c(cat, val)
ON CONFLICT (referencia_data, unidade_id, categoria, valor_dimensao) DO NOTHING;

INSERT INTO fato_ps_fluxo (referencia_data, unidade_id, dia_semana, hora, atendimentos, tempo_medio_min)
SELECT gs.d::date, u.id, (EXTRACT(DOW FROM gs.d::date))::smallint, h.h::smallint,
  (5 + floor(random() * 120))::int, (25 + random() * 95)::numeric(8, 2)
FROM generate_series(current_date - 35, current_date, '1 day'::interval) AS gs(d)
CROSS JOIN dim_unidade u
CROSS JOIN generate_series(7, 22) AS h(h)
WHERE random() > 0.35
ON CONFLICT (referencia_data, unidade_id, dia_semana, hora) DO NOTHING;

INSERT INTO fato_ps_medicacao (referencia_data, unidade_id, via, velocidade, medicamento, quantidade)
SELECT d::date, u.id, m.via, m.vel, m.med, (80 + floor(random() * 2500))::int
FROM generate_series(current_date - 35, current_date, '1 day'::interval) AS d
CROSS JOIN dim_unidade u
CROSS JOIN (
  VALUES
    ('EV', 'rápida', 'Dipirona'), ('EV', 'rápida', 'Ondansetrona'), ('EV', 'lenta', 'Ceftriaxona'),
    ('EV', 'lenta', 'Cloreto de sódio 0,9%'), ('VO', 'rápida', 'Paracetamol'), ('VO', 'lenta', 'IBP'),
    ('IM', 'rápida', 'Diclofenaco'), ('SC', 'rápida', 'Insulina regular'), ('EV', 'rápida', 'Metoclopramida'),
    ('EV', 'lenta', 'Omeprazol'), ('EV', 'rápida', 'Tramadol'), ('VO', 'rápida', 'Amoxicilina')
) AS m(via, vel, med)
WHERE random() > 0.2
ON CONFLICT (referencia_data, unidade_id, via, velocidade, medicamento) DO NOTHING;

INSERT INTO fato_ps_conversao_mensal (
  referencia_data, unidade_id, atendimentos, internacoes, taxa_conversao_pct, tempo_medio_ps_internacao_horas
)
SELECT (date_trunc('month', m)::date), u.id, x.att, x.intn,
  ROUND((x.intn::numeric / NULLIF(x.att, 0)) * 100, 2),
  ROUND((2.5 + random() * 12)::numeric, 2)
FROM generate_series(date_trunc('month', current_date - interval '11 months'), date_trunc('month', current_date), '1 month'::interval) AS m
CROSS JOIN dim_unidade u
CROSS JOIN LATERAL (
  SELECT (8000 + floor(random() * 22000))::int AS att, (200 + floor(random() * 1400))::int AS intn
) x
ON CONFLICT (referencia_data, unidade_id) DO NOTHING;
