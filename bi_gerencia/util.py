"""Funções utilitárias espelhadas de node_legado/api/live_service.js."""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable

from bi_gerencia.constants import PBI_VIAS_EXCLUDE_CD_MATERIAL


def as_number(v: Any) -> float:
    try:
        n = float(v)
        return n if n == n and n not in (float("inf"), float("-inf")) else 0.0
    except (TypeError, ValueError):
        return 0.0


def norm_upper(s: Any) -> str:
    return str(s or "").strip().upper()


def contains_any(text: Any, needles: list[str]) -> bool:
    t = norm_upper(text)
    return any(norm_upper(n) in t for n in needles)


def n_key(*parts: Any) -> str:
    return "|".join(str(p if p is not None else "") for p in parts)


def ratio_pct(num: float, den: float) -> float:
    if not den:
        return 0.0
    return (num / den) * 100.0


def distinct_count_by(rows: list[dict], key_fn: Callable[[dict], str]) -> int:
    return len({key_fn(r) for r in rows})


def avg(rows: list[dict], value_fn: Callable[[dict], float]) -> float:
    if not rows:
        return 0.0
    vals: list[float] = []
    for r in rows:
        v = value_fn(r)
        if isinstance(v, bool):
            continue
        if isinstance(v, (int, float)) and v == v and abs(v) < 1e308:
            vals.append(float(v))
    if not vals:
        return 0.0
    return sum(vals) / len(vals)


def to_date(v: Any) -> datetime | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.replace(tzinfo=None) if v.tzinfo else v
    if isinstance(v, date):
        return datetime.combine(v, datetime.min.time())
    if isinstance(v, (int, float)):
        try:
            return datetime.utcfromtimestamp(float(v))
        except (OSError, ValueError, OverflowError):
            return None
    s = str(v).strip()
    if not s:
        return None
    try:
        if "T" in s or s.endswith("Z"):
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return d.replace(tzinfo=None) if d.tzinfo else d
        if re.match(r"^\d{4}-\d{2}-\d{2}", s):
            parts = s[:10].split("-")
            return datetime(int(parts[0]), int(parts[1]), int(parts[2]))
    except (ValueError, TypeError):
        pass
    return None


def pick_date(row: dict, fields: list[str]) -> datetime | None:
    for f in fields:
        # Postgres uppercase keys
        val = row.get(f) or row.get(f.upper()) or row.get(f.lower())
        d = to_date(val)
        if d:
            return d
    return None


def to_month_key(d: datetime | None) -> str | None:
    if not d:
        return None
    return f"{d.year}-{str(d.month).zfill(2)}"


def shift_month_key(month_key: str, delta_months: int) -> str:
    parts = str(month_key).split("-")
    y, mo = int(parts[0]), int(parts[1])
    mo += delta_months
    while mo > 12:
        mo -= 12
        y += 1
    while mo < 1:
        mo += 12
        y -= 1
    return f"{y}-{str(mo).zfill(2)}"


def january_key_of(month_key: str) -> str:
    return f"{str(month_key)[:4]}-01"


def parse_period_start(query: dict | None = None) -> datetime:
    q = query or {}
    try:
        days = float(q.get("period", ""))
    except (TypeError, ValueError):
        days = 0
    now = datetime.now()
    if days == 366:
        return datetime(now.year, 1, 1)
    if days > 0 and days == days:
        return now - timedelta(days=int(days))
    return now - timedelta(days=30)


def is_in_period(row_date: datetime | None, query: dict | None = None) -> bool:
    if not row_date:
        return False
    return row_date >= parse_period_start(query or {})


_PT_MO = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


def format_month_pt_br(key: str) -> str:
    parts = str(key or "").split("-")
    if len(parts) < 2:
        return key
    try:
        y, m = int(parts[0]), int(parts[1])
        s = f"{_PT_MO[m]}/{str(y % 100).zfill(2)}"
        return s[0].upper() + s[1:] if s else key
    except (ValueError, IndexError):
        return key


def month_keys_overlapping_query_period(query: dict | None = None) -> list[str]:
    start = parse_period_start(query or {})
    end = datetime.now()
    keys: list[str] = []
    cur = datetime(start.year, start.month, 1)
    end_m = datetime(end.year, end.month, 1)
    while cur <= end_m:
        mk = to_month_key(cur)
        if mk:
            keys.append(mk)
        if cur.month == 12:
            cur = datetime(cur.year + 1, 1, 1)
        else:
            cur = datetime(cur.year, cur.month + 1, 1)
    if not keys:
        k = to_month_key(datetime.now())
        keys = [k] if k else []
    if len(keys) > 24:
        return keys[-24:]
    return keys


def months_labels_from_keys(mes_keys: list[str] | None) -> list[str]:
    return [format_month_pt_br(k) for k in (mes_keys or [])]


def is_destino_internado_pbi(r: dict) -> bool:
    v = str(r.get("DESTINO") or "").strip()
    return v.lower() == "internado"


def reavaliacao_minutos_pbi(r: dict) -> float | None:
    dt_ini = pick_date(r, ["DT_SOLIC_REAVALIACAO"])
    if not dt_ini:
        return None
    dt_evo = pick_date(r, ["DT_EVO_PRESC"])
    dt_fim = pick_date(r, ["DT_FIM_REAVALIACAO"])
    dt_ref = None
    if not dt_evo and not dt_fim:
        return None
    if not dt_evo:
        dt_ref = dt_fim
    elif not dt_fim:
        dt_ref = dt_evo
    else:
        dt_ref = dt_evo if dt_evo <= dt_fim else dt_fim
    if not dt_ref:
        return None
    return (dt_ref - dt_ini).total_seconds() / 60.0


def reavaliacao_linha_valida_denominador_pbi(r: dict) -> bool:
    if not pick_date(r, ["DT_SOLIC_REAVALIACAO"]):
        return False
    return bool(pick_date(r, ["DT_EVO_PRESC"]) or pick_date(r, ["DT_FIM_REAVALIACAO"]))


def media_medicacoes_por_paciente_pbi(vias_rows: list[dict]) -> float:
    if not vias_rows:
        return 0.0
    by_nr: dict[str, set[str]] = {}
    for r in vias_rows:
        cd = int(as_number(r.get("CD_MATERIAL")))
        if cd in PBI_VIAS_EXCLUDE_CD_MATERIAL:
            continue
        nr = n_key(r.get("NR_ATENDIMENTO"))
        by_nr.setdefault(nr, set()).add(f"{n_key(r.get('NR_PRESCRICAO'))}|{cd}")
    if not by_nr:
        return 0.0
    return sum(len(s) for s in by_nr.values()) / len(by_nr)


def desfecho_medico_atend_distinct_count_pbi(flux_rows: list[dict]) -> int:
    s: set[str] = set()
    for r in flux_rows:
        if not pick_date(r, ["DT_DESFECHO"]):
            continue
        md = norm_upper(r.get("MEDICO_DESFECHO"))
        ma = norm_upper(r.get("MEDICO_ATENDIMENTO"))
        if not md or not ma or md != ma:
            continue
        s.add(n_key(r.get("NR_ATENDIMENTO")))
    return len(s)


def row_is_ps_ativo(r: dict) -> bool:
    v = r.get("ps")
    if v is None:
        return True
    if v is True or v == 1:
        return True
    s = str(v).strip().lower()
    return s in ("true", "t", "1", "s", "sim", "yes")


def establishment_id_lookup_keys(id_val: Any) -> list[str]:
    s = str(id_val or "").strip()
    if not s:
        return []
    keys: set[str] = {s}
    if re.match(r"^\d+$", s):
        n = int(s, 10)
        keys.add(str(n))
        keys.add(str(n).zfill(2))
        keys.add(str(n).zfill(3))
    return list(keys)


def row_unit_id(row: dict) -> str | None:
    direct = (
        row.get("unidade_id")
        or row.get("unidadeId")
        or row.get("CD_ESTABELECIMENTO")
        or row.get("cd_estabelecimento")
        or row.get("CD_ESTAB_URG")
        or row.get("CD_ESTAB_INT")
    )
    if direct is not None and str(direct).strip() != "":
        return str(direct)
    return None


def row_unidade_nome(row: dict) -> str:
    return str(row.get("UNIDADE") or row.get("unidade") or "").strip()


def fmt_meta_br(n: float) -> str:
    return f"{float(n):.1f}".replace(".", ",")


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def label_unidade_ps(u: dict) -> str:
    nome = str(u.get("unidadeNome") or "").strip()
    reg = str(u.get("regional") or "").strip()
    cod_raw = u.get("codigo")
    cod = str(cod_raw).zfill(3) if cod_raw is not None and str(cod_raw).strip() != "" else ""
    if cod and nome and reg:
        return f"{cod} - {nome}_{reg}"
    if reg and nome:
        return f"{reg} - {nome}"
    return nome or reg or str(u.get("unidadeId") or "")


def sort_unidades_por_codigo_impl(lst: list[dict]) -> list[dict]:
    def key_fn(a: dict) -> tuple[int, str]:
        ca = str(a.get("codigo") or a.get("unidadeId") or "")
        try:
            na = int(ca, 10)
        except ValueError:
            na = -1
        return (na, ca)

    return sorted(lst, key=key_fn)
