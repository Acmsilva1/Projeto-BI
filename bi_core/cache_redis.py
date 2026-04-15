"""Cache Redis assíncrona (bytes JSON via orjson)."""

from __future__ import annotations

import logging
from typing import Any

import orjson

log = logging.getLogger(__name__)


class RedisJsonCache:
    def __init__(self, client: Any | None):
        self._client = client

    @property
    def enabled(self) -> bool:
        return self._client is not None

    async def get_json(self, key: str) -> Any | None:
        if not self._client:
            return None
        try:
            raw = await self._client.get(key)
            if raw is None:
                return None
            if isinstance(raw, str):
                raw = raw.encode("utf-8")
            return orjson.loads(raw)
        except Exception as e:
            log.warning("Redis GET %s: %s", key, e)
            return None

    async def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        if not self._client:
            return
        try:
            payload = orjson.dumps(value)
            await self._client.set(key, payload, ex=ttl_seconds)
        except Exception as e:
            log.warning("Redis SET %s: %s", key, e)

    async def close(self) -> None:
        if self._client:
            try:
                await self._client.aclose()
            except Exception:
                pass


async def connect_redis(url: str) -> Any:
    import redis.asyncio as redis

    return redis.from_url(url, decode_responses=False, socket_connect_timeout=5)
