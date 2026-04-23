# Logica Dos Graficos Do Legado

## Visao Geral

No legado, os graficos ficavam em `FRONTEND/src/graficos` com `echarts-for-react`.
Existia um catalogo por `chartId` (`registry.js`) contendo:

- id estavel do grafico
- label do seletor
- componente React
- builder de option ECharts

Fluxo do legado:

1. receber `chartId`
2. montar `option` com builder
3. renderizar via `EchartsCanvas`
4. envolver no `ChartPanel`

## Modelos Disponiveis No Legado

- barras, linhas, area, mixed line/bar
- pie, donut, gauge, funnel
- heatmap, radar, scatter
- treemap, sunburst, sankey
- boxplot, candlestick, graph, parallel

## Uso Real No Modulo Gerencial

Apesar do catalogo grande, o gerencial usava principalmente:

- serie temporal multi modo
- gauge de meta global
- painel padrao (`ChartPanel`)

## Estado No NOVO BI

A nova base simplificou a superficie inicial:

- foco em cards KPI e graficos gerenciais essenciais
- backend centraliza calculo e agregacao
- frontend foca em renderizacao e interacao

## Integracao Com Dados (estado atual)

- modo principal: `csv-memory`
- modo opcional: `duckdb` com fallback
- transporte de linhas: Arrow opcional, fallback JSON

Observacao:

- A decisao de manter o frontend mais enxuto foi preservada.
- O motor analitico ainda esta em evolucao para alta escala no caminho DuckDB.
