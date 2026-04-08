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
