# agents.md - fonte unica para agentes (IA) e contexto tecnico do repositorio

**Localizacao:** na raiz do repositorio, na mesma pasta que `doc.md` (ex.: `Projeto-BI/agents.md`).

Toda a documentacao orientada a assistentes de codigo e detalhe de implementacao esta **neste ficheiro**.  
Nao ha `AGENTS.md` nem outro guia paralelo de agentes.

---

## Produto (resumo)

Aplicacao web de indicadores com **Visao Gerencia** (totais, tempos por etapa, metas, indicadores por unidade), troca de tipo de grafico por painel (ECharts em `FRONTEND/src/graficos/`) e temas multiplos.

---

## Repositorio e GitHub

| Item | Detalhe |
| :--- | :--- |
| **Remoto** | `https://github.com/Acmsilva1/Projeto-BI` (`origin`) |
| **Conta** | **Acmsilva1** |
| **Branch por defeito** | **`main`** |

---

## Arquitetura

- **`FRONTEND/`** - React 19 + Vite: dashboards, graficos, chamadas a **`/api/v1/*`**.
- **`BACKEND/`** - Express 5 + TypeScript: MVC em `src/`, com rotas em `modules/*`, regras em `services/liveService.ts`, e fontes de dados em `models/`.
- Em producao, se existir `FRONTEND/dist/index.html`, o mesmo processo serve SPA + API na mesma origem (`HOSPITAL_BI_API_PORT`).

---

## Pastas na raiz

```text
Projeto-BI/
  FRONTEND/          # App React + Vite
  BACKEND/           # API Node (TypeScript em src/)
  dados/             # CSV por nome logico
  db local/          # SQLite e DuckDB locais (opcional)
  BI/
  postgres/
  agents.md
  doc.md
  iniciar-hospital-bi.bat
```

---

## BACKEND - `BACKEND/src/`

| Area | Funcao |
| :--- | :--- |
| `app.ts` / `server.ts` | Express e arranque |
| `modules/*/*.routes.ts` | Rotas `/api/v1` por dominio |
| `controllers/apiV1Routes.ts` | Agrega mounts |
| `services/liveService.ts` | Regras e agregacoes da API |
| `models/db.ts` | Selecao de fonte (`postgres`, `duckdb`, `sqlite`, `csv`) |
| `models/db_postgres.ts` | Camada PostgreSQL (`fetchView`) |
| `models/db_duckdb.ts` | Camada DuckDB (`fetchView`) para CSV local |
| `models/db_sqlite.ts` | Camada SQLite + `LOGICAL_TO_SQLITE_TABLE` |
| `models/db_csv.ts` | Leitura direta de CSV em Node |
| `lib/parsr/` | Parser CSV proprio |
| `repositories/readRepository.ts` | `safeView` / `safeViewParallel` |
| `repositories/gerenciaRepository.ts` | Leituras paralelas Gerencia + cache curto |
| `cli/ingestDadosCsv.ts` | CSV -> SQLite (opcional) |
| `cli/syncCsvToSupabase.ts` | CSV -> Supabase/Postgres (automacao) |
| `config/loadEnv.ts` | Carrega `.env` de `BACKEND/pipeline/`, `BACKEND/` e raiz |

**Inspecao:** `GET /api/v1/_meta/stack` retorna `data_source`, `csv_direct` e `duckdb_local`.

---

## Fontes de dados (`models/db.ts`)

Ordem e regras:

1. **Fonte explicita via `DATA_SOURCE`**: `postgres`, `duckdb`, `csv`, `sqlite`.
2. Sem `DATA_SOURCE` explicito:
   - usa **PostgreSQL** se houver `DATABASE_URL` ou `PGHOST`;
   - senao usa **CSV** se `CSV_DATOS_DIR` estiver definido ou se SQLite padrao nao existir e houver `.csv` em `dados/`;
   - senao usa **SQLite**.

Detalhes por fonte:

1. **PostgreSQL**
   - `DATABASE_URL` ou `PGHOST` + credenciais.
2. **DuckDB**
   - `DATA_SOURCE=duckdb`
   - `CSV_DATOS_DIR` (opcional; default `dados/`)
   - `DUCKDB_PATH` (opcional; default `db local/hospital_bi.duckdb`; `:memory:` para temporario)
   - Cria views `schema.tabela` sobre os CSV do mapeamento logico.
3. **CSV direto**
   - `DATA_SOURCE=csv`
   - Leitura em memoria/streaming na camada Node.
4. **SQLite**
   - `SQLITE_PATH` ou default `db local/db_testes_replica.sqlite3`.

---

## Scripts npm (`BACKEND/`)

| Script | Descricao |
| :--- | :--- |
| `npm run dev` | API em desenvolvimento (`tsx watch`) |
| `npm run dev:vite` | API + Vite (HMR) |
| `npm run build` / `npm start` | Build TS (`dist`) e servidor |
| `npm run build:web` | Build Vite em `FRONTEND/dist` |
| `npm run build:all` | Build web + backend |
| `npm run pipeline:dados` | CSV -> SQLite (opcional) |
| `npm run pipeline:supabase` | CSV -> Supabase/Postgres (create/import) |

---

## Configuracao DuckDB (passo a passo)

1. Instalar dependencias no backend:

```bash
cd BACKEND
npm install
```

2. No `.env` (raiz ou `BACKEND/.env`):

```env
DATA_SOURCE=duckdb
CSV_DATOS_DIR=dados
DUCKDB_PATH=db local/hospital_bi.duckdb
```

3. Subir API:

```bash
cd BACKEND
npm run dev
```

4. Verificar:

- `GET /api/v1/_meta/stack`
- esperado: `data_source: "duckdb"` e `duckdb_local: true`

---

## Orquestracao de cache Gerencia (7/30/60)

Objetivo: reduzir carga no DuckDB e entregar dados rapidos na primeira experiencia.

Fluxo backend (Node):

1. Mantem um **JSON aperitivo de 7 dias** no cache (`Redis`/memoria), para primeiro carregamento.
2. Na primeira chamada da Gerencia, inicia aquecimento da janela de **30 dias**.
3. Apos **10 minutos** (configuravel), dispara a segunda onda para **60 dias**.
4. Para pedidos ate 60 dias, tenta responder do cache quente; se nao houver cobertura, consulta o banco sob demanda e atualiza cache.
5. Periodos acima de 60 dias sao bloqueados na UX da Gerencia.

Persistencia no cliente (browser):
- `FRONTEND/src/hooks/useApi.js` persiste respostas em `localStorage` (chave por URL+query)
- para endpoints de Gerencia, a leitura prioriza cache local antes de chamar backend
- objetivo: reduzir trafego e manter DuckDB livre para consultas realmente novas

Endpoints novos/relevantes:

- `GET /api/v1/gerencia/aperitivo` -> payload inicial (7 dias cacheado)
- `GET /api/v1/gerencia/dashboard-bundle` -> bundle principal com `cacheOrchestration` no payload

Campos de telemetria no `dashboard-bundle`:

- `cacheOrchestration.source`: `aperitivo_json_cache` | `hot_window_30d` | `hot_window_60d` | `db_on_demand`
- `cacheOrchestration.hotCoverageDays`
- `cacheOrchestration.requestedPeriod`
- `cacheOrchestration.effectivePeriod`
- `cacheOrchestration.cappedToMax60`
- `cacheOrchestration.warmStatus`

---

## Docker (`docker-compose.yml` na raiz)

Servicos: Redis, backend (Node API), frontend (Nginx + estatico React, proxy `/api` -> backend).

Variaveis principais:

| Variavel | Funcao |
| :--- | :--- |
| `REDIS_URL` | Ligacao ao Redis |
| `REDIS_OFFLINE_USE_MEMORY` | Fallback de cache em memoria |
| `CACHE_FORCE_MEMORY` | Forca ignorar Redis |
| `DB_FALLBACK_READ_STALE` | Le snapshot stale quando fetch falha |
| `DB_FALLBACK_WRITE_STALE` | Escreve snapshot stale apos leitura OK |
| `DB_FALLBACK_STALE_TTL_SEC` | TTL do snapshot |
| `BIND_HOST` | Em Docker, usar `0.0.0.0` |
| `DATA_SOURCE` | `postgres` \| `duckdb` \| `sqlite` \| `csv` |
| `CSV_DATOS_DIR` | Pasta de CSV |
| `DUCKDB_PATH` | Caminho do banco DuckDB local |

---

## Arranque

1. **Producao local (mesma URL):**
   - `cd BACKEND && npm install`
   - `cd ../FRONTEND && npm install`
   - `cd ../BACKEND && npm run build:all && npm start`

2. **Desenvolvimento com HMR (recomendado para UI):**
   - `cd FRONTEND && npm run dev`
   - equivalente: `cd BACKEND && npm run dev:vite`

3. **Windows helper:** `iniciar-hospital-bi.bat` na raiz.

4. **Docker:** `docker compose up --build`.

---

## Pasta `testes/` - watcher da pipeline

Watcher Node que observa alteracoes em backend/frontend/docker e reexecuta validacoes.

```bash
cd testes
npm install
npm start
# ou
npm run once
```

Logs em `testes/logs/` (`latest.log` e `run-*.log`).

---

## Outros documentos (nao sao guias de agente)

| Ficheiro | Uso |
| :--- | :--- |
| `css.md` | Tokens CSS, temas, ECharts |
| `FRONTEND/src/graficos/index.js` | API publica da biblioteca de graficos |

`doc.md` e `README.md` sao atalhos breves; o detalhe tecnico para agentes fica aqui em `agents.md`.

---

*Uso interno do projeto BI.*
