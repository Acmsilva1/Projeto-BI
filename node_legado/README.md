# Node (legado e tooling Node)

Tudo o que depende de **Node.js** e **não** faz parte da pipeline Python (`bi_core`, `bi_gerencia`, `bi_api`) está aqui.

| Pasta / ficheiro | Conteúdo |
| --- | --- |
| **`api/`** | Express, `live_service.js`, `db*.js`, testes de DB, `.env.example`. |
| **`scripts/`** | Seeds SQLite (`seed-unidades-ps.js`, `seed-gerencia-dados.js`). |
| **`web-dev/`** | `launch-api-python.cjs`, `wait-api.cjs` — usados pelo `npm run dev` em `web/`. |
| **`pipeline/`** | `viz.mjs` e opcional `.env` legado. |

A API em produção no fluxo atual é **FastAPI** na raiz (`bi_*`). Para subir só o Python: na raiz, `PYTHONPATH` = raiz do repo e `python -m uvicorn bi_api.main:app` (ou `bi_api/start.ps1`).
