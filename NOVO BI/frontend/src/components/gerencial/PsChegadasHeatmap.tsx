import ReactECharts from "echarts-for-react";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { fetchDashboardRows, fetchPsHeatmapChegadas } from "../../services/api";
import { analyzePsHeatmapRows, type HeatmapRow } from "./psChegadasHeatmapAnalysis";
import { PsChegadasHeatmapReport } from "./PsChegadasHeatmapReport";

type FilterRow = { regional: string; unidade: string };

function normalizeIsoDate(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return "";
    return t.length >= 10 ? t.slice(0, 10) : t;
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
    const hora = Math.trunc(Number(row.hora ?? row.HORA ?? 0));
    const qtd = Number(row.qtd_atendimentos ?? row.QTD_ATENDIMENTOS ?? 0);
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

export function PsChegadasHeatmap(): ReactElement {
  const [regional, setRegional] = useState<string>("ALL");
  const [unidade, setUnidade] = useState<string>("");
  const [mes, setMes] = useState<string>("");

  const [filtrosRows, setFiltrosRows] = useState<FilterRow[]>([]);
  const [filtrosLoading, setFiltrosLoading] = useState(true);

  const [rows, setRows] = useState<HeatmapRow[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canQuery = Boolean(mes.trim() && unidade.trim());

  useEffect(() => {
    const controller = new AbortController();
    setFiltrosLoading(true);
    void fetchDashboardRows("gerencial-filtros", {
      limit: 2000,
      period: 30,
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
            .filter((r) => r.regional && r.unidade)
        );
      })
      .catch(() => setFiltrosRows([]))
      .finally(() => setFiltrosLoading(false));
    return () => controller.abort();
  }, [regional]);

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
      unidade: unidade.trim(),
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
  }, [canQuery, mes, unidade, regional]);

  const regionais = useMemo(() => {
    const s = new Set(filtrosRows.map((r) => r.regional));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [filtrosRows]);

  const unidades = useMemo(() => {
    const list =
      regional === "ALL"
        ? filtrosRows.map((r) => r.unidade)
        : filtrosRows.filter((r) => r.regional === regional).map((r) => r.unidade);
    return [...new Set(list)].sort((a, b) => a.localeCompare(b));
  }, [filtrosRows, regional]);

  useEffect(() => {
    if (unidade && !unidades.includes(unidade)) setUnidade("");
  }, [unidade, unidades]);

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

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_92%,transparent)] p-3 md:p-4">
        <label className="flex min-w-[140px] flex-col gap-1 text-xs text-[var(--app-muted)]">
          Regional
          <select
            className="filter-select min-w-[140px]"
            value={regional}
            onChange={(e) => {
              setRegional(e.target.value);
              setUnidade("");
            }}
            disabled={filtrosLoading}
          >
            <option value="ALL">Todas</option>
            {regionais.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-[var(--app-muted)]">
          Unidade
          <select
            className="filter-select w-full min-w-[200px]"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            disabled={filtrosLoading}
          >
            <option value="">—</option>
            {unidades.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[160px] flex-col gap-1 text-xs text-[var(--app-muted)]">
          Mês
          <input
            type="month"
            className="filter-select min-h-[38px] min-w-[160px] px-2"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </label>
      </div>

      {!canQuery && (
        <div className="rounded-2xl border border-dashed border-[var(--table-grid)] bg-[var(--app-elevated)]/40 py-16 text-center text-sm text-[var(--app-muted)]">
          Selecione <strong className="text-[var(--table-header-fg)]">unidade</strong> e{" "}
          <strong className="text-[var(--table-header-fg)]">mês</strong> para carregar o mapa.
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
        <div className="w-full overflow-visible rounded-2xl border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_92%,transparent)] p-2 md:p-3">
          <ReactECharts
            option={chart.option}
            notMerge
            lazyUpdate
            style={{ width: "100%", height: chart.height }}
            opts={{ renderer: "canvas" }}
          />
        </div>
      )}

      {canQuery && !dataLoading && error === null && analysis !== null && (
        <PsChegadasHeatmapReport unidade={unidade.trim()} mesLabel={mesLabel} analysis={analysis} />
      )}
    </div>
  );
}
