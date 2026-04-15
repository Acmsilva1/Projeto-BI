"""Gerência dashboard-bundle: Redis → (opcional Postgres JSON view) → LiveService Python."""

from __future__ import annotations

import hashlib
import logging
from typing import TYPE_CHECKING, Any

import orjson

from bi_core.cache_redis import RedisJsonCache
from bi_core.config import gerencia_bundle_json_view, redis_cache_ttl_seconds
from bi_core.db_pg import fetch_bundle_payload_from_view, wants_postgres
from bi_core.polars_transform import apply_bundle_polars

if TYPE_CHECKING:
    from bi_gerencia.service import LiveService

log = logging.getLogger(__name__)


def _cache_key(query: dict[str, str]) -> str:
    items = sorted((k, str(v)) for k, v in query.items() if v is not None and str(v) != "")
    raw = orjson.dumps(items)
    h = hashlib.sha256(raw).hexdigest()[:40]
    return f"hospital_bi:v1:gerencia_dashboard_bundle:{h}"


async def _fetch_from_live_service(live: "LiveService", query: dict[str, str]) -> dict[str, Any]:
    result = await live.getGerenciaDashboardBundle(query)
    if not isinstance(result, dict):
        raise RuntimeError("getGerenciaDashboardBundle não devolveu objeto")
    return result


async def get_gerencia_dashboard_bundle(
    *,
    cache: RedisJsonCache,
    live: "LiveService",
    pool: Any | None,
    query: dict[str, str],
) -> dict[str, Any]:
    key = _cache_key(query)

    if cache.enabled:
        cached = await cache.get_json(key)
        if isinstance(cached, dict):
            return cached

    dotted = gerencia_bundle_json_view()
    if pool is not None and dotted and wants_postgres():
        try:
            row = await fetch_bundle_payload_from_view(pool, dotted)
            if row is not None:
                out = apply_bundle_polars(row)
                if cache.enabled:
                    await cache.set_json(key, out, redis_cache_ttl_seconds())
                return out
        except Exception as e:
            log.warning("Postgres bundle view falhou, fallback LiveService: %s", e)

    data = await _fetch_from_live_service(live, query)
    data = apply_bundle_polars(data)
    if cache.enabled:
        await cache.set_json(key, data, redis_cache_ttl_seconds())
    return data
