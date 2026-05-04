# Mudança de arquitetura — pastas por *features* + camadas na API

Este documento define o **alvo de organização** alinhado ao padrão usado em projetos como *command-center-web*: **feature slices** no frontend e na API, com **rotas → controllers → services → repositories** dentro de cada feature, e código partilhado em `shared` / `core`.

> **Nota:** Este ficheiro está na raiz do pacote **NOVO BI** (`Projeto-BI/NOVO BI`), onde vivem `web/` e `api/`.

## Referência de pastas (alvo)

```
NOVO BI/
  web/src/
    features/<nome-da-feature>/
      components/
      hooks/
      lib/
    shared/
      components/
      lib/
  api/src/
    core/config/     # env (ex.: env.ts) — variáveis e defaults da API
    features/<nome-da-feature>/
      routes/
      controllers/
      services/
      domain/        # opcional — catálogos de queries, agregadores específicos da feature
      repositories/  # opcional — se houver camada SQL explícita
    data/            # infra partilhada (DuckDB, loaders)
    shared/
```

**Regras:**

- A API já usa `features/jornada` com controllers, services e domain — **manter e estender** o mesmo padrão para qualquer nova área (ex.: `gerencial`, `internacao` como sub-features ou features irmãs, conforme tamanho).
- Componentes React em `web/src/components/<area>` devem **migrar** para `web/src/features/<area>/components` quando a área for um recorte de produto fechado; design system → `shared`.

## Situação atual neste repositório

API **já alinhada** em `api/src/features/jornada/...`. No **web**, os painéis foram movidos para `web/src/features/gerencial/components/`, `web/src/features/internacao/components/` e gráficos/UI genéricos para `web/src/shared/components/`; o `App` em `features/jornada` importa os módulos irmãos.

## Etapas do processo (checklist)

1. **Mapa web** — Listar pastas em `web/src/components` e decidir feature alvo (`features/jornada`, `features/internacao`, etc.).
2. **Migração incremental** — Mover um domínio de cada vez; atualizar imports e rotas React.
3. **Paridade com API** — Nomes de features no web alinhados aos da API para navegação intuitiva.
4. **`data/` e DuckDB** — Manter como infra em `api/src/data` ou `core`; features consomem via services, não importam detalhes de ficheiros Parquet nas rotas.
5. **Testes e build** — Garantir que `npm run build` em `web` e `api` passa após cada bloco de movimentos.
6. **Documentação** — Atualizar documentação do BI com diagrama simples features ↔ dashboards.

**Ordem sugerida:** migrar primeiro os componentes mais acoplados a uma única API (`internacao` ↔ endpoints de internação).

## Critério de conclusão

- `web/src/features/` reflete as mesmas fronteiras que `api/src/features/`.
- Sem lógica de dashboard “solta” na raiz de `components/` que pertença claramente a uma feature.

## Ambiente local (dev)

| Alvo | Comando típico | Porta |
|--------|----------------|--------|
| Web (Vite) | `npm run dev --prefix web` ou `cd web && npm run dev` | **5175** (`strictPort`; proxy `/api` → `http://127.0.0.1:3333`) |
| API (Express) | `npm run dev --prefix api` | **3333** (variável `PORT` / env em `core/config/env.ts`) |
| Monorepo | `npm run dev` na raiz `NOVO BI` | `concurrently` api + web |
