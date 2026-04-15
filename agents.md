# Hospital BI — guia para agentes (Cursor / IA)

Este ficheiro resume a arquitetura atual do **Projeto-BI** para não repetir contexto em cada conversa.

## O que é o projeto

- **Frontend:** React 19 + Vite + Tailwind + ECharts (`web/`). Consome JSON em **`/api/v1/*`** (proxy do Vite em dev).
- **Backend:** **FastAPI** em Python, organizado em **três pacotes na raiz** + `requirements.txt`.
- **Legado Node:** Express + `live_service.js` e tooling Node (seeds, launch/wait da API) em **`node_legado/`** — **não** é o motor da API em produção no fluxo normal.

## Pastas Python (raiz do repositório)

| Pacote | Responsabilidade |
|--------|-------------------|
| **`bi_core/`** | `config` (`.env`), PostgreSQL (`db_pg`, `LOGICAL_TO_TABLE`), Redis (`cache_redis`), Polars (`polars_transform`). |
| **`bi_gerencia/`** | Regras e agregações da **visão Gerência**: `LiveService`, `datasets`, `metrics`, `constants`, `util`. Paridade histórica com `node_legado/api/live_service.js`. |
| **`bi_api/`** | `main.py` (rotas FastAPI), `bundle_service.py` (Redis + view JSON opcional + `LiveService`), `start.ps1`, `scripts/refresh_gerencia_bundle_cache.py`. |

**Imports:** sempre a partir da raiz do repo, com **`PYTHONPATH`** = raiz (ou equivalente). Ex.: `from bi_core.config import load_env`, `from bi_gerencia import LiveService`, `from bi_api.bundle_service import get_gerencia_dashboard_bundle`.

**Módulo ASGI:** `bi_api.main:app`.

## Como correr

- **Stack completa (recomendado):** `cd web` → `npm run dev` — sobe **uvicorn** (`launch-api-python.cjs` define `PYTHONPATH` e `bi_api.main:app`) e **Vite** na porta do `VITE_PORT` / proxy `/api`.
- **Só API Python:** na raiz, `.\bi_api\start.ps1` **ou** `set PYTHONPATH=%CD%` e `python -m uvicorn bi_api.main:app --host 127.0.0.1 --port 3020` (Linux/macOS: `export PYTHONPATH=$(pwd)`).
- **Pré-aquecer Redis do bundle Gerência:** com `PYTHONPATH` na raiz, `python bi_api/scripts/refresh_gerencia_bundle_cache.py --period 90` (exige `REDIS_URL` ativo).

Porta API: **`HOSPITAL_BI_API_PORT`** (padrão **3020**). Não usar `PORT` genérico do `.env` para confundir com outras apps.

## Variáveis de ambiente (resumo)

- **Postgres:** `DATABASE_URL` ou `PGHOST` / `DB_HOST` + credenciais (`bi_core/db_pg.py`).
- **Redis:** `REDIS_URL`; desligar com `REDIS_DISABLED=1`.
- **Bundle pré-calculado (opcional):** `GERENCIA_BUNDLE_JSON_VIEW` (schema.view com coluna JSON).
- **Filtro SQL Gerência:** `GERENCIA_SQL_DATE_FILTER` (vazio = ativo; `0` = desligado).
- **`.env`:** `load_env()` em `bi_core/config.py` lê `node_legado/pipeline/.env`, `bi_api/.env` (se existir) e **`.env` na raiz** (override).

## Rotas HTTP

- Prefixo **`/api/v1/`** — KPI, Gerência (totais, metas, tabelas, `dashboard-bundle`), PS, Financeiro, Ocupação, Cirurgia, CC.
- **`/health`**, **`/api/v1/_meta/stack`** — diagnóstico.
- Respostas de dados: **`{ "ok": true, "data": ... }`** nas rotas com `@_route_json` (exceto `dashboard-bundle` que devolve `ok`/`data` no handler).

## Frontend

- Base API: `web/src/utils/apiBase.js` — em dev usa **`/api/v1`** (proxy para a porta da API).
- **Não** alterar layout/visual por defeito se o pedido for só backend ou dados.

## `node_legado/` (Node)

- **`node_legado/api/`** — Express + `live_service.js` (referência).
- **`node_legado/scripts/`** — seeds SQLite (`node node_legado/scripts/seed-*.js` a partir da raiz).
- **`node_legado/web-dev/`** — `launch-api-python.cjs`, `wait-api.cjs` (usados pelo `npm run dev` em `web/`).
- **`node_legado/pipeline/`** — `viz.mjs` (Node), opcional `.env`.

## Outras pastas na raiz (não Python/React)

- **`BI/`** — artefatos Power BI (modelo semântico).
- **`postgres/`**, **`db local/`** — dados / documentação SQL.
- **`web/scripts/free-ports.ps1`** — usado por `iniciar-hospital-bi.bat` para libertar portas.

## Convenções úteis

- **Paridade JSON:** alterações na Gerência devem manter o mesmo contrato JSON que o front já espera (espelho do legado JS onde aplicável).
- **Dependências Python:** `requirements.txt` na raiz; não criar segundo ambiente Python paralelo sem necessidade.
- **Mudanças focadas:** evitar refactors grandes não pedidos; alinhar estilo ao código existente nos três pacotes `bi_*`.

## Ficheiros de entrada

- API: `bi_api/main.py`
- Negócio Gerência: `bi_gerencia/service.py` (+ `metrics.py`, `datasets.py`)
- SQL/views lógicas: `bi_core/db_pg.py` (`LOGICAL_TO_TABLE`)

---

*Atualizar este ficheiro quando a arquitetura ou o fluxo de arranque mudarem.*
