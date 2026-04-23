# AGENTS.md

## Objetivo
Guia rapido para agentes que atuam neste repositorio (`NOVO BI`).

## Estrutura
- `backend/`: API Express + TypeScript (CSV-memory + DuckDB opcional)
- `frontend/`: React + Vite + TypeScript
- `dados/`: CSVs e docs de mapeamento
- `POWER BI/`: modelo semantico de referencia

## Comandos principais
- Dev full: `npm run dev`
- Build full: `npm run build`
- Backend dev: `npm run dev --prefix backend`
- Frontend dev: `npm run dev --prefix frontend`
- Backend build: `npm run build --prefix backend`
- Frontend build: `npm run build --prefix frontend`

## Regras de dados e performance
- Priorizar leitura de dados pelos endpoints existentes; evitar criar endpoint monolitico.
- Reusar cache em memoria e prewarm ja implementados no backend.
- `DATA_GATEWAY=duckdb` deve manter fallback para `csv-memory`.
- Manter alinhamento com logica do Power BI para indicadores gerenciais.

## Contrato de formatos (atual)
- Arrow preferencial:
1. `/api/v1/dashboard/gerencial-filtros`
2. `/api/v1/dashboard/gerencial-unidades-ranking`

- JSON:
1. `/api/v1/dashboard/gerencial-kpis-topo`
2. `/api/v1/dashboard/gerencial-metas-por-volumes`
3. `/api/v1/dashboard/gerencial-metas-por-volumes-drill`
4. `/api/v1/ps-heatmap/chegadas`

## Boas praticas de alteracao
- Alteracoes de periodo/filtro devem ser ponta a ponta (frontend + backend + controller + tipos).
- Sempre validar build backend e frontend apos mudancas estruturais.
- Nao remover fallbacks sem justificativa tecnica.
- Evitar quebrar nomes de campos consumidos pelo frontend.

## Entrega
- Informar arquivos alterados e impacto funcional.
- Em mudancas de regra, registrar tambem em `documentacao.md` e/ou `dados/rotas.md`.
