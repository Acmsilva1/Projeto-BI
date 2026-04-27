import ReactECharts from "echarts-for-react";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { fetchDashboardRows, fetchPsHeatmapChegadas } from "../../features/jornada/api";
import type { PeriodDays } from "../../lib/gerencialFiltersStorage";
import { analyzePsHeatmapRows, type HeatmapRow } from "./psChegadasHeatmapAnalysis";
import { PsChegadasHeatmapReport } from "./PsChegadasHeatmapReport";

export type PsChegadasHeatmapProps = {
  period: PeriodDays;
  regional: string;
  unidade: string;
};

type FilterRow = { regional: string; unidade: string };

/** Mês civil alinhado ao painel gerencial: `period === 1` usa ontem (local); demais períodos usam o mês atual. */
function calendarYmForPeriodAnchor(period: PeriodDays): string {
  const now = new Date();
  if (period === 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Mês civil corrente (local) — usado quando o painel fixa uma unidade no filtro global. */
function currentCalendarYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function initialMes(unidade: string, period: PeriodDays): string {
  if (unidade !== "ALL" && unidade.trim().length > 0) return currentCalendarYm();
  return calendarYmForPeriodAnchor(period);
}

function normalizeIsoDate(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return "";
    if (t.length >= 10 && t[4] === "-" && t[7] === "-") return t.slice(0, 10);
    if (t.includes("T")) return t.slice(0, 10);
    return t.length >= 10 ? t.slice(0, 10) : t;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function toHeatmapRows(rows: Record<string, unknown>[]): HeatmapRow[] {
  const out: HeatmapRow[] = [];
  for (const row of rows) {
    const data_chegada = normalizeIsoDate(row.data_chegada ?? row.DATA_CHEGADA);
    const horaRaw = row.hora ?? row.HORA;
    const hora = Math.trunc(Number(typeof horaRaw === "string" ? horaRaw.trim() : horaRaw));
    const qtdRaw = row.qtd_atendimentos ?? row.QTD_ATENDIMENTOS;
    const qtd = Number(typeof qtdRaw === "string" ? String(qtdRaw).replace(",", ".") : qtdRaw);
    if (!data_chegada || hora < 0 || hora > 23 || !Number.isFinite(qtd)) continue;
    const diaRaw = row.dia_mes ?? row.DIA_MES;
    const dia_mes = Number.isFinite(Number(diaRaw)) ? Math.trunc(Number(diaRaw)) : Number(data_chegada.slice(-2)) || 0;
    out.push({ data_chegada, dia_mes, hora, qtd_atendimentos: Math.max(0, qtd) });
  }
  return out;
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

function lastDayOfCalendarMonth(ym: string): number {
  const parts = ym.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return 31;
  return new Date(y, m, 0).getDate();
}

const PBIX_HEAT_COLORS = ["#bbf7d0", "#86efac", "#fde047", "#fb923c", "#ea580c", "#dc2626"];

const Y_DAYS = 31;
const Y_LABELS = Array.from({ length: Y_DAYS }, (_, i) => String(i + 1));

const GRID_LINE = "rgba(71, 85, 105, 0.55)";

export function PsChegadasHeatmap(props: PsChegadasHeatmapProps): ReactElement {
  const { period, regional, unidade } = props;
  const [mes, setMes] = useState<string>(() => initialMes(props.unidade, props.period));
  /**
   * Com unidade "Todas" no painel global, a API do mapa exige uma unidade: o utilizador escolhe aqui (sem dados até
   * haver seleção). Com unidade fixa no painel, o mês abre no mês civil atual dessa unidade.
   */
  const [unidadeMapaLocal, setUnidadeMapaLocal] = useState<string>("");
  const [filtrosRows, setFiltrosRows] = useState<FilterRow[]>([]);
  const [filtrosLoading, setFiltrosLoading] = useState(false);
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReactECharts | null>(null);
  const previousPeriodRef = useRef<PeriodDays>(period);
  const previousGlobalUnidadeRef = useRef<string>(unidade);

  const unidadePainelEspecifica = unidade !== "ALL" && unidade.trim().length > 0;
  const unidadeParaApi = unidadePainelEspecifica ? unidade.trim() : unidadeMapaLocal.trim();
  const canQuery = Boolean(mes.trim() && unidadeParaApi.length > 0);

  useEffect(() => {
    const controller = new AbortController();
    setFiltrosLoading(true);
    void fetchDashboardRows("gerencial-filtros", {
      limit: 2000,
      period,
      regional: regional === "ALL" ? undefined : regional,
      signal: controller.signal
    })
      .then((p) => {
        setFiltrosRows(
          p.rows
            .map((r) => ({
              regional: String(r.regional ?? "").trim(),
              unidade: String(r.unidade ?? "").trim()
            }))
            .filter((r) => r.regional.length > 0 && r.unidade.length > 0)
        );
      })
      .catch(() => setFiltrosRows([]))
      .finally(() => setFiltrosLoading(false));
    return () => controller.abort();
  }, [period, regional]);

  const unidadesLista = useMemo(() => {
    const list =
      regional === "ALL"
        ? filtrosRows.map((r) => r.unidade)
        : filtrosRows.filter((r) => r.regional === regional).map((r) => r.unidade);
    return [...new Set(list)].sort((a, b) => a.localeCompare(b));
  }, [filtrosRows, regional]);

  useEffect(() => {
    if (unidadePainelEspecifica) {
      previousPeriodRef.current = period;
      return;
    }
    if (previousPeriodRef.current !== period) {
      previousPeriodRef.current = period;
      setMes(calendarYmForPeriodAnchor(period));
    }
  }, [period, unidadePainelEspecifica]);

  useEffect(() => {
    if (unidadePainelEspecifica) {
      setUnidadeMapaLocal("");
      const u = unidade.trim();
      if (previousGlobalUnidadeRef.current !== u) {
        previousGlobalUnidadeRef.current = u;
        setMes(currentCalendarYm());
      }
      return;
    }
    previousGlobalUnidadeRef.current = unidade;
  }, [unidade, unidadePainelEspecifica]);

  useEffect(() => {
    if (unidadePainelEspecifica) return;
    if (unidadeMapaLocal && !unidadesLista.includes(unidadeMapaLocal)) {
      setUnidadeMapaLocal("");
    }
  }, [unidadePainelEspecifica, unidadeMapaLocal, unidadesLista]);

  const [rows, setRows] = useState<HeatmapRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canQuery) {
      setRows([]);
      setError(null);
      setDataLoading(false);
      return;
    }
    const controller = new AbortController();
    setDataLoading(true);
    setError(null);
    void fetchPsHeatmapChegadas({
      mes: mes.trim(),
      unidade: unidadeParaApi,
      regional: regional === "ALL" ? undefined : regional,
      limit: 5000,
      signal: controller.signal
    })
      .then((p) => setRows(toHeatmapRows(p.rows)))
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Erro");
        setRows([]);
      })
      .finally(() => setDataLoading(false));
    return () => controller.abort();
  }, [canQuery, mes, unidadeParaApi, regional]);

  const resizeChart = useCallback((): void => {
    const inst = chartRef.current?.getEchartsInstance?.();
    if (inst) void inst.resize();
  }, []);

  useEffect(() => {
    if (!canQuery || dataLoading) return;
    const t = window.setTimeout(resizeChart, 80);
    return () => window.clearTimeout(t);
  }, [canQuery, dataLoading, mes, unidadeParaApi, regional, rows.length, resizeChart]);

  useEffect(() => {
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resizeChart()) : null;
    const el = chartWrapRef.current;
    if (ro && el) ro.observe(el);
    window.addEventListener("resize", resizeChart);
    return () => {
      window.removeEventListener("resize", resizeChart);
      if (ro && el) ro.unobserve(el);
      ro?.disconnect();
    };
  }, [resizeChart]);

  const analysis = useMemo(() => {
    if (!canQuery || !mes.trim()) return null;
    return analyzePsHeatmapRows(mes.trim(), rows);
  }, [canQuery, mes, rows]);

  const mesLabel = useMemo(() => {
    const t = mes.trim();
    if (t.length < 7) return t;
    return `${t.slice(5, 7)}/${t.slice(0, 4)}`;
  }, [mes]);

  const chart = useMemo((): { option: Record<string, unknown>; height: number } | null => {
    if (!canQuery || !mes.trim()) return null;
    const ym = mes.trim();

    const valueMap = new Map<string, number>();
    for (const r of rows) {
      if (!r.data_chegada.startsWith(ym)) continue;
      const k = `${r.data_chegada}|${r.hora}`;
      valueMap.set(k, (valueMap.get(k) ?? 0) + r.qtd_atendimentos);
    }
    let vmax = 0;
    for (const v of valueMap.values()) {
      if (v > vmax) vmax = v;
    }

    const lastD = lastDayOfCalendarMonth(ym);
    const heatData: [number, number, number][] = [];
    for (let dia = 1; dia <= Y_DAYS; dia += 1) {
      const inMonth = dia <= lastD;
      const iso = inMonth ? `${ym}-${String(dia).padStart(2, "0")}` : "";
      for (let hi = 0; hi < 24; hi += 1) {
        const v = iso ? (valueMap.get(`${iso}|${hi}`) ?? 0) : 0;
        heatData.push([hi, dia - 1, v]);
      }
    }

    const [yy, mm] = ym.split("-");
    const tooltipY = (yi: number): string => {
      const d = yi + 1;
      return `${String(d).padStart(2, "0")}/${mm}/${yy}`;
    };

    const chartHeight = Math.min(Math.round(typeof window !== "undefined" ? window.innerHeight * 0.72 : 720), 900);

    const axisSplit = {
      show: true,
      lineStyle: { color: GRID_LINE, width: 1 }
    };

    const option: Record<string, unknown> = {
      animationDuration: 400,
      tooltip: {
        trigger: "item",
        appendToBody: true,
        confine: false,
        transitionDuration: 0.15,
        formatter: (p: { data?: [number, number, number] }) => {
          const d = p.data;
          if (!d) return "";
          const [hx, yi, val] = d;
          return `${tooltipY(yi)} · ${HOUR_LABELS[hx] ?? String(hx)}<br/><b>${val.toLocaleString("pt-BR")}</b>`;
        },
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        borderColor: "rgba(71, 85, 105, 0.5)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        extraCssText: "max-width:min(320px,92vw);pointer-events:none;z-index:9999;"
      },
      grid: { left: 48, right: 10, top: 28, bottom: 68, containLabel: false },
      xAxis: {
        type: "category",
        data: HOUR_LABELS,
        splitArea: { show: true, areaStyle: { color: ["rgba(148,163,184,0.06)", "rgba(148,163,184,0.1)"] } },
        splitLine: axisSplit,
        axisLabel: { color: "#94a3b8", fontSize: 9, interval: 1, rotate: 40 },
        axisLine: { lineStyle: { color: GRID_LINE } }
      },
      yAxis: {
        type: "category",
        data: Y_LABELS,
        inverse: true,
        splitArea: { show: true, areaStyle: { color: ["rgba(148,163,184,0.06)", "rgba(148,163,184,0.1)"] } },
        splitLine: axisSplit,
        axisLabel: { color: "#94a3b8", fontSize: 11 },
        axisLine: { lineStyle: { color: GRID_LINE } }
      },
      visualMap: {
        min: 0,
        max: Math.max(vmax, 1),
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 6,
        itemWidth: 12,
        itemHeight: 88,
        textStyle: { color: "#94a3b8", fontSize: 10 },
        inRange: { color: PBIX_HEAT_COLORS }
      },
      series: [
        {
          type: "heatmap",
          data: heatData,
          itemStyle: { borderColor: "rgba(30, 41, 59, 0.35)", borderWidth: 0.5 },
          label: {
            show: true,
            fontSize: 9,
            color: "#0f172a",
            formatter: (p: { value?: [number, number, number] }) => {
              const v = p.value?.[2];
              if (v === undefined || v === 0) return "";
              return String(v);
            }
          },
          emphasis: {
            itemStyle: { shadowBlur: 6, shadowColor: "rgba(220, 38, 38, 0.3)" }
          }
        }
      ]
    };
    return { option, height: chartHeight };
  }, [rows, mes, canQuery]);

  const chartKey = `${mes}|${unidadeParaApi}|${regional}|${rows.length}`;

  const faltaUnidadeMsg = unidadePainelEspecifica
    ? "Selecione o mês acima (alinhado ao período do painel ao mudar 1d / 7d / …)."
    : unidadesLista.length === 0
      ? "Nenhuma unidade disponível para este regional. Ajuste os filtros do painel ou aguarde o carregamento."
      : "Com unidade “Todas” no painel, escolha a unidade do mapa abaixo para carregar os dados.";

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_92%,transparent)] p-3 md:p-4">
        <label className="flex min-w-[160px] flex-col gap-1 text-xs text-[var(--app-muted)]">
          Mês
          <input
            type="month"
            className="filter-select min-h-[38px] min-w-[160px] px-2"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </label>
        {!unidadePainelEspecifica && (
          <label className="flex min-w-[200px] max-w-full flex-1 flex-col gap-1 text-xs text-[var(--app-muted)]">
            Unidade do mapa
            <select
              className={`filter-select min-h-[38px] w-full min-w-[200px] px-2${unidadeMapaLocal.trim() ? " is-active" : ""}`}
              value={unidadeMapaLocal}
              onChange={(e) => setUnidadeMapaLocal(e.target.value)}
              disabled={filtrosLoading}
            >
              <option value="">— escolher —</option>
              {unidadesLista.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!canQuery && (
        <div className="rounded-2xl border border-dashed border-[var(--table-grid)] bg-[var(--app-elevated)]/40 py-16 text-center text-sm text-[var(--app-muted)]">
          {filtrosLoading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin opacity-70" aria-hidden />
              Carregando unidades…
            </span>
          ) : (
            <>{faltaUnidadeMsg}</>
          )}
        </div>
      )}

      {canQuery && dataLoading && (
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_92%,transparent)]">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--dash-live)] opacity-70" aria-hidden />
        </div>
      )}

      {canQuery && !dataLoading && error !== null && (
        <div className="rounded-xl border border-[var(--dash-critical)]/30 p-3 text-center text-xs text-[var(--dash-critical)]">{error}</div>
      )}

      {canQuery && !dataLoading && error === null && chart !== null && (
        <div
          ref={chartWrapRef}
          className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_92%,transparent)] p-2 md:p-3"
        >
          <ReactECharts
            key={chartKey}
            ref={chartRef}
            option={chart.option}
            notMerge
            lazyUpdate={false}
            style={{ width: "100%", minWidth: 280, height: chart.height }}
            opts={{ renderer: "canvas" }}
            onChartReady={resizeChart}
          />
        </div>
      )}

      {canQuery && !dataLoading && error === null && analysis !== null && (
        <PsChegadasHeatmapReport unidade={unidadeParaApi} mesLabel={mesLabel} analysis={analysis} />
      )}
    </div>
  );
}
