# NOVO BI

Workspace TypeScript com arquitetura modular por feature.

**Guias:** [mudanca_arquitetura.md](mudanca_arquitetura.md) · **[agents.md](agents.md)** (inclui **Checkpoint**). Dev web: **5175** (`vite --strictPort`).

## Pacotes

- `api/`: API Node + Express
- `web/`: App React + Vite
- `banco local/`: datasets locais (CSV/Parquet)

## Executar

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Arquitetura Atual

### Web (`web/src`)

```text
web/src/
├── main.tsx
├── index.css
├── vite-env.d.ts
├── shared/                    # componentes e utilitários transversais
└── features/
    ├── jornada/               # fluxo / mapa (ReactFlow)
    ├── gerencial/             # painéis gerenciais (heatmap, metas, etc.)
    └── internacao/            # internação (gráficos, metas)
```

### API (`api/src`)

```text
api/src/
├── app.ts
├── server.ts
├── core/
│   └── config/
│       └── env.ts             # env central (não usar pasta config/ solta na raiz)
├── data/
│   ├── services/
│   │   └── duckdb.service.ts
│   └── utils/
│       └── datasetTableLoader.ts
├── shared/
│   └── utils/
│       └── arrow.ts
└── features/jornada/          # rotas, controllers, services, domain (dashboard, internação, heatmap)
    ├── controllers/
    ├── routes/
    ├── services/
    └── domain/
        ├── dashboard/
        └── internacao/
```

## Endpoints principais

- `GET /api/v1/health`
- `GET /api/v1/ping`
- `GET /api/v1/data/views`
- `GET /api/v1/data/view/:viewName?limit=100`
- `GET /api/v1/dashboard/slugs`
- `GET /api/v1/dashboard/:slug`
- `GET /api/v1/ps-heatmap/chegadas`

## Notas da migracao (2026-04-24)

- Pacote `frontend` renomeado para `web`.
- API reorganizada para `features/jornada` + `shared/utils`.
- Banco e DuckDB centralizados em `api/src/data`.
- Frontend reorganizado para `features/jornada`.
- Pastas legadas removidas em seguranca apos validacao de build.
