-- ================================================================
-- Hospital BI MVC - Bootstrap PostgreSQL
-- Arquivo: sql/001_init_hospital_bi.sql
-- Objetivo: criar estrutura inicial + dados sinteticos minimos
-- ================================================================

CREATE SCHEMA IF NOT EXISTS hospital_bi;
SET search_path TO hospital_bi, public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- Dimensao de Unidades
-- =========================
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
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome,
    regional = EXCLUDED.regional,
    updated_at = NOW();

-- =========================
-- KPI geral
-- =========================
CREATE TABLE IF NOT EXISTS fato_kpi_snapshot (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT REFERENCES dim_unidade(id),
  regional CHAR(2),
  taxa_ocupacao NUMERIC(5,2) NOT NULL,
  tempo_medio_internacao NUMERIC(5,2) NOT NULL,
  cirurgias_mes INTEGER NOT NULL,
  taxa_readmissao NUMERIC(5,2) NOT NULL,
  satisfacao_paciente NUMERIC(5,2) NOT NULL,
  faturamento_mes NUMERIC(14,2) NOT NULL,
  leitos_disponiveis INTEGER NOT NULL,
  pacientes_ativos INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_ref ON fato_kpi_snapshot (referencia_data DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_unidade ON fato_kpi_snapshot (unidade_id);

INSERT INTO fato_kpi_snapshot (
  referencia_data, unidade_id, regional, taxa_ocupacao, tempo_medio_internacao,
  cirurgias_mes, taxa_readmissao, satisfacao_paciente, faturamento_mes,
  leitos_disponiveis, pacientes_ativos
)
SELECT
  CURRENT_DATE,
  u.id,
  u.regional,
  (70 + (random() * 25))::NUMERIC(5,2),
  (3 + (random() * 4))::NUMERIC(5,2),
  (150 + floor(random() * 220))::INT,
  (2 + (random() * 4))::NUMERIC(5,2),
  (84 + (random() * 12))::NUMERIC(5,2),
  (3000000 + (random() * 2500000))::NUMERIC(14,2),
  (15 + floor(random() * 20))::INT,
  (110 + floor(random() * 140))::INT
FROM dim_unidade u
WHERE NOT EXISTS (
  SELECT 1 FROM fato_kpi_snapshot k
  WHERE k.referencia_data = CURRENT_DATE
);

-- =========================
-- PS - Volumes, SLA e Matrix
-- =========================
CREATE TABLE IF NOT EXISTS fato_ps_volume (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  atendimentos INTEGER NOT NULL,
  exames_laboratoriais INTEGER NOT NULL,
  rx_ecg INTEGER NOT NULL,
  tc_us INTEGER NOT NULL,
  prescricoes INTEGER NOT NULL,
  evasoes INTEGER NOT NULL,
  conversao_internacao NUMERIC(5,2) NOT NULL,
  reavaliacoes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fato_ps_sla (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  categoria TEXT NOT NULL,
  total INTEGER NOT NULL,
  acima INTEGER NOT NULL,
  percentual NUMERIC(6,2) NOT NULL,
  meta_minutos INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, categoria)
);

CREATE TABLE IF NOT EXISTS fato_ps_matrix (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  triagem_percent NUMERIC(6,2) NOT NULL,
  consulta_percent NUMERIC(6,2) NOT NULL,
  medicacao_percent NUMERIC(6,2) NOT NULL,
  imagem_percent NUMERIC(6,2) NOT NULL,
  alta_percent NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id)
);

INSERT INTO fato_ps_volume (
  referencia_data, unidade_id, atendimentos, exames_laboratoriais, rx_ecg, tc_us,
  prescricoes, evasoes, conversao_internacao, reavaliacoes
)
SELECT
  CURRENT_DATE,
  u.id,
  (3000 + floor(random() * 9000))::INT,
  (2500 + floor(random() * 8000))::INT,
  (1200 + floor(random() * 3500))::INT,
  (450 + floor(random() * 1800))::INT,
  (2300 + floor(random() * 6000))::INT,
  (15 + floor(random() * 70))::INT,
  (7 + random() * 11)::NUMERIC(5,2),
  (400 + floor(random() * 1800))::INT
FROM dim_unidade u
WHERE NOT EXISTS (
  SELECT 1 FROM fato_ps_volume v
  WHERE v.referencia_data = CURRENT_DATE
);

INSERT INTO fato_ps_sla (
  referencia_data, unidade_id, categoria, total, acima, percentual, meta_minutos
)
SELECT
  CURRENT_DATE,
  u.id,
  c.categoria,
  c.total,
  c.acima,
  ROUND((c.acima::NUMERIC / NULLIF(c.total, 0)) * 100, 2),
  c.meta
FROM dim_unidade u
CROSS JOIN (
  VALUES
    ('triagem', 2200, 90, 12),
    ('consulta', 1700, 130, 90),
    ('medicacao', 3100, 200, 30),
    ('reavaliacao', 1800, 140, 45),
    ('rx_ecg', 2000, 260, 45),
    ('tc_us', 1300, 190, 60),
    ('permanencia', 1200, 210, 180)
) AS c(categoria, total, acima, meta)
ON CONFLICT (referencia_data, unidade_id, categoria) DO NOTHING;

INSERT INTO fato_ps_matrix (
  referencia_data, unidade_id, triagem_percent, consulta_percent,
  medicacao_percent, imagem_percent, alta_percent
)
SELECT
  CURRENT_DATE,
  u.id,
  (1 + random() * 14)::NUMERIC(6,2),
  (2 + random() * 20)::NUMERIC(6,2),
  (3 + random() * 18)::NUMERIC(6,2),
  (8 + random() * 30)::NUMERIC(6,2),
  (4 + random() * 16)::NUMERIC(6,2)
FROM dim_unidade u
ON CONFLICT (referencia_data, unidade_id) DO NOTHING;

-- =========================
-- Ocupacao / Internacoes
-- =========================
CREATE TABLE IF NOT EXISTS fato_ocupacao_setor (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  setor TEXT NOT NULL,
  leitos_total INTEGER NOT NULL,
  leitos_ocupados INTEGER NOT NULL,
  percentual NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, setor)
);

CREATE TABLE IF NOT EXISTS fato_internacao_kpi (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  altas_acumuladas INTEGER NOT NULL,
  obitos_acumulados INTEGER NOT NULL,
  tempo_medio_permanencia NUMERIC(5,2) NOT NULL,
  taxa_readmissao NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id)
);

CREATE TABLE IF NOT EXISTS fato_internacao (
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  paciente_ref TEXT NOT NULL,
  setor TEXT NOT NULL,
  convenio TEXT NOT NULL,
  dias_internacao INTEGER NOT NULL,
  data_entrada DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO fato_ocupacao_setor (
  referencia_data, unidade_id, setor, leitos_total, leitos_ocupados, percentual
)
SELECT
  CURRENT_DATE,
  u.id,
  s.setor,
  s.total,
  GREATEST(1, LEAST(s.total, (s.total * (0.65 + random() * 0.3))::INT)),
  0
FROM dim_unidade u
CROSS JOIN (
  VALUES
    ('UTI Adulto I', 12),
    ('UTI Adulto II', 10),
    ('Enfermaria 1 Andar', 24),
    ('Enfermaria 2 Andar', 24),
    ('Semicritico', 8)
) s(setor, total)
ON CONFLICT (referencia_data, unidade_id, setor) DO NOTHING;

UPDATE fato_ocupacao_setor
SET percentual = ROUND((leitos_ocupados::NUMERIC / NULLIF(leitos_total, 0)) * 100, 2)
WHERE referencia_data = CURRENT_DATE;

INSERT INTO fato_internacao_kpi (
  referencia_data, unidade_id, altas_acumuladas, obitos_acumulados,
  tempo_medio_permanencia, taxa_readmissao
)
SELECT
  CURRENT_DATE,
  u.id,
  (280 + floor(random() * 250))::INT,
  (4 + floor(random() * 12))::INT,
  (3.2 + random() * 3.8)::NUMERIC(5,2),
  (2.0 + random() * 5.0)::NUMERIC(5,2)
FROM dim_unidade u
ON CONFLICT (referencia_data, unidade_id) DO NOTHING;

INSERT INTO fato_internacao (
  id, unidade_id, paciente_ref, setor, convenio, dias_internacao, data_entrada, status
)
SELECT
  'INT-' || LPAD((100000 + gs)::TEXT, 6, '0'),
  u.id,
  'PAC-' || LPAD((50000 + gs)::TEXT, 5, '0'),
  (ARRAY['UTI Adulto I', 'UTI Adulto II', 'Enfermaria 1 Andar', 'Enfermaria 2 Andar', 'Semicritico'])[1 + floor(random() * 5)::INT],
  (ARRAY['MedSenior', 'SUS', 'Unimed', 'Bradesco Saude', 'Particular'])[1 + floor(random() * 5)::INT],
  (1 + floor(random() * 20))::INT,
  CURRENT_DATE - ((1 + floor(random() * 20))::INT),
  (ARRAY['Internado', 'Alta Programada', 'Aguardando Exame'])[1 + floor(random() * 3)::INT]
FROM generate_series(1, 120) gs
JOIN dim_unidade u ON u.id = (ARRAY['001','003','013','025','026','031','033','039','045'])[1 + (gs % 9)]
ON CONFLICT (id) DO NOTHING;

-- =========================
-- Financeiro
-- =========================
CREATE TABLE IF NOT EXISTS fato_financeiro_mensal (
  id BIGSERIAL PRIMARY KEY,
  mes_ref DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  receita NUMERIC(14,2) NOT NULL,
  despesa NUMERIC(14,2) NOT NULL,
  meta_receita NUMERIC(14,2) NOT NULL,
  glosa_percent NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mes_ref, unidade_id)
);

CREATE TABLE IF NOT EXISTS fato_financeiro_convenio (
  id BIGSERIAL PRIMARY KEY,
  mes_ref DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  convenio TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  cor_hex TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mes_ref, unidade_id, convenio)
);

CREATE TABLE IF NOT EXISTS fato_financeiro_glosa_motivo (
  id BIGSERIAL PRIMARY KEY,
  mes_ref DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  motivo TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mes_ref, unidade_id, motivo)
);

INSERT INTO fato_financeiro_mensal (mes_ref, unidade_id, receita, despesa, meta_receita, glosa_percent)
SELECT
  date_trunc('month', CURRENT_DATE)::DATE - (g.n || ' months')::INTERVAL,
  u.id,
  (3400000 + random() * 2100000)::NUMERIC(14,2),
  (2600000 + random() * 1800000)::NUMERIC(14,2),
  4500000,
  (2.2 + random() * 3.6)::NUMERIC(5,2)
FROM generate_series(0, 11) AS g(n)
CROSS JOIN dim_unidade u
ON CONFLICT (mes_ref, unidade_id) DO NOTHING;

INSERT INTO fato_financeiro_convenio (mes_ref, unidade_id, convenio, valor, cor_hex)
SELECT
  date_trunc('month', CURRENT_DATE)::DATE,
  u.id,
  c.convenio,
  c.valor,
  c.cor
FROM dim_unidade u
CROSS JOIN (
  VALUES
    ('SUS', 2100000, '#3b82f6'),
    ('Unimed', 980000, '#22c55e'),
    ('Bradesco Saude', 720000, '#f59e0b'),
    ('Amil', 560000, '#ef4444'),
    ('SulAmerica', 480000, '#8b5cf6'),
    ('Particular', 310000, '#06b6d4'),
    ('Outros', 210000, '#94a3b8')
) c(convenio, valor, cor)
ON CONFLICT (mes_ref, unidade_id, convenio) DO NOTHING;

INSERT INTO fato_financeiro_glosa_motivo (mes_ref, unidade_id, motivo, valor)
SELECT
  date_trunc('month', CURRENT_DATE)::DATE,
  u.id,
  g.motivo,
  g.valor
FROM dim_unidade u
CROSS JOIN (
  VALUES
    ('Documentacao Incompleta', 128000),
    ('Codigo Incorreto (TUSS)', 97000),
    ('Prazo Expirado', 73000),
    ('Procedimento Nao Autorizado', 52000),
    ('Outros', 37420)
) g(motivo, valor)
ON CONFLICT (mes_ref, unidade_id, motivo) DO NOTHING;

-- =========================
-- Cirurgia / CC
-- =========================
CREATE TABLE IF NOT EXISTS fato_cirurgia_especialidade (
  id BIGSERIAL PRIMARY KEY,
  mes_ref DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  especialidade TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  meta INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mes_ref, unidade_id, especialidade)
);

CREATE TABLE IF NOT EXISTS fato_cirurgia_evolucao (
  id BIGSERIAL PRIMARY KEY,
  mes_ref DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  eletivas INTEGER NOT NULL,
  urgencias INTEGER NOT NULL,
  meta INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mes_ref, unidade_id)
);

CREATE TABLE IF NOT EXISTS fato_cirurgia_tempo_dia (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  dia_semana SMALLINT NOT NULL,
  media_tempo_min INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, dia_semana)
);

CREATE TABLE IF NOT EXISTS fato_cirurgia_heatmap (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  hora_label TEXT NOT NULL,
  dia_semana SMALLINT NOT NULL,
  utilizacao_percent NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id, hora_label, dia_semana)
);

CREATE TABLE IF NOT EXISTS fato_cc_performance (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  atraso_30_min NUMERIC(6,2) NOT NULL,
  ociosidade_sala NUMERIC(6,2) NOT NULL,
  subutilizacao_filtrado INTEGER NOT NULL,
  taxa_reabordagem NUMERIC(6,2) NOT NULL,
  total_cirurgias INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id)
);

CREATE TABLE IF NOT EXISTS fato_cc_timeline_evento (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  nr_cirurgia TEXT NOT NULL,
  sala_nome TEXT NOT NULL,
  sequencia SMALLINT NOT NULL,
  evento_nome TEXT NOT NULL,
  evento_data TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO fato_cirurgia_especialidade (mes_ref, unidade_id, especialidade, quantidade, meta)
SELECT
  date_trunc('month', CURRENT_DATE)::DATE,
  u.id,
  e.especialidade,
  e.quantidade,
  40
FROM dim_unidade u
CROSS JOIN (
  VALUES
    ('Ortopedia', 68),
    ('Geral', 54),
    ('Cardiologia', 42),
    ('Neurologia', 31),
    ('Urologia', 27),
    ('Ginecologia', 45),
    ('Oftalmologia', 22),
    ('Vascular', 23)
) e(especialidade, quantidade)
ON CONFLICT (mes_ref, unidade_id, especialidade) DO NOTHING;

INSERT INTO fato_cirurgia_evolucao (mes_ref, unidade_id, eletivas, urgencias, meta)
SELECT
  date_trunc('month', CURRENT_DATE)::DATE - (g.n || ' months')::INTERVAL,
  u.id,
  (150 + floor(random() * 100))::INT,
  (60 + floor(random() * 55))::INT,
  280
FROM generate_series(0, 11) g(n)
CROSS JOIN dim_unidade u
ON CONFLICT (mes_ref, unidade_id) DO NOTHING;

INSERT INTO fato_cirurgia_tempo_dia (referencia_data, unidade_id, dia_semana, media_tempo_min)
SELECT
  CURRENT_DATE,
  u.id,
  d.dia,
  d.tempo
FROM dim_unidade u
CROSS JOIN (
  VALUES
    (1, 245), (2, 210), (3, 260), (4, 220), (5, 195), (6, 180), (7, 90)
) d(dia, tempo)
ON CONFLICT (referencia_data, unidade_id, dia_semana) DO NOTHING;

INSERT INTO fato_cirurgia_heatmap (referencia_data, unidade_id, hora_label, dia_semana, utilizacao_percent)
SELECT
  CURRENT_DATE,
  u.id,
  h.hora,
  d.dia,
  (10 + random() * 90)::NUMERIC(5,2)
FROM dim_unidade u
CROSS JOIN (VALUES ('07h'), ('08h'), ('09h'), ('10h'), ('11h'), ('12h'), ('13h'), ('14h')) h(hora)
CROSS JOIN (VALUES (1), (2), (3), (4), (5), (6), (7)) d(dia)
ON CONFLICT (referencia_data, unidade_id, hora_label, dia_semana) DO NOTHING;

INSERT INTO fato_cc_performance (
  referencia_data, unidade_id, atraso_30_min, ociosidade_sala,
  subutilizacao_filtrado, taxa_reabordagem, total_cirurgias
)
SELECT
  CURRENT_DATE,
  u.id,
  (5 + random() * 12)::NUMERIC(6,2),
  (10 + random() * 18)::NUMERIC(6,2),
  (120 + floor(random() * 260))::INT,
  (1.5 + random() * 3.0)::NUMERIC(6,2),
  (180 + floor(random() * 260))::INT
FROM dim_unidade u
ON CONFLICT (referencia_data, unidade_id) DO NOTHING;

INSERT INTO fato_cc_timeline_evento (
  referencia_data, unidade_id, nr_cirurgia, sala_nome, sequencia, evento_nome, evento_data
)
SELECT
  CURRENT_DATE,
  u.id,
  'CC-' || u.id || '-' || s.sala_num,
  'SALA ' || LPAD(s.sala_num::TEXT, 2, '0'),
  e.seq,
  e.nome,
  date_trunc('day', NOW()) + INTERVAL '7 hours' + (s.sala_num * INTERVAL '20 minutes') + e.offset_min
FROM dim_unidade u
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) s(sala_num)
CROSS JOIN (
  VALUES
    (5, 'INICIO SALA', INTERVAL '0 minute'),
    (6, 'INICIO ANESTESIA', INTERVAL '25 minute'),
    (12, 'INICIO CIRURGIA', INTERVAL '55 minute'),
    (14, 'FIM CIRURGIA', INTERVAL '150 minute'),
    (7, 'SAIDA SALA', INTERVAL '185 minute')
) e(seq, nome, offset_min)
WHERE NOT EXISTS (
  SELECT 1 FROM fato_cc_timeline_evento t
  WHERE t.referencia_data = CURRENT_DATE
);

-- =========================
-- VIEWS para graficos e realtime
-- =========================

-- KPI (realtime por unidade)
CREATE OR REPLACE VIEW vw_realtime_kpi AS
SELECT
  k.referencia_data,
  k.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  k.taxa_ocupacao,
  k.tempo_medio_internacao,
  k.cirurgias_mes,
  k.taxa_readmissao,
  k.satisfacao_paciente,
  k.faturamento_mes,
  k.leitos_disponiveis,
  k.pacientes_ativos
FROM fato_kpi_snapshot k
JOIN dim_unidade u ON u.id = k.unidade_id
WHERE k.referencia_data = (SELECT MAX(referencia_data) FROM fato_kpi_snapshot);

-- PS
CREATE OR REPLACE VIEW vw_realtime_ps_volumes AS
SELECT
  v.referencia_data,
  v.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  v.atendimentos,
  v.exames_laboratoriais,
  v.rx_ecg,
  v.tc_us,
  v.prescricoes,
  v.evasoes,
  v.conversao_internacao,
  v.reavaliacoes
FROM fato_ps_volume v
JOIN dim_unidade u ON u.id = v.unidade_id
WHERE v.referencia_data = (SELECT MAX(referencia_data) FROM fato_ps_volume);

CREATE OR REPLACE VIEW vw_realtime_ps_slas AS
SELECT
  s.referencia_data,
  s.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  s.categoria,
  s.total,
  s.acima,
  s.percentual,
  s.meta_minutos
FROM fato_ps_sla s
JOIN dim_unidade u ON u.id = s.unidade_id
WHERE s.referencia_data = (SELECT MAX(referencia_data) FROM fato_ps_sla);

CREATE OR REPLACE VIEW vw_realtime_ps_matrix AS
SELECT
  m.referencia_data,
  m.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  m.triagem_percent,
  m.consulta_percent,
  m.medicacao_percent,
  m.imagem_percent,
  m.alta_percent
FROM fato_ps_matrix m
JOIN dim_unidade u ON u.id = m.unidade_id
WHERE m.referencia_data = (SELECT MAX(referencia_data) FROM fato_ps_matrix);

-- Ocupacao / internacoes
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

CREATE OR REPLACE VIEW vw_realtime_internacao_kpis AS
SELECT
  k.referencia_data,
  k.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  k.altas_acumuladas,
  k.obitos_acumulados,
  k.tempo_medio_permanencia,
  k.taxa_readmissao
FROM fato_internacao_kpi k
JOIN dim_unidade u ON u.id = k.unidade_id
WHERE k.referencia_data = (SELECT MAX(referencia_data) FROM fato_internacao_kpi);

CREATE OR REPLACE VIEW vw_realtime_internacoes AS
SELECT
  i.id,
  i.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  i.paciente_ref,
  i.setor,
  i.convenio,
  i.dias_internacao,
  i.data_entrada,
  i.status
FROM fato_internacao i
JOIN dim_unidade u ON u.id = i.unidade_id;

-- Simulacao de tendencia de ocupacao (30 dias) para graficos de linha
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

-- Simulacao de qualidade (6 meses)
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

-- Financeiro
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

CREATE OR REPLACE VIEW vw_realtime_financeiro_glosa_motivo AS
SELECT
  g.mes_ref,
  g.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  g.motivo,
  g.valor
FROM fato_financeiro_glosa_motivo g
JOIN dim_unidade u ON u.id = g.unidade_id
WHERE g.mes_ref = (SELECT MAX(mes_ref) FROM fato_financeiro_glosa_motivo);

-- Cirurgia
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

CREATE OR REPLACE VIEW vw_realtime_cirurgia_tempo_semana AS
SELECT
  t.referencia_data,
  t.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  t.dia_semana,
  t.media_tempo_min
FROM fato_cirurgia_tempo_dia t
JOIN dim_unidade u ON u.id = t.unidade_id
WHERE t.referencia_data = (SELECT MAX(referencia_data) FROM fato_cirurgia_tempo_dia);

CREATE OR REPLACE VIEW vw_realtime_cirurgia_heatmap AS
SELECT
  h.referencia_data,
  h.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  h.hora_label,
  h.dia_semana,
  h.utilizacao_percent
FROM fato_cirurgia_heatmap h
JOIN dim_unidade u ON u.id = h.unidade_id
WHERE h.referencia_data = (SELECT MAX(referencia_data) FROM fato_cirurgia_heatmap);

-- CC detalhado
CREATE OR REPLACE VIEW vw_realtime_cc_performance AS
SELECT
  c.referencia_data,
  c.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  c.atraso_30_min,
  c.ociosidade_sala,
  c.subutilizacao_filtrado,
  c.taxa_reabordagem,
  c.total_cirurgias
FROM fato_cc_performance c
JOIN dim_unidade u ON u.id = c.unidade_id
WHERE c.referencia_data = (SELECT MAX(referencia_data) FROM fato_cc_performance);

CREATE OR REPLACE VIEW vw_realtime_cc_timeline AS
SELECT
  t.referencia_data,
  t.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  t.nr_cirurgia,
  t.sala_nome,
  t.sequencia,
  t.evento_nome,
  t.evento_data
FROM fato_cc_timeline_evento t
JOIN dim_unidade u ON u.id = t.unidade_id
WHERE t.referencia_data = (SELECT MAX(referencia_data) FROM fato_cc_timeline_evento)
ORDER BY t.unidade_id, t.nr_cirurgia, t.sequencia;

-- =========================
-- Complementos Operacionais (PS / CC / Internacao)
-- =========================
ALTER TABLE fato_internacao
  ADD COLUMN IF NOT EXISTS perfil_assistencial TEXT,
  ADD COLUMN IF NOT EXISTS origem_paciente TEXT;

UPDATE fato_internacao
SET perfil_assistencial = CASE
  WHEN perfil_assistencial IS NULL THEN CASE WHEN random() < 0.55 THEN 'CLINICO' ELSE 'CIRURGICO' END
  ELSE perfil_assistencial
END,
origem_paciente = CASE
  WHEN origem_paciente IS NULL THEN CASE WHEN random() < 0.6 THEN 'INTERNO' ELSE 'EXTERNO' END
  ELSE origem_paciente
END
WHERE perfil_assistencial IS NULL OR origem_paciente IS NULL;

-- Garante presenca de obito na internacao para mtricas
UPDATE fato_internacao
SET status = 'Obito'
WHERE id IN (
  SELECT id
  FROM fato_internacao
  ORDER BY id
  LIMIT 6
);

CREATE TABLE IF NOT EXISTS fato_ps_operacional (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  tempo_permanencia_min NUMERIC(8,2) NOT NULL,
  tempo_consulta_min NUMERIC(8,2) NOT NULL,
  exames_total INTEGER NOT NULL,
  medicacao_total INTEGER NOT NULL,
  conversao_internacao NUMERIC(6,2) NOT NULL,
  altas_ps INTEGER NOT NULL,
  obitos_ps INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id)
);

INSERT INTO fato_ps_operacional (
  referencia_data,
  unidade_id,
  tempo_permanencia_min,
  tempo_consulta_min,
  exames_total,
  medicacao_total,
  conversao_internacao,
  altas_ps,
  obitos_ps
)
SELECT
  CURRENT_DATE,
  u.id,
  (135 + random() * 90)::NUMERIC(8,2), -- 2h15 a 3h45
  (45 + random() * 70)::NUMERIC(8,2),  -- 45 a 115 min
  (2500 + floor(random() * 8500))::INT,
  (1800 + floor(random() * 6500))::INT,
  (8 + random() * 10)::NUMERIC(6,2),
  (450 + floor(random() * 1000))::INT,
  (3 + floor(random() * 30))::INT
FROM dim_unidade u
ON CONFLICT (referencia_data, unidade_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS fato_cc_operacional (
  id BIGSERIAL PRIMARY KEY,
  referencia_data DATE NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES dim_unidade(id),
  tempo_cirurgia_min NUMERIC(8,2) NOT NULL,
  tempo_sala_min NUMERIC(8,2) NOT NULL,
  tempo_anestesia_min NUMERIC(8,2) NOT NULL,
  altas_cc INTEGER NOT NULL,
  obitos_cc INTEGER NOT NULL,
  eletivas INTEGER NOT NULL,
  urgencias INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referencia_data, unidade_id)
);

INSERT INTO fato_cc_operacional (
  referencia_data,
  unidade_id,
  tempo_cirurgia_min,
  tempo_sala_min,
  tempo_anestesia_min,
  altas_cc,
  obitos_cc,
  eletivas,
  urgencias
)
SELECT
  CURRENT_DATE,
  u.id,
  (95 + random() * 70)::NUMERIC(8,2),
  (130 + random() * 85)::NUMERIC(8,2),
  (30 + random() * 35)::NUMERIC(8,2),
  (70 + floor(random() * 190))::INT,
  (1 + floor(random() * 10))::INT,
  (120 + floor(random() * 170))::INT,
  (45 + floor(random() * 110))::INT
FROM dim_unidade u
ON CONFLICT (referencia_data, unidade_id) DO NOTHING;

CREATE OR REPLACE VIEW vw_realtime_ps_kpis AS
SELECT
  p.referencia_data,
  p.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  p.tempo_permanencia_min,
  p.tempo_consulta_min,
  p.exames_total,
  p.medicacao_total,
  p.conversao_internacao,
  p.altas_ps,
  p.obitos_ps
FROM fato_ps_operacional p
JOIN dim_unidade u ON u.id = p.unidade_id
WHERE p.referencia_data = (SELECT MAX(referencia_data) FROM fato_ps_operacional);

CREATE OR REPLACE VIEW vw_realtime_cc_kpis AS
SELECT
  c.referencia_data,
  c.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  c.tempo_cirurgia_min,
  c.tempo_sala_min,
  c.tempo_anestesia_min,
  c.altas_cc,
  c.obitos_cc,
  c.eletivas,
  c.urgencias
FROM fato_cc_operacional c
JOIN dim_unidade u ON u.id = c.unidade_id
WHERE c.referencia_data = (SELECT MAX(referencia_data) FROM fato_cc_operacional);

CREATE OR REPLACE VIEW vw_realtime_internacao_resumo AS
SELECT
  i.unidade_id,
  u.nome AS unidade_nome,
  u.regional,
  COUNT(*)::INT AS qtd_internacoes,
  COUNT(*) FILTER (WHERE i.status ILIKE '%Alta%')::INT AS altas,
  COUNT(*) FILTER (WHERE i.status = 'Obito')::INT AS obitos,
  COUNT(*) FILTER (WHERE i.perfil_assistencial = 'CLINICO')::INT AS pacientes_clinicos,
  COUNT(*) FILTER (WHERE i.perfil_assistencial = 'CIRURGICO')::INT AS pacientes_cirurgicos,
  COUNT(*) FILTER (WHERE i.origem_paciente = 'INTERNO')::INT AS pacientes_internos,
  COUNT(*) FILTER (WHERE i.origem_paciente = 'EXTERNO')::INT AS pacientes_externos
FROM fato_internacao i
JOIN dim_unidade u ON u.id = i.unidade_id
GROUP BY i.unidade_id, u.nome, u.regional;

-- =========================
-- Compatibilidade Supabase API (schema public)
-- =========================
CREATE OR REPLACE VIEW public.vw_realtime_kpi AS SELECT * FROM hospital_bi.vw_realtime_kpi;
CREATE OR REPLACE VIEW public.vw_realtime_ps_volumes AS SELECT * FROM hospital_bi.vw_realtime_ps_volumes;
CREATE OR REPLACE VIEW public.vw_realtime_ps_slas AS SELECT * FROM hospital_bi.vw_realtime_ps_slas;
CREATE OR REPLACE VIEW public.vw_realtime_ps_matrix AS SELECT * FROM hospital_bi.vw_realtime_ps_matrix;
CREATE OR REPLACE VIEW public.vw_realtime_ps_kpis AS SELECT * FROM hospital_bi.vw_realtime_ps_kpis;
CREATE OR REPLACE VIEW public.vw_realtime_ocupacao_setor AS SELECT * FROM hospital_bi.vw_realtime_ocupacao_setor;
CREATE OR REPLACE VIEW public.vw_realtime_internacao_kpis AS SELECT * FROM hospital_bi.vw_realtime_internacao_kpis;
CREATE OR REPLACE VIEW public.vw_realtime_internacoes AS SELECT * FROM hospital_bi.vw_realtime_internacoes;
CREATE OR REPLACE VIEW public.vw_realtime_internacao_resumo AS SELECT * FROM hospital_bi.vw_realtime_internacao_resumo;
CREATE OR REPLACE VIEW public.vw_grafico_ocupacao_tendencia_30d AS SELECT * FROM hospital_bi.vw_grafico_ocupacao_tendencia_30d;
CREATE OR REPLACE VIEW public.vw_grafico_ocupacao_qualidade_6m AS SELECT * FROM hospital_bi.vw_grafico_ocupacao_qualidade_6m;
CREATE OR REPLACE VIEW public.vw_grafico_financeiro_resumo_12m AS SELECT * FROM hospital_bi.vw_grafico_financeiro_resumo_12m;
CREATE OR REPLACE VIEW public.vw_realtime_financeiro_convenio AS SELECT * FROM hospital_bi.vw_realtime_financeiro_convenio;
CREATE OR REPLACE VIEW public.vw_realtime_financeiro_glosa_motivo AS SELECT * FROM hospital_bi.vw_realtime_financeiro_glosa_motivo;
CREATE OR REPLACE VIEW public.vw_realtime_cirurgia_especialidade AS SELECT * FROM hospital_bi.vw_realtime_cirurgia_especialidade;
CREATE OR REPLACE VIEW public.vw_grafico_cirurgia_evolucao_12m AS SELECT * FROM hospital_bi.vw_grafico_cirurgia_evolucao_12m;
CREATE OR REPLACE VIEW public.vw_realtime_cirurgia_tempo_semana AS SELECT * FROM hospital_bi.vw_realtime_cirurgia_tempo_semana;
CREATE OR REPLACE VIEW public.vw_realtime_cirurgia_heatmap AS SELECT * FROM hospital_bi.vw_realtime_cirurgia_heatmap;
CREATE OR REPLACE VIEW public.vw_realtime_cc_performance AS SELECT * FROM hospital_bi.vw_realtime_cc_performance;
CREATE OR REPLACE VIEW public.vw_realtime_cc_timeline AS SELECT * FROM hospital_bi.vw_realtime_cc_timeline;
CREATE OR REPLACE VIEW public.vw_realtime_cc_kpis AS SELECT * FROM hospital_bi.vw_realtime_cc_kpis;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA hospital_bi TO anon, authenticated;



