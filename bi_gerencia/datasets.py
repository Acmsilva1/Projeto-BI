"""Carregamento de views Gerência + unidades PS — espelho do legado node_legado/api/live_service.js."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime
from typing import TYPE_CHECKING, Any

from bi_gerencia.constants import DEMO_UNIDADES_PS, GERENCIA_FACT_DATE_COLUMNS
from bi_gerencia.util import row_is_ps_ativo, sort_unidades_por_codigo_impl

if TYPE_CHECKING:
    import asyncpg

log = logging.getLogger(__name__)

GERENCIA_DS_TTL_MS = 25_000
_gerencia_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_gerencia_inflight: dict[str, asyncio.Task] = {}


def _gerencia_sql_date_filter_enabled() -> bool:
    v = os.environ.get("GERENCIA_SQL_DATE_FILTER")
    if v is None or str(v).strip() == "":
        return True
    return str(v).strip() != "0"


def gerencia_dataset_cache_key(query: dict) -> str:
    if not _gerencia_sql_date_filter_enabled():
        return "full"
    try:
        p = float(query.get("period", ""))
    except (TypeError, ValueError):
        p = 0.0
    period_key = int(p) if p > 0 and p == p else 365
    return f"df:{period_key}"


def gerencia_fetch_opts(logical: str, query: dict) -> dict[str, Any]:
    if not _gerencia_sql_date_filter_enabled():
        return {}
    cols = GERENCIA_FACT_DATE_COLUMNS.get(logical)
    if not cols:
        return {}
    from bi_gerencia.util import parse_period_start

    return {"date_from": parse_period_start(query), "date_columns": cols}


async def safe_fetch_view(
    pool: "asyncpg.Pool | None",
    view_name: str,
    *,
    columns: str = "*",
    order_by: str | None = None,
    date_from: datetime | None = None,
    date_columns: list[str] | None = None,
) -> list[dict[str, Any]]:
    if pool is None:
        return []
    try:
        from bi_core.db_pg import fetch_view

        return await fetch_view(
            pool,
            view_name,
            columns=columns,
            order_by=order_by,
            date_from=date_from,
            date_columns=date_columns,
        )
    except Exception as e:
        log.warning("[LiveService] fetch %s failed: %s", view_name, e)
        return []


def sort_unidades_por_codigo(lst: list[dict]) -> list[dict]:
    return sort_unidades_por_codigo_impl(lst)


async def load_unidades_ps_from_db(pool: "asyncpg.Pool | None") -> list[dict]:
    candidates = ["tbl_unidades", "tbl_unidades_teste", "tbl_unidades_prod"]
    for table in candidates:
        rows = await safe_fetch_view(
            pool,
            table,
            columns="id,nome,uf,cd_estabelecimento,ps",
            order_by="cd_estabelecimento",
        )
        if not rows:
            continue
        mapped = []
        for r in rows:
            if not row_is_ps_ativo(r):
                continue
            cod = str(r.get("cd_estabelecimento") or r.get("id") or "")
            nome = str(r.get("nome") or "").strip() or str(r.get("id") or "")
            mapped.append(
                {
                    "codigo": cod,
                    "unidadeId": cod,
                    "unidadeNome": nome,
                    "regional": str(r.get("uf") or "").strip().upper(),
                }
            )
        mapped = [u for u in mapped if u["unidadeId"]]
        if mapped:
            return sort_unidades_por_codigo(mapped)
    return sort_unidades_por_codigo(list(DEMO_UNIDADES_PS))


def filter_units_by_query(units: list[dict], query: dict) -> list[dict]:
    out = list(units)
    if query.get("regional"):
        out = [u for u in out if u.get("regional") == query["regional"]]
    if query.get("unidade"):
        out = [u for u in out if str(u.get("unidadeId")) == str(query["unidade"])]
    return sort_unidades_por_codigo(out)


def filter_unidades_ps_matriz(units_base: list[dict], query: dict) -> list[dict]:
    out = list(units_base)
    if query.get("regional"):
        out = [u for u in out if u.get("regional") == query["regional"]]
    if query.get("unidade"):
        out = [u for u in out if str(u.get("unidadeId")) == str(query["unidade"])]
    return sort_unidades_por_codigo(out)


async def load_gerencia_datasets(pool: "asyncpg.Pool | None", query: dict) -> dict[str, Any]:
    cache_key = gerencia_dataset_cache_key(query)
    now = time.monotonic() * 1000
    hit = _gerencia_cache.get(cache_key)
    if hit and now - hit[0] < GERENCIA_DS_TTL_MS:
        return hit[1]

    inflight = _gerencia_inflight.get(cache_key)
    if inflight:
        return await inflight

    async def _load() -> dict[str, Any]:
        try:

            def fo(logical: str) -> dict[str, Any]:
                o = gerencia_fetch_opts(logical, query)
                return o

            o_flux = fo("tbl_tempos_entrada_consulta_saida")
            o_med = fo("tbl_tempos_medicacao")
            o_lab = fo("tbl_tempos_laboratorio")
            o_rx = fo("tbl_tempos_rx_e_ecg")
            o_tc = fo("tbl_tempos_tc_e_us")
            o_re = fo("tbl_tempos_reavaliacao")
            o_al = fo("tbl_altas_ps")
            o_co = fo("tbl_intern_conversoes")
            o_vi = fo("tbl_vias_medicamentos")
            o_me = fo("meta_tempos")

            flux_rows, med_rows, lab_rows, rx_rows, tcus_rows, reav_rows, altas_rows, conv_rows, vias_rows, metas_rows = await asyncio.gather(
                safe_fetch_view(pool, "tbl_tempos_entrada_consulta_saida", **o_flux),
                safe_fetch_view(pool, "tbl_tempos_medicacao", **o_med),
                safe_fetch_view(pool, "tbl_tempos_laboratorio", **o_lab),
                safe_fetch_view(pool, "tbl_tempos_rx_e_ecg", **o_rx),
                safe_fetch_view(pool, "tbl_tempos_tc_e_us", **o_tc),
                safe_fetch_view(pool, "tbl_tempos_reavaliacao", **o_re),
                safe_fetch_view(pool, "tbl_altas_ps", **o_al),
                safe_fetch_view(pool, "tbl_intern_conversoes", **o_co),
                safe_fetch_view(pool, "tbl_vias_medicamentos", **o_vi),
                safe_fetch_view(pool, "meta_tempos", **o_me),
            )
            out = {
                "flux_rows": flux_rows,
                "med_rows": med_rows,
                "lab_rows": lab_rows,
                "rx_rows": rx_rows,
                "tcus_rows": tcus_rows,
                "reav_rows": reav_rows,
                "altas_rows": altas_rows,
                "conv_rows": conv_rows,
                "vias_rows": vias_rows or [],
                "metas_rows": metas_rows,
            }
            _gerencia_cache[cache_key] = (time.monotonic() * 1000, out)
            return out
        finally:
            _gerencia_inflight.pop(cache_key, None)

    t = asyncio.create_task(_load())
    _gerencia_inflight[cache_key] = t
    return await t
