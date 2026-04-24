# Projeto-BI — Documentação técnica resumida

## Stacks tecnológicas (NOVO BI)

### Backend (`NOVO BI/backend/`)

- **Runtime:** Node.js 22+
- **Linguagem:** TypeScript 5.9 (módulos ESM)
- **Framework HTTP:** Express 5
- **Dados em memória / CSV:** leitura de CSV em `CSV_DATA_DIR` (padrão: `NOVO BI/dados`), agregações em TypeScript (`csv-memory`)
- **Dados analíticos opcionais:** DuckDB (driver `duckdb`), com fallback automático para `csv-memory` quando o gateway falha
- **Serialização tabular:** Apache Arrow (stream) para respostas `format=arrow` nos endpoints de dashboard
- **Dev / execução:** `tsx` (watch em desenvolvimento), build com `tsc`, produção com `node dist/server.js`
- **Configuração:** `dotenv`, variáveis em `src/config/env.ts` (`PORT`, `CSV_DATA_DIR`, `DATA_GATEWAY`, etc.)

### Frontend (`NOVO BI/frontend/`)

- **Linguagem:** TypeScript
- **Build:** Vite 7 + `tsc -b`
- **UI:** React 19, Tailwind CSS v4 (`@import "tailwindcss"` em `src/index.css`)
- **Animação:** Framer Motion
- **Ícones:** Lucide React
- **Consumo de API:** `fetch` nativo; dashboard em Arrow via `apache-arrow` (`tableFromIPC`) em `src/services/api.ts`, com helper JSON `fetchDashboardJson` para payloads aninhados (ex.: Metas por volume)

### Testes pontuais de paridade

- **Script:** `NOVO BI/backend/scripts/parity-metas-volumes.ts`
- **Comando:** `npm run test:parity-metas` (executar dentro de `NOVO BI/backend`)
- **Escopo atual:** janela de três meses civis (`resolveLastThreeMonths`) e amostra sintética de `% triagem RG fixo` (50% com dois atendimentos, um acima de 12 min)

### Modelo semântico de referência (Power BI)

- Pasta: `NOVO BI/POWER BI/Tempos fluxos PS.SemanticModel/` (TMDL)
- Catálogo DAX resumido: `NOVO BI/POWER BI/catalogoDAX_PS.md`

### Ligação ao banco de produção oficial

Quando o backend passar a consumir o **DB de produção** (via DuckDB apontando para as mesmas bases/views que alimentam o Power BI, ou via pipeline que materialize as mesmas tabelas), as **entidades lógicas se alinham** ao modelo semântico: `tbl_tempos_entrada_consulta_saida` ↔ fluxo, `tbl_tempos_medicacao` ↔ medicacao, `tbl_vias_medicamentos` ↔ Vias_medicamentos, laboratório, TC/US, reavaliação, unidades, etc. O código de agregação (`metasPorVolumesAggregator` e rotas gerenciais) permanece o mesmo; o que muda é a **fonte física** (CSV local → conexão estável a produção). Vale garantir **nomes de colunas** e **tipos** compatíveis com o que já parseamos hoje (ou uma camada de view SQL padronizada).

## Arquitetura de performance (estado atual)

### Por que ficou rapido

- CSV em memoria com cache: o backend carrega os CSVs uma vez (`storeCache`) e reaproveita nas consultas seguintes.
- Prewarm de contexto: periodos/filtros mais usados sao pre-processados em background para reduzir latencia de troca de filtros.
- DuckDB opcional como acelerador: em `DATA_GATEWAY=duckdb`, consultas pesadas usam SQL sobre CSV/views, com fallback automatico para `csv-memory`.
- Frontend recebe agregado: o React nao processa CSV bruto; recebe KPI/matriz prontos para render.

### Formato de resposta por endpoint

- Arrow (preferencial, com fallback JSON):
1. `GET /api/v1/dashboard/gerencial-filtros`
2. `GET /api/v1/dashboard/gerencial-unidades-ranking`

- JSON (payload aninhado ou especializado):
1. `GET /api/v1/dashboard/gerencial-kpis-topo`
2. `GET /api/v1/dashboard/gerencial-metas-por-volumes`
3. `GET /api/v1/dashboard/gerencial-metas-por-volumes-drill`
4. `GET /api/v1/ps-heatmap/chegadas`

### Motivo do desenho em endpoints separados

- Evita endpoint monolitico com payload gigante.
- Permite cache/prewarm por bloco funcional (cards, ranking, metas, heatmap).
- Reduz gargalo de rede e serializacao.
- Melhora observabilidade (fica claro qual rota esta lenta).
- Facilita evolucao e rollback por modulo sem afetar o restante.

### Otimizacao do carregamento gerencial (frontend)

- Em `frontend/src/components/gerencial/GerencialTopCards.tsx`, a resposta Arrow de `gerencial-filtros` e guardada em cache por **regional** (`filtrosCacheRef`).
- Se a **regional** nao mudou em relacao ao render anterior e o cache e valido, o efeito **nao** refaz o fetch de filtros (`skipFiltros`), poupando um round-trip e parse; a barra de progresso usa **2 passos** nesse caso e **3** quando os filtros precisam ser buscados de novo.
- Troca de **unidade** ou **periodo** mantendo a mesma regional continua a atualizar KPIs e ranking normalmente.

## Modulo Chegadas por hora (PS)

### Backend

- **Rota:** `GET /api/v1/ps-heatmap/chegadas` (`psHeatmap.routes.ts` → `psHeatmapChegadasController`).
- **Query obrigatoria:** `mes=YYYY-MM`, `unidade` (nome da unidade; vazio ou `ALL` e rejeitado com 400).
- **Query opcional:** `regional` (omitir ou `ALL` = sem filtro regional); `limit` (inteiro; padrao **2500** no controller se ausente ou invalido — o componente do mapa pede **5000**).
- **Resposta:** JSON com `rows`, `rowCount`, `sourceView`, `applied` (espelha mes/unidade/regional aplicados). Suporte a **Apache Arrow** quando o cliente envia `Accept: application/vnd.apache.arrow.stream` ou `?format=arrow` (mesma convencao dos outros endpoints).
- **Agregacao:** implementada em `dashboard.service.ts` (`getPsChegadasHeatmapPayload`): chegadas por dia civil do mes e hora (0–23) para alimentar o heatmap.

### Frontend

- **Mapa:** `frontend/src/components/gerencial/PsChegadasHeatmap.tsx` — filtro de **mes** (`input type="month"`), selecao de **unidade do mapa** quando o painel gerencial esta em "Todas" as unidades (nao altera o filtro global), consumo via `fetchPsHeatmapChegadas` em `services/api.ts`, grafico **ECharts** heatmap dia × hora.
- **Leitura para gestao:** `PsChegadasHeatmapReport.tsx` + logica em `psChegadasHeatmapAnalysis.ts` (comparacao sazonal por dia da semana/hora, feriados, destaques).
- **Formato da leitura:** resumo em **cards** (totais, janela 8h–19h, faixas de tres horas melhor/pior), grade de **cards** por hora (8h–19h: media por dia, pico no mes, rotulo automatico), secao **Onde mais chama atenção** em **cards** (sem tabela).
- **Cores dos cards de pico** (pelo numero de **chegadas naquela celula** `qtd`): **1 a 9** — tons sky; **10 a 19** — tons ambar; **20 ou mais** — tons rose/vermelho. Legenda textual com as tres faixas fica no cabecalho da secao; o badge do card mostra apenas **Pico #N** (sem repetir o texto da faixa no chip).
