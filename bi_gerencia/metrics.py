"""Agregações e matrizes Gerência — espelho de node_legado/api/live_service.js (reduceMetrics, grouping, refs)."""

from __future__ import annotations

from typing import Any, Callable

from bi_gerencia.constants import METAS_ACOMP_POR_KEY
from bi_gerencia.util import (
    as_number,
    avg,
    contains_any,
    desfecho_medico_atend_distinct_count_pbi,
    establishment_id_lookup_keys,
    is_destino_internado_pbi,
    is_in_period,
    media_medicacoes_por_paciente_pbi,
    n_key,
    norm_upper,
    pick_date,
    ratio_pct,
    reavaliacao_linha_valida_denominador_pbi,
    reavaliacao_minutos_pbi,
    row_unit_id,
    row_unidade_nome,
    to_month_key,
    distinct_count_by,
)


def meta_limit_rows_by_key(rows: list[dict], key_text: str, fallback: float) -> float:
    for r in rows:
        if contains_any(r.get("CHAVE"), [key_text]):
            return as_number(r.get("VALOR_MIN"))
    return fallback


def reduce_metrics(rows: dict[str, Any], ctx: dict[str, Any]) -> dict[str, Any]:
    flux_rows = list(rows.get("flux_rows") or [])
    flux_row_count = len(flux_rows)
    atendimentos = distinct_count_by(flux_rows, lambda r: n_key(r.get("NR_ATENDIMENTO")))
    altas_rows = list(rows.get("altas_rows") or [])
    altas = len(altas_rows)
    obitos = sum(
        1 for r in altas_rows if contains_any(r.get("TIPO_DESFECHO") or r.get("DS_MOTIVO_ALTA"), ["OBITO"])
    )
    evasoes = sum(
        1 for r in altas_rows if contains_any(r.get("TIPO_DESFECHO") or r.get("DS_MOTIVO_ALTA"), ["EVADI", "EVAS"])
    )
    fim = rows.get("flux_internacao_mes_rows")
    if fim is not None:
        internados_flux_count = len(fim)
    else:
        internados_flux_count = sum(1 for r in flux_rows if is_destino_internado_pbi(r))
    internacoes = internados_flux_count
    conv_rows = list(rows.get("conv_rows") or [])
    conversoes = distinct_count_by(conv_rows, lambda r: n_key(r.get("NR_ATENDIMENTO_URG")))
    saidas = altas + evasoes + obitos
    reav_rows = list(rows.get("reav_rows") or [])
    reavaliacoes = distinct_count_by(reav_rows, lambda r: n_key(r.get("NR_ATENDIMENTO")))

    vias_rows = list(rows.get("vias_rows") or [])
    med_rows = list(rows.get("med_rows") or [])
    pacientes_medicados_vias = distinct_count_by(vias_rows, lambda r: n_key(r.get("NR_ATENDIMENTO")))
    pacientes_medicados_med = distinct_count_by(med_rows, lambda r: n_key(r.get("NR_ATENDIMENTO")))
    pacientes_medicados = pacientes_medicados_vias if vias_rows else pacientes_medicados_med

    medicacoes = len(med_rows)
    lab_rows = list(rows.get("lab_rows") or [])
    pacientes_lab = distinct_count_by(lab_rows, lambda r: n_key(r.get("NR_ATENDIMENTO")))
    exames_lab = len(lab_rows)
    rx_all = list(rows.get("rx_rows") or [])
    rx_rows = [r for r in rx_all if contains_any(r.get("TIPO") or r.get("EXAME"), ["RX"])]
    ecg_rows = [r for r in rx_all if contains_any(r.get("TIPO") or r.get("EXAME"), ["ECG"])]
    pacientes_rx = distinct_count_by(rx_rows, lambda r: n_key(r.get("NR_ATENDIMENTO")))
    pacientes_ecg = distinct_count_by(ecg_rows, lambda r: n_key(r.get("NR_ATENDIMENTO")))
    tcus_all = list(rows.get("tcus_rows") or [])
    tc_rows = [r for r in tcus_all if contains_any(r.get("TIPO") or r.get("EXAME"), ["TC", "TOMO"])]
    us_rows = [r for r in tcus_all if contains_any(r.get("TIPO") or r.get("EXAME"), ["US", "ULTRA"])]
    pacientes_tc = distinct_count_by(tc_rows, lambda r: n_key(r.get("NR_ATENDIMENTO")))
    pacientes_us = distinct_count_by(us_rows, lambda r: n_key(r.get("NR_ATENDIMENTO")))
    tcs = len(tc_rows)

    metas_rows = list(ctx.get("metas_rows") or [])
    triagem_meta = meta_limit_rows_by_key(metas_rows, "TRIAGEM", 12)
    consulta_meta = meta_limit_rows_by_key(metas_rows, "CONSULTA", 90)
    medicacao_meta = meta_limit_rows_by_key(metas_rows, "MEDICACAO", 30)
    reaval_meta = meta_limit_rows_by_key(metas_rows, "REAVALI", 60)
    permanencia_meta = meta_limit_rows_by_key(metas_rows, "ALTA", 240)

    triagem_acima = sum(1 for r in flux_rows if as_number(r.get("MIN_ENTRADA_X_TRIAGEM")) > triagem_meta)
    consulta_acima = sum(1 for r in flux_rows if as_number(r.get("MIN_ENTRADA_X_CONSULTA")) > consulta_meta)
    permanencia_acima = sum(1 for r in flux_rows if as_number(r.get("MIN_ENTRADA_X_ALTA")) > permanencia_meta)
    medicacao_acima = sum(1 for r in med_rows if as_number(r.get("MINUTOS")) > medicacao_meta)

    reav_denom = sum(1 for r in reav_rows if reavaliacao_linha_valida_denominador_pbi(r))

    def _reav_acima(r: dict) -> bool:
        if not reavaliacao_linha_valida_denominador_pbi(r):
            return False
        m = reavaliacao_minutos_pbi(r)
        if m is None or m != m:
            m = as_number(r.get("MINUTOS"))
        return m > reaval_meta

    reavaliacao_acima = sum(1 for r in reav_rows if _reav_acima(r))
    medicacoes_rapidas = sum(1 for r in med_rows if as_number(r.get("MINUTOS")) <= medicacao_meta)

    desfecho_medico_qtd_altas = sum(
        1 for r in altas_rows if contains_any(r.get("TIPO_DESFECHO"), ["ALTA", "ALTA MED"])
    )
    pct_desfecho_sobre_altas = ratio_pct(desfecho_medico_qtd_altas, altas) if altas else 0.0
    desfecho_flux_distinct = desfecho_medico_atend_distinct_count_pbi(flux_rows)

    media_medicacoes_por_pac = (
        media_medicacoes_por_paciente_pbi(vias_rows)
        if vias_rows
        else (medicacoes / pacientes_medicados_med if pacientes_medicados_med else 0.0)
    )
    medicacoes_ref_linhas = len(vias_rows) if vias_rows else medicacoes

    metas_por_volumes_refs = {
        "triagem_acima_meta": [triagem_acima, flux_row_count],
        "consulta_acima_meta": [consulta_acima, flux_row_count],
        "medicacao_acima_meta": [medicacao_acima, medicacoes],
        "reavaliacao_acima_meta": [reavaliacao_acima, reav_denom],
        "permanencia_acima_meta": [permanencia_acima, flux_row_count],
    }

    return {
        "atendimentos": atendimentos,
        "flux_row_count": flux_row_count,
        "altas": altas,
        "obitos": obitos,
        "evasoes": evasoes,
        "saidas": saidas,
        "internacoes": internacoes,
        "conversoes": conversoes,
        "reavaliacoes": reavaliacoes,
        "medicacoes_ref_linhas": medicacoes_ref_linhas,
        "pacientes_medicados": pacientes_medicados,
        "medicacoes": medicacoes,
        "medicacoes_rapidas": medicacoes_rapidas,
        "pacientes_lab": pacientes_lab,
        "exames_lab": exames_lab,
        "pacientes_rx": pacientes_rx,
        "pacientes_ecg": pacientes_ecg,
        "pacientes_tc": pacientes_tc,
        "pacientes_us": pacientes_us,
        "tcs": tcs,
        "desfecho_medico_qtd": desfecho_flux_distinct,
        "pct_desfecho_sobre_altas": pct_desfecho_sobre_altas,
        "pct_evasao": ratio_pct(evasoes, atendimentos),
        "pct_desfecho_medico": ratio_pct(desfecho_flux_distinct, atendimentos),
        "pct_conversao": ratio_pct(internados_flux_count, flux_row_count),
        "pct_reavaliacao": ratio_pct(reavaliacoes, atendimentos),
        "pct_pacientes_medicados": ratio_pct(pacientes_medicados, atendimentos),
        "media_medicacoes_por_pac": media_medicacoes_por_pac,
        "pct_medicacoes_rapidas": ratio_pct(medicacoes_rapidas, medicacoes),
        "pct_pacientes_lab": ratio_pct(pacientes_lab, atendimentos),
        "media_lab_por_pac": (exames_lab / pacientes_lab) if pacientes_lab else 0.0,
        "pct_pacientes_rx": ratio_pct(pacientes_rx, atendimentos),
        "pct_pacientes_ecg": ratio_pct(pacientes_ecg, atendimentos),
        "pct_pacientes_tc": ratio_pct(pacientes_tc, atendimentos),
        "media_tcs_por_pac": (tcs / pacientes_tc) if pacientes_tc else 0.0,
        "pct_pacientes_us": ratio_pct(pacientes_us, atendimentos),
        "triagem_acima_meta_pct": ratio_pct(triagem_acima, flux_row_count),
        "consulta_acima_meta_pct": ratio_pct(consulta_acima, flux_row_count),
        "medicacao_acima_meta_pct": ratio_pct(medicacao_acima, medicacoes),
        "reavaliacao_acima_meta_pct": ratio_pct(reavaliacao_acima, reav_denom),
        "permanencia_acima_meta_pct": ratio_pct(permanencia_acima, flux_row_count),
        "avg_triagem_min": avg(flux_rows, lambda r: as_number(r.get("MIN_ENTRADA_X_TRIAGEM"))),
        "avg_consulta_min": avg(flux_rows, lambda r: as_number(r.get("MIN_ENTRADA_X_CONSULTA"))),
        "avg_permanencia_min": avg(flux_rows, lambda r: as_number(r.get("MIN_ENTRADA_X_ALTA"))),
        "avg_medicacao_min": avg(med_rows, lambda r: as_number(r.get("MINUTOS"))),
        "avg_rxecg_min": avg(rx_all, lambda r: as_number(r.get("MINUTOS"))),
        "avg_tcus_min": avg(tcus_all, lambda r: as_number(r.get("MINUTOS"))),
        "avg_reavaliacao_min": avg(reav_rows, lambda r: as_number(r.get("MINUTOS"))),
        "metasPorVolumesRefs": metas_por_volumes_refs,
    }


def group_rows_by_unit(
    rows: list[dict],
    unit_map: dict[str, Any],
    predicate: Callable[[dict], bool],
    date_fields: list[str],
    query: dict,
) -> dict[str, list[dict]]:
    buckets: dict[str, list[dict]] = {}
    by_id = unit_map["by_id"]
    for r in rows:
        if not predicate(r):
            continue
        d = pick_date(r, date_fields)
        if not is_in_period(d, query):
            continue
        unit = resolve_unit_from_row(r, by_id, unit_map["by_name"])
        if not unit:
            continue
        k = str(unit["unidadeId"])
        buckets.setdefault(k, []).append(r)
    return buckets


def group_rows_by_unit_in_month(
    rows: list[dict],
    unit_map: dict[str, Any],
    predicate: Callable[[dict], bool],
    date_fields: list[str],
    month_key: str,
    period_query: dict,
    apply_period_clip: bool,
) -> dict[str, list[dict]]:
    buckets: dict[str, list[dict]] = {}
    by_id = unit_map["by_id"]
    for r in rows:
        if not predicate(r):
            continue
        d = pick_date(r, date_fields)
        if not d or to_month_key(d) != month_key:
            continue
        if apply_period_clip and not is_in_period(d, period_query):
            continue
        unit = resolve_unit_from_row(r, by_id, unit_map["by_name"])
        if not unit:
            continue
        k = str(unit["unidadeId"])
        buckets.setdefault(k, []).append(r)
    return buckets


def resolve_unit_from_row(row: dict, by_id: dict[str, Any], by_name: dict[str, Any]) -> dict | None:
    rid = row_unit_id(row)
    if rid:
        for k in establishment_id_lookup_keys(rid):
            u = by_id.get(k)
            if u:
                return u
    nome = row_unidade_nome(row)
    if nome:
        return by_name.get(norm_upper(nome))
    return None


def unit_meta_map(units: list[dict]) -> dict[str, Any]:
    by_id: dict[str, Any] = {}
    by_name: dict[str, Any] = {}
    for u in units:
        canon = str(u["unidadeId"])
        for k in establishment_id_lookup_keys(canon):
            by_id[k] = u
        by_name[norm_upper(u.get("unidadeNome") or "")] = u
    return {"by_id": by_id, "by_name": by_name}


def build_row_predicate(query: dict, unit_map: dict[str, Any]) -> Callable[[dict], bool]:
    def pred(row: dict) -> bool:
        unit = resolve_unit_from_row(row, unit_map["by_id"], unit_map["by_name"])
        if query.get("unidade") and (not unit or str(unit["unidadeId"]) != str(query["unidade"])):
            return False
        if query.get("regional") and (not unit or str(unit.get("regional")) != str(query["regional"])):
            return False
        return True

    return pred


def build_monthly_gerencia_row_pack(
    ds: dict[str, Any],
    pred: Callable[[dict], bool],
    unit_map: dict[str, Any],
    unidade_id: str,
    mk: str,
    query: dict,
) -> dict[str, Any]:
    uid = str(unidade_id)

    def match_unit(r: dict) -> bool:
        if not pred(r):
            return False
        u = resolve_unit_from_row(r, unit_map["by_id"], unit_map["by_name"])
        return u is not None and str(u["unidadeId"]) == uid

    def date_in_month(r: dict, fields: list[str]) -> bool:
        return to_month_key(pick_date(r, fields)) == mk

    def in_period(r: dict, fields: list[str]) -> bool:
        d = pick_date(r, fields)
        return bool(d and is_in_period(d, query))

    def p(rows: list[dict] | None, fields: list[str]) -> list[dict]:
        out = []
        for r in rows or []:
            if match_unit(r) and date_in_month(r, fields) and in_period(r, fields):
                out.append(r)
        return out

    flux = list(ds.get("flux_rows") or [])
    intern_mes = [
        r
        for r in flux
        if match_unit(r)
        and is_destino_internado_pbi(r)
        and date_in_month(r, ["DT_INTERNACAO", "DT_INTERNACAO_DATA"])
        and in_period(r, ["DT_INTERNACAO", "DT_INTERNACAO_DATA"])
    ]
    return {
        "flux_rows": p(flux, ["DATA", "DT_ENTRADA"]),
        "flux_internacao_mes_rows": intern_mes,
        "med_rows": p(list(ds.get("med_rows") or []), ["DATA", "DT_PRESCRICAO"]),
        "vias_rows": p(list(ds.get("vias_rows") or []), ["DATA"]),
        "lab_rows": p(list(ds.get("lab_rows") or []), ["DATA", "DT_SOLICITACAO", "DT_EXAME"]),
        "rx_rows": p(list(ds.get("rx_rows") or []), ["DATA", "DT_SOLICITACAO"]),
        "tcus_rows": p(list(ds.get("tcus_rows") or []), ["DATA", "DT_EXAME", "DT_REALIZADO"]),
        "reav_rows": p(list(ds.get("reav_rows") or []), ["DATA", "DT_SOLIC_REAVALIACAO"]),
        "altas_rows": p(list(ds.get("altas_rows") or []), ["DT_ALTA", "DT_ENTRADA"]),
        "conv_rows": p(list(ds.get("conv_rows") or []), ["DT_ENTRADA", "DT_ALTA"]),
    }


def empty_row_pack() -> dict[str, Any]:
    return {
        "flux_rows": [],
        "flux_internacao_mes_rows": [],
        "med_rows": [],
        "vias_rows": [],
        "lab_rows": [],
        "rx_rows": [],
        "tcus_rows": [],
        "reav_rows": [],
        "altas_rows": [],
        "conv_rows": [],
    }


def merge_gerencia_monthly_row_packs(
    ds: dict[str, Any],
    pred: Callable[[dict], bool],
    unit_map: dict[str, Any],
    unidade_id: str,
    month_keys: list[str],
    query: dict,
) -> dict[str, Any]:
    out = empty_row_pack()
    for mk in month_keys or []:
        p = build_monthly_gerencia_row_pack(ds, pred, unit_map, unidade_id, mk, query)
        out["flux_rows"].extend(p["flux_rows"])
        out["flux_internacao_mes_rows"].extend(p.get("flux_internacao_mes_rows") or [])
        out["med_rows"].extend(p["med_rows"])
        out["vias_rows"].extend(p.get("vias_rows") or [])
        out["lab_rows"].extend(p["lab_rows"])
        out["rx_rows"].extend(p["rx_rows"])
        out["tcus_rows"].extend(p["tcus_rows"])
        out["reav_rows"].extend(p["reav_rows"])
        out["altas_rows"].extend(p["altas_rows"])
        out["conv_rows"].extend(p["conv_rows"])
    return out


def metas_por_volumes_support_month_keys(mes_keys: list[str]) -> list[str]:
    if not mes_keys:
        return []
    have = set(mes_keys)
    out: list[str] = []
    from bi_gerencia.util import shift_month_key, january_key_of

    prev = shift_month_key(mes_keys[0], -1)
    if prev not in have:
        out.append(prev)
    jan = january_key_of(mes_keys[-1])
    if jan not in have:
        out.append(jan)
    return out


def build_metas_por_volumes_rows_by_month_by_unit(
    ds: dict[str, Any],
    unit_map: dict[str, Any],
    pred: Callable[[dict], bool],
    mes_keys: list[str],
    period_query: dict,
) -> tuple[dict[str, Any], str, str]:
    from bi_gerencia.util import shift_month_key, january_key_of

    support = metas_por_volumes_support_month_keys(mes_keys)
    all_keys = list(dict.fromkeys([*mes_keys, *support]))
    mes_set = set(mes_keys or [])
    flux = list(ds.get("flux_rows") or [])
    flux_internados = [r for r in flux if is_destino_internado_pbi(r)]
    vias_all = list(ds.get("vias_rows") or [])
    rows_by_month_by_unit: dict[str, Any] = {}
    for k in all_keys:
        clip = k in mes_set
        rows_by_month_by_unit[k] = {
            "flux_rows": group_rows_by_unit_in_month(
                flux, unit_map, pred, ["DATA", "DT_ENTRADA"], k, period_query, clip
            ),
            "flux_internacao_mes_rows": group_rows_by_unit_in_month(
                flux_internados,
                unit_map,
                pred,
                ["DT_INTERNACAO", "DT_INTERNACAO_DATA"],
                k,
                period_query,
                clip,
            ),
            "med_rows": group_rows_by_unit_in_month(
                list(ds.get("med_rows") or []), unit_map, pred, ["DATA", "DT_PRESCRICAO"], k, period_query, clip
            ),
            "vias_rows": group_rows_by_unit_in_month(vias_all, unit_map, pred, ["DATA"], k, period_query, clip),
            "lab_rows": group_rows_by_unit_in_month(
                list(ds.get("lab_rows") or []),
                unit_map,
                pred,
                ["DATA", "DT_SOLICITACAO", "DT_EXAME"],
                k,
                period_query,
                clip,
            ),
            "rx_rows": group_rows_by_unit_in_month(
                list(ds.get("rx_rows") or []), unit_map, pred, ["DATA", "DT_SOLICITACAO"], k, period_query, clip
            ),
            "tcus_rows": group_rows_by_unit_in_month(
                list(ds.get("tcus_rows") or []),
                unit_map,
                pred,
                ["DATA", "DT_EXAME", "DT_REALIZADO"],
                k,
                period_query,
                clip,
            ),
            "reav_rows": group_rows_by_unit_in_month(
                list(ds.get("reav_rows") or []),
                unit_map,
                pred,
                ["DATA", "DT_SOLIC_REAVALIACAO"],
                k,
                period_query,
                clip,
            ),
            "altas_rows": group_rows_by_unit_in_month(
                list(ds.get("altas_rows") or []), unit_map, pred, ["DT_ALTA", "DT_ENTRADA"], k, period_query, clip
            ),
            "conv_rows": group_rows_by_unit_in_month(
                list(ds.get("conv_rows") or []), unit_map, pred, ["DT_ENTRADA", "DT_ALTA"], k, period_query, clip
            ),
        }
    return rows_by_month_by_unit, shift_month_key(mes_keys[0], -1), january_key_of(mes_keys[-1])


def row_pack_for_unidade(rows_by_month_by_unit: dict[str, Any], month_key: str, unidade_id: str) -> dict[str, Any]:
    pack = rows_by_month_by_unit.get(month_key)
    k = str(unidade_id)
    if not pack:
        return empty_row_pack()
    return {
        "flux_rows": (pack["flux_rows"].get(k) or []),
        "flux_internacao_mes_rows": (pack.get("flux_internacao_mes_rows") or {}).get(k) or [],
        "med_rows": pack["med_rows"].get(k) or [],
        "vias_rows": (pack.get("vias_rows") or {}).get(k) or [],
        "lab_rows": pack["lab_rows"].get(k) or [],
        "rx_rows": pack["rx_rows"].get(k) or [],
        "tcus_rows": pack["tcus_rows"].get(k) or [],
        "reav_rows": pack["reav_rows"].get(k) or [],
        "altas_rows": pack["altas_rows"].get(k) or [],
        "conv_rows": pack["conv_rows"].get(k) or [],
    }


def merge_row_packs_across_months(
    rows_by_month_by_unit: dict[str, Any], mes_keys: list[str], unidade_id: str
) -> dict[str, Any]:
    out = empty_row_pack()
    for mk in mes_keys or []:
        p = row_pack_for_unidade(rows_by_month_by_unit, mk, unidade_id)
        out["flux_rows"].extend(p["flux_rows"])
        out["flux_internacao_mes_rows"].extend(p.get("flux_internacao_mes_rows") or [])
        out["med_rows"].extend(p["med_rows"])
        out["vias_rows"].extend(p.get("vias_rows") or [])
        out["lab_rows"].extend(p["lab_rows"])
        out["rx_rows"].extend(p["rx_rows"])
        out["tcus_rows"].extend(p["tcus_rows"])
        out["reav_rows"].extend(p["reav_rows"])
        out["altas_rows"].extend(p["altas_rows"])
        out["conv_rows"].extend(p["conv_rows"])
    return out


def metas_por_volumes_metric_value(m: dict | None, key: str) -> float:
    if not m:
        return 0.0
    if key == "conversao":
        return float(m.get("pct_conversao") or 0)
    if key == "pacs_medicados":
        return float(m.get("pct_pacientes_medicados") or 0)
    if key == "medicacoes_por_paciente":
        return float(m.get("media_medicacoes_por_pac") or 0)
    if key == "pacs_exames_lab":
        return float(m.get("pct_pacientes_lab") or 0)
    if key == "lab_por_paciente":
        return float(m.get("media_lab_por_pac") or 0)
    if key == "pacs_exames_tc":
        return float(m.get("pct_pacientes_tc") or 0)
    if key == "tcs_por_paciente":
        return float(m.get("media_tcs_por_pac") or 0)
    if key == "triagem_acima_meta":
        return float(m.get("triagem_acima_meta_pct") or 0)
    if key == "consulta_acima_meta":
        return float(m.get("consulta_acima_meta_pct") or 0)
    if key == "medicacao_acima_meta":
        return float(m.get("medicacao_acima_meta_pct") or 0)
    if key == "reavaliacao_acima_meta":
        return float(m.get("reavaliacao_acima_meta_pct") or 0)
    if key == "permanencia_acima_meta":
        return float(m.get("permanencia_acima_meta_pct") or 0)
    if key == "desfecho_medico":
        return float(m.get("pct_desfecho_medico") or 0)
    return 0.0


def fmt_metas_por_volumes_ref_pair(n: float, d: float) -> str:
    nn = int(round(as_number(n)))
    dd = int(round(as_number(d)))
    if not dd and not nn:
        return "(—)"
    if not dd:
        return f"({nn})"
    return f"({nn}/{dd})"


def metas_por_volumes_ref_sec(m: dict | None, key: str) -> str:
    if not m:
        return "(—)"
    r = m.get("metasPorVolumesRefs") or {}
    if key == "conversao":
        return fmt_metas_por_volumes_ref_pair(m.get("internacoes") or 0, m.get("flux_row_count") or m.get("atendimentos") or 0)
    if key == "pacs_medicados":
        return fmt_metas_por_volumes_ref_pair(m.get("pacientes_medicados") or 0, m.get("atendimentos") or 0)
    if key == "medicacoes_por_paciente":
        return fmt_metas_por_volumes_ref_pair(
            m.get("medicacoes_ref_linhas") or m.get("medicacoes") or 0, m.get("pacientes_medicados") or 0
        )
    if key == "pacs_exames_lab":
        return fmt_metas_por_volumes_ref_pair(m.get("pacientes_lab") or 0, m.get("atendimentos") or 0)
    if key == "lab_por_paciente":
        return fmt_metas_por_volumes_ref_pair(m.get("exames_lab") or 0, m.get("pacientes_lab") or 0)
    if key == "pacs_exames_tc":
        return fmt_metas_por_volumes_ref_pair(m.get("pacientes_tc") or 0, m.get("atendimentos") or 0)
    if key == "tcs_por_paciente":
        return fmt_metas_por_volumes_ref_pair(m.get("tcs") or 0, m.get("pacientes_tc") or 0)
    if key == "triagem_acima_meta":
        p = r.get("triagem_acima_meta") or [0, 0]
        return fmt_metas_por_volumes_ref_pair(p[0], p[1])
    if key == "consulta_acima_meta":
        p = r.get("consulta_acima_meta") or [0, 0]
        return fmt_metas_por_volumes_ref_pair(p[0], p[1])
    if key == "medicacao_acima_meta":
        p = r.get("medicacao_acima_meta") or [0, 0]
        return fmt_metas_por_volumes_ref_pair(p[0], p[1])
    if key == "reavaliacao_acima_meta":
        p = r.get("reavaliacao_acima_meta") or [0, 0]
        return fmt_metas_por_volumes_ref_pair(p[0], p[1])
    if key == "permanencia_acima_meta":
        p = r.get("permanencia_acima_meta") or [0, 0]
        return fmt_metas_por_volumes_ref_pair(p[0], p[1])
    if key == "desfecho_medico":
        return fmt_metas_por_volumes_ref_pair(m.get("desfecho_medico_qtd") or 0, m.get("atendimentos") or 0)
    return f"({int(round(as_number(m.get('atendimentos'))))})"


def pair_for_metas_por_volumes_ref_agg(m: dict | None, key: str) -> tuple[float, float]:
    if not m:
        return (0.0, 0.0)
    r = m.get("metasPorVolumesRefs") or {}
    if key == "conversao":
        return (as_number(m.get("internacoes")), as_number(m.get("flux_row_count") or m.get("atendimentos")))
    if key == "pacs_medicados":
        return (as_number(m.get("pacientes_medicados")), as_number(m.get("atendimentos")))
    if key == "medicacoes_por_paciente":
        return (as_number(m.get("medicacoes_ref_linhas") or m.get("medicacoes")), as_number(m.get("pacientes_medicados")))
    if key == "pacs_exames_lab":
        return (as_number(m.get("pacientes_lab")), as_number(m.get("atendimentos")))
    if key == "lab_por_paciente":
        return (as_number(m.get("exames_lab")), as_number(m.get("pacientes_lab")))
    if key == "pacs_exames_tc":
        return (as_number(m.get("pacientes_tc")), as_number(m.get("atendimentos")))
    if key == "tcs_por_paciente":
        return (as_number(m.get("tcs")), as_number(m.get("pacientes_tc")))
    if key == "triagem_acima_meta":
        p = r.get("triagem_acima_meta") or [0, 0]
        return (as_number(p[0]), as_number(p[1]))
    if key == "consulta_acima_meta":
        p = r.get("consulta_acima_meta") or [0, 0]
        return (as_number(p[0]), as_number(p[1]))
    if key == "medicacao_acima_meta":
        p = r.get("medicacao_acima_meta") or [0, 0]
        return (as_number(p[0]), as_number(p[1]))
    if key == "reavaliacao_acima_meta":
        p = r.get("reavaliacao_acima_meta") or [0, 0]
        return (as_number(p[0]), as_number(p[1]))
    if key == "permanencia_acima_meta":
        p = r.get("permanencia_acima_meta") or [0, 0]
        return (as_number(p[0]), as_number(p[1]))
    if key == "desfecho_medico":
        return (as_number(m.get("desfecho_medico_qtd")), as_number(m.get("atendimentos")))
    return (as_number(m.get("atendimentos")), as_number(m.get("atendimentos")))


def metas_por_volumes_ref_sec_parent(unit_synth_ms: list[dict], key: str) -> str:
    if not unit_synth_ms:
        return "(—)"
    n = 0.0
    d = 0.0
    for m in unit_synth_ms:
        p = pair_for_metas_por_volumes_ref_agg(m, key)
        n += p[0]
        d += p[1]
    return fmt_metas_por_volumes_ref_pair(n, d)


def metas_por_volumes_ref_sec_month_all_units(
    rows_by_month_by_unit: dict[str, Any],
    month_key: str,
    unit_ids: list[str],
    ds: dict[str, Any],
    key: str,
) -> str:
    if not unit_ids:
        return "(—)"
    n = 0.0
    d = 0.0
    for uid in unit_ids:
        m = reduce_metrics(row_pack_for_unidade(rows_by_month_by_unit, month_key, uid), ds)
        p = pair_for_metas_por_volumes_ref_agg(m, key)
        n += as_number(p[0])
        d += as_number(p[1])
    return fmt_metas_por_volumes_ref_pair(n, d)


def empty_metas_meses_cells(mes_keys: list[str]) -> dict[str, Any]:
    z = lambda: {"v": 0.0, "d": 0.0}
    return {"meses": [z() for _ in (mes_keys or [])], "t": {"v": 0.0, "ytd": 0.0, "sec": "(—)"}}


def meta_ref_display_metas_por_volumes(ind: dict) -> dict[str, str]:
    from bi_gerencia.util import fmt_meta_br

    cfg = METAS_ACOMP_POR_KEY.get(ind["key"], {"meta": 0})
    m = float(cfg.get("meta") or 0)
    v = fmt_meta_br(m)
    if ind.get("isP"):
        cmp = "≤" if ind.get("isReverso") else "≥"
        if ind.get("isReverso"):
            titulo = f"Meta: {cmp} {v}% (quanto menor, melhor)"
        else:
            titulo = f"Meta: {cmp} {v}% (quanto maior, melhor)"
        return {"texto": f"{cmp} {v}%", "titulo": titulo}
    return {"texto": f"≤ {v}", "titulo": f"Meta: ≤ {v} (quanto menor, melhor)"}
