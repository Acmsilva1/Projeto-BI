import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { fetchInternacaoVariados } from "../../jornada/api";
import type { PeriodDays } from "../../../lib/gerencialFiltersStorage";
import { useDashboardLoadBar } from "../../../lib/useDashboardLoadBar";
import { GerencialLoadPanel } from "../../gerencial/components/GerencialLoadPanel";

type InternacaoGraficosVariadosProps = {
  period: PeriodDays;
  regional: string;
  unidade: string;
};

type SexoSlice = { label: string; value: number; percent: number };
type FaixaSexo = { faixa: string; feminino: number; masculino: number; total: number };
type ProcSlice = { label: string; value: number; percent: number };
type ProcSliceChart = ProcSlice & { fill: string };
type ReintBar = {
  label: "30 dias" | "7 dias";
  count: number;
  percent: number;
  baseAltas: number;
};
type ReintBarChart = ReintBar & { labelFmt: string };
type SexoSliceChart = SexoSlice & { chartPercent: number };
type FaixaSexoChart = { faixa: string; feminino: number; masculino: number; total: number };

type VariadosPayload = {
  sexo: SexoSlice[];
  faixaEtariaSexo: FaixaSexo[];
  procedencia: ProcSlice[];
  reinternacoes: ReintBar[];
};

type VariadosState =
  | { status: "loading"; loadSession: number }
  | { status: "error"; message: string }
  | { status: "ready"; data: VariadosPayload };

const SEXO_COLORS: Record<string, string> = {
  FEMININO: "#8e67ad",
  MASCULINO: "#88c40f",
  "N/I": "#94a3b8"
};

/** Mesma ordem / cores do relatório legado (legenda). */
const PROCEDENCIA_BASE = [
  "Residência",
  "Consultório",
  "Outro Hospital",
  "Hospital Próprio",
  "Pronto Socorro",
  "APH (Atend. Pré Hospitalar)"
] as const;

const PROCEDENCIA_FILL: Record<string, string> = {
  Residência: "#3fa34d",
  Consultório: "#88c40f",
  "Outro Hospital": "#dd9031",
  "Hospital Próprio": "#2f855a",
  "Pronto Socorro": "#b3c850",
  "APH (Atend. Pré Hospitalar)": "#e4d951",
  Outros: "#94a3b8"
};
const FAIXAS_ETARIAS_BASE = ["20-39", "40-59", "60-79", "80-99", "100-119"] as const;

function formatInt(value: number): string {
  return Math.round(value).toLocaleString("pt-BR");
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
}

function parseRow(payloadRow: Record<string, unknown> | undefined): VariadosPayload {
  const safeArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return {
    sexo: safeArray<SexoSlice>(payloadRow?.sexo),
    faixaEtariaSexo: safeArray<FaixaSexo>(payloadRow?.faixaEtariaSexo),
    procedencia: safeArray<ProcSlice>(payloadRow?.procedencia),
    reinternacoes: safeArray<ReintBar | { label: string; value: number }>(payloadRow?.reinternacoes) as ReintBar[]
  };
}

/** API nova: count + percent + baseAltas; legado: só `value` como percentual. */
function normalizeReinternacoesRows(raw: unknown): ReintBar[] {
  const rows = Array.isArray(raw) ? raw : [];
  const pick = (lbl: "30 dias" | "7 dias"): ReintBar => {
    const row = rows.find((r) => r && typeof r === "object" && String((r as Record<string, unknown>).label) === lbl) as
      | Record<string, unknown>
      | undefined;
    if (row && typeof row.count === "number" && typeof row.percent === "number") {
      return {
        label: lbl,
        count: Math.round(Number(row.count)),
        percent: Number(row.percent),
        baseAltas: Math.round(Number(row.baseAltas ?? 0))
      };
    }
    const legacyPct = Number(row?.value ?? row?.percent ?? 0);
    return { label: lbl, count: 0, percent: legacyPct, baseAltas: 0 };
  };
  return [pick("30 dias"), pick("7 dias")];
}

export function InternacaoGraficosVariados(props: InternacaoGraficosVariadosProps): ReactElement {
  const { period, regional, unidade } = props;
  const loadSessionRef = useRef(0);
  const [state, setState] = useState<VariadosState>({
    status: "loading",
    loadSession: 0
  });

  useEffect(() => {
    const controller = new AbortController();
    const loadSession = ++loadSessionRef.current;
    const startedAt = Date.now();
    setState({ status: "loading", loadSession });

    fetchInternacaoVariados({
      period,
      regional: regional === "ALL" ? undefined : regional,
      unidade: unidade === "ALL" ? undefined : unidade,
      limit: 50000,
      signal: controller.signal
    })
      .then((payload) => {
        if (loadSession !== loadSessionRef.current) return;
        const row = payload.rows[0] as Record<string, unknown> | undefined;
        const parsed = parseRow(row);
        const elapsedMs = Date.now() - startedAt;
        const waitMs = Math.max(0, 1100 - elapsedMs);
        window.setTimeout(() => {
          if (loadSession !== loadSessionRef.current) return;
          setState({ status: "ready", data: parsed });
        }, waitMs);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Falha ao carregar gráficos variados.";
        setState({ status: "error", message });
      });

    return () => controller.abort();
  }, [period, regional, unidade]);

  const variadosLoading = state.status === "loading";
  const variadosLoadWaveKey = variadosLoading
    ? `internacao-variados-${state.loadSession}`
    : "internacao-variados-idle";
  const { progress: variadosLoadProgress, message: variadosLoadMessage } = useDashboardLoadBar(
    variadosLoading,
    variadosLoadWaveKey
  );

  const procedenciaCharts = useMemo(() => {
    if (state.status !== "ready") return { pie: [] as ProcSliceChart[], legend: [] as ProcSliceChart[] };
    const map = new Map(state.data.procedencia.map((item) => [item.label, item]));
    const baseRows: ProcSliceChart[] = PROCEDENCIA_BASE.map((label) => {
      const row = map.get(label);
      return {
        label,
        value: Number(row?.value ?? 0),
        percent: Number(row?.percent ?? 0),
        fill: PROCEDENCIA_FILL[label] ?? "#94a3b8"
      };
    });
    const outros = map.get("Outros");
    const outrosRow: ProcSliceChart | null =
      outros && Number(outros.value ?? 0) > 0
        ? {
            label: "Outros",
            value: Number(outros.value),
            percent: Number(outros.percent ?? 0),
            fill: PROCEDENCIA_FILL.Outros ?? "#94a3b8"
          }
        : null;
    const legend = outrosRow ? [...baseRows, outrosRow] : baseRows;
    const pie = legend.filter((row) => row.value > 0);
    return { pie, legend };
  }, [state]);

  const sexoChartData = useMemo<SexoSliceChart[]>(() => {
    if (state.status !== "ready") return [];
    const onlyBinary = state.data.sexo.filter((item) => item.label === "FEMININO" || item.label === "MASCULINO");
    const total = onlyBinary.reduce((acc, item) => acc + Number(item.value ?? 0), 0);
    return onlyBinary.map((item) => ({
      ...item,
      chartPercent: total > 0 ? Number(((Number(item.value ?? 0) * 100) / total).toFixed(2)) : 0
    }));
  }, [state]);

  const faixaEtariaChartData = useMemo<FaixaSexoChart[]>(() => {
    if (state.status !== "ready") return [];
    const byFaixa = new Map<string, FaixaSexo>();
    for (const item of state.data.faixaEtariaSexo) {
      byFaixa.set(item.faixa, item);
    }
    return FAIXAS_ETARIAS_BASE.map((faixa) => {
      const found = byFaixa.get(faixa);
      if (!found) return { faixa, feminino: 0, masculino: 0, total: 0 };
      return {
        faixa,
        feminino: Number(found.feminino ?? 0),
        masculino: Number(found.masculino ?? 0),
        total: Number(found.total ?? Number(found.feminino ?? 0) + Number(found.masculino ?? 0))
      };
    });
  }, [state]);

  const reinternacoesChartData = useMemo<ReintBarChart[]>(() => {
    if (state.status !== "ready") return [];
    const base = normalizeReinternacoesRows(state.data.reinternacoes);
    return base.map((r) => ({
      ...r,
      labelFmt: `${formatInt(r.count)} (${formatPercent(r.percent)})`
    }));
  }, [state]);

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-[var(--dash-critical)]/40 bg-[color-mix(in_srgb,var(--dash-critical)_10%,transparent)] p-3 text-sm text-[var(--dash-critical)]">
        {state.message}
      </div>
    );
  }

  if (state.status === "loading") {
    return <GerencialLoadPanel progress={variadosLoadProgress} message={variadosLoadMessage} />;
  }

  if (sexoChartData.length === 0 && faixaEtariaChartData.length === 0 && procedenciaCharts.legend.length === 0) {
    return <p className="text-sm text-[var(--app-muted)]">Sem dados de internação no recorte selecionado.</p>;
  }

  return (
    <section className="internacao-var-grid" aria-label="Gráficos variados de internação">
      <article className="internacao-var-card">
        <h3 className="internacao-var-title">Internações por sexo</h3>
        <div className="internacao-var-chart-tall">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
            <PieChart margin={{ top: 18, right: 28, left: 28, bottom: 20 }}>
              <Pie
                data={sexoChartData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="49%"
                outerRadius={108}
                minAngle={6}
                labelLine
                label={({ payload }) => `${formatInt(Number(payload?.value ?? 0))} (${formatPercent(Number(payload?.chartPercent ?? 0))})`}
              >
                {sexoChartData.map((slice) => (
                  <Cell key={slice.label} fill={SEXO_COLORS[slice.label] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, color: "#334155" }} />
              <Tooltip formatter={(value) => formatInt(Number(value ?? 0))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="internacao-var-card">
        <h3 className="internacao-var-title">Internações por faixa etária</h3>
        <div className="internacao-var-chart-tall">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
            <BarChart data={faixaEtariaChartData} margin={{ top: 40, right: 12, left: 4, bottom: 8 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="faixa" tick={{ fill: "#334155", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(value) => formatInt(Number(value ?? 0))} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, color: "#334155" }} />
              <Bar dataKey="feminino" name="FEMININO" stackId="a" fill="#8e67ad">
                <LabelList
                  dataKey="feminino"
                  position="inside"
                  formatter={(value) => (Number(value ?? 0) > 0 ? formatInt(Number(value ?? 0)) : "")}
                  fill="#ffffff"
                />
              </Bar>
              <Bar dataKey="masculino" name="MASCULINO" stackId="a" fill="#88c40f">
                <LabelList
                  dataKey="masculino"
                  position="inside"
                  formatter={(value) => (Number(value ?? 0) > 0 ? formatInt(Number(value ?? 0)) : "")}
                  fill="#ffffff"
                />
                <LabelList
                  dataKey="total"
                  position="top"
                  formatter={(value) => (Number(value ?? 0) > 0 ? formatInt(Number(value ?? 0)) : "")}
                  fill="#334155"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="internacao-var-card">
        <h3 className="internacao-var-title">Internações por procedência</h3>
        <div className="internacao-var-proc-body">
          <div className="internacao-var-proc-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <PieChart margin={{ top: 16, right: 20, left: 20, bottom: 16 }}>
                <Pie
                  data={procedenciaCharts.pie}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={118}
                  paddingAngle={2}
                  minAngle={6}
                  labelLine={{ stroke: "#64748b", strokeWidth: 1 }}
                  label={(props: { payload?: ProcSliceChart }) => {
                    const p = props.payload;
                    if (!p) return null;
                    const val = Number(p.value);
                    const pct = Number(p.percent);
                    if (!Number.isFinite(val) || val <= 0) return null;
                    if (!Number.isFinite(pct) || pct < 0.15) return null;
                    return `${formatInt(val)} (${formatPercent(pct)})`;
                  }}
                >
                  {procedenciaCharts.pie.map((slice) => (
                    <Cell key={slice.label} fill={slice.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${formatInt(Number(value ?? 0))}`, String(name ?? "")]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="internacao-var-proc-legend-title">Legenda</p>
          <ul className="internacao-var-proc-legend" aria-label="Legenda de procedência">
            {procedenciaCharts.legend.map((row) => (
              <li key={row.label} className="internacao-var-proc-legend-item">
                <span className="internacao-var-proc-dot" style={{ backgroundColor: row.fill }} aria-hidden />
                <span className="internacao-var-proc-label" title={row.label}>
                  {row.label === "APH (Atend. Pré Hospitalar)" ? "APH (Atend. Pré H…)" : row.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </article>

      <article className="internacao-var-card">
        <h3 className="internacao-var-title">Reinternações</h3>
        <div className="internacao-var-chart-tall">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
            <BarChart data={reinternacoesChartData} margin={{ top: 28, right: 24, left: 24, bottom: 16 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#334155", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(value) => formatPercent(Number(value ?? 0))} />
              <Bar dataKey="percent" radius={[4, 4, 0, 0]}>
                {reinternacoesChartData.map((item) => (
                  <Cell key={item.label} fill={item.label === "30 dias" ? "#3fa34d" : "#88c40f"} />
                ))}
                <LabelList dataKey="labelFmt" position="top" fill="#334155" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}

