"""
Pré-aquece a cache Redis do GET /api/v1/gerencia/dashboard-bundle.

Uso (na raiz do repositório, com PYTHONPATH=.):
  set PYTHONPATH=%CD%
  python bi_api/scripts/refresh_gerencia_bundle_cache.py --period 90 --regional ES
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


async def _run(query: dict[str, str]) -> None:
    from bi_api.bundle_service import get_gerencia_dashboard_bundle
    from bi_core.cache_redis import RedisJsonCache, connect_redis
    from bi_core.config import load_env, redis_url
    from bi_core.db_pg import create_pool, wants_postgres
    from bi_gerencia.service import LiveService

    load_env()
    url = redis_url()
    if not url:
        raise SystemExit("Redis desativado (REDIS_DISABLED=1) ou sem REDIS_URL.")

    cache = RedisJsonCache(await connect_redis(url))
    pool = None
    try:
        if wants_postgres():
            pool = await create_pool()
        live = LiveService(pool)
        await get_gerencia_dashboard_bundle(cache=cache, live=live, pool=pool, query=query)
    finally:
        await cache.close()
        if pool:
            await pool.close()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--period", default="", help="ex.: 30, 90, 366")
    p.add_argument("--regional", default="")
    p.add_argument("--unidade", default="")
    args = p.parse_args()
    q: dict[str, str] = {}
    if args.period:
        q["period"] = args.period
    if args.regional:
        q["regional"] = args.regional
    if args.unidade:
        q["unidade"] = args.unidade
    asyncio.run(_run(q))
    print("Cache Redis atualizada para:", q or "(sem query)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
