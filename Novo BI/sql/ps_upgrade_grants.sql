-- Leitura via PostgREST (anon) — mesmo padrão das outras tabelas do projeto
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
