"""
Hospital BI — FastAPI. Rotas /api/v1; Gerência em bi_gerencia (asyncpg via bi_core).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any, Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from bi_api.bundle_service import get_gerencia_dashboard_bundle
from bi_core.cache_redis import RedisJsonCache, connect_redis
from bi_core.config import api_listen_port, cors_origins, load_env, redis_url
from bi_core.db_pg import create_pool, wants_postgres
from bi_core.polars_transform import polars_version
from bi_gerencia import LiveService

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

Handler = Callable[..., Awaitable[Any]]


def _route_json(handler: Handler) -> Handler:
    async def wrapped(request: Request, *args: Any, **kwargs: Any) -> Any:
        try:
            data = await handler(request, *args, **kwargs)
            return {"ok": True, "data": data}
        except Exception as e:
            log.exception("API error")
            err_msg = str(e) or "Erro interno ao consultar dados"
            return JSONResponse({"ok": False, "error": err_msg}, status_code=500)

    return wrapped


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_env()
    app.state.pool = None
    app.state.cache = RedisJsonCache(None)

    rurl = redis_url()
    if rurl:
        try:
            app.state.cache = RedisJsonCache(await connect_redis(rurl))
            log.info("[bi_api] Redis: %s", rurl.split("@")[-1] if "@" in rurl else rurl)
        except Exception as e:
            log.warning("[bi_api] Redis indisponível: %s", e)

    if wants_postgres():
        try:
            app.state.pool = await create_pool()
            log.info("[bi_api] Pool PostgreSQL OK (motor Gerência + views JSON)")
        except Exception as e:
            log.warning("[bi_api] Postgres opcional não disponível: %s", e)

    app.state.live = LiveService(app.state.pool)
    log.info("[bi_api] LiveService (pool=%s)", app.state.pool is not None)

    yield

    await app.state.cache.close()
    if app.state.pool:
        await app.state.pool.close()


app = FastAPI(title="Hospital BI API (Python)", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/favicon.ico")
async def favicon():
    return Response(status_code=204)


@app.get("/api")
@app.get("/api/")
async def api_root_nag():
    return JSONResponse(
        {"ok": False, "error": "Rota inválida. Use prefixo /api/v1 (ex.: GET /api/v1/kpi)."},
        status_code=404,
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "api": "v1",
        "description": "FastAPI + LiveService Python (asyncpg) + Redis/Polars opcionais",
    }


@app.get("/api/v1/_meta/stack")
async def meta_stack():
    return {
        "ok": True,
        "data": {
            "polars": polars_version(),
            "redis": app.state.cache.enabled,
            "postgres_pool": app.state.pool is not None,
            "live_service_engine": "python_asyncpg",
        },
    }


def _q(request: Request) -> dict[str, str]:
    return {k: str(v) for k, v in request.query_params.items()}


@app.get("/api/v1/kpi")
@_route_json
async def kpi(request: Request):
    return await request.app.state.live.getKPIs(_q(request))


@app.get("/api/v1/kpi/unidades")
@_route_json
async def kpi_unidades(request: Request):
    return await request.app.state.live.getKpiUnidades(_q(request))


@app.get("/api/v1/overview/indicadores")
@_route_json
async def overview_indicadores(request: Request):
    return await request.app.state.live.getIndicadoresGerais(_q(request))


@app.get("/api/v1/overview/metas-volumes")
@_route_json
async def overview_metas_volumes(request: Request):
    return await request.app.state.live.getOverviewMetasVolumes(_q(request))


@app.get("/api/v1/gerencia/unidades-ps")
@_route_json
async def gerencia_unidades_ps(request: Request):
    return await request.app.state.live.getGerenciaUnidadesPs(_q(request))


@app.get("/api/v1/gerencia/metas-por-volumes")
@_route_json
async def gerencia_metas_por_volumes(request: Request):
    return await request.app.state.live.getGerenciaMetasPorVolumes(_q(request))


@app.get("/api/v1/gerencia/metricas-por-unidade")
@_route_json
async def gerencia_metricas_por_unidade(request: Request):
    return await request.app.state.live.getGerenciaMetricasPorUnidade(_q(request))


@app.get("/api/v1/gerencia/totais-ps")
@_route_json
async def gerencia_totais_ps(request: Request):
    return await request.app.state.live.getGerenciaTotaisPs(_q(request))


@app.get("/api/v1/gerencia/tempo-medio-etapas")
@_route_json
async def gerencia_tempo_medio_etapas(request: Request):
    return await request.app.state.live.getGerenciaTempoMedioEtapas(_q(request))


@app.get("/api/v1/gerencia/metas-acompanhamento-gestao")
@_route_json
async def gerencia_metas_acompanhamento(request: Request):
    return await request.app.state.live.getGerenciaMetasAcompanhamentoGestao(_q(request))


@app.get("/api/v1/gerencia/metas-conformes-por-unidade")
@_route_json
async def gerencia_metas_conformes(request: Request):
    return await request.app.state.live.getGerenciaMetasConformesPorUnidade(_q(request))


@app.get("/api/v1/gerencia/metas-por-volumes/indicador/{indicador_key}/unidades")
@_route_json
async def gerencia_metas_por_volumes_ind(request: Request, indicador_key: str):
    return await request.app.state.live.getGerenciaMetasPorVolumesPorIndicador(indicador_key, _q(request))


@app.get("/api/v1/gerencia/dashboard-bundle")
async def gerencia_dashboard_bundle(request: Request):
    query = _q(request)
    try:
        data = await get_gerencia_dashboard_bundle(
            cache=request.app.state.cache,
            live=request.app.state.live,
            pool=request.app.state.pool,
            query=query,
        )
        return {"ok": True, "data": data}
    except Exception as e:
        log.exception("dashboard-bundle")
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


def _ps(meth: str) -> Handler:
    @_route_json
    async def h(request: Request):
        fn = getattr(request.app.state.live, meth)
        return await fn(_q(request))

    return h


for _path, _meth in (
    ("volumes", "getPSVolumes"),
    ("kpis", "getPSKpis"),
    ("slas", "getPSSlas"),
    ("matrix", "getPSMatrix"),
    ("history", "getPSHistory"),
    ("perfil", "getPSPerfil"),
    ("fluxos", "getPSFluxos"),
    ("medicacao", "getPSMedicacao"),
    ("conversao", "getPSConversao"),
):
    app.add_api_route(f"/api/v1/ps/{_path}", _ps(_meth), methods=["GET"])


def _fin(meth: str) -> Handler:
    @_route_json
    async def h(request: Request):
        fn = getattr(request.app.state.live, meth)
        return await fn(_q(request))

    return h


for _path, _meth in (
    ("resumo", "getFinanceiroResumo"),
    ("convenio", "getFinanceiroConvenio"),
    ("glosas", "getFinanceiroGlosas"),
):
    app.add_api_route(f"/api/v1/financeiro/{_path}", _fin(_meth), methods=["GET"])


@app.get("/api/v1/ocupacao/setor")
@_route_json
async def ocup_setor(request: Request):
    return await request.app.state.live.getOcupacaoSetor(_q(request))


@app.get("/api/v1/ocupacao/kpis")
@_route_json
async def ocup_kpis(request: Request):
    return await request.app.state.live.getInternacaoKPIs(_q(request))


@app.get("/api/v1/ocupacao/resumo")
@_route_json
async def ocup_resumo(request: Request):
    return await request.app.state.live.getInternacaoResumo(_q(request))


@app.get("/api/v1/ocupacao/internacoes")
@_route_json
async def ocup_internacoes(request: Request):
    return await request.app.state.live.getInternacoes(_q(request))


@app.get("/api/v1/ocupacao/tendencia")
@_route_json
async def ocup_tendencia(request: Request):
    return await request.app.state.live.getOcupacaoTendencia(_q(request))


@app.get("/api/v1/ocupacao/qualidade")
@_route_json
async def ocup_qualidade(request: Request):
    return await request.app.state.live.getOcupacaoQualidade()


for _path, _meth in (
    ("especialidade", "getCirurgiaEspecialidade"),
    ("evolucao", "getCirurgiaEvolucao"),
    ("tempo-centro", "getCirurgiaTempoCentro"),
):
    app.add_api_route(f"/api/v1/cirurgia/{_path}", _fin(_meth), methods=["GET"])


@app.get("/api/v1/cc/performance")
@_route_json
async def cc_perf(request: Request):
    return await request.app.state.live.getCCPerformance(_q(request))


@app.get("/api/v1/cc/kpis")
@_route_json
async def cc_kpis(request: Request):
    return await request.app.state.live.getCCKpis(_q(request))


@app.get("/api/v1/cc/timeline")
@_route_json
async def cc_timeline(request: Request):
    return await request.app.state.live.getCCPerformanceTimeline(_q(request))


def run():
    import uvicorn

    uvicorn.run(
        "bi_api.main:app",
        host="127.0.0.1",
        port=api_listen_port(),
        reload=False,
    )


if __name__ == "__main__":
    run()
