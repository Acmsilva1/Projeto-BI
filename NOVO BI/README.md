# NOVO BI

Workspace TypeScript com arquitetura modular por feature.

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
├── shared/
└── features/jornada/
    ├── App.tsx
    ├── api.ts
    ├── apiBase.ts
    └── components/
        ├── MapFlow.tsx
        ├── SectorBackgroundNode.tsx
        ├── PatientWalkingNode.tsx
        ├── PatientQueueRow.tsx
        ├── StepDetailModal.tsx
        └── FootprintEdge.tsx
```

### API (`api/src`)

```text
api/src/
├── app.ts
├── server.ts
├── config/
│   └── env.ts
├── data/
│   ├── services/
│   │   └── duckdb.service.ts
│   └── utils/
│       └── datasetTableLoader.ts
├── shared/
│   └── utils/
│       └── arrow.ts
└── features/jornada/
    ├── controllers/
    ├── routes/
    ├── services/
    └── domain/dashboard/
        └── dashboardQueryCatalog.ts
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
