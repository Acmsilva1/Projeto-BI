"""
Motor de negócio Gerência + stubs das outras rotas — paridade com node_legado/api/live_service.js.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from bi_gerencia.constants import (
    DIAS_SEMANA,
    GERENCIA_TOTAIS_PS_DEF,
    METAS_ACOMP_CORES_UNIDADE,
    METAS_ACOMP_POR_KEY,
    METAS_POR_VOLUMES_INDICADORES,
    METRICAS_POR_UNIDADE_COLUNAS,
    SLA_KEYS,
    TEMPO_MEDIO_ETAPAS_COLS,
)
from bi_gerencia.datasets import (
    filter_units_by_query,
    load_gerencia_datasets,
    load_unidades_ps_from_db,
)
from bi_gerencia.metrics import (
    build_metas_por_volumes_rows_by_month_by_unit,
    build_monthly_gerencia_row_pack,
    build_row_predicate,
    empty_metas_meses_cells,
    merge_gerencia_monthly_row_packs,
    merge_row_packs_across_months,
    meta_limit_rows_by_key,
    meta_ref_display_metas_por_volumes,
    metas_por_volumes_metric_value,
    metas_por_volumes_ref_sec,
    metas_por_volumes_ref_sec_month_all_units,
    metas_por_volumes_ref_sec_parent,
    reduce_metrics,
    row_pack_for_unidade,
    unit_meta_map,
    group_rows_by_unit,
)
from bi_gerencia.util import (
    as_number,
    avg,
    iso_now,
    label_unidade_ps,
    month_keys_overlapping_query_period,
    months_labels_from_keys,
    pick_date,
    is_in_period,
    reavaliacao_linha_valida_denominador_pbi,
    reavaliacao_minutos_pbi,
    ratio_pct,
)

if TYPE_CHECKING:
    import asyncpg


def _empty_kpi_field() -> dict[str, Any]:
    return {"valor": 0, "unidade": "", "variacao": 0, "tendencia": "estavel", "meta": 0}


def _empty_sla() -> dict[str, Any]:
    return {"total": 0, "acima": 0, "percent": 0, "meta": 0, "mu": 0, "sigma": 0, "zScore": 0}


class LiveService:
    def __init__(self, pool: "asyncpg.Pool | None") -> None:
        self._pool = pool

    async def getKPIs(self, _query: dict | None = None) -> dict[str, Any]:
        e = _empty_kpi_field
        return {
            "taxaOcupacao": {**e(), "unidade": "%"},
            "tempoMedioInternacao": {**e(), "unidade": "dias"},
            "cirurgiasNoMes": {**e(), "unidade": "proced."},
            "taxaReadmissao": {**e(), "unidade": "%"},
            "satisfacaoPaciente": {**e(), "unidade": "%"},
            "faturamentoMes": {**e(), "unidade": "R$"},
            "leitosDisponiveis": {**e(), "unidade": "leitos"},
            "pacientesAtivos": {**e(), "unidade": "pac."},
        }

    async def getKpiUnidades(self, _query: dict | None = None) -> list:
        return []

    async def getIndicadoresGerais(self, _query: dict | None = None) -> dict[str, Any]:
        return {"linhas": [], "totais": {}}

    async def getOverviewMetasVolumes(self, query: dict | None = None) -> Any:
        return await self.getGerenciaMetasPorVolumes(query or {})

    async def getGerenciaUnidadesPs(self, query: dict | None = None) -> list[dict]:
        q = query or {}
        units = await load_unidades_ps_from_db(self._pool)
        return filter_units_by_query(units, {"regional": q.get("regional")})

    async def getGerenciaMetasPorVolumes(self, query: dict | None = None) -> dict[str, Any]:
        q = query or {}
        all_units = await load_unidades_ps_from_db(self._pool)
        units = filter_units_by_query(all_units, q)
        umap = unit_meta_map(all_units)
        pred = build_row_predicate(q, umap)
        ds = await load_gerencia_datasets(self._pool, q)
        mes_keys = month_keys_overlapping_query_period(q)
        months = months_labels_from_keys(mes_keys)
        rows_by_month_by_unit, prev_month_key, january_key = build_metas_por_volumes_rows_by_month_by_unit(
            ds, umap, pred, mes_keys, q
        )
        try:
            period_days = float(q.get("period", ""))
        except (TypeError, ValueError):
            period_days = 0.0
        z = empty_metas_meses_cells(mes_keys)

        data = []
        for ind in METAS_POR_VOLUMES_INDICADORES:
            meta_ref = meta_ref_display_metas_por_volumes(ind)
            item: dict[str, Any] = {
                "key": ind["key"],
                "name": ind["name"],
                "isReverso": ind["isReverso"],
                "isP": ind["isP"],
                "metaTexto": meta_ref["texto"],
                "metaTitulo": meta_ref["titulo"],
                "meses": [{"v": c["v"], "d": c["d"]} for c in z["meses"]],
                "t": {**z["t"]},
                "subItems": [],
            }
            unit_values: list[dict[str, Any]] = []
            for u in units:
                uid = u["unidadeId"]
                m0 = reduce_metrics(row_pack_for_unidade(rows_by_month_by_unit, prev_month_key, uid), ds)
                m_jan = reduce_metrics(row_pack_for_unidade(rows_by_month_by_unit, january_key, uid), ds)
                m_months = [
                    reduce_metrics(row_pack_for_unidade(rows_by_month_by_unit, mk, uid), ds) for mk in mes_keys
                ]
                m_synth = reduce_metrics(merge_row_packs_across_months(rows_by_month_by_unit, mes_keys, uid), ds)
                v0 = metas_por_volumes_metric_value(m0, ind["key"])
                v_jan = metas_por_volumes_metric_value(m_jan, ind["key"])
                v_months = [metas_por_volumes_metric_value(m, ind["key"]) for m in m_months]
                v_synth = metas_por_volumes_metric_value(m_synth, ind["key"])
                meses = [
                    {
                        "v": v_months[i],
                        "d": (v_months[i] - v0) if i == 0 else (v_months[i] - v_months[i - 1]),
                        "sec": metas_por_volumes_ref_sec(m_months[i], ind["key"]),
                    }
                    for i in range(len(v_months))
                ]
                if period_days == 366:
                    ytd = (v_months[-1] - v_jan) if v_months else 0.0
                elif len(v_months) > 1:
                    ytd = v_months[-1] - v_months[0]
                elif len(v_months) == 1:
                    ytd = v_months[0] - v0
                else:
                    ytd = 0.0
                unit_values.append(
                    {"v0": v0, "vJan": v_jan, "vMonths": v_months, "vSynth": v_synth, "mSynth": m_synth, "ytd": ytd}
                )
                item["subItems"].append(
                    {
                        "unidadeId": u["unidadeId"],
                        "name": label_unidade_ps(u),
                        "meses": meses,
                        "t": {"v": v_synth, "ytd": ytd, "sec": metas_por_volumes_ref_sec(m_synth, ind["key"])},
                    }
                )
            if not unit_values:
                data.append({**item, "subItems": []})
                continue
            n = len(unit_values)

            def avg_pick(pick: str) -> float:
                return sum(float(uv[pick]) for uv in unit_values) / n

            g0 = avg_pick("v0")
            g_jan = avg_pick("vJan")
            g_months = [sum(uv["vMonths"][i] for uv in unit_values) / n for i in range(len(mes_keys))]
            g_synth = avg_pick("vSynth")
            unit_ids_list = [u["unidadeId"] for u in units]
            g_month_secs = [
                metas_por_volumes_ref_sec_month_all_units(rows_by_month_by_unit, mk, unit_ids_list, ds, ind["key"])
                for mk in mes_keys
            ]
            item["meses"] = [
                {
                    "v": g_months[i],
                    "d": (g_months[i] - g0) if i == 0 else (g_months[i] - g_months[i - 1]),
                    "sec": g_month_secs[i],
                }
                for i in range(len(g_months))
            ]
            if period_days == 366:
                g_ytd = (g_months[-1] - g_jan) if g_months else 0.0
            elif len(g_months) > 1:
                g_ytd = g_months[-1] - g_months[0]
            elif len(g_months) == 1:
                g_ytd = g_months[0] - g0
            else:
                g_ytd = 0.0
            item["t"] = {
                "v": g_synth,
                "ytd": g_ytd,
                "sec": metas_por_volumes_ref_sec_parent([uv["mSynth"] for uv in unit_values], ind["key"]),
            }
            data.append(item)

        return {
            "months": months,
            "mesKeys": mes_keys,
            "data": data,
            "meta": {
                "schemaVersion": 6,
                "titulo": "Metas por volumes",
                "filtroUnidades": "apenas_unidades_com_ps",
                "unidadesNoContexto": len(units),
                "eixoMeses": "periodo_topo",
            },
        }

    async def getGerenciaMetricasPorUnidade(self, query: dict | None = None) -> dict[str, Any]:
        q = query or {}
        all_units = await load_unidades_ps_from_db(self._pool)
        units = filter_units_by_query(all_units, q)
        umap = unit_meta_map(all_units)
        pred = build_row_predicate(q, umap)
        ds = await load_gerencia_datasets(self._pool, q)

        flux_by = group_rows_by_unit(list(ds.get("flux_rows") or []), umap, pred, ["DATA", "DT_ENTRADA"], q)
        vias_by = group_rows_by_unit(list(ds.get("vias_rows") or []), umap, pred, ["DATA"], q)
        med_by = group_rows_by_unit(list(ds.get("med_rows") or []), umap, pred, ["DATA", "DT_PRESCRICAO"], q)
        lab_by = group_rows_by_unit(list(ds.get("lab_rows") or []), umap, pred, ["DATA", "DT_SOLICITACAO", "DT_EXAME"], q)
        rx_by = group_rows_by_unit(list(ds.get("rx_rows") or []), umap, pred, ["DATA", "DT_SOLICITACAO"], q)
        tcus_by = group_rows_by_unit(list(ds.get("tcus_rows") or []), umap, pred, ["DATA", "DT_EXAME", "DT_REALIZADO"], q)
        reav_by = group_rows_by_unit(list(ds.get("reav_rows") or []), umap, pred, ["DATA", "DT_SOLIC_REAVALIACAO"], q)
        altas_by = group_rows_by_unit(list(ds.get("altas_rows") or []), umap, pred, ["DT_ALTA", "DT_ENTRADA"], q)
        conv_by = group_rows_by_unit(list(ds.get("conv_rows") or []), umap, pred, ["DT_ENTRADA", "DT_ALTA"], q)

        linhas = []
        for u in units:
            k = str(u["unidadeId"])
            m = reduce_metrics(
                {
                    "flux_rows": flux_by.get(k) or [],
                    "med_rows": med_by.get(k) or [],
                    "vias_rows": vias_by.get(k) or [],
                    "lab_rows": lab_by.get(k) or [],
                    "rx_rows": rx_by.get(k) or [],
                    "tcus_rows": tcus_by.get(k) or [],
                    "reav_rows": reav_by.get(k) or [],
                    "altas_rows": altas_by.get(k) or [],
                    "conv_rows": conv_by.get(k) or [],
                },
                ds,
            )
            linhas.append(
                {
                    "unidadeId": u["unidadeId"],
                    "label": label_unidade_ps(u),
                    "valores": {
                        "atendimentos": m["atendimentos"],
                        "altas": m["altas"],
                        "obitos": m["obitos"],
                        "pct_evasao": m["pct_evasao"],
                        "pct_desfecho_sobre_altas": m["pct_desfecho_sobre_altas"],
                        "pct_desfecho_medico": m["pct_desfecho_medico"],
                        "saidas": m["saidas"],
                        "internacoes": m["internacoes"],
                        "pct_conversao": m["pct_conversao"],
                        "pct_reavaliacao": m["pct_reavaliacao"],
                        "pct_pacientes_medicados": m["pct_pacientes_medicados"],
                        "media_medicacoes_por_pac": m["media_medicacoes_por_pac"],
                        "pct_medicacoes_rapidas": m["pct_medicacoes_rapidas"],
                        "pct_pacientes_lab": m["pct_pacientes_lab"],
                        "media_lab_por_pac": m["media_lab_por_pac"],
                        "pct_pacientes_rx": m["pct_pacientes_rx"],
                        "pct_pacientes_ecg": m["pct_pacientes_ecg"],
                        "pct_pacientes_tc": m["pct_pacientes_tc"],
                        "media_tcs_por_pac": m["media_tcs_por_pac"],
                        "pct_pacientes_us": m["pct_pacientes_us"],
                    },
                }
            )
        return {
            "colunas": METRICAS_POR_UNIDADE_COLUNAS,
            "linhas": linhas,
            "meta": {
                "schemaVersion": 2,
                "titulo": "Indicadores por unidade (PS)",
                "filtroUnidades": "regional_unidade_gerencia",
            },
        }

    async def getGerenciaTotaisPs(self, query: dict | None = None) -> dict[str, Any]:
        q = query or {}
        all_units = await load_unidades_ps_from_db(self._pool)
        umap = unit_meta_map(all_units)
        pred = build_row_predicate(q, umap)
        ds = await load_gerencia_datasets(self._pool, q)

        def filt(rows: list[dict], fields: list[str]) -> list[dict]:
            out = []
            for r in rows:
                if not pred(r):
                    continue
                d = pick_date(r, fields)
                if is_in_period(d, q):
                    out.append(r)
            return out

        rows = {
            "flux_rows": filt(list(ds.get("flux_rows") or []), ["DATA", "DT_ENTRADA"]),
            "med_rows": filt(list(ds.get("med_rows") or []), ["DATA", "DT_PRESCRICAO"]),
            "vias_rows": filt(list(ds.get("vias_rows") or []), ["DATA"]),
            "lab_rows": filt(list(ds.get("lab_rows") or []), ["DATA", "DT_SOLICITACAO", "DT_EXAME"]),
            "rx_rows": filt(list(ds.get("rx_rows") or []), ["DATA", "DT_SOLICITACAO"]),
            "tcus_rows": filt(list(ds.get("tcus_rows") or []), ["DATA", "DT_EXAME", "DT_REALIZADO"]),
            "reav_rows": filt(list(ds.get("reav_rows") or []), ["DATA", "DT_SOLIC_REAVALIACAO"]),
            "altas_rows": filt(list(ds.get("altas_rows") or []), ["DT_ALTA", "DT_ENTRADA"]),
            "conv_rows": filt(list(ds.get("conv_rows") or []), ["DT_ENTRADA", "DT_ALTA"]),
        }
        m = reduce_metrics(rows, ds)
        values = {
            "atendimentos": m["atendimentos"],
            "altas": m["altas"],
            "obitos": m["obitos"],
            "evasoes": m["evasoes"],
            "desfecho": m["desfecho_medico_qtd"],
            "desfecho_medico": m["desfecho_medico_qtd"],
            "saidas": m["saidas"],
            "internacoes": m["internacoes"],
            "conversoes": m["conversoes"],
            "reavaliacoes": m["reavaliacoes"],
            "pacientes_medicados": m["pacientes_medicados"],
            "medicacoes": m["medicacoes"],
            "medicacoes_rapidas": m["medicacoes_rapidas"],
            "pacientes_lab": m["pacientes_lab"],
            "exames_lab": m["exames_lab"],
            "pacientes_rx": m["pacientes_rx"],
            "pacientes_ecg": m["pacientes_ecg"],
            "pacientes_tc": m["pacientes_tc"],
            "tcs": m["tcs"],
            "pacientes_us": m["pacientes_us"],
        }
        return {
            "cards": [{"key": d["key"], "label": d["label"], "value": as_number(values.get(d["key"])), "format": "int"} for d in GERENCIA_TOTAIS_PS_DEF],
            "meta": {"schemaVersion": 2, "titulo": "Totais PS (filtro atual)"},
        }

    async def getGerenciaTempoMedioEtapas(self, query: dict | None = None) -> dict[str, Any]:
        q = query or {}
        all_units = await load_unidades_ps_from_db(self._pool)
        units = filter_units_by_query(all_units, q)
        umap = unit_meta_map(all_units)
        pred = build_row_predicate(q, umap)
        ds = await load_gerencia_datasets(self._pool, q)
        meta_rows = list(ds.get("metas_rows") or [])
        triagem_meta = meta_limit_rows_by_key(meta_rows, "TRIAGEM", 12)
        consulta_meta = meta_limit_rows_by_key(meta_rows, "CONSULTA", 90)
        med_meta = meta_limit_rows_by_key(meta_rows, "MEDICACAO", 30)
        rx_meta = meta_limit_rows_by_key(meta_rows, "RX", 60)
        tc_meta = meta_limit_rows_by_key(meta_rows, "TC", 120)
        reav_meta = meta_limit_rows_by_key(meta_rows, "REAVALI", 60)
        perm_meta = meta_limit_rows_by_key(meta_rows, "ALTA", 240)

        flux_by = group_rows_by_unit(list(ds.get("flux_rows") or []), umap, pred, ["DATA", "DT_ENTRADA"], q)
        med_by = group_rows_by_unit(list(ds.get("med_rows") or []), umap, pred, ["DATA", "DT_PRESCRICAO"], q)
        rx_by = group_rows_by_unit(list(ds.get("rx_rows") or []), umap, pred, ["DATA", "DT_SOLICITACAO"], q)
        tcus_by = group_rows_by_unit(list(ds.get("tcus_rows") or []), umap, pred, ["DATA", "DT_EXAME", "DT_REALIZADO"], q)
        reav_by = group_rows_by_unit(list(ds.get("reav_rows") or []), umap, pred, ["DATA", "DT_SOLIC_REAVALIACAO"], q)

        linhas = []
        for u in units:
            k = str(u["unidadeId"])
            flux = flux_by.get(k) or []
            med = med_by.get(k) or []
            rx = rx_by.get(k) or []
            tcus = tcus_by.get(k) or []
            reav = reav_by.get(k) or []

            def reav_avg(r: dict) -> float:
                if not reavaliacao_linha_valida_denominador_pbi(r):
                    return float("nan")
                mm = reavaliacao_minutos_pbi(r)
                if mm is not None and mm == mm:
                    return float(mm)
                return as_number(r.get("MINUTOS"))

            linhas.append(
                {
                    "unidadeId": u["unidadeId"],
                    "unidadeLabel": label_unidade_ps(u),
                    "valores": {
                        "totem_triagem": avg(flux, lambda r: as_number(r.get("MIN_ENTRADA_X_TRIAGEM"))),
                        "totem_consulta": avg(flux, lambda r: as_number(r.get("MIN_ENTRADA_X_CONSULTA"))),
                        "presc_medicacao": avg(med, lambda r: as_number(r.get("MINUTOS"))),
                        "presc_rx_ecg": avg(rx, lambda r: as_number(r.get("MINUTOS"))),
                        "presc_tc_us": avg(tcus, lambda r: as_number(r.get("MINUTOS"))),
                        "pedido_reavaliacao": avg(reav, reav_avg),
                        "permanencia_total": avg(flux, lambda r: as_number(r.get("MIN_ENTRADA_X_ALTA"))),
                    },
                }
            )
        totais = {
            "totem_triagem": avg(linhas, lambda r: as_number(r["valores"]["totem_triagem"])),
            "totem_consulta": avg(linhas, lambda r: as_number(r["valores"]["totem_consulta"])),
            "presc_medicacao": avg(linhas, lambda r: as_number(r["valores"]["presc_medicacao"])),
            "presc_rx_ecg": avg(linhas, lambda r: as_number(r["valores"]["presc_rx_ecg"])),
            "presc_tc_us": avg(linhas, lambda r: as_number(r["valores"]["presc_tc_us"])),
            "pedido_reavaliacao": avg(linhas, lambda r: as_number(r["valores"]["pedido_reavaliacao"])),
            "permanencia_total": avg(linhas, lambda r: as_number(r["valores"]["permanencia_total"])),
        }
        sla_map = {
            "totem_triagem": triagem_meta,
            "totem_consulta": consulta_meta,
            "presc_medicacao": med_meta,
            "presc_rx_ecg": rx_meta,
            "presc_tc_us": tc_meta,
            "pedido_reavaliacao": reav_meta,
            "permanencia_total": perm_meta,
        }
        etapas = [{**e, "slaMaxMinutos": sla_map.get(e["key"])} for e in TEMPO_MEDIO_ETAPAS_COLS]
        return {
            "titulo": "Tempo medio por etapa (min)",
            "etapas": etapas,
            "filtroUnidadeOpcoes": [{"value": "", "label": "Todas"}, *[{"value": u["unidadeId"], "label": label_unidade_ps(u)} for u in units]],
            "linhas": linhas,
            "totais": totais,
            "meta": {"schemaVersion": 2},
        }

    async def getGerenciaMetasAcompanhamentoGestao(self, query: dict | None = None) -> dict[str, Any]:
        q = query or {}
        all_units = await load_unidades_ps_from_db(self._pool)
        units = filter_units_by_query(all_units, q)
        umap = unit_meta_map(all_units)
        pred = build_row_predicate(q, umap)
        ds = await load_gerencia_datasets(self._pool, q)
        raw_key = str(q.get("metric") or "conversao")
        ind_resolved = next((x for x in METAS_POR_VOLUMES_INDICADORES if x["key"] == raw_key), METAS_POR_VOLUMES_INDICADORES[0])
        metric_key = ind_resolved["key"]
        cfg = METAS_ACOMP_POR_KEY.get(metric_key, {"meta": 0})
        sense = "low_good" if ind_resolved.get("isReverso") else "high_good"
        ribbon_cmp = "<" if sense == "low_good" else ">"

        from bi_gerencia.util import fmt_meta_br

        month_keys = month_keys_overlapping_query_period(q)
        months = months_labels_from_keys(month_keys)

        def per_metric(m: dict) -> float:
            return float(metas_por_volumes_metric_value(m, metric_key))

        series = []
        for idx, u in enumerate(units):
            data = [
                per_metric(
                    reduce_metrics(build_monthly_gerencia_row_pack(ds, pred, umap, u["unidadeId"], mk, q), ds)
                )
                for mk in month_keys
            ]
            series.append(
                {
                    "unidadeId": u["unidadeId"],
                    "name": label_unidade_ps(u),
                    "color": METAS_ACOMP_CORES_UNIDADE[idx % len(METAS_ACOMP_CORES_UNIDADE)],
                    "data": data,
                }
            )
        period_val_by_unit = [
            per_metric(reduce_metrics(merge_gerencia_monthly_row_packs(ds, pred, umap, u["unidadeId"], month_keys, q), ds))
            for u in units
        ]
        global_val = sum(period_val_by_unit) / len(period_val_by_unit) if period_val_by_unit else 0.0
        gauge_max = 100 if ind_resolved.get("isP") else max(10, float(cfg.get("meta") or 0) * 1.5 or 10)

        return {
            "titulo": "Metas de acompanhamento da gestao",
            "catalog": [
                {"key": x["key"], "label": x["name"], "isP": x["isP"], "isReverso": x["isReverso"]}
                for x in METAS_POR_VOLUMES_INDICADORES
            ],
            "selectedKey": metric_key,
            "gauge": {
                "title": f"{ind_resolved['name']} global no periodo",
                "value": global_val,
                "min": 0,
                "max": gauge_max,
                "isPercent": bool(ind_resolved.get("isP")),
                "sense": sense,
            },
            "metaRibbon": {
                "target": cfg.get("meta"),
                "sense": sense,
                "text": f"META {fmt_meta_br(float(cfg.get('meta') or 0))} {ribbon_cmp} melhor",
            },
            "months": months,
            "series": series,
            "meta": {
                "schemaVersion": 3,
                "filtroUnidades": "regional_unidade_gerencia",
                "demo": False,
                "eixoMeses": "periodo_topo",
            },
        }

    async def getGerenciaMetasConformesPorUnidade(self, query: dict | None = None) -> dict[str, Any]:
        q = query or {}
        all_units = await load_unidades_ps_from_db(self._pool)
        units = filter_units_by_query(all_units, q)
        umap = unit_meta_map(all_units)
        pred = build_row_predicate(q, umap)
        ds = await load_gerencia_datasets(self._pool, q)
        month_keys = month_keys_overlapping_query_period(q)
        months = months_labels_from_keys(month_keys)
        metas = {
            "triagem": meta_limit_rows_by_key(list(ds.get("metas_rows") or []), "TRIAGEM", 12),
            "consulta": meta_limit_rows_by_key(list(ds.get("metas_rows") or []), "CONSULTA", 90),
            "medicacao": meta_limit_rows_by_key(list(ds.get("metas_rows") or []), "MEDICACAO", 30),
            "reavaliacao": meta_limit_rows_by_key(list(ds.get("metas_rows") or []), "REAVALI", 60),
            "permanencia": meta_limit_rows_by_key(list(ds.get("metas_rows") or []), "ALTA", 240),
            "conversao": 12.0,
            "desfecho": 82.0,
        }
        series = []
        for idx, u in enumerate(units):

            def month_pct(mk: str) -> float:
                rows = build_monthly_gerencia_row_pack(ds, pred, umap, u["unidadeId"], mk, q)
                m = reduce_metrics(rows, ds)
                checks = [
                    (m["triagem_acima_meta_pct"], metas["triagem"], "low"),
                    (m["consulta_acima_meta_pct"], metas["consulta"], "low"),
                    (m["medicacao_acima_meta_pct"], metas["medicacao"], "low"),
                    (m["reavaliacao_acima_meta_pct"], metas["reavaliacao"], "low"),
                    (m["permanencia_acima_meta_pct"], metas["permanencia"], "low"),
                    (m["pct_conversao"], metas["conversao"], "high"),
                    (m["pct_desfecho_medico"], metas["desfecho"], "high"),
                ]
                ok = 0
                total = 0
                for v, t, mode in checks:
                    total += 1
                    if mode == "low" and v <= t:
                        ok += 1
                    if mode == "high" and v >= t:
                        ok += 1
                return ratio_pct(ok, total)

            data = [month_pct(mk) for mk in month_keys]
            series.append(
                {
                    "unidadeId": u["unidadeId"],
                    "name": label_unidade_ps(u),
                    "color": METAS_ACOMP_CORES_UNIDADE[idx % len(METAS_ACOMP_CORES_UNIDADE)],
                    "data": data,
                }
            )
        return {
            "titulo": "% de metas conformes por unidade",
            "months": months,
            "isPercent": True,
            "series": series,
            "meta": {
                "schemaVersion": 3,
                "filtroUnidades": "regional_unidade_gerencia",
                "demo": False,
                "eixoMeses": "periodo_topo",
            },
        }

    async def getGerenciaMetasPorVolumesPorIndicador(self, indicador_key: str, filters: dict | None = None) -> dict[str, Any]:
        ff = filters or {}
        ind = next((x for x in METAS_POR_VOLUMES_INDICADORES if x["key"] == indicador_key), None)
        all_units = await load_unidades_ps_from_db(self._pool)
        units = filter_units_by_query(all_units, ff)
        umap = unit_meta_map(all_units)
        pred = build_row_predicate(ff, umap)
        ds = await load_gerencia_datasets(self._pool, ff)
        mes_keys = month_keys_overlapping_query_period(ff)
        months = months_labels_from_keys(mes_keys)
        rows_by_month_by_unit, prev_month_key, january_key = build_metas_por_volumes_rows_by_month_by_unit(
            ds, umap, pred, mes_keys, ff
        )
        key = ind["key"] if ind else indicador_key
        try:
            period_days = float(ff.get("period", ""))
        except (TypeError, ValueError):
            period_days = 0.0
        unidades_out = []
        for u in units:
            uid = u["unidadeId"]
            m0 = reduce_metrics(row_pack_for_unidade(rows_by_month_by_unit, prev_month_key, uid), ds)
            m_jan = reduce_metrics(row_pack_for_unidade(rows_by_month_by_unit, january_key, uid), ds)
            m_months = [reduce_metrics(row_pack_for_unidade(rows_by_month_by_unit, mk, uid), ds) for mk in mes_keys]
            m_synth = reduce_metrics(merge_row_packs_across_months(rows_by_month_by_unit, mes_keys, uid), ds)
            v0 = metas_por_volumes_metric_value(m0, key)
            v_jan = metas_por_volumes_metric_value(m_jan, key)
            v_months = [metas_por_volumes_metric_value(m, key) for m in m_months]
            v_synth = metas_por_volumes_metric_value(m_synth, key)
            meses = [
                {
                    "v": v_months[i],
                    "d": (v_months[i] - v0) if i == 0 else (v_months[i] - v_months[i - 1]),
                    "sec": metas_por_volumes_ref_sec(m_months[i], key),
                }
                for i in range(len(v_months))
            ]
            if period_days == 366:
                ytd = (v_months[-1] - v_jan) if v_months else 0.0
            elif len(v_months) > 1:
                ytd = v_months[-1] - v_months[0]
            elif len(v_months) == 1:
                ytd = v_months[0] - v0
            else:
                ytd = 0.0
            unidades_out.append(
                {
                    "unidadeId": u["unidadeId"],
                    "name": label_unidade_ps(u),
                    "meses": meses,
                    "t": {"v": v_synth, "ytd": ytd, "sec": metas_por_volumes_ref_sec(m_synth, key)},
                }
            )
        ind_nome = ind["name"] if ind else str(indicador_key)
        return {
            "indicadorKey": indicador_key,
            "indicadorNome": ind_nome,
            "months": months,
            "mesKeys": mes_keys,
            "unidades": unidades_out,
        }

    async def getGerenciaDashboardBundle(self, query: dict | None = None) -> dict[str, Any]:
        q = dict(query or {})
        metas_acomp: dict[str, Any] = {}
        for ind in METAS_POR_VOLUMES_INDICADORES:
            metas_acomp[ind["key"]] = await self.getGerenciaMetasAcompanhamentoGestao({**q, "metric": ind["key"]})
        totais_ps = await self.getGerenciaTotaisPs(q)
        tempo = await self.getGerenciaTempoMedioEtapas(q)
        metas_vol = await self.getGerenciaMetasPorVolumes(q)
        metas_conf = await self.getGerenciaMetasConformesPorUnidade(q)
        metricas = await self.getGerenciaMetricasPorUnidade(q)
        unidades = await self.getGerenciaUnidadesPs(q)
        return {
            "schemaVersion": 1,
            "generatedAt": iso_now(),
            "totaisPs": totais_ps,
            "tempoMedioEtapas": tempo,
            "metasPorVolumes": metas_vol,
            "metasConformesPorUnidade": metas_conf,
            "metricasPorUnidade": metricas,
            "unidadesPs": unidades,
            "metasAcompanhamentoByMetric": metas_acomp,
        }

    async def getPSVolumes(self, _query: dict | None = None) -> dict[str, Any]:
        return {
            "atendimentos": 0,
            "examesLaboratoriais": 0,
            "rxEcg": 0,
            "tcUs": 0,
            "prescricoes": 0,
            "evasoes": 0,
            "conversaoInternacao": "0",
            "reavaliacoes": 0,
            "pacsMedicados": 0,
            "medicacoesPorPaciente": "0",
            "pacsExamesLab": 0,
            "labPorPaciente": "0",
            "pacsTcs": 0,
            "tcsPorPaciente": "0",
            "desfechoMedico": "",
        }

    async def getPSKpis(self, _query: dict | None = None) -> dict[str, Any]:
        return {
            "tempoPermanenciaMin": 0,
            "tempoConsultaMin": 0,
            "examesTotal": 0,
            "medicacaoTotal": 0,
            "conversaoInternacao": 0,
            "altas": 0,
            "obitos": 0,
        }

    async def getPSSlas(self, _query: dict | None = None) -> dict[str, Any]:
        return {k: _empty_sla() for k in SLA_KEYS}

    async def getPSMatrix(self, _query: dict | None = None) -> list:
        return []

    async def getPSHistory(self, query: dict | None = None) -> Any:
        return await self.getOverviewMetasVolumes(query or {})

    async def getPSPerfil(self, _query: dict | None = None) -> dict[str, Any]:
        return {"faixaEtaria": [], "sexo": [], "desfechoMedico": []}

    async def getPSFluxos(self, _query: dict | None = None) -> dict[str, Any]:
        return {
            "diasLabels": [],
            "horasLabels": [],
            "heatmapAtendimentos": [],
            "heatmapTempoMedioMin": [],
            "resumoPorHora": [],
            "heatmapCalendario": {"horasLabels": [], "diasLabels": [], "atendimentos": []},
        }

    async def getPSMedicacao(self, _query: dict | None = None) -> dict[str, Any]:
        return {"porVia": [], "velocidade": {"rapida": 0, "lenta": 0}, "top10": []}

    async def getPSConversao(self, _query: dict | None = None) -> dict[str, Any]:
        return {
            "labels": [],
            "taxaConversaoPct": [],
            "atendimentos": [],
            "internacoes": [],
            "porUnidadeUltimoMes": [],
            "kpis": {
                "quantidadeAtendimentos": 0,
                "quantidadeInternacoes": 0,
                "taxaConversaoPct": 0,
                "tempoMedioPsInternacaoHoras": None,
            },
        }

    async def getFinanceiroResumo(self, _query: dict | None = None) -> dict[str, Any]:
        return {"labels": [], "receitas": [], "despesas": [], "meta": 0, "glosasPercent": []}

    async def getFinanceiroConvenio(self, _query: dict | None = None) -> dict[str, Any]:
        return {"labels": [], "valores": [], "cores": []}

    async def getFinanceiroGlosas(self, _query: dict | None = None) -> dict[str, Any]:
        return {"total": 0, "percentualFaturamento": 0, "porMotivo": []}

    async def getOcupacaoSetor(self, _query: dict | None = None) -> dict[str, Any]:
        return {"setores": []}

    async def getInternacaoKPIs(self, _query: dict | None = None) -> dict[str, Any]:
        return {
            "altasAcumuladas": 0,
            "obitosAcumulados": 0,
            "tempoMedioPermanencia": "0",
            "taxaReadmissao": "0",
        }

    async def getInternacaoResumo(self, _query: dict | None = None) -> dict[str, Any]:
        return {
            "quantidadeInternacoes": 0,
            "altas": 0,
            "obitos": 0,
            "pacientesClinicos": 0,
            "pacientesCirurgicos": 0,
            "pacientesInternos": 0,
            "pacientesExternos": 0,
        }

    async def getInternacoes(self, _query: dict | None = None) -> list:
        return []

    async def getOcupacaoTendencia(self, _query: dict | None = None) -> dict[str, Any]:
        return {"labels": [], "series": [], "meta": 0}

    async def getOcupacaoQualidade(self, _query: dict | None = None) -> dict[str, Any]:
        return {
            "labels": [],
            "infeccaoHospitalar": [],
            "quedas": [],
            "ulcerasPressao": [],
            "nps": [],
            "meta": 0,
            "metaNps": 0,
        }

    async def getCirurgiaEspecialidade(self, _query: dict | None = None) -> dict[str, Any]:
        return {"labels": [], "dados": [], "meta": []}

    async def getCirurgiaEvolucao(self, _query: dict | None = None) -> dict[str, Any]:
        return {"labels": [], "eletivas": [], "urgencias": [], "meta": 0}

    async def getCirurgiaTempoCentro(self, _query: dict | None = None) -> dict[str, Any]:
        return {
            "labels": DIAS_SEMANA,
            "mediaTempoMin": [0, 0, 0, 0, 0, 0, 0],
            "heatmap": [],
            "horasLabels": [],
        }

    async def getCCPerformance(self, _query: dict | None = None) -> dict[str, Any]:
        return {
            "atraso30min": "0",
            "ociosidadeSala": "0",
            "subutilizacaoFiltrado": 0,
            "taxaReabordagem": "0",
            "totalCirurgias": 0,
        }

    async def getCCKpis(self, _query: dict | None = None) -> dict[str, Any]:
        return {
            "tempoCirurgiaMin": 0,
            "tempoSalaMin": 0,
            "tempoAnestesiaMin": 0,
            "altas": 0,
            "obitos": 0,
            "eletivas": 0,
            "urgencias": 0,
        }

    async def getCCPerformanceTimeline(self, _query: dict | None = None) -> list:
        return []
