# Hospital BI - Projeto-BI

Indicadores e Visao Gerencia (React + Vite + API Express/TypeScript).

Documentacao tecnica para agentes e implementacao:
- [agents.md](./agents.md) (fonte unica para agentes)

## Quickstart local com DuckDB (recomendado)

1. Instalar dependencias:

```bash
cd BACKEND && npm install
cd ../FRONTEND && npm install
```

2. Configurar `.env` (na raiz ou em `BACKEND/.env`):

```env
DATA_SOURCE=duckdb
CSV_DATOS_DIR=dados
DUCKDB_PATH=db local/hospital_bi.duckdb
HOSPITAL_BI_API_PORT=3020
```

3. Subir frontend + backend em dev:

```bash
cd FRONTEND
npm run dev
```

4. Verificar stack:
- `GET /api/v1/_meta/stack`
- esperado: `data_source = "duckdb"` e `duckdb_local = true`

## Cache progressivo da Gerencia

Com DuckDB/CSV local, o Node agora orquestra cache em ondas:

1. `GET /api/v1/gerencia/aperitivo` entrega um JSON rapido de 7 dias.
2. Primeira onda aquece 30 dias.
3. Segunda onda (10 min depois) aquece 60 dias.
4. A tela da Gerencia limita o filtro para ate 60 dias.

Isso reduz carga no banco local e melhora o tempo de resposta inicial.

Persistencia no navegador:
- respostas da Gerencia ficam em `localStorage` por URL+filtros (cache por usuario/dispositivo)
- primeiro acesso populariza cache local; acessos seguintes priorizam cache local antes de nova ida ao backend

## Licenca / uso

Uso interno do projeto BI; ajustar conforme politica da organizacao.
