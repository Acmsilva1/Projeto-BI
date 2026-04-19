# Plano de Otimizacao Backend (DuckDB + Redis + Node Orquestrador)

## Objetivo

Manter o frontend React como esta, otimizar somente o backend para entregar dados com precisao e velocidade, deixando:

- DuckDB: responsavel por consultas e calculos.
- Redis: cache de respostas prontas (principalmente 7 dias).
- Node: orquestracao do fluxo e montagem de resposta.

Sem alterar, neste momento, a estrutura atual de CSVs/tabelas.

## Metas de desempenho e precisao

- Gerencia 7 dias: p95 <= 800ms (cache quente ideal <= 200ms).
- Gerencia 30 dias: p95 <= 1.8s.
- Gerencia 60 dias sob demanda: p95 <= 3s.
- Precisao: divergencia maxima <= 0.1% vs baseline atual.

## Plano por fases

### Fase 1 - Baseline (Dia 1)

- Medir latencia atual dos endpoints:
  - `/api/v1/gerencia/dashboard-bundle`
  - `/api/v1/gerencia/totais-ps`
  - `/api/v1/gerencia/tempo-medio-etapas`
  - `/api/v1/gerencia/metas-por-volumes`
- Registrar p50/p95 e tempo de resposta.
- Salvar snapshots de saida para periodos 7, 30 e 60 dias.

**Criterio de saida:** baseline documentado para comparacao antes/depois.

### Fase 2 - Estabilidade de runtime (Dia 1)

- Garantir `DATA_SOURCE=duckdb`.
- Ativar Redis real via `REDIS_URL`.
- Validar stack em `GET /api/v1/_meta/stack`:
  - `duckdb_local=true`
  - `redis=true`
  - `stale_cache_backend=redis`
- Ajustar timeout/failfast para evitar fallback prematuro DuckDB -> CSV.
- Habilitar prewarm no boot para iniciar aquecimento da gerencia.

**Criterio de saida:** ambiente estavel sem fallback indevido.

### Fase 3 - Cache 7 dias obrigatorio (Dia 2)

- Priorizar cache para `period=7` por chave de filtro (`regional`, `unidade`).
- Aquecer 7 dias nacional no boot.
- No primeiro acesso por filtro, gerar e persistir resposta no Redis.
- Reuso imediato em chamadas seguintes.

**Criterio de saida:** ao abrir a tela, dados de 7 dias prontos e rapidos.

### Fase 4 - Otimizacao sem mudar modelo de dados (Dia 2-3)

- Maximizar pushdown de filtro de data nas leituras.
- Remover leituras/calculos redundantes no mesmo request.
- Reaproveitar dataset ja carregado dentro do mesmo fluxo.
- Reduzir loops repetidos no `liveService`.

**Criterio de saida:** menor uso de CPU Node e menor tempo no bundle.

### Fase 5 - Migracao progressiva de calculos para DuckDB (Dia 3-5)

- Levar os calculos mais caros para consultas agregadas no DuckDB.
- Manter contrato de resposta igual para nao impactar frontend.
- Deixar Node focado em orquestracao e montagem final.

**Criterio de saida:** mesma resposta funcional, latencia menor.

### Fase 6 - 30/60 dias sob demanda (Dia 5)

- 7 dias sempre quente.
- 30/60 dias somente quando usuario solicitar.
- Cachear 30/60 apos primeira execucao para acelerar repeticoes.

**Criterio de saida:** boa experiencia com custo computacional controlado.

### Fase 7 - Validacao final e decisao (Dia 6)

- Reexecutar benchmark completo.
- Comparar p50/p95 vs baseline.
- Comparar precisao vs snapshots de referencia.
- Decisao Go/No-Go para reduzir/deixar Power BI.

**Criterio de saida:** metas de desempenho e precisao atingidas.

## Entregaveis

1. Checklist tecnico de configuracao (`.env`, stack, warmup, cache).
2. Relatorio antes/depois de latencia por endpoint.
3. Validacao de precisao por periodo (7/30/60).
4. Recomendacao objetiva para descontinuar ou manter Power BI.

## Premissas

- Nao alterar frontend.
- Nao alterar, neste inicio, estrutura atual de CSVs/tabelas.
- Mudancas focadas em backend, consultas, cache e orquestracao.
