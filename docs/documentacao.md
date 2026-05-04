# Projeto-BI â€” DocumentaÃ§Ã£o tÃ©cnica resumida

## Stacks tecnolÃ³gicas (NOVO BI)

### API (`NOVO BI/api/`)

- **Runtime:** Node.js 22+
- **Linguagem:** TypeScript 5.9 (mÃ³dulos ESM)
- **Framework HTTP:** Express 5
- **Dados em memÃ³ria / CSV:** leitura de arquivos em `CSV_DATA_DIR`, agregaÃ§Ãµes em TypeScript (`csv-memory`). O diretÃ³rio padrÃ£o Ã© resolvido em `src/config/env.ts`: se existir `tbl_tempos_entrada_consulta_saida` em Parquet ou CSV em `NOVO BI/banco local`, essa pasta Ã© usada; caso contrÃ¡rio, `NOVO BI/dados`.
- **Dados analÃ­ticos opcionais:** DuckDB (driver `duckdb`), com fallback automÃ¡tico para `csv-memory` quando o gateway falha. Na inicializaÃ§Ã£o, cada `.csv` / `.parquet` na pasta vira uma **view**; para o **mesmo nome base**, **Parquet prevalece sobre CSV** (`duckdb.service.ts`).
- **SerializaÃ§Ã£o tabular:** Apache Arrow (stream) para respostas `format=arrow` nos endpoints de dashboard
- **Dev / execuÃ§Ã£o:** `tsx` (watch em desenvolvimento), build com `tsc`, produÃ§Ã£o com `node dist/server.js`
- **ConfiguraÃ§Ã£o:** `dotenv`, variÃ¡veis em `src/config/env.ts` (`PORT`, `CSV_DATA_DIR`, `DATA_GATEWAY`, etc.)

### Web (`NOVO BI/web/`)

- **Linguagem:** TypeScript
- **Build:** Vite 7 + `tsc -b`
- **UI:** React 19, Tailwind CSS v4 (`@import "tailwindcss"` em `src/index.css`)
- **AnimaÃ§Ã£o:** Framer Motion
- **Ãcones:** Lucide React
- **Consumo de API:** `fetch` nativo; dashboard em Arrow via `apache-arrow` (`tableFromIPC`) em `src/features/jornada/api.ts`, com helper JSON `fetchDashboardJson` para payloads aninhados (ex.: Metas por volume)

### Testes pontuais de paridade

- **Script:** `NOVO BI/api/scripts/parity-metas-volumes.ts`
- **Comando:** `npm run test:parity-metas` (executar dentro de `NOVO BI/api`)
- **Escopo atual:** janela de trÃªs meses civis (`resolveLastThreeMonths`) e amostra sintÃ©tica de `% triagem RG fixo` (50% com dois atendimentos, um acima de 12 min)

### Modelo semÃ¢ntico de referÃªncia (Power BI)

- Pasta: `NOVO BI/POWER BI/Tempos fluxos PS.SemanticModel/` (TMDL)
- CatÃ¡logo DAX resumido: `NOVO BI/POWER BI/catalogoDAX_PS.md`

### Dataset local e views do warehouse (`ww_*`)

Arquivos exportados do mesmo pipeline do DW (ex.: Parquet gerados a partir das views `ww_*` no banco analÃ­tico) podem ficar em `NOVO BI/banco local` junto com as tabelas fato (`tbl_*`, `meta_tempos`, etc.). Exemplos usados ou previstos pelo projeto:

| Arquivo (view DuckDB) | Papel |
|------------------------|--------|
| `ww_painel_ps_base.parquet` | Painel operacional por estabelecimento (ativos, ocupaÃ§Ã£o, metas por etapa, transferÃªncias, pendentes, etc.). **Fonte preferida no DuckDB** para o bloco que antes lia `ps_resumo_unidades_snapshot_prod` / catÃ¡logo que apontava para `vw_painel_ps_base`. |
| `ww_taxa_ocupacao*.parquet` | Taxa de ocupaÃ§Ã£o (com ou sem detalhe de pacientes); disponÃ­vel como view para evoluÃ§Ãµes de relatÃ³rio. |
| `ww_alertas_*.parquet` | Bases de alertas (ao vivo, finalizados, supervisÃ£o, resumo). |

ImplementaÃ§Ã£o de referÃªncia: `dashboardQueryCatalog.ts` (SQL de catÃ¡logo / slug `painel-ps-base`) e `dashboard.service.ts` (payload DuckDB de ranking e KPIs).

**Consultas DuckDB (gerencial):** o snapshot por unidade (KPIs topo, ranking) lÃª **`ww_painel_ps_base`** para ocupaÃ§Ã£o, transferÃªncias, ativos e agregados de meta alinhados ao warehouse. **Continuam** a ser lidas as tabelas fato (`tbl_tempos_entrada_consulta_saida`, `tbl_intern_conversoes`, `tbl_tempos_rx_e_ecg`, `tbl_tempos_tc_e_us`, `tbl_altas_ps`, `tbl_unidades`, â€¦) para mÃ©tricas com **janela de perÃ­odo** e granularidade de evento. Com `DATA_GATEWAY=duckdb`, a pasta de dados deve incluir **`ww_painel_ps_base.parquet`** (ou CSV homÃ´nimo) para esses caminhos nÃ£o falharem.

### LigaÃ§Ã£o ao banco de produÃ§Ã£o oficial

Quando a API passar a consumir o **DB de produÃ§Ã£o** (via DuckDB apontando para as mesmas bases/views que alimentam o Power BI, ou via pipeline que materialize as mesmas tabelas), as **entidades lÃ³gicas se alinham** ao modelo semÃ¢ntico: `tbl_tempos_entrada_consulta_saida` â†” fluxo, `tbl_tempos_medicacao` â†” medicacao, `tbl_vias_medicamentos` â†” Vias_medicamentos, laboratÃ³rio, TC/US, reavaliaÃ§Ã£o, unidades, etc. O snapshot de painel por unidade deve seguir as **views materializadas do DW** (`ww_painel_ps_base` e afins) para evitar divergÃªncia com `ps_resumo` legado. O cÃ³digo de agregaÃ§Ã£o (`metasPorVolumesAggregator` e rotas gerenciais) permanece o mesmo; o que muda Ã© a **fonte fÃ­sica** (CSV local â†’ Parquet/views estÃ¡veis ou conexÃ£o a produÃ§Ã£o). Vale garantir **nomes de colunas** e **tipos** compatÃ­veis com o que jÃ¡ parseamos hoje (ou uma camada de view SQL padronizada).

## Arquitetura de performance (estado atual)

### Por que ficou rapido

- CSV em memoria com cache: a API carrega os CSVs uma vez (`storeCache`) e reaproveita nas consultas seguintes.
- Prewarm de contexto: periodos/filtros mais usados sao pre-processados em background para reduzir latencia de troca de filtros.
- DuckDB opcional como acelerador: em `DATA_GATEWAY=duckdb`, consultas pesadas usam SQL sobre **views** criadas a partir de CSV/Parquet na pasta de dados, com fallback automÃ¡tico para `csv-memory`. O painel por unidade reutiliza **`ww_painel_ps_base`**, reduzindo leitura duplicada de exports de resumo legados.
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

- Em `web/src/components/gerencial/GerencialTopCards.tsx`, a resposta Arrow de `gerencial-filtros` e guardada em cache por **regional** (`filtrosCacheRef`).
- Se a **regional** nao mudou em relacao ao render anterior e o cache e valido, o efeito **nao** refaz o fetch de filtros (`skipFiltros`), poupando um round-trip e parse; a barra de progresso usa **2 passos** nesse caso e **3** quando os filtros precisam ser buscados de novo.
- Troca de **unidade** ou **periodo** mantendo a mesma regional continua a atualizar KPIs e ranking normalmente.

## Modulo Chegadas por hora (PS)

### Backend

- **Rota:** `GET /api/v1/ps-heatmap/chegadas` (`psHeatmap.routes.ts` â†’ `psHeatmapChegadasController`).
- **Query obrigatoria:** `mes=YYYY-MM`, `unidade` (nome da unidade; vazio ou `ALL` e rejeitado com 400).
- **Query opcional:** `regional` (omitir ou `ALL` = sem filtro regional); `limit` (inteiro; padrao **2500** no controller se ausente ou invalido â€” o componente do mapa pede **5000**).
- **Resposta:** JSON com `rows`, `rowCount`, `sourceView`, `applied` (espelha mes/unidade/regional aplicados). Suporte a **Apache Arrow** quando o cliente envia `Accept: application/vnd.apache.arrow.stream` ou `?format=arrow` (mesma convencao dos outros endpoints).
- **Agregacao:** implementada em `dashboard.service.ts` (`getPsChegadasHeatmapPayload`): chegadas por dia civil do mes e hora (0â€“23) para alimentar o heatmap.

### Frontend

- **Mapa:** `web/src/components/gerencial/PsChegadasHeatmap.tsx` â€” filtro de **mes** (`input type="month"`), selecao de **unidade do mapa** quando o painel gerencial esta em "Todas" as unidades (nao altera o filtro global), consumo via `fetchPsHeatmapChegadas` em `services/api.ts`, grafico **ECharts** heatmap dia Ã— hora.
- **Leitura para gestao:** `PsChegadasHeatmapReport.tsx` + logica em `psChegadasHeatmapAnalysis.ts` (comparacao sazonal por dia da semana/hora, feriados, destaques).
- **Formato da leitura:** resumo em **cards** (totais, janela 8hâ€“19h, faixas de tres horas melhor/pior), grade de **cards** por hora (8hâ€“19h: media por dia, pico no mes, rotulo automatico), secao **Onde mais chama atenÃ§Ã£o** em **cards** (sem tabela).
- **Cores dos cards de pico** (pelo numero de **chegadas naquela celula** `qtd`): **1 a 9** â€” tons sky; **10 a 19** â€” tons ambar; **20 ou mais** â€” tons rose/vermelho. Legenda textual com as tres faixas fica no cabecalho da secao; o badge do card mostra apenas **Pico #N** (sem repetir o texto da faixa no chip).


