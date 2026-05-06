import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { fetchPsMedicacaoDashboard, type PsMedicacaoResponse } from "../../jornada/api";
import type { PeriodDays } from "../../../lib/gerencialFiltersStorage";
import { useDashboardLoadBar } from "../../../lib/useDashboardLoadBar";
import { GerencialLoadPanel } from "../../gerencial/components/GerencialLoadPanel";
import { motion } from "framer-motion";

type MedicacaoPsDashboardProps = {
  period: PeriodDays;
  regional: string;
  unidade: string;
};

type MedicacaoData = PsMedicacaoResponse["data"];

type MedicacaoState =
  | { status: "loading"; loadSession: number }
  | { status: "error"; message: string }
  | { status: "ready"; data: MedicacaoData };

const COLORS = {
  LENTA: '#22c55e', // green-500
  RAPIDA: '#ef4444', // red-500
};

function formatInt(value: number): string {
  return Math.round(value).toLocaleString("pt-BR");
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Recharts omite LabelList em barras com altura 0 — força rótulo (ex.: "0") alinhado à categoria. */
function MedicacaoPieLegend(props: { entries: Array<{ name: string; fill: string }> }): ReactElement {
  const { entries } = props;
  return (
    <div className="medicacao-pie-legend" role="list" aria-label="Legenda">
      {entries.map((e) => (
        <span key={e.name} className="medicacao-pie-legend__item" role="listitem">
          <span className="medicacao-pie-legend__swatch" style={{ backgroundColor: e.fill }} aria-hidden />
          <span>{e.name}</span>
        </span>
      ))}
    </div>
  );
}

function NaoPadraoRankingBarLabel(props: Record<string, unknown>): ReactElement | null {
  const x = Number(props.x);
  const y = Number(props.y);
  const width = Number(props.width);
  const raw = props.value;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(n)) return null;
  const cx = x + width / 2;
  const cy = n > 0 ? y - 8 : y + 14;
  return (
    <text x={cx} y={cy} fill="#ef4444" fontSize={12} fontWeight={800} textAnchor="middle">
      {formatInt(n)}
    </text>
  );
}

export function MedicacaoPsDashboard(props: MedicacaoPsDashboardProps): ReactElement {
  const { period, regional, unidade } = props;
  const loadSessionRef = useRef(0);
  const [state, setState] = useState<MedicacaoState>({ status: "loading", loadSession: 0 });

  const loadData = useCallback(() => {
    const controller = new AbortController();
    const loadSession = ++loadSessionRef.current;
    setState({ status: "loading", loadSession });

    fetchPsMedicacaoDashboard({
      period,
      regional: regional === "ALL" ? undefined : regional,
      unidade: unidade === "ALL" ? undefined : unidade,
      signal: controller.signal
    })
      .then((res) => {
        if (loadSession !== loadSessionRef.current) return;
        setState({ status: "ready", data: res.data });
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

  const medicacaoLoading = state.status === "loading";
  const medicacaoLoadWaveKey = medicacaoLoading ? `ps-medicacao-${state.loadSession}` : "ps-medicacao-idle";
  const { progress: medicacaoLoadProgress, message: medicacaoLoadMessage } = useDashboardLoadBar(
    medicacaoLoading,
    medicacaoLoadWaveKey
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
      fill: `hsl(${210 + idx * 25}, 60%, ${45 + (idx % 3) * 10}%)`
    }));
  }, [state]);

  if (state.status === "loading") {
    return (
      <div className="py-2">
        <GerencialLoadPanel progress={medicacaoLoadProgress} message={medicacaoLoadMessage} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-[var(--dash-critical)]/40 bg-[color-mix(in_srgb,var(--dash-critical)_10%,transparent)] p-4 text-[var(--dash-critical)]">
        {state.message}
      </div>
    );
  }

  if (state.status === "ready" && state.data.totalMedicacoes === 0) {
    return <p className="py-6 text-sm text-[var(--app-muted)]">Sem dados de medicação no período.</p>;
  }

  const data = state.data;
  const rankingNaoPadrao = data.rankingNaoPadrao || [];
  const rankingNaoPadraoSemValores =
    rankingNaoPadrao.length > 0 && rankingNaoPadrao.every((item) => Number(item.qtd) <= 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="min-w-0"
      aria-label="Dashboard de Medicação PS"
    >
      <header className="mb-5 flex flex-wrap items-center justify-end gap-3">
        <div className="rounded-full border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_88%,transparent)] px-4 py-1.5 text-xs font-bold text-[var(--app-muted)]">
          {formatInt(data.totalMedicacoes)} administrações
        </div>
      </header>

      <div className="internacao-var-grid">
        {/* Gráfico 1: Tipo de Infusão (Donut) */}
        <article className="internacao-var-card">
          <h3 className="internacao-var-title mb-2 text-center">Tipo de Infusão</h3>
          <div className="medicacao-donut-stack mt-4">
            <div className="medicacao-donut-stack__chart">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                <PieChart margin={{ top: 26, right: 36, bottom: 8, left: 36 }}>
                  <Pie
                    data={infusaoData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    labelLine={{ stroke: "#64748b", strokeWidth: 1 }}
                    label={(props: {
                      x?: number;
                      y?: number;
                      textAnchor?: string;
                      name?: string;
                      percent?: number;
                      fill?: string;
                    }) => {
                      const x = Number(props.x);
                      const y = Number(props.y);
                      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                      const text = `${String(props.name ?? "")} - ${formatPercent(Number(props.percent ?? 0))}`;
                      return (
                        <text
                          x={x}
                          y={y}
                          fill={String(props.fill ?? "#0f172a")}
                          textAnchor={(props.textAnchor as "start" | "end" | "middle") || "middle"}
                          dominantBaseline="central"
                          style={{ fontSize: 12, fontWeight: 800 }}
                        >
                          {text}
                        </text>
                      );
                    }}
                  >
                    {infusaoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatInt(Number(v ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <MedicacaoPieLegend entries={infusaoData.map((d) => ({ name: d.name, fill: d.fill }))} />
          </div>
        </article>

        {/* Gráfico 2: Vias de Aplicação (Donut) */}
        <article className="internacao-var-card">
          <h3 className="internacao-var-title mb-2 text-center">Vias de Aplicação</h3>
          <div className="medicacao-donut-stack mt-4">
            <div className="medicacao-donut-stack__chart">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                <PieChart margin={{ top: 26, right: 28, bottom: 8, left: 28 }}>
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
                      const mainVias = ["EV", "IM", "VO", "EV BOLUS", "IN", "SC", "OUTROS"];
                      const pct = Number(percent ?? 0);
                      const nm = String(name ?? "");
                      if (mainVias.includes(nm) || pct > 10) {
                        return `${nm} - ${formatPercent(pct)}`;
                      }
                      return "";
                    }}
                  >
                    {viasData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatInt(Number(v ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <MedicacaoPieLegend entries={viasData.map((d) => ({ name: d.name, fill: d.fill }))} />
          </div>
        </article>

        {/* Gráfico 3: Top 10 Lenta (Horizontal Bar) */}
        <article className="internacao-var-card">
          <h3 className="internacao-var-title mb-6">Top 10 - Infusão Lenta</h3>
          <div className="internacao-var-chart-tall">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <BarChart
                layout="vertical"
                data={data.topLenta}
                margin={{ top: 5, right: 45, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#94a3b8" />
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
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <BarChart
                layout="vertical"
                data={data.topRapida}
                margin={{ top: 5, right: 45, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#94a3b8" />
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

        {/* Gráfico 5: Ranking Não Padrão (Vertical Column) */}
        <article className="internacao-var-card">
          <h3 className="internacao-var-title mb-8 text-center">Utilização de Medicações Não Padrão por Unidade</h3>
          <div className="internacao-var-chart-tall mt-4" style={{ height: '350px' }}>
            {(rankingNaoPadrao.length || 0) === 0 || rankingNaoPadraoSemValores ? (
              <div className="flex h-full items-center justify-center text-sm font-medium text-slate-400 italic">
                Nenhum registro de medicacao nao padrao no periodo/filtros
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                <BarChart
                  data={rankingNaoPadrao}
                  margin={{ top: 22, right: 30, left: 8, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" />
                  <XAxis 
                    dataKey="unidade" 
                    fontSize={10} 
                    fontWeight={700}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fill: "#475569" }}
                  />
                  <YAxis
                    width={36}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickFormatter={(v) => formatInt(Number(v))}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="qtd" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40}>
                    <LabelList
                      dataKey="qtd"
                      content={(p) => NaoPadraoRankingBarLabel(p as unknown as Record<string, unknown>)}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        {/* Gráfico 6: Top 10 Não Padrão (Horizontal Bar) */}
        <article className="internacao-var-card">
          <h3 className="internacao-var-title mb-6">Top 10 - Não Padrão</h3>
          <div className="internacao-var-chart-tall">
            {(data.topNaoPadrao?.length || 0) === 0 ? (
              <div className="flex h-full items-center justify-center text-sm font-medium text-slate-400 italic">
                Sem medicações não padrão no período/filtros
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                <BarChart
                  layout="vertical"
                  data={data.topNaoPadrao}
                  margin={{ top: 5, right: 45, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#94a3b8" />
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
                  <Bar dataKey="qtd" fill="#f97316" radius={[0, 4, 4, 0]} barSize={18}>
                    <LabelList dataKey="qtd" position="right" fontSize={11} fontWeight={800} fill="#334155" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </div>
    </motion.section>
  );
}

