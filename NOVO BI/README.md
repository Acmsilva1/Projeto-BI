# NOVO BI

Base TypeScript com:

- `backend/`: API Node + Express (MVC enxuto)
- `frontend/`: React + Vite + Tailwind + shadcn/ui + Framer Motion
- `dados/`: arquivos CSV de origem

## Requisitos

- Node.js 22+
- npm 10+

## Instalacao

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

## Execucao

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Endpoints

- `GET /api/v1/health`
- `GET /api/v1/ping`
- `GET /api/v1/data/views`
- `GET /api/v1/data/view/:viewName?limit=100`
- `GET /api/v1/dashboard/slugs`
- `GET /api/v1/dashboard/:slug?limit=200`
- `GET /api/v1/dashboard/gerencial-filtros?period=7|15|30|60|90&regional=...&unidade=...`
- `GET /api/v1/dashboard/gerencial-kpis-topo?period=7|15|30|60|90&regional=...&unidade=...`
- `GET /api/v1/dashboard/gerencial-unidades-ranking?period=7|15|30|60|90&regional=...&unidade=...&limit=...`
- `GET /api/v1/ps-heatmap/chegadas?mes=YYYY-MM&unidade=...&regional=...&limit=...` — agregado dia × hora para o mapa de calor (JSON por padrao; Arrow com `Accept` ou `?format=arrow`)

## Variaveis De Ambiente

- `CSV_DATA_DIR`
  - default: `../dados` (a partir de `backend/`)
- `DATA_GATEWAY`
  - valores: `csv-memory` ou `duckdb`
  - default: `csv-memory`
- `DUCKDB_PATH`
  - default: `:memory:`
  - usado quando `DATA_GATEWAY=duckdb`

## Gateways De Dados

### `csv-memory`

- Carrega CSV em memoria e calcula agregacoes no Node.
- Hoje e o modo recomendado para producao neste projeto.

### `duckdb`

- Registra views para os CSVs e tenta executar consultas pelo DuckDB.
- Tem fallback automatico para `csv-memory` em caso de erro.
- `health` mostra estado real em `duckdb.status` e `dataGateway`.

## Transporte Apache Arrow

Endpoints de linhas suportam Arrow para reduzir payload:

- Content-Type: `application/vnd.apache.arrow.stream`
- Ativacao:
  - query: `?format=arrow`
  - ou header: `Accept: application/vnd.apache.arrow.stream`

No frontend, o cliente tenta Arrow por padrao e faz fallback para JSON.

## Estado Atual Da Migracao

### Fase 1

- `/data/views` e `/data/view/:viewName` com suporte DuckDB + fallback.

### Fase 2

- Slugs com caminho DuckDB implementado:
  - `gerencial-filtros`
  - `gerencial-kpis-topo`
  - `gerencial-unidades-ranking`
- Fallback para `csv-memory` mantido.

## Benchmark (snapshot local em 2026-04-22)

Script:

- `backend/scripts/benchmark-format-once.mjs`

Cenario comparativo executado (`json`, 12s, concorrencia 8):

- `csv-memory` mix: `428.24 req/s`, `p95 29.55ms`
- `duckdb` mix: `0.17 req/s`, `p95 45770.45ms`
- `csv-memory` heavy: `495.75 req/s`, `p95 36.29ms`
- `duckdb` heavy: `0.10 req/s`, `p95 78475.90ms`

Interpretacao:

- No estado atual, `duckdb` ainda nao esta performatico para alta carga neste projeto.
- Manter `DATA_GATEWAY=csv-memory` ate a proxima etapa de materializacao/cache no DuckDB.

## Como Rodar Benchmark

Exemplos:

```bash
# csv-memory
BENCH_DURATION_SECONDS=12 BENCH_CONCURRENCY=8 DATA_GATEWAY=csv-memory node backend/scripts/benchmark-format-once.mjs json mix

# duckdb
BENCH_DURATION_SECONDS=12 BENCH_CONCURRENCY=8 DATA_GATEWAY=duckdb node backend/scripts/benchmark-format-once.mjs json mix
```

No PowerShell, use:

```powershell
$env:BENCH_DURATION_SECONDS='12'
$env:BENCH_CONCURRENCY='8'
$env:DATA_GATEWAY='csv-memory'
node backend/scripts/benchmark-format-once.mjs json mix
```
