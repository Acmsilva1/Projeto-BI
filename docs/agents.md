# Agentes (Cursor / automação) — NOVO BI

## Contexto

Monorepo `web` (Vite + React + TS + Tailwind v4) e `api` (Express + TS). Feature principal da API: **`api/src/features/jornada/`** (routes, controllers, services, domain). Config em **`api/src/core/config/env.ts`**. DuckDB e loaders em **`api/src/data/`**. Utilitário Arrow em **`api/src/shared/`**.

No **web**: `web/src/features/jornada` (App, componentes do mapa), `features/gerencial`, `features/internacao`, gráficos e botão em **`web/src/shared/components/`**.

## Regras

- Novos painéis: pasta em `web/src/features/<nome>/components/` e endpoints espelhados na API com o mesmo vocabulário (`jornada`, `internacao`, etc.).
- Proxy Vite `/api` → **127.0.0.1:3333** (porta default da API no env).

## Comandos

- Raiz `NOVO BI`: `npm run dev` — api + web em paralelo.
- Web: **5175**; API: **3333** (override com `PORT` no env carregado por `core/config`).

## Checkpoint

- [ ] Imports da API que usam `env` apontam para `core/config/env.js` (ou `.ts` em fonte), não para `config/` removido.
- [ ] `npm run build` em `api` e `web` sem erros após alterações.
- [ ] Nenhum componente de negócio novo na raiz extinta `web/src/components/` — usar `features/` ou `shared/`.
- [ ] `web` em dev não usa porta **5173** (porta atual **5175**).
