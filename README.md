# Hospital BI — Projeto-BI

Aplicação web de indicadores com **Visão Gerência** (totais, tempos por etapa, metas, indicadores por unidade), **troca de tipo de gráfico por painel** (linha, barras, pizza nos mesmos dados), temas múltiplos e biblioteca **ECharts** (`web/src/graficos/`).

A estrutura na raiz concentra-se em **`bi_core/`**, **`bi_gerencia/`**, **`bi_api/`** (Python / FastAPI) e **`web/`** (React + Vite). Tudo o que é **Node** (legado Express, seeds, scripts de dev, `viz.mjs`) está em **`node_legado/`**. Há ainda **`BI/`**, **`postgres/`**, **`db local/`**, **`docs/`**, etc.

## Stack

| Camada | Tecnologia |
| :--- | :--- |
| Frontend | React 19, Vite 8, Tailwind 3, `echarts` + `echarts-for-react` |
| Backend | Python FastAPI (`bi_api/main.py`, rotas `/api/v1/...`; Gerência em `bi_gerencia/`; infra em `bi_core/`) |
| Dados | PostgreSQL (`asyncpg` + `app/db_pg.py`) ou SQLite local (legado em `node_legado/api/db*.js`) |

## Dados: Power BI (modelo semântico) ↔ API Gerência

O relatório **`BI/Tempos fluxos PS.SemanticModel`** importa do PostgreSQL (`Schema="cmc_hospital"`, base `db`) as tabelas abaixo. A API Python usa os **mesmos nomes físicos** (via chaves lógicas em `bi_core/db_pg.py` → `fetch_view`).

| Tabela no PostgreSQL (`schema`) | Tabela no modelo PBI | Chave lógica na API (`fetch_view`) | Uso nos dashboards Gerência |
|--------------------------------|----------------------|-----------------------------------|--------------------------------------|
| `cmc_hospital.tbl_tempos_entrada_consulta_saida` | `fluxo` | `tbl_tempos_entrada_consulta_saida` | Atendimentos, tempos triagem/consulta/permanência, conversão, desfecho médico, “acima da meta” |
| `cmc_hospital.tbl_tempos_medicacao` | `medicacao` | `tbl_tempos_medicacao` | Medicações, tempo prescrição→medicação, % meta medicação |
| `cmc_hospital.tbl_tempos_laboratorio` | `laboratorio` | `tbl_tempos_laboratorio` | Laboratório / paciente |
| `cmc_hospital.tbl_tempos_rx_e_ecg` | `RX e ECG` | `tbl_tempos_rx_e_ecg` | RX/ECG, tempo revisão |
| `cmc_hospital.tbl_tempos_tc_e_us` | `TC e US` | `tbl_tempos_tc_e_us` | TC/US, médias |
| `cmc_hospital.tbl_tempos_reavaliacao` | `reavaliacao` | `tbl_tempos_reavaliacao` | Reavaliação (incl. `DT_EVO_PRESC` / `DT_FIM_REAVALIACAO` como no PBI) |
| `cmc_hospital.tbl_vias_medicamentos` | `Vias_medicamentos` | `tbl_vias_medicamentos` | Medicações por paciente (vias), `CD_MATERIAL` |
| `cmc_hospital.tbl_tempos_procedimentos` | `procedimento` | — | **Não** usada hoje na API Gerência (só no PBI) |
| `cmc_hospital.tbl_custo_pac_ps` | `Custos` | — | **Não** usada hoje na API Gerência (só no PBI) |

Objetos que a **API** ainda lê (réplica / warehouse), mas **não** aparecem como `PostgreSQL.Database` neste `.SemanticModel`: `meta_tempos`, `tbl_altas_ps`, `tbl_intern_conversoes`, `vw_painel_ps_base`, `ps_resumo_unidades_snapshot_prod`, `tbl_unidades` / `tbl_unidades_teste` / `central_command.tbl_unidades_prod` — alinhados ao painel web e à réplica SQLite; devem existir no Postgres (ou views homónimas) quando ligar a base real.

### Variáveis de ambiente (conexão)

- **PostgreSQL (prioritário):** defina `DATABASE_URL` **ou** `PGHOST` + credenciais, **ou** o bloco `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_READ_USER` / `DB_READ_PASSWORD` (como noutros serviços do ecossistema). Exemplo legado Node: `node_legado/api/.env.example`; a API Python lê o `.env` na raiz do repositório.
- **SQLite (fallback):** sem as variáveis acima, usa `SQLITE_PATH` ou `db local/db_testes_replica.sqlite3`.

### Porta da API (evitar 502 no browser)

O `.env` da raiz costuma ter **`PORT=...`** para **outra** aplicação. Esta API **não** usa `PORT`: escuta em **`HOSPITAL_BI_API_PORT`**, por defeito **3020**. O proxy do Vite aponta para a mesma porta (lê `HOSPITAL_BI_API_PORT` no `.env` da raiz ou assume 3020).

Se vires **502** em `/api/v1/...`: confirma que o **`npm run dev`** na pasta `web` sobe **API + Vite** (não uses só `npm run vite`). O script `vite:wait` espera a API em `127.0.0.1` na porta `HOSPITAL_BI_API_PORT` (padrão 3020) antes de abrir o Vite. Na consola do Vite aparece `[vite] proxy /api -> …` com a porta usada.

## Arranque

**Opção A — batch (Windows):** na raiz do repositório, execute `iniciar-hospital-bi.bat` (sobe API na porta 3020 e Vite na 5180).

**Opção B — npm na pasta `web`:**

```bash
cd web
npm install
npm run dev
```

Isto sobe a API e o Vite em paralelo (`concurrently`). Build de produção: `npm run build` (dentro de `web`).

## Documentação técnica

| Documento | Conteúdo |
| :--- | :--- |
| **`css.md`** | Tokens CSS, temas (`.dark`, `.light`, `.dark-green`, `.dark-blue`), pipeline, tabelas Gerência, **`ChartPanel`** / ECharts, extensibilidade |
| **`web/src/graficos/index.js`** | API pública da biblioteca de gráficos (`ChartRenderer`, `ChartPanel`, modelos, `buildOptionById`) |

## Especificações visuais resumidas

- **Temas:** classe no `<html>` controlada por `ThemeContext` + `ThemeSwitcher` (emoji + nome curto: Escuro, Claro, Verde, Azul); variáveis em `web/src/index.css`.
- **Painéis de módulo:** `.dashboard-panel`; cabeçalhos de bloco Gerência: `.gerencia-panel-head`.
- **Gráficos:** na **Visão Gerência**, os **gráficos dedicados** (metas conformes, tendência de acompanhamento) usam **`ChartPanel`** + **`EchartsCanvas`**, **`GerenciaChartToolbar`** e **`web/src/utils/gerenciaChartOptions.js`**. **Totais PS** e as **tabelas** ficam só em cartões/tabulares (export CSV onde aplicável). Na biblioteca (`GraficosContainer`), combinar **`ChartPanel`** + **`EchartsCanvas`**. Os **modelos** em `graficos/models/*` devolvem só `EchartsCanvas`; **`ChartRenderer`** não inclui `ChartPanel` — envolver manualmente se quiseres o mesmo contentor. **`chartUi(theme)`** em `web/src/utils/chartTheme.js`.
- **CSV:** botão nas tabelas/totais da Gerência (`ExportCsvButton`, `utils/downloadCsv.js`); não nos gráficos de tendência.

## Pastas principais

```
Projeto-BI/
  requirements.txt  # Dependências Python (pip install -r na raiz)
  bi_core/          # Config, PostgreSQL, Redis, Polars
  bi_gerencia/      # LiveService, métricas, datasets Gerência
  bi_api/           # FastAPI, rotas /api/v1, bundle_service, start.ps1
  node_legado/      # Node: Express legado, seeds, web-dev (launch/wait API), pipeline viz
  web/
    scripts/      # free-ports.ps1 (dev)
    src/
      components/   # Secções, tabelas e gráficos da UI
      graficos/     # EchartsCanvas, ChartPanel, registry, modelos
      context/      # ThemeContext
      hooks/        # useApi, etc.
      utils/        # chartTheme, downloadCsv, apiBase
  BI/               # Artefatos Power BI / modelo semântico (legado)
  postgres/
  db local/
  docs/
  css.md
```

## Licença / uso

Uso interno do projeto BI; ajustar conforme política da organização.
