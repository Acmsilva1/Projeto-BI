import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { fetchInternacaoMetas } from "../../jornada/api";
import type { PeriodDays } from "../../../lib/gerencialFiltersStorage";
import { useRotatingGerencialLoadPhrases } from "../../../lib/gerencialLoadPhrases";
import { GerencialLoadPanel } from "../../gerencial/components/GerencialLoadPanel";

type InternacaoMetasTableProps = {
  period: PeriodDays;
  regional: string;
  unidade: string;
};

type MetasIndicator = {
  key: string;
  label: string;
  format: "int" | "percent" | "days" | "number";
  values: Array<number | null>;
  total: number | null;
  /** Parcial / total para tooltip (mesmo padrão do Dashboard de Metas — PS). */
  numerators?: Array<number | null>;
  denominators?: Array<number | null>;
  /**
   * Desvio vs meta por coluna (unidade). Quando ausente ou só null, a linha de variação fica neutra (—)
   * até o backend enviar metas — mesma semântica visual do PS (parênteses + pulso se fora da meta).
   */
  deltasVsMeta?: Array<number | null>;
  /** Igual ao PS: menor é melhor ou maior é melhor para pintar verde/vermelho. */
  direction?: "<" | ">";
};

type MetasPayload = {
  units: string[];
  indicators: MetasIndicator[];
};

type MetasState =
  | { status: "loading"; loadSession: number; progress: number }
  | { status: "error"; message: string }
  | { status: "ready"; data: MetasPayload };

/** Placeholder de meta (Power BI / próximo backend); ordenação: mesmas linhas do modelo oficial. */
const TARGET_DISPLAY_BY_KEY: Partial<Record<MetasIndicator["key"], string>> = {
  internacoes: "(-)",
  altas: "(-)",
  reinternacao_7d: "(-)",
  reinternacao_30d: "(-)",
  tmp: "(-)",
  ocupacao: "(-)",
  altas_hosp_2h: "(-)",
  altas_medicas_10h: "(-)",
  mortalidade_hospitalar: "(-)",
  mortalidade_institucional: "(-)",
  reinternacao_uti_48h: "(-)",
  mortalidade_uti: "(-)",
  tmp_uti: "(-)"
};

type DeltaDirection = "<" | ">";

/** Fallback até o payload definir `direction` por indicador. */
const DEFAULT_DIRECTION_BY_KEY: Partial<Record<string, DeltaDirection>> = {
  internacoes: ">",
  altas: ">",
  reinternacao_7d: "<",
  reinternacao_30d: "<",
  tmp: "<",
  ocupacao: "<",
  altas_hosp_2h: ">",
  altas_medicas_10h: ">",
  mortalidade_hospitalar: "<",
  mortalidade_institucional: "<",
  reinternacao_uti_48h: "<",
  mortalidade_uti: "<",
  tmp_uti: "<"
};

function directionForIndicator(indicator: MetasIndicator): DeltaDirection {
  if (indicator.direction === ">" || indicator.direction === "<") return indicator.direction;
  return DEFAULT_DIRECTION_BY_KEY[indicator.key] ?? "<";
}

/** Igual ao Dashboard de Metas — PS: vermelho quando o desvio é “ruim” para o indicador. */
function deltaTrendClass(delta: number | null, direction: DeltaDirection): string {
  if (delta === null || !Number.isFinite(delta)) return "text-[var(--app-muted)]";
  if (Math.abs(delta) < 1e-12) return "text-[var(--app-muted)]";
  if (direction === ">") {
    if (delta > 0) return "text-[var(--dash-live)]";
    if (delta < 0) return "text-[var(--dash-critical)] font-extrabold drop-shadow-[0_0_8px_rgba(224,45,95,0.42)]";
  } else {
    if (delta < 0) return "text-[var(--dash-live)]";
    if (delta > 0) return "text-[var(--dash-critical)] font-extrabold drop-shadow-[0_0_8px_rgba(224,45,95,0.42)]";
  }
  return "text-[var(--app-muted)]";
}

function deltaIsCritical(delta: number | null, direction: DeltaDirection): boolean {
  if (delta === null || !Number.isFinite(delta)) return false;
  if (Math.abs(delta) < 1e-12) return false;
  if (direction === ">") return delta < 0;
  return delta > 0;
}

function formatDeltaVsMeta(value: number | null, format: MetasIndicator["format"]): string {
  if (value === null || !Number.isFinite(value)) return "";
  if (format === "percent") {
    const sign = value > 0 ? "+" : "";
    return `(${sign}${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)`;
  }
  if (format === "days" || format === "number") {
    const sign = value > 0 ? "+" : "";
    return `(${sign}${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  const sign = value > 0 ? "+" : "";
  return `(${sign}${Math.round(value).toLocaleString("pt-BR")})`;
}

function cellHasComparableDelta(indicator: MetasIndicator, index: number): boolean {
  const d = indicator.deltasVsMeta?.[index];
  return d !== undefined && d !== null && Number.isFinite(d);
}

function displayUnidade(unidade: string): string {
  const withAccent = unidade
    .replaceAll("AGUAS", "ÁGUAS")
    .replaceAll("FUNCIONARIOS", "FUNCIONÁRIOS")
    .replaceAll("VITORIA", "VITÓRIA");
  const cleaned = withAccent
    .replace(/\bPS\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*-\s*/g, " - ")
    .trim();
  return cleaned || unidade;
}

const ONE_DECIMAL_PT_BR: Intl.NumberFormatOptions = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
};

function tooltipPercentPartialTotal(indicator: MetasIndicator, cellIndex: number): string | undefined {
  if (indicator.format !== "percent") return undefined;
  const n = indicator.numerators?.[cellIndex];
  const d = indicator.denominators?.[cellIndex];
  if (n === undefined || d === undefined || n === null || d === null || d <= 0) return undefined;
  const num = Math.round(n);
  const den = Math.round(d);
  return `Valor: ${num.toLocaleString("pt-BR")} de ${den.toLocaleString("pt-BR")}`;
}

function formatMetric(value: number | null, format: MetasIndicator["format"]): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (format === "days") {
    // Alinhado ao BI oficial: TMP (dias) com 2 decimais (ex.: 3,72)
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (format === "int") {
    return Math.round(value).toLocaleString("pt-BR");
  }
  if (format === "percent") {
    return `${value.toLocaleString("pt-BR", ONE_DECIMAL_PT_BR)}%`;
  }
  return value.toLocaleString("pt-BR", ONE_DECIMAL_PT_BR);
}

export function InternacaoMetasTable(props: InternacaoMetasTableProps): ReactElement {
  const { period, regional, unidade } = props;
  const loadSessionRef = useRef(0);
  const [state, setState] = useState<MetasState>({
    status: "loading",
    loadSession: 0,
    progress: 10
  });

  useEffect(() => {
    const controller = new AbortController();
    const loadSession = ++loadSessionRef.current;
    const startedAt = Date.now();
    setState({
      status: "loading",
      loadSession,
      progress: 12
    });

    fetchInternacaoMetas({
      period,
      regional: regional === "ALL" ? undefined : regional,
      unidade: unidade === "ALL" ? undefined : unidade,
      signal: controller.signal
    })
      .then((payload) => {
        if (loadSession !== loadSessionRef.current) return;
        const row = payload.rows[0] as Record<string, unknown> | undefined;
        const units = Array.isArray(row?.units) ? (row.units as string[]) : [];
        const indicators = Array.isArray(row?.indicators) ? (row.indicators as MetasIndicator[]) : [];
        const elapsedMs = Date.now() - startedAt;
        const minVisibleMs = 1100;
        const waitMs = Math.max(0, minVisibleMs - elapsedMs);
        window.setTimeout(() => {
          if (loadSession !== loadSessionRef.current) return;
          setState({
            status: "ready",
            data: {
              units,
              indicators
            }
          });
        }, waitMs);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (loadSession !== loadSessionRef.current) return;
        const message = error instanceof Error ? error.message : "Falha ao carregar metas de Internação.";
        setState({ status: "error", message });
      });

    return () => controller.abort();
  }, [period, regional, unidade]);

  const loadProgressKey = state.status === "loading" ? state.loadSession : -1;
  const rotatingLoadMessage = useRotatingGerencialLoadPhrases(
    state.status === "loading",
    state.status === "loading" ? `internacao-metas-${state.loadSession}` : "internacao-metas-idle"
  );

  useEffect(() => {
    if (state.status !== "loading") return;
    const session = state.loadSession;
    const id1 = window.setTimeout(() => {
      setState((s) => (s.status === "loading" && s.loadSession === session ? { ...s, progress: 44 } : s));
    }, 320);
    const id2 = window.setTimeout(() => {
      setState((s) => (s.status === "loading" && s.loadSession === session ? { ...s, progress: 72 } : s));
    }, 760);
    const id3 = window.setTimeout(() => {
      setState((s) => (s.status === "loading" && s.loadSession === session ? { ...s, progress: 90 } : s));
    }, 1200);
    return () => {
      window.clearTimeout(id1);
      window.clearTimeout(id2);
      window.clearTimeout(id3);
    };
  }, [loadProgressKey]);

  const orderedIndicators = useMemo(() => {
    if (state.status !== "ready") return [];
    const withTarget: MetasIndicator[] = [];
    const withoutTarget: MetasIndicator[] = [];
    for (const indicator of state.data.indicators) {
      if (TARGET_DISPLAY_BY_KEY[indicator.key]) withTarget.push(indicator);
      else withoutTarget.push(indicator);
    }
    return [...withTarget, ...withoutTarget];
  }, [state]);

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-[var(--dash-critical)]/40 bg-[color-mix(in_srgb,var(--dash-critical)_10%,transparent)] p-3 text-sm text-[var(--dash-critical)]">
        {state.message}
      </div>
    );
  }

  if (state.status === "loading") {
    return <GerencialLoadPanel progress={state.progress} message={rotatingLoadMessage} />;
  }

  if (state.data.units.length === 0 || state.data.indicators.length === 0) {
    return <p className="text-sm text-[var(--app-muted)]">Sem dados de internação no recorte selecionado.</p>;
  }

  return (
    <section className="dashboard-panel mpv-section" aria-label="Dashboard de Metas - Internação">
      <div className="mpv-table-wrap mt-2 overflow-x-auto rounded-xl border border-[var(--table-grid)] bg-[var(--app-elevated)]">
        <table className="mpv-table min-w-[1100px] w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]">
              <th className="mpv-th sticky left-0 z-20 bg-[var(--app-elevated)] px-3 py-3 text-left font-bold text-[var(--table-header-fg)]">
                Indicador
              </th>
              {state.data.units.map((unit) => (
                <th key={unit} className="mpv-th px-2 py-3 text-center font-bold text-[var(--table-header-fg)]">
                  {displayUnidade(unit)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedIndicators.map((indicator) => (
              <tr key={indicator.key}>
                <td className="mpv-td sticky left-0 z-10 bg-[var(--background)] px-3 py-2 font-semibold text-[var(--foreground)]">
                  <span>
                    {indicator.label}{" "}
                    {TARGET_DISPLAY_BY_KEY[indicator.key] && (
                      <span className="mpv-meta-target" title="Meta de referência">
                        {TARGET_DISPLAY_BY_KEY[indicator.key]}
                      </span>
                    )}
                  </span>
                </td>
                {indicator.values.map((value, index) => {
                  const tip = tooltipPercentPartialTotal(indicator, index);
                  const dir = directionForIndicator(indicator);
                  const deltaVsMeta = indicator.deltasVsMeta?.[index];
                  const hasDelta = cellHasComparableDelta(indicator, index);
                  const critical = hasDelta && deltaIsCritical(deltaVsMeta ?? null, dir);
                  const deltaClass = hasDelta ? deltaTrendClass(deltaVsMeta ?? null, dir) : "text-[var(--app-muted)]";
                  const deltaText = hasDelta ? formatDeltaVsMeta(deltaVsMeta ?? null, indicator.format) : "(—)";
                  return (
                    <td
                      key={`${indicator.key}-${state.data.units[index] ?? index}`}
                      className={`mpv-cell mpv-cell--uniform px-1 py-2 text-center tabular-nums${tip ? " mpv-tooltip-cell" : ""}${
                        critical ? " mpv-cell--soft-ring-pulse" : ""
                      }`}
                      data-tooltip={tip}
                    >
                      <div className="mpv-value">{formatMetric(value, indicator.format)}</div>
                      <div className={`mpv-delta ${deltaClass}`}>{deltaText}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

