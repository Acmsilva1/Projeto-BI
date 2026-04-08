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
