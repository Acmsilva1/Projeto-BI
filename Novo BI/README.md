# Novo BI — Hospital (shell React + API Node)

Aplicação web de indicadores com **Visão Gerência** (totais, tempos por etapa, metas, indicadores por unidade), **troca de tipo de gráfico por painel** (linha, barras, pizza nos mesmos dados), temas múltiplos e biblioteca **ECharts** (`graficos/`).

## Stack

| Camada | Tecnologia |
| :--- | :--- |
| Frontend | React 19, Vite 8, Tailwind 3, `echarts` + `echarts-for-react` |
| Backend | Node.js (`backend/server.js`, rotas `/api/v1/...`) |
| Dados local | SQLite opcional (`backend/db_sqlite.js`) |

## Arranque

Na pasta `frontend`:

```bash
npm install
npm run dev
```

Isto sobe a API e o Vite em paralelo (`concurrently`). Build de produção: `npm run build`.

## Documentação técnica

| Documento | Conteúdo |
| :--- | :--- |
| **`css.md`** | Tokens CSS, temas (`.dark`, `.light`, `.dark-green`, `.dark-blue`), pipeline, tabelas Gerência, **`ChartPanel`** / ECharts, extensibilidade |
| **`frontend/src/graficos/index.js`** | API pública da biblioteca de gráficos (`ChartRenderer`, `ChartPanel`, modelos, `buildOptionById`) |

## Especificações visuais resumidas

- **Temas:** classe no `<html>` controlada por `ThemeContext` + `ThemeSwitcher` (emoji + nome curto: Escuro, Claro, Verde, Azul); variáveis em `frontend/src/index.css`.
- **Painéis de módulo:** `.dashboard-panel`; cabeçalhos de bloco Gerência: `.gerencia-panel-head`.
- **Gráficos:** na **Visão Gerência**, os **gráficos dedicados** (metas conformes, tendência de acompanhamento) usam **`ChartPanel`** + **`EchartsCanvas`**, **`GerenciaChartToolbar`** e **`frontend/src/utils/gerenciaChartOptions.js`**. **Totais PS** e as **tabelas** ficam só em cartões/tabulares (export CSV onde aplicável). Na biblioteca (`GraficosContainer`), combinar **`ChartPanel`** + **`EchartsCanvas`**. Os **modelos** em `graficos/models/*` devolvem só `EchartsCanvas`; **`ChartRenderer`** não inclui `ChartPanel` — envolver manualmente se quiseres o mesmo contentor. **`chartUi(theme)`** em `frontend/src/utils/chartTheme.js`.
- **CSV:** botão nas tabelas/totais da Gerência (`ExportCsvButton`, `utils/downloadCsv.js`); não nos gráficos de tendência.

## Pastas principais

```
Novo BI/
  backend/          # API Express + lógica gerência / PBIP alinhada
  frontend/
    src/
      components/   # Secções, tabelas e gráficos da UI
      graficos/     # EchartsCanvas, ChartPanel, registry, modelos
      context/      # ThemeContext
      hooks/        # useApi, etc.
      utils/        # chartTheme, downloadCsv, apiBase
  css.md            # Especificações técnicas de estilo e gráficos
```

## Licença / uso

Uso interno do projeto BI; ajustar conforme política da organização.
