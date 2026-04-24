import { Loader2, Minus, Plus } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { fetchDashboardJson } from "../../services/api";
import type { PeriodDays } from "../../lib/gerencialFiltersStorage";

type MonthMeta = { yearMonth: number; label: string };
type MonthCell = {
  yearMonth: number;
  label: string;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  deltaVsPrev: number | null;
  tone: "ok" | "warn" | "bad" | "empty";
};
type TotalBlock = {
  value: number | null;
  compareParen: number | null;
  variance: number | null;
  ytd: number | null;
  toneTotal: "ok" | "warn" | "bad" | "empty";
  toneYtd: "ok" | "warn" | "bad" | "empty";
};
type DeltaDirection = "<" | ">";

type IndicatorRow = {
  key: string;
  label: string;
  targetDisplay: string;
  targetValue: number;
  format: "percent" | "number";
  direction: DeltaDirection;
  months: MonthCell[];
  total: TotalBlock;
};

type DrillRow = {
  cd: number;
  unidade: string;
  months: MonthCell[];
  ytd: number | null;
};

type MatrixPayload = {
  availableMonths: MonthMeta[];
  months: MonthMeta[];
  anchorYearMonth: number;
  indicators: IndicatorRow[];
};

type MetaDefinitionLite = { key: string; direction?: string };

function normalizeIndicators(raw: unknown, metaDefinitions: unknown): IndicatorRow[] {
  const list = Array.isArray(raw) ? raw : [];
  const defs = Array.isArray(metaDefinitions) ? (metaDefinitions as MetaDefinitionLite[]) : [];
  return list.map((item) => {
    const i = item as IndicatorRow;
    const fromMeta = defs.find((d) => d.key === i.key)?.direction;
    const explicit = i.direction === ">" || i.direction === "<" ? i.direction : undefined;
    const fromMetaOk = fromMeta === ">" || fromMeta === "<" ? fromMeta : undefined;
    const direction: DeltaDirection = explicit ?? fromMetaOk ?? (i.key === "desfecho" ? ">" : "<");
    return { ...i, direction };
  });
}

function formatCell(format: "percent" | "number", value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  if (format === "percent") {
    return `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDelta(format: "percent" | "number", delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) return "";
  const v = format === "percent" ? delta * 100 : delta;
  const sign = v > 0 ? "+" : "";
  return `(${sign}${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${format === "percent" ? "%" : ""})`;
}

function deltaTrendClass(delta: number | null, direction: DeltaDirection): string {
  if (delta === null || !Number.isFinite(delta)) return "text-[var(--app-muted)]";
  if (Math.abs(delta) < 1e-12) return "text-[var(--app-muted)]";
  if (direction === ">") {
    if (delta > 0) return "text-[var(--dash-live)]";
    if (delta < 0) return "text-[var(--dash-critical)]";
  } else {
    if (delta < 0) return "text-[var(--dash-live)]";
    if (delta > 0) return "text-[var(--dash-critical)]";
  }
  return "text-[var(--app-muted)]";
}

function ytdMetricClass(ytd: number | null, direction: DeltaDirection): string {
  if (ytd === null || !Number.isFinite(ytd)) return "text-[var(--app-muted)]";
  if (Math.abs(ytd) < 1e-12) return "text-[var(--app-muted)]";
  if (direction === "<") {
    return ytd < 0 ? "text-[var(--dash-live)]" : "text-[var(--dash-critical)]";
  }
  return ytd > 0 ? "text-[var(--dash-live)]" : "text-[var(--dash-critical)]";
}

function isYtdRed(ytd: number | null, direction: DeltaDirection): boolean {
  if (ytd === null || !Number.isFinite(ytd)) return false;
  if (Math.abs(ytd) < 1e-12) return false;
  if (direction === "<") return ytd > 0;
  return ytd < 0;
}

function formatDrillYtd(format: "percent" | "number", ytd: number | null, direction: DeltaDirection): string {
  const base = formatCell(format, ytd);
  if (base === "-" || !isYtdRed(ytd, direction)) return base;
  if (base.startsWith("-")) return base;
  return `+${base}`;
}

function tooltipForCell(format: "percent" | "number", cell: MonthCell): string | undefined {
  if (format !== "percent") return undefined;
  if (cell.numerator === null || cell.denominator === null) return undefined;
  const num = Math.round(cell.numerator);
  const den = Math.round(cell.denominator);
  return `Valor: ${num.toLocaleString("pt-BR")} de ${den.toLocaleString("pt-BR")}`;
}

function cellSurfaceClass(_tone: MonthCell["tone"]): string {
  return "mpv-cell mpv-cell--uniform";
}

function drillCellSurfaceClass(deltaVsPrev: number | null): string {
  if (deltaVsPrev === null || !Number.isFinite(deltaVsPrev)) return "mpv-cell mpv-cell--drill-empty";
  if (deltaVsPrev > 0) return "mpv-cell mpv-cell--drill-negative";
  if (deltaVsPrev < 0) return "mpv-cell mpv-cell--drill-positive";
  return "mpv-cell mpv-cell--drill-empty";
}

function toneTextClass(tone: "ok" | "warn" | "bad" | "empty"): string {
  if (tone === "ok") return "text-[var(--dash-live)]";
  if (tone === "warn") return "text-[var(--dash-accent-urgent)]";
  if (tone === "bad") return "text-[var(--dash-critical)]";
  return "text-[var(--app-muted)]";
}

function toYearMonthParam(yearMonth: number): string {
  const year = Math.trunc(yearMonth / 100);
  const month = yearMonth % 100;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export type MetasPorVolumesTableProps = {
  period: PeriodDays;
  regional: string;
  unidade: string;
};

export function MetasPorVolumesTable(props: MetasPorVolumesTableProps): ReactElement {
  const { period, regional, unidade } = props;
  const [selectedMonth, setSelectedMonth] = useState<number | "ALL">("ALL");
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; matrix: MatrixPayload }
  >({ status: "loading" });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drillByKey, setDrillByKey] = useState<Record<string, DrillRow[] | "loading" | "error">>({});

  const loadMatrix = useCallback(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    setExpanded({});
    setDrillByKey({});
    fetchDashboardJson("gerencial-metas-por-volumes", {
      mes: selectedMonth === "ALL" ? undefined : toYearMonthParam(selectedMonth),
      period,
      regional: regional === "ALL" ? undefined : regional,
      unidade: unidade === "ALL" ? undefined : unidade,
      signal: controller.signal
    })
      .then((payload) => {
        const row = payload.rows[0] as Record<string, unknown> | undefined;
        if (!row || row.kind !== "metas-por-volumes") {
          setState({ status: "error", message: "Resposta inesperada do servidor." });
          return;
        }
        const matrix: MatrixPayload = {
          availableMonths: (row.availableMonths as MonthMeta[]) ?? [],
          months: (row.months as MonthMeta[]) ?? [],
          anchorYearMonth: Number(row.anchorYearMonth ?? 0),
          indicators: normalizeIndicators(row.indicators, row.metaDefinitions)
        };
        setState({ status: "ready", matrix });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Falha ao carregar Metas por volume.";
        setState({ status: "error", message });
      });
    return () => controller.abort();
  }, [selectedMonth, period, regional, unidade]);

  useEffect(() => loadMatrix(), [loadMatrix]);

  const monthOptions = useMemo(() => {
    if (state.status !== "ready") return [];
    return state.matrix.availableMonths;
  }, [state]);

  const fetchDrill = useCallback(
    (key: string) => {
      setDrillByKey((prev) => ({ ...prev, [key]: "loading" }));
      fetchDashboardJson("gerencial-metas-por-volumes-drill", {
        indicador: key,
        mes: selectedMonth === "ALL" ? undefined : toYearMonthParam(selectedMonth),
        period,
        regional: regional === "ALL" ? undefined : regional,
        unidade: unidade === "ALL" ? undefined : unidade
      })
        .then((payload) => {
          const rows = payload.rows as Record<string, unknown>[];
          const drill: DrillRow[] = rows.map((r) => ({
            cd: Number(r.cd ?? 0),
            unidade: String(r.unidade ?? ""),
            months: r.months as MonthCell[],
            ytd: r.ytd === null || r.ytd === undefined ? null : Number(r.ytd)
          }));
          setDrillByKey((prev) => ({ ...prev, [key]: drill }));
        })
        .catch(() => {
          setDrillByKey((prev) => ({ ...prev, [key]: "error" }));
        });
    },
    [selectedMonth, period, regional, unidade]
  );

  const toggleDrill = (key: string): void => {
    setExpanded((prev) => {
      const willOpen = !prev[key];
      if (willOpen) {
        void fetchDrill(key);
      }
      return { ...prev, [key]: willOpen };
    });
  };

  return (
    <section className="dashboard-panel mpv-section" aria-label="Metas por volume">
      <header className="mpv-head px-3 pt-3">
        <div className="mpv-filters">
          <label className="mpv-filter">
            <span className="mpv-filter-label">Mes</span>
            <select
              className="filter-select"
              value={selectedMonth === "ALL" ? "ALL" : String(selectedMonth)}
              onChange={(event) => {
                const next = event.target.value;
                setSelectedMonth(next === "ALL" ? "ALL" : Number(next));
              }}
            >
              <option value="ALL">Ultimos 3 meses (media mensal)</option>
              {monthOptions.map((m) => (
                <option key={m.yearMonth} value={String(m.yearMonth)}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {state.status === "error" && (
        <div className="mt-4 rounded-xl border border-[var(--dash-critical)]/40 bg-[color-mix(in_srgb,var(--dash-critical)_12%,transparent)] p-4 text-sm text-[var(--app-fg)]">
          {state.message}
        </div>
      )}

      {state.status === "loading" && (
        <div className="mt-6 flex items-center gap-2 text-sm text-[var(--app-muted)]">
          <Loader2 className="animate-spin text-[var(--dash-live)]" size={18} />
          Carregando matriz de metas...
        </div>
      )}

      {state.status === "ready" && state.matrix.months.length === 0 && (
        <p className="mt-4 text-sm text-[var(--app-muted)]">Sem dados de fluxo no recorte selecionado.</p>
      )}

      {state.status === "ready" && state.matrix.months.length > 0 && (
        <div className="px-3 pb-3">
          <div className="mpv-table-wrap mt-5 overflow-x-auto rounded-xl border border-[var(--table-grid)] bg-[var(--app-elevated)]">
          <table className="mpv-table min-w-[1180px] w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]">
                <th className="mpv-th sticky left-0 z-20 bg-[var(--app-elevated)] px-3 py-3 text-left font-bold text-[var(--table-header-fg)]">
                  Indicador
                </th>
                {state.matrix.months.map((m) => (
                  <th key={m.yearMonth} colSpan={2} className="mpv-th px-2 py-3 text-center font-bold text-[var(--table-header-fg)]">
                    {m.label}
                  </th>
                ))}
                <th colSpan={4} className="mpv-th px-2 py-3 text-center font-bold text-[var(--table-header-fg)]">
                  Total
                </th>
              </tr>
              <tr className="text-xs font-semibold uppercase tracking-wide text-[var(--table-header-muted)]">
                <th className="mpv-th sticky left-0 z-20 bg-[var(--app-elevated)] px-3 py-2" />
                {state.matrix.months.map((m) => (
                  <th key={`${m.yearMonth}-h`} colSpan={2} className="mpv-th px-1 py-2 text-center">
                    Valor / Var.
                  </th>
                ))}
                <th className="mpv-th px-1 py-2 text-center">Valor atual</th>
                <th className="mpv-th px-1 py-2 text-center">Valor anterior</th>
                <th className="mpv-th px-1 py-2 text-center">Var.</th>
                <th className="mpv-th px-1 py-2 text-center">YTD</th>
              </tr>
            </thead>
            <tbody>
              {state.matrix.indicators.map((ind) => (
                <Fragment key={ind.key}>
                  <tr>
                    <td className="mpv-td sticky left-0 z-10 bg-[var(--background)] px-2 py-2 font-medium text-[var(--foreground)]">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded border border-[var(--table-grid)] p-0.5 text-[var(--app-muted)] hover:bg-[var(--app-elevated)]"
                          aria-expanded={Boolean(expanded[ind.key])}
                          onClick={() => toggleDrill(ind.key)}
                        >
                          {expanded[ind.key] ? <Minus size={14} /> : <Plus size={14} />}
                        </button>
                        <span>
                          {ind.label} <span className="text-[var(--app-muted)]">{ind.targetDisplay}</span>
                        </span>
                      </div>
                    </td>
                    {ind.months.map((mc) => {
                      const tip = tooltipForCell(ind.format, mc);
                      return (
                        <td
                          key={mc.yearMonth}
                          colSpan={2}
                          className={`px-1 py-2 text-center tabular-nums ${cellSurfaceClass(mc.tone)} ${tip ? "mpv-tooltip-cell" : ""}`}
                          data-tooltip={tip}
                        >
                          <div className="mpv-value">{formatCell(ind.format, mc.value)}</div>
                          {mc.deltaVsPrev !== null && (
                            <div className={`mpv-delta ${deltaTrendClass(mc.deltaVsPrev, ind.direction)}`}>
                              {formatDelta(ind.format, mc.deltaVsPrev)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className={`px-1 py-2 text-center tabular-nums ${cellSurfaceClass(ind.total.toneTotal)}`}>
                      {formatCell(ind.format, ind.total.value)}
                    </td>
                    <td className={`px-1 py-2 text-center tabular-nums text-[var(--table-header-muted)] ${cellSurfaceClass("empty")}`}>
                      {formatCell(ind.format, ind.total.compareParen)}
                    </td>
                    <td className={`px-1 py-2 text-center tabular-nums ${cellSurfaceClass("empty")}`}>
                      <span className={deltaTrendClass(ind.total.variance, ind.direction)}>
                        {formatDelta(ind.format, ind.total.variance)}
                      </span>
                    </td>
                    <td className={`px-1 py-2 text-center tabular-nums ${cellSurfaceClass(ind.total.toneYtd)}`}>
                      <span className={`font-semibold ${toneTextClass(ind.total.toneYtd)}`}>
                        {formatCell(ind.format, ind.total.ytd)}
                      </span>
                    </td>
                  </tr>
                  {expanded[ind.key] && (
                    <tr className="bg-[color-mix(in_srgb,var(--primary)_4%,transparent)]">
                      <td colSpan={1 + state.matrix.months.length * 2 + 4} className="px-3 py-3">
                        <DrillPanel
                          format={ind.format}
                          direction={ind.direction}
                          drill={drillByKey[ind.key]}
                          monthLabels={state.matrix.months.map((m) => m.label)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </section>
  );
}

function DrillPanel(props: {
  format: "percent" | "number";
  direction: DeltaDirection;
  drill: DrillRow[] | "loading" | "error" | undefined;
  monthLabels: string[];
}): ReactElement {
  if (props.drill === "loading" || props.drill === undefined) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--app-muted)]">
        <Loader2 className="animate-spin" size={14} /> Carregando unidades...
      </div>
    );
  }
  if (props.drill === "error") {
    return <p className="text-xs text-[var(--dash-critical)]">Falha ao carregar drill.</p>;
  }
  if (props.drill.length === 0) {
    return <p className="text-xs text-[var(--app-muted)]">Nenhuma unidade no recorte.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="mpv-drill-table w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-[var(--table-header-muted)]">
            <th className="mpv-drill-th py-1 pr-2">Unidade</th>
            {props.monthLabels.map((label) => (
              <th key={label} className="mpv-drill-th px-1 py-1">
                {label}
              </th>
            ))}
            <th className="mpv-drill-th px-1 py-1 text-center">YTD</th>
          </tr>
        </thead>
        <tbody>
          {props.drill.map((row, rowIdx) => (
            <tr key={row.cd}>
              <td className="py-1 pr-2 font-medium text-[var(--foreground)]">{row.unidade}</td>
              {row.months.map((mc, idx) => {
                const tip = tooltipForCell(props.format, mc);
                const tooltipPos = idx === 0 ? "right" : idx === row.months.length - 1 ? "left" : "center";
                const tooltipVertical = rowIdx === 0 ? "down" : "up";
                return (
                  <td
                    key={mc.yearMonth}
                    className={`px-1 py-2 text-center tabular-nums ${drillCellSurfaceClass(mc.deltaVsPrev)} ${tip ? "mpv-tooltip-cell" : ""}`}
                    data-tooltip={tip}
                    data-tooltip-pos={tooltipPos}
                    data-tooltip-vertical={tooltipVertical}
                  >
                    <div className="mpv-value">{formatCell(props.format, mc.value)}</div>
                    {mc.deltaVsPrev !== null && (
                      <div className={`mpv-delta ${deltaTrendClass(mc.deltaVsPrev, props.direction)}`}>
                        {formatDelta(props.format, mc.deltaVsPrev)}
                      </div>
                    )}
                  </td>
                );
              })}
              <td className={`px-1 py-1 text-center tabular-nums text-[var(--foreground)] ${cellSurfaceClass("empty")}`}>
                <span className={`font-semibold ${ytdMetricClass(row.ytd, props.direction)}`}>
                  {formatDrillYtd(props.format, row.ytd, props.direction)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
