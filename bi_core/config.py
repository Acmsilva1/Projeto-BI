"""Carrega .env na mesma ordem de prioridade que node_legado/api/server.js (legado)."""

from __future__ import annotations

import os
from pathlib import Path


def load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return

    here = Path(__file__).resolve()
    repo = here.parent

    for path in (repo / "node_legado" / "pipeline" / ".env", repo / "bi_api" / ".env"):
        if path.is_file():
            load_dotenv(path, override=False)

    root_env = repo / ".env"
    if root_env.is_file():
        load_dotenv(root_env, override=True)


def api_listen_port() -> int:
    """Alinhado ao wait-api do Vite: HOSPITAL_BI_API_PORT (ex.: 3020)."""
    return int(
        os.environ.get("HOSPITAL_BI_API_PORT")
        or os.environ.get("HOSPITAL_BI_PYTHON_PORT")
        or "3020",
    )


def redis_url() -> str | None:
    if (os.environ.get("REDIS_DISABLED") or "").strip().lower() in ("1", "true", "yes"):
        return None
    u = (os.environ.get("REDIS_URL") or "").strip()
    return u or "redis://127.0.0.1:6379/0"


def redis_cache_ttl_seconds() -> int:
    try:
        return max(30, int(os.environ.get("REDIS_CACHE_TTL_SECONDS", "300"), 10))
    except ValueError:
        return 300


def gerencia_bundle_json_view() -> str | None:
    """schema.view — opcional; ver bundle_service / db_pg."""
    v = (os.environ.get("GERENCIA_BUNDLE_JSON_VIEW") or "").strip()
    return v or None


def cors_origins() -> list[str]:
    raw = [
        "http://127.0.0.1:5180",
        "http://localhost:5180",
        "http://127.0.0.1:5188",
        "http://localhost:5188",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:1573",
        (os.environ.get("FRONTEND_URL") or "").strip(),
    ]
    return [x for x in raw if x]
