# Hospital BI - Projeto-BI

## agents.md (unico, minusculas)

Na raiz deste repositorio, ao lado deste `doc.md`, existe apenas `agents.md`.
Ele e a unica fonte de contexto para agentes de codigo (IA) e detalhe de implementacao.

- Conteudo completo: [agents.md](./agents.md)
- Nao ha `AGENTS.md` nem outro ficheiro paralelo de agentes.

## Nota de operacao atual

O backend agora suporta fonte local via DuckDB:

```env
DATA_SOURCE=duckdb
CSV_DATOS_DIR=dados
DUCKDB_PATH=db local/hospital_bi.duckdb
```

Validacao:
- `GET /api/v1/_meta/stack`
- `data_source = duckdb`
- `duckdb_local = true`

Cache progressivo da Gerencia:
- `GET /api/v1/gerencia/aperitivo` (7 dias)
- aquecimento 30 dias na primeira onda
- aquecimento 60 dias apos 10 minutos
- filtro de periodo da Gerencia limitado a 60 dias na UI

## Licenca / uso

Uso interno do projeto BI; ajustar conforme politica da organizacao.
