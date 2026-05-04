import { Bell, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
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
import { fetchPsMedicacaoDashboard, type PsMedicacaoResponse } from "../../jornada/api";
import type { PeriodDays } from "../../../lib/gerencialFiltersStorage";
import { useRotatingGerencialLoadPhrases } from "../../../lib/gerencialLoadPhrases";
import { GerencialLoadPanel } from "../../gerencial/components/GerencialLoadPanel";
import { motion } from "framer-motion";

type MedicacaoPsDashboardProps = {
  period: PeriodDays;
  regional: string;
  unidade: string;
};

type MedicacaoData = PsMedicacaoResponse["data"];

type MedicacaoState =
  | { status: "loading"; loadSession: number; progress: number }
  | { status: "error"; message: string }
  | { status: "ready"; data: MedicacaoData; isStale?: boolean; pendingData?: MedicacaoData };

const COLORS = {
  RAPIDA: "#3fa34d", // Verde
  LENTA: "#dd9031",  // Laranja
  NEUTRO: "#94a3b8"
};

const CHART_HEIGHT = 320;

function formatInt(value: number): string {
  return Math.round(value).toLocaleString("pt-BR");
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function MedicacaoPsDashboard(props: MedicacaoPsDashboardProps): ReactElement {
  const { period, regional, unidade } = props;
  const loadSessionRef = useRef(0);
  const [state, setState] = useState<MedicacaoState>(() => {
    const cacheKey = `ps-medicacao-cache-${period}-${regional}-${unidade}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return { status: "ready", data: JSON.parse(cached), isStale: true };
      } catch { /* skip */ }
    }
    return { status: "loading", loadSession: 0, progress: 10 };
  });

  const loadData = useCallback(() => {
    const controller = new AbortController();
    const loadSession = ++loadSessionRef.current;
    
    if (state.status !== "ready") {
      setState({ status: "loading", loadSession, progress: 12 });
    }

    fetchPsMedicacaoDashboard({
      period,
      regional: regional === "ALL" ? undefined : regional,
      unidade: unidade === "ALL" ? undefined : unidade,
      signal: controller.signal
    })
      .then((res) => {
        if (loadSession !== loadSessionRef.current) return;
        
        const cacheKey = `ps-medicacao-cache-${period}-${regional}-${unidade}`;
        localStorage.setItem(cacheKey, JSON.stringify(res.data));

        setState((prev) => {
          if (prev.status === "ready" && prev.isStale) {
            return { ...prev, pendingData: res.data };
          }
          return { status: "ready", data: res.data, isStale: false };
        });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (loadSession !== loadSessionRef.current) return;
        const message = error instanceof Error ? error.message : "Falha ao carregar medicação.";
        setState({ status: "error", message });
      });

    return () => controller.abort();
  }, [period, regional, unidade]);

  useEffect(() => {
    return loadData();
  }, [loadData]);

  const rotatingLoadMessage = useRotatingGerencialLoadPhrases(
    state.status === "loading",
    state.status === "loading" ? `ps-medicacao-${state.loadSession}` : "ps-medicacao-idle"
  );

  const infusaoData = useMemo(() => {
    if (state.status !== "ready") return [];
    const { lenta, rapida } = state.data.infusao;
    const total = lenta + rapida;
    return [
      { name: "Rápida", value: rapida, percent: total > 0 ? (rapida / total) * 100 : 0, fill: COLORS.RAPIDA },
      { name: "Lenta", value: lenta, percent: total > 0 ? (lenta / total) * 100 : 0, fill: COLORS.LENTA }
    ].filter(v => v.value > 0);
  }, [state]);

  const viasData = useMemo(() => {
    if (state.status !== "ready") return [];
    const total = state.data.totalMedicacoes;
    return state.data.vias.map((v, idx) => ({
      name: v.via,
      value: v.qtd,
      percent: total > 0 ? (v.qtd / total) * 100 : 0,
      // Usar cores rotativas ou fixas para vias? Vou usar tons de azul/cinza para não competir com Lenta/Rápida
      fill: `hsl(${210 + idx * 25}, 60%, ${45 + (idx % 3) * 10}%)`
    }));
  }, [state]);

  if (state.status === "loading") {
    return (
      <div className="mb-8">
        <GerencialLoadPanel progress={state.progress} message={rotatingLoadMessage} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mb-8 rounded-xl border border-[var(--dash-critical)]/40 bg-[color-mix(in_srgb,var(--dash-critical)_10%,transparent)] p-4 text-[var(--dash-critical)]">
        {state.message}
      </div>
    );
  }

  if (state.status === "ready" && state.data.totalMedicacoes === 0) {
    return <p className="mb-8 text-sm text-[var(--app-muted)]">Sem dados de medicação no período.</p>;
  }

  const data = state.data;

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10"
      aria-label="Dashboard de Medicação PS"
    >
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <h2 className="text-2xl font-black tracking-tight text-white">
          Medicação - Pronto Socorro
        </h2>
        
        {state.status === "ready" && state.pendingData && (
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-[var(--dash-live)] bg-[color-mix(in_srgb,var(--dash-live)_15%,transparent)] px-4 py-1.5 text-[11px] font-bold uppercase tracking-tight text-[var(--dash-live)] shadow-[0_0_15px_rgba(45,224,185,0.3)] transition-all hover:bg-[var(--dash-live)] hover:text-white active:scale-95 animate-bounce-subtle z-30 ml-4"
            onClick={() => {
              setState(prev => prev.status === "ready" && prev.pendingData ? { ...prev, data: prev.pendingData, pendingData: undefined, isStale: false } : prev);
            }}
          >
            <Bell size={13} className="animate-bell-shake" />
            Novos dados disponíveis
          </button>
        )}

        <div className="h-px flex-1 bg-white/10" />
        
        {state.status === "ready" && state.isStale && !state.pendingData && (
          <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/40 animate-pulse">
            <Loader2 size={10} className="animate-spin" />
            <span>Sincronizando...</span>
          </div>
        )}

        <div className="rounded-full bg-white/5 px-4 py-1 text-xs font-bold text-white/60 backdrop-blur-md">
          {formatInt(data.totalMedicacoes)} ADMINISTRAÇÕES
        </div>
      </header>

      <div className="internacao-var-grid">
        {/* Gráfico 1: Tipo de Infusão (Donut) */}
        <article className="internacao-var-card">
          <h3 className="internacao-var-title mb-2 text-center">Tipo de Infusão</h3>
          <div className="internacao-var-chart-tall mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 30, bottom: 20 }}>
                <Pie
                  data={infusaoData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  labelLine={false}
                  label={({ percent, name }) => `${name} - ${formatPercent(percent)}`}
                >
                  {infusaoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatInt(v)} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Gráfico 2: Vias de Aplicação (Donut) */}
        <article className="internacao-var-card">
          <h3 className="internacao-var-title mb-2 text-center">Vias de Aplicação</h3>
          <div className="internacao-var-chart-tall mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 30, bottom: 20 }}>
                <Pie
                  data={viasData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  labelLine
                  label={({ name, percent }) => {
                    // Mostrar labels com percentual para as vias principais ou fatias significativas
                    const mainVias = ["EV", "IM", "VO", "EV BOLUS", "IN", "SC", "OUTROS"];
                    if (mainVias.includes(name) || percent > 10) {
                      return `${name} - ${formatPercent(percent)}`;
                    }
                    return "";
                  }}
                >
                  {viasData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatInt(v)} />
                <Legend 
                  verticalAlign="bottom" 
                  height={80} 
                  iconType="circle" 
                  wrapperStyle={{ fontSize: 9, paddingTop: 15 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Gráfico 3: Top 10 Lenta (Horizontal Bar) */}
        <article className="internacao-var-card">
          <h3 className="internacao-var-title mb-6">Top 10 - Infusão Lenta</h3>
          <div className="internacao-var-chart-tall">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data.topLenta}
                margin={{ top: 5, right: 45, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="nome" 
                  type="category" 
                  width={140} 
                  fontSize={10} 
                  fontWeight={600}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.length > 20 ? v.substring(0, 18) + "..." : v}
                />
                <Tooltip />
                <Bar dataKey="qtd" fill={COLORS.LENTA} radius={[0, 4, 4, 0]} barSize={18}>
                  <LabelList dataKey="qtd" position="right" fontSize={11} fontWeight={800} fill="#334155" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Gráfico 4: Top 10 Rápida (Horizontal Bar) */}
        <article className="internacao-var-card">
          <h3 className="internacao-var-title mb-6">Top 10 - Infusão Rápida</h3>
          <div className="internacao-var-chart-tall">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data.topRapida}
                margin={{ top: 5, right: 45, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="nome" 
                  type="category" 
                  width={140} 
                  fontSize={10} 
                  fontWeight={600}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.length > 20 ? v.substring(0, 18) + "..." : v}
                />
                <Tooltip />
                <Bar dataKey="qtd" fill={COLORS.RAPIDA} radius={[0, 4, 4, 0]} barSize={18}>
                  <LabelList dataKey="qtd" position="right" fontSize={11} fontWeight={800} fill="#334155" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
    </motion.section>
  );
}
