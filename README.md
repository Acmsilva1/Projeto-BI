# Hospital BI — Projeto-BI

Aplicação web de indicadores com **Visão Gerência** (totais, tempos por etapa, metas, indicadores por unidade), **troca de tipo de gráfico por painel** (linha, barras, pizza nos mesmos dados), temas múltiplos e biblioteca **ECharts** (`web/src/graficos/`).

A estrutura de pastas segue o mesmo arranjo da pipeline de produção **command-center-web**: **`api/`** (Node/Express), **`web/`** (React + Vite), **`scripts/`**, artefatos em **`pipeline/`**, **`postgres/`**, **`db local/`**, etc.

## Stack

| Camada | Tecnologia |
| :--- | :--- |
| Frontend | React 19, Vite 8, Tailwind 3, `echarts` + `echarts-for-react` |
| Backend | Node.js (`api/server.js`, rotas `/api/v1/...`) |
| Dados local | SQLite opcional (`api/db_sqlite.js`) |

## Arranque

**Opção A — batch (Windows):** na raiz do repositório, execute `iniciar-hospital-bi.bat` (sobe API na porta 3020 e Vite na 5180).

**Opção B — npm na pasta `web`:**

```bash
cd web
npm install
npm run dev
```

Isto sobe a API e o Vite em paralelo (`concurrently`). Build de produção: `npm run build` (dentro de `web`).

**Opção C — scripts só na raiz (sem `cd`):**

```bash
npm run setup
npm run dev
```

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
  api/              # API Express + lógica gerência / PBIP alinhada
  web/
    src/
      components/   # Secções, tabelas e gráficos da UI
      graficos/     # EchartsCanvas, ChartPanel, registry, modelos
      context/      # ThemeContext
      hooks/        # useApi, etc.
      utils/        # chartTheme, downloadCsv, apiBase
  BI/               # Artefatos Power BI / modelo semântico (legado)
  pipeline/
  postgres/
  db local/
  scripts/
  docs/
  css.md
```

## Pasta `Novo BI` residual

Se ainda existir uma pasta **`Novo BI`** com restos (`node_modules`, `.vite`, cópia antiga do SQLite), foi bloqueada por processos em uso durante a migração. Feche o dev server, o Cursor sobre esses ficheiros e qualquer handle ao SQLite; em seguida apague manualmente a pasta **`Novo BI`**. O código e o SQLite ativos estão em **`web/`**, **`api/`** e **`db local/`** na raiz.

## Licença / uso

Uso interno do projeto BI; ajustar conforme política da organização.
