# Gerencial - Rotas E Fontes De Dados

Documento de apoio para entender quais tabelas CSV alimentam cada rota do modulo gerencial.

## Rotas Principais

- `POST /api/v1/dashboard/prewarm/gerencial-context?activePeriod=7&regional=...&unidade=...` — pre-calculo em background dos outros periodos (cache CSV-memory; dispara apos carregar o gerencial).

- `GET /api/v1/dashboard/gerencial-filtros`
- `GET /api/v1/dashboard/gerencial-kpis-topo`
- `GET /api/v1/dashboard/gerencial-unidades-ranking`
- `GET /api/v1/dashboard/gerencial-metas-por-volumes`
- `GET /api/v1/dashboard/gerencial-metas-por-volumes-drill?indicador=<key>`

## Mapeamento Por Rota

### `gerencial-filtros`

Retorna lista de regionais e unidades filtraveis.

Fontes:

- `tbl_unidades.csv`

Campos principais usados:

- `cd_estabelecimento`
- `nome`
- `uf`
- `ps`

### `gerencial-kpis-topo`

Retorna KPIs agregados do topo (atendimentos, internacoes, altas, obitos, tempos medios e metas).

Fontes:

- `tbl_tempos_entrada_consulta_saida.csv`
- `tbl_intern_conversoes.csv`
- `tbl_altas_ps.csv`
- `tbl_tempos_rx_e_ecg.csv`
- `tbl_tempos_tc_e_us.csv`
- `ps_resumo_unidades_snapshot_prod.csv`
- `meta_tempos.csv`
- `tbl_unidades.csv` (filtro de unidades PS)

Regras assistenciais (para migracao DV):

- `altas_total`: `tbl_altas_ps.csv`, evento por linha com classificacao por `TIPO_DESFECHO`/`DS_MOTIVO_ALTA` contendo `"alta"`.
- `obitos_total`: `tbl_altas_ps.csv`, linha conta como obito quando `QTD_OBITO > 0` **ou** `TIPO_DESFECHO`/`DS_MOTIVO_ALTA` contem `"obito"` (comparacao normalizada para acento/case).
- `evasoes_total`: `tbl_altas_ps.csv`, linha conta como evasao quando `TIPO_DESFECHO`/`DS_MOTIVO_ALTA` contem padroes de evasao (`"evas"`/`"evad"`/`"aband"`), cobrindo casos como `"Evadiu-se"`.
- Data de referencia do evento assistencial: `DT_ALTA` (fallback para `DT_ENTRADA` quando `DT_ALTA` estiver nulo), sempre respeitando a janela `period` (7/15/30/60/90 dias).

### `gerencial-unidades-ranking`

Retorna ranking operacional por unidade com score, metas positivas/negativas e tempos medios.

No frontend do modulo gerencial, esta rota so e chamada quando o filtro **Unidade** nao esta em **Todas** (evita carga ampla e payload pesado com `metas_detalhadas` em varias linhas).

Fontes:

- `tbl_tempos_entrada_consulta_saida.csv`
- `tbl_intern_conversoes.csv`
- `tbl_altas_ps.csv`
- `tbl_tempos_rx_e_ecg.csv`
- `tbl_tempos_tc_e_us.csv`
- `ps_resumo_unidades_snapshot_prod.csv`
- `meta_tempos.csv`
- `tbl_unidades.csv`

### `gerencial-metas-por-volumes`

Matriz **Metas por volume**: treze indicadores alinhados ao modelo Power BI (`Param metas de volumes` + medidas `Valor Indicador Volume RG Base` / RG fixo). Sempre agrega os **tres ultimos meses civis** relativos ao `max(DATA)` do fluxo no recorte de unidades; **o parametro `period` da pagina e ignorado** neste slug (use apenas `regional` e `unidade` como nos demais gerenciais).

Resposta JSON recomendada (`Accept: application/json`): uma linha com `kind: "metas-por-volumes"`, `months`, `anchorYearMonth`, `indicators`, `metaDefinitions`.

Fontes:

- `tbl_tempos_entrada_consulta_saida.csv` (fluxo, datas, tempos, desfecho medico)
- `tbl_tempos_medicacao.csv`
- `tbl_tempos_laboratorio.csv`
- `tbl_tempos_tc_e_us.csv` (TC por `TIPO`)
- `tbl_tempos_reavaliacao.csv`
- `tbl_vias_medicamentos.csv` (paridade com `% pacientes medicados` e media de medicacoes; se vazio, ha fallback parcial via medicação)
- `tbl_unidades.csv` (filtro PS)

### `gerencial-metas-por-volumes-drill`

Mesmas fontes e mesma logica de indicador que a matriz, com **uma linha por unidade** no recorte. Query obrigatoria: `indicador` = uma das chaves internas (ex.: `conversao`, `triagem_rg`, `desfecho`).

Fontes: as mesmas listadas em `gerencial-metas-por-volumes`.

## Rotas De Dados Brutos

- `GET /api/v1/data/views`
- `GET /api/v1/data/view/:viewName?limit=...`

Essas rotas servem para exploracao de views (CSV normalizados ou views DuckDB).

## Parametros Mais Comuns

- `period`: `7|15|30|60|90` (ignorado em `gerencial-metas-por-volumes` e no drill homonimo)
- `regional`: texto (opcional)
- `unidade`: texto (opcional)
- `limit`: inteiro (opcional)
- `indicador`: obrigatorio no drill de metas por volume

## Gateway E Fallback

- `DATA_GATEWAY=csv-memory`: calculo no Node (padrao atual recomendado)
- `DATA_GATEWAY=duckdb`: tenta DuckDB e, se falhar, cai para `csv-memory`

Estado de conexao pode ser consultado em:

- `GET /api/v1/health`
