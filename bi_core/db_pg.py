"""
Camada PostgreSQL (espelho de node_legado/api/db_postgres.js + mapa em node_legado/api/db_sqlite.js).
Manter LOGICAL_TO_TABLE alinhado a LOGICAL_TO_SQLITE_TABLE no Node.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any

import asyncpg
import orjson

# Mesmas chaves que node_legado/api/db_sqlite.js — valores schema.tabela
LOGICAL_TO_TABLE: dict[str, str] = {
    "vw_painel_ps_base": "cmc_hospital.vw_painel_ps_base",
    "ps_resumo_unidades_snapshot_prod": "cmc_hospital.ps_resumo_unidades_snapshot_prod",
    "tbl_tempos_entrada_consulta_saida": "cmc_hospital.tbl_tempos_entrada_consulta_saida",
    "tbl_tempos_medicacao": "cmc_hospital.tbl_tempos_medicacao",
    "tbl_tempos_laboratorio": "cmc_hospital.tbl_tempos_laboratorio",
    "tbl_tempos_rx_e_ecg": "cmc_hospital.tbl_tempos_rx_e_ecg",
    "tbl_tempos_tc_e_us": "cmc_hospital.tbl_tempos_tc_e_us",
    "tbl_tempos_reavaliacao": "cmc_hospital.tbl_tempos_reavaliacao",
    "tbl_altas_ps": "cmc_hospital.tbl_altas_ps",
    "tbl_intern_conversoes": "cmc_hospital.tbl_intern_conversoes",
    "tbl_vias_medicamentos": "cmc_hospital.tbl_vias_medicamentos",
    "meta_tempos": "cmc_hospital.meta_tempos",
    "tbl_unidades": "cmc_hospital.tbl_unidades",
    "tbl_unidades_teste": "cmc_hospital.tbl_unidades_teste",
    "tbl_unidades_prod": "central_command.tbl_unidades_prod",
}

UNIDADES_LOGICAL = frozenset({"tbl_unidades", "tbl_unidades_teste", "tbl_unidades_prod"})

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_DOTTED = re.compile(r"^[a-z_][a-z0-9_]*\.[a-z0-9_]+$", re.I)


def _strip_outer_quotes(s: str) -> str:
    t = s.strip()
    if len(t) >= 2 and t[0] == t[-1] and t[0] in "\"'":
        return t[1:-1]
    return t


def _ssl_mode() -> Any:
    mode = (os.environ.get("PGSSLMODE") or os.environ.get("PG_SSLMODE") or "").lower()
    if mode in ("require", "verify-full"):
        import ssl

        ctx = ssl.create_default_context()
        if mode != "verify-full":
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        return ctx
    if os.environ.get("PGSSL") == "1" or os.environ.get("PG_SSL") == "1":
        import ssl

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    return None


def _statement_timeout_ms() -> int | None:
    raw = (os.environ.get("PG_STATEMENT_TIMEOUT_MS") or "300000").strip()
    try:
        ms = int(raw, 10)
    except ValueError:
        return None
    if ms <= 0:
        return None
    return min(max(ms, 1000), 3_600_000)


def resolve_pool_connect_kwargs() -> tuple[str | None, dict[str, Any]]:
    """
    Retorna (dsn_ou_None, kwargs) para asyncpg.create_pool.
    Sem DATABASE_URL usa host/database/user/password (evita URL com senha mal escapada).
    """
    url = (os.environ.get("DATABASE_URL") or "").strip()
    ssl = _ssl_mode()
    st_ms = _statement_timeout_ms()
    server_settings: dict[str, str] = {}
    if st_ms is not None:
        # Em SET, inteiro = milissegundos (documentação runtime-config client).
        server_settings["statement_timeout"] = str(st_ms)

    kwargs: dict[str, Any] = {}
    if ssl is not None:
        kwargs["ssl"] = ssl
    if server_settings:
        kwargs["server_settings"] = server_settings

    if url:
        return url, kwargs

    host = (os.environ.get("PGHOST") or os.environ.get("PG_HOST") or os.environ.get("DB_HOST") or "").strip()
    if not host:
        return None, kwargs

    port = int(os.environ.get("PGPORT") or os.environ.get("PG_PORT") or os.environ.get("DB_PORT") or "5432")
    database = (
        os.environ.get("PGDATABASE") or os.environ.get("PG_DATABASE") or os.environ.get("DB_NAME") or "postgres"
    ).strip()
    user = _strip_outer_quotes(
        os.environ.get("PGUSER")
        or os.environ.get("PG_USER")
        or os.environ.get("DB_READ_USER")
        or os.environ.get("DB_USER")
        or ""
    )
    password = _strip_outer_quotes(
        os.environ.get("PGPASSWORD")
        or os.environ.get("PG_PASSWORD")
        or os.environ.get("DB_READ_PASSWORD")
        or os.environ.get("DB_PASSWORD")
        or ""
    )

    kwargs["host"] = host
    kwargs["port"] = port
    kwargs["database"] = database
    if user:
        kwargs["user"] = user
    if password:
        kwargs["password"] = password
    return None, kwargs


def wants_postgres() -> bool:
    u = (os.environ.get("DATABASE_URL") or "").strip()
    h = (os.environ.get("PGHOST") or os.environ.get("PG_HOST") or os.environ.get("DB_HOST") or "").strip()
    return bool(u or h)


def quote_pg_ident(part: str) -> str:
    s = part.strip()
    if not _IDENT.match(s):
        raise ValueError(f"Identificador PostgreSQL inválido: {s}")
    return '"' + s.replace('"', '""') + '"'


def parse_schema_table(dotted: str) -> tuple[str, str]:
    s = dotted.strip()
    i = s.find(".")
    if i <= 0 or i == len(s) - 1:
        raise ValueError(f"Nome schema.tabela inválido: {dotted}")
    return s[:i], s[i + 1 :]


def sanitize_columns(columns: str) -> str:
    raw = (columns or "*").strip()
    if raw == "*":
        return "*"
    parts = [quote_pg_ident(c.strip()) for c in raw.split(",") if c.strip()]
    return ", ".join(parts)


def normalize_pg_row(logical: str, row: dict[str, Any]) -> dict[str, Any]:
    if logical in UNIDADES_LOGICAL:
        return {str(k).lower(): v for k, v in row.items()}
    return {str(k).upper(): v for k, v in row.items()}


async def create_pool() -> asyncpg.Pool:
    dsn, kwargs = resolve_pool_connect_kwargs()
    if dsn is None and not kwargs.get("host"):
        raise RuntimeError(
            "PostgreSQL não configurado: defina DATABASE_URL ou PGHOST (+ PGDATABASE/PGUSER/PGPASSWORD)."
        )
    max_size = int(os.environ.get("PG_POOL_MAX", "10"))
    if dsn:
        return await asyncpg.create_pool(dsn, min_size=1, max_size=max_size, **kwargs)
    return await asyncpg.create_pool(min_size=1, max_size=max_size, **kwargs)


async def fetch_view(
    pool: asyncpg.Pool,
    view_name: str,
    *,
    columns: str = "*",
    order_by: str | None = None,
    ascending: bool = True,
    limit: int | None = None,
    date_from: datetime | None = None,
    date_columns: list[str] | None = None,
) -> list[dict[str, Any]]:
    logical = view_name.strip()
    dotted = LOGICAL_TO_TABLE.get(logical)
    if not dotted:
        raise ValueError(f"PostgreSQL: objeto não mapeado: {logical}")
    if not _DOTTED.match(dotted):
        raise ValueError(f"Nome schema.tabela inválido: {dotted}")

    schema, table = parse_schema_table(dotted)
    cols = sanitize_columns(columns)
    from_sql = f"{quote_pg_ident(schema)}.{quote_pg_ident(table)}"
    sql = f"SELECT {cols} FROM {from_sql}"
    params: list[Any] = []
    if date_from is not None and date_columns:
        iso = date_from.astimezone(timezone.utc).replace(tzinfo=None).isoformat()
        or_parts = [f"{quote_pg_ident(c.strip().lower())}::timestamp >= $1::timestamp" for c in date_columns]
        sql += " WHERE (" + " OR ".join(or_parts) + ")"
        params.append(iso)

    if order_by:
        sql += f" ORDER BY {quote_pg_ident(order_by)} {'ASC' if ascending else 'DESC'}"

    if limit is not None and isinstance(limit, int) and limit > 0:
        sql += f" LIMIT {int(limit)}"

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

    out: list[dict[str, Any]] = []
    for r in rows:
        d = {k: r[k] for k in r.keys()}
        out.append(normalize_pg_row(logical, d))
    return out


async def fetch_bundle_payload_from_view(pool: asyncpg.Pool, dotted: str) -> dict[str, Any] | None:
    """
    Uma linha de schema.view/tabela com coluna JSON (json/jsonb ou texto JSON).
    Nome da coluna: GERENCIA_BUNDLE_PAYLOAD_COLUMN (default: payload).
    """
    s = dotted.strip()
    if not _DOTTED.match(s):
        raise ValueError(f"Nome schema.objeto inválido: {dotted}")
    schema, table = parse_schema_table(s)
    col = (os.environ.get("GERENCIA_BUNDLE_PAYLOAD_COLUMN") or "payload").strip() or "payload"
    if not _IDENT.match(col):
        raise ValueError(f"Coluna payload inválida: {col}")
    from_sql = f"{quote_pg_ident(schema)}.{quote_pg_ident(table)}"
    sql = f"SELECT {quote_pg_ident(col)} AS _p FROM {from_sql} LIMIT 1"
    async with pool.acquire() as conn:
        row = await conn.fetchrow(sql)
    if not row or row["_p"] is None:
        return None
    val = row["_p"]
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        return orjson.loads(val.encode("utf-8"))
    if isinstance(val, (bytes, bytearray, memoryview)):
        return orjson.loads(bytes(val))
    return None
