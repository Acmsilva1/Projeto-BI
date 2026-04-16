# agents.md — fonte única para agentes (IA) e contexto técnico do repositório

**Localização:** na **raiz do repositório**, na **mesma pasta** que `doc.md` (ex.: `Projeto-BI/agents.md`).

Toda a documentação orientada a assistentes de código e a detalhe de implementação está **neste ficheiro**. Não há `AGENTS.md` nem outro guia paralelo de agentes.

---

## Produto (resumo)

Aplicação web de indicadores com **Visão Gerência** (totais, tempos por etapa, metas, indicadores por unidade), troca de tipo de gráfico por painel (ECharts em `FRONTEND/src/graficos/`), temas múltiplos.

---

## Repositório e GitHub

| Item | Detalhe |
| :--- | :--- |
| **Remoto** | `https://github.com/Acmsilva1/Projeto-BI` (`origin`) |
| **Conta** | **Acmsilva1** |
| **Branch por defeito** | **`main`** |

---

## Arquitetura

- **`FRONTEND/`** — React 19 + Vite: dashboards, gráficos, chamadas a **`/api/v1/*`**. Regras de negócio e agregações devem viver no **BACKEND**; o UI prioriza apresentação.
- **`BACKEND/`** — Express 5 + TypeScript: MVC em `src/` — rotas em **`modules/*`**, **`services/liveService.ts`**, **`models/`** (fonte de dados), **`views/`**, **`repositories/`**, **`domain/`**, **`messaging/`**. Em produção, se existir **`FRONTEND/dist/index.html`**, o mesmo processo serve o **SPA** (estático + fallback) e a **API** na **mesma origem** (porta `HOSPITAL_BI_API_PORT`). **`FRONTEND_DIST`** (caminho absoluto ou relativo à raiz do repo) sobrepõe a pasta do `dist`.

---

## Pastas na raiz

```
Projeto-BI/
  FRONTEND/          # App React + Vite
  BACKEND/           # API Node (TypeScript em src/)
  dados/             # CSV por nome lógico (modo leitura direta)
  db local/          # SQLite de testes / réplica (opcional)
  BI/
  postgres/
  agents.md          # Este ficheiro (ao lado de doc.md)
  doc.md
  iniciar-hospital-bi.bat
```

---

## BACKEND — `BACKEND/src/`

| Área | Função |
| :--- | :--- |
| **`app.ts` / `server.ts`** | Express e arranque |
| **`modules/*/*.routes.ts`** | Rotas `/api/v1` por domínio (core, gerencia, ps, financeiro, ocupacao, cirurgia, cc) |
| **`controllers/apiV1Routes.ts`** | Agrega os mounts |
| **`services/liveService.ts`** | Regras e agregações da API (inclui Gerência) |
| **`models/db.ts`** | Escolhe fonte: **PostgreSQL**, **SQLite** ou **CSV** |
| **`models/db_postgres.ts`**, **`db_sqlite.ts`**, **`db_csv.ts`** | `fetchView` por backend |
| **`models/db_sqlite.ts`** | **`LOGICAL_TO_SQLITE_TABLE`** — nome lógico → tabela física ou ficheiro **`<nome>.csv`** |
| **`lib/parsr/`** | Parser CSV próprio (`parseCsv`) — usado por `db_csv` e pelo CLI de ingestão |
| **`repositories/readRepository.ts`** | `safeView` / `safeViewParallel` |
| **`repositories/gerenciaRepository.ts`** | Leituras paralelas Gerência + cache curto |
| **`domain/`** | Ex.: `shared/period.ts`, `gerencia/sqlContext.ts`, tons Metas por volumes |
| **`messaging/domainEventBus.ts`** | Eventos em processo (ex.: bundle Gerência) |
| **`cli/ingestDadosCsv.ts`** | Opcional: CSV → SQLite (`npm run pipeline:dados`); com **`DATA_SOURCE=csv`** a API lê CSV direto, sem precisar disto |
| **`config/loadEnv.ts`** | `.env` em `BACKEND/pipeline/`, `BACKEND/`, raiz (raiz com override) |

**Inspeção:** `GET /api/v1/_meta/stack` — `data_source` (`postgres` \| `sqlite` \| `csv`), `csv_direct`.

---

## Fontes de dados (`models/db.ts`)

1. **PostgreSQL** — `DATABASE_URL` ou `PGHOST` / credenciais.
2. **CSV** — `DATA_SOURCE=csv`, ou `CSV_DATOS_DIR` definido, ou **ausência** do SQLite por defeito **e** existir `.csv` em **`dados/`**. Ficheiros: **`dados/<nome_logico>.csv`**, primeira linha = cabeçalho.
3. **SQLite** — `db local/db_testes_replica.sqlite3` ou `SQLITE_PATH`.

Detalhe de variáveis: **`BACKEND/sample-local-mode.env`**. Porta: **`HOSPITAL_BI_API_PORT`** (padrão **3020**).

---

## Scripts npm (`BACKEND/`)

| Script | Descrição |
| :--- | :--- |
| `npm run dev` | Só a API em desenvolvimento (`tsx watch`) |
| `npm run dev:vite` | API + **Vite** (HMR); delega em `FRONTEND` `npm run dev` |
| `npm run build` / `npm start` | Build só do TypeScript (`BACKEND/dist`) e servidor |
| `npm run build:web` | Build do Vite em `FRONTEND/dist` |
| `npm run build:all` | **`build:web`** + **`build`** — um artefacto lógico: API + ficheiros estáticos |
| `npm run pipeline:dados` | Importar CSV de `dados/` para SQLite (opcional) |

---

## Docker (`docker-compose.yml` na raiz)

Serviços: **Redis**, **backend** (Node API), **frontend** (Nginx + estático React, proxy `/api` → backend).

Variáveis principais (ver comentários no compose e **`docker-compose.env.example`**):

| Variável | Função |
| :--- | :--- |
| `REDIS_URL` | Ligação ao Redis (ex.: `redis://redis:6379` no compose). |
| `REDIS_OFFLINE_USE_MEMORY` | `1` (omissão): se o Redis não ligar, cache stale só em **memória** no processo Node. |
| `CACHE_FORCE_MEMORY` | `1` força ignorar Redis (só memória). |
| `DB_FALLBACK_READ_STALE` | `1` (omissão): quando **fetchView** falha, devolver último snapshot gravado. |
| `DB_FALLBACK_WRITE_STALE` | `1` (omissão): após leitura OK ao BD, gravar snapshot em Redis **e** memória. |
| `DB_FALLBACK_STALE_TTL_SEC` | TTL do snapshot (Redis e memória). |
| `BIND_HOST` | Em Docker usar `0.0.0.0` para aceitar tráfego externo. |
| `DATA_SOURCE` / `CSV_DATOS_DIR` | Modo CSV; volume `./dados` → `/data/dados` no contentor. |

`GET /api/v1/_meta/stack` inclui `redis`, `stale_cache_backend` (`redis` \| `memory`).

---

## Arranque

1. **Mesma URL / mesma build (produção local):** `cd BACKEND && npm install` → `cd ../FRONTEND && npm install` (primeira vez) → `cd ../BACKEND && npm run build:all && npm start` — UI e API em `http://127.0.0.1:<HOSPITAL_BI_API_PORT>/` (omissão **3020**). Requer base de dados configurada (ver `models/db.ts` / `.env`).
2. **Desenvolvimento com atualização em tempo real (Vite + HMR):** `cd FRONTEND && npm run dev` — sobe a API (`BACKEND` via `concurrently`) e o **Vite** com **Fast Refresh**, proxy `/api` e watcher com **polling** no Windows (`vite.config.js`). Equivalente a partir do BACKEND: `npm run dev:vite`. Na raiz do repo, Windows: **`iniciar-hospital-bi.bat`** (abre `http://127.0.0.1:5180` por omissão). **Não** use `npm start` para iterar no UI — isso é build estático sem HMR.
3. Windows: **`iniciar-hospital-bi.bat`** na raiz, se existir.
4. Docker: na raiz, `docker compose up --build` (ou com `--env-file docker-compose.env.example`).

---

## Pasta `testes/` — watcher da pipeline

Aplicação Node em **`testes/`** que observa mudanças em `BACKEND/src`, `FRONTEND/src`, Dockerfiles, `docker-compose.yml`, etc., e **reexecuta verificações** (build BACKEND, opcionalmente FRONTEND, `docker compose config`, smoke da API). Resultados em **`testes/logs/`** (`run-*.log` por execução e **`latest.log`** sempre atualizado).

```bash
cd testes
npm install
npm start              # contínuo (debounce ~3,5 s)
npm run once           # uma corrida e sair
```

Variáveis: `TESTES_API_BASE`, `SKIP_FRONTEND_BUILD`, `SKIP_DOCKER_COMPOSE`, `TESTES_DEBOUNCE_MS` (ver cabeçalho de `testes/watch-pipeline.js`).

---

## Outros documentos (não são guias de agente)

| Ficheiro | Uso |
| :--- | :--- |
| **`css.md`** | Tokens CSS, temas, ECharts |
| **`FRONTEND/src/graficos/index.js`** | API pública da biblioteca de gráficos |

**`doc.md`** e **`README.md`** na raiz são atalhos breves; o conteúdo técnico para agentes mantém-se **só em `agents.md`** (esta pasta).

---

*Uso interno do projeto BI.*
