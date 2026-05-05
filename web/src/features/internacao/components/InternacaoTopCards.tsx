import { motion } from "framer-motion";
import { BedDouble, CalendarClock, Clock3, HeartPulse, Skull } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { fetchInternacaoFiltros, fetchInternacaoTopo } from "../../jornada/api";
import type { PeriodDays } from "../../../lib/gerencialFiltersStorage";
import { useDashboardLoadBar } from "../../../lib/useDashboardLoadBar";
import { GerencialLoadPanel } from "../../gerencial/components/GerencialLoadPanel";

type InternacaoTopCardsProps = {
  period: PeriodDays;
  regional: string;
  unidade: string;
  onPeriodChange: (value: PeriodDays) => void;
  onRegionalChange: (value: string) => void;
  onUnidadeChange: (value: string) => void;
};

type FilterRow = {
  regional: string;
  unidade: string;
};

type InternacaoKpiCardConfig = {
  id: string;
  title: string;
  value: string;
  chipLabel: string;
  tone: "primary" | "live" | "urgent" | "critical";
  cardClass: string;
  emoji?: string;
  icon?: ReactNode;
  titleAttr?: string;
};

/** 3 totais + 10 células na faixa de taxas (9 KPIs + 1 slot; 2 linhas × 5 colunas). */
const INTERNACAO_KPI_GRID_SLOT_COUNT = 13;
const INTERNACAO_KPI_TOP_TOTAL_CARDS = 3;

const INTERNACAO_UNIDADES_HABILITADAS = new Set<string>([
  "DF - AGUAS CLARAS",
  "DF - PS SIG",
  "DF - PS TAGUATINGA",
  "ES - BRESSAN",
  "ES - HOSPITAL VITORIA",
  "ES - PS VILA VELHA",
  "MG - FUNCIONARIOS",
  "MG - PAMPULHA",
  "MG BH GUTIERREZ - PS",
  "RJ - PS BARRA DA TIJUCA",
  "RJ - PS BOTAFOGO",
  "RJ - PS CAMPO GRANDE"
]);

function normalizeUnitKey(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replaceAll(/\s+/g, " ")
    .trim();
}

function normalizeRows(rows: Record<string, unknown>[]): FilterRow[] {
  const allowed = new Set([...INTERNACAO_UNIDADES_HABILITADAS].map((value) => normalizeUnitKey(value)));
  return rows
    .map((row) => ({
      regional: String(row.regional ?? "").trim(),
      unidade: String(row.unidade ?? "").trim()
    }))
    .filter((row) => row.regional.length > 0 && row.unidade.length > 0 && allowed.has(normalizeUnitKey(row.unidade)));
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtInt(value: unknown): string {
  return Math.round(toNumber(value)).toLocaleString("pt-BR");
}

function fmtPercent(value: unknown): string {
  return `${toNumber(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function fmtPercentOrDash(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = toNumber(value);
  if (!Number.isFinite(n)) return "—";
  return fmtPercent(n);
}

/** Taxa de mortalidade: valores muito pequenos precisam de mais casas (ex.: 0,02%). */
function fmtPercentMortalityOrDash(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = toNumber(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** Mesmo padrão visual do BI oficial: TMP em dias com 2 casas (ex.: 3,72). Valor vem em minutos da API. */
function fmtTmpDias(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const minutes = toNumber(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const days = minutes / 1440;
  return days.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function periodLabel(period: PeriodDays): string {
  if (period === 1) return "ontem";
  return `${period}d`;
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

function selectedScopeLabel(regional: string, unidade: string): string {
  if (unidade !== "ALL") return `Unidade: ${displayUnidade(unidade)}`;
  if (regional !== "ALL") return `Regional: ${regional}`;
  return "Todas";
}

export function InternacaoTopCards(props: InternacaoTopCardsProps): ReactElement {
  const { period, regional, unidade, onPeriodChange, onRegionalChange, onUnidadeChange } = props;
  const [loading, setLoading] = useState(true);
  const [loadSession, setLoadSession] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FilterRow[]>([]);
  const [kpi, setKpi] = useState<Record<string, unknown> | null>(null);
  const currentSessionRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const session = Date.now();
    const startedAt = Date.now();
    currentSessionRef.current = session;
    setLoadSession(session);
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchInternacaoFiltros({
        period,
        limit: 2000,
        signal: controller.signal
      }),
      fetchInternacaoTopo({
        period,
        regional: regional === "ALL" ? undefined : regional,
        unidade: unidade === "ALL" ? undefined : unidade,
        signal: controller.signal
      })
    ])
      .then(([filtersPayload, kpiPayload]) => {
        setRows(normalizeRows(filtersPayload.rows));
        const first = Array.isArray(kpiPayload.rows) ? kpiPayload.rows[0] : null;
        setKpi(first && typeof first === "object" ? (first as Record<string, unknown>) : null);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Falha ao carregar dados de Internação.");
      })
      .finally(() => {
        const elapsedMs = Date.now() - startedAt;
        const minVisibleMs = 1200;
        const waitMs = Math.max(0, minVisibleMs - elapsedMs);
        window.setTimeout(() => {
          if (currentSessionRef.current !== session) return;
          setLoading(false);
        }, waitMs);
      });
    return () => controller.abort();
  }, [period, regional, unidade]);

  const loadWaveKey = `${loadSession}|${period}|${regional}|${unidade}`;
  const { progress, message: rotatingLoadMessage } = useDashboardLoadBar(loading, loadWaveKey);

  const regionais = useMemo(() => [...new Set(rows.map((x) => x.regional))].sort((a, b) => a.localeCompare(b)), [rows]);
  const unidades = useMemo(() => {
    const list = regional === "ALL" ? rows.map((x) => x.unidade) : rows.filter((x) => x.regional === regional).map((x) => x.unidade);
    return [...new Set(list)].sort((a, b) => a.localeCompare(b));
  }, [rows, regional]);

  useEffect(() => {
    if (regional !== "ALL" && !regionais.includes(regional)) onRegionalChange("ALL");
  }, [regional, regionais, onRegionalChange]);

  useEffect(() => {
    if (unidade !== "ALL" && !unidades.includes(unidade)) onUnidadeChange("ALL");
  }, [unidade, unidades, onUnidadeChange]);

  const scope = selectedScopeLabel(regional, unidade);

  const kpiCards: InternacaoKpiCardConfig[] = useMemo(
    () => [
      /* Totais (contagens) */
      {
        id: "internacoes",
        title: "Total de internações",
        value: kpi ? fmtInt(kpi.internacoes_total) : "—",
        emoji: "🛏️",
        chipLabel: "Volume",
        tone: "primary",
        cardClass: "internacao-card--internacoes"
      },
      {
        id: "altas",
        title: "Total de altas",
        value: kpi ? fmtInt(kpi.altas_total) : "—",
        emoji: "✅",
        chipLabel: "Assistencial",
        tone: "live",
        cardClass: "internacao-card--altas"
      },
      {
        id: "obitos",
        title: "Óbitos",
        value: kpi ? fmtInt(kpi.obitos_total) : "—",
        icon: <Skull className="shrink-0" strokeWidth={2.35} aria-hidden />,
        chipLabel: "Desfecho",
        tone: "primary",
        cardClass: "internacao-card--obitos",
        titleAttr:
          "Contagem distinta de atendimentos com alta no período e motivo de alta compatível com óbito (inclui variações «Óbito institucional», etc.)."
      },
      /* Taxas e indicadores derivados */
      {
        id: "reinternacao",
        title: "% reinternação 7d / CID",
        value: kpi && kpi.taxa_conversao_internacao_pct != null ? fmtPercent(kpi.taxa_conversao_internacao_pct) : "—",
        emoji: "♻️",
        chipLabel: "Qualidade",
        tone: "urgent",
        cardClass: "internacao-card--reinternacao"
      },
      {
        id: "altas-med-10h",
        title: "% altas médicas até 10h",
        value: kpi ? fmtPercentOrDash(kpi.pct_altas_medicas_10h) : "—",
        icon: <CalendarClock className="shrink-0" strokeWidth={2.25} aria-hidden />,
        chipLabel: "Altas",
        tone: "live",
        cardClass: "internacao-card--altas-med-10h",
        titleAttr:
          "Igual ao Power BI: altas com DT_ALTA_MEDICA_CONDIC até 10:00 ÷ altas com registo de alta médica (DT_ALTA_MEDICO), excluindo óbito; filtro pela data de alta no período."
      },
      {
        id: "altas-hosp-2h",
        title: "% altas hosp até 2h",
        value: kpi ? fmtPercentOrDash(kpi.pct_altas_hosp_2h) : "—",
        icon: <Clock3 className="shrink-0" strokeWidth={2.25} aria-hidden />,
        chipLabel: "Altas",
        tone: "urgent",
        cardClass: "internacao-card--altas-hosp-2h",
        titleAttr:
          "Igual ao Power BI: alta hospitalar (DT_ALTA) até 2h após DT_ALTA_MEDICA_CONDIC ÷ altas com alta médica e alta hospitalar preenchidas."
      },
      {
        id: "ocupacao",
        title: "Taxa de ocupação",
        value: kpi ? fmtPercentOrDash(kpi.ocupacao_internacao_pct) : "—",
        icon: <BedDouble className="shrink-0" strokeWidth={2.35} aria-hidden />,
        chipLabel: "Capacidade",
        tone: "live",
        cardClass: "internacao-card--ocupacao",
        titleAttr:
          "Percentagem de leitos ocupados em relação ao total de leitos no último snapshot disponível (tbl_intern_leitos), agregada pelas unidades do filtro."
      },
      {
        id: "mortalidade",
        title: "Taxa de mortalidade geral",
        value: kpi ? fmtPercentMortalityOrDash(kpi.taxa_mortalidade_geral_pct) : "—",
        icon: <HeartPulse className="shrink-0" strokeWidth={2.25} aria-hidden />,
        chipLabel: "Indicador",
        tone: "primary",
        cardClass: "internacao-card--mortalidade",
        titleAttr: "Óbitos no período ÷ total de altas no período, em percentagem (mesmo recorte do resumo)."
      },
      {
        id: "tmp",
        title: "TMP (dias)",
        value: kpi ? fmtTmpDias(kpi.tempo_medio_alta_min) : "—",
        emoji: "⏳",
        chipLabel: "Eficiência",
        tone: "critical",
        cardClass: "internacao-card--tmp",
        titleAttr:
          "Igual ao modelo do Power BI: TMP (dias) = Paciente-dia no período ÷ Qtd de altas (distinctcount com alta). Paciente-dia soma os dias em que havia paciente internado segundo tbl_intern_movimentacoes (mesma lógica de censo por DT_HISTORICO / DT_FIM_HISTORICO)."
      }
    ],
    [kpi]
  );

  return (
    <section className="dashboard-panel module-shell module-shell--resumo internacao-shell p-4 md:p-6" aria-label="Resumo Gerencial Internação">
      <header className="mb-4">
        <h2 className="text-xl font-black text-[var(--table-header-fg)] md:text-2xl">Resumo Gerencial - Internação</h2>
      </header>

      <div className="mb-4 grid gap-3 md:grid-cols-[auto,1fr,1fr]">
        <div className="glass-card internacao-filter-strip flex flex-wrap items-center gap-2 p-2.5">
          <button type="button" onClick={() => onPeriodChange(1)} className={`internacao-pill ${period === 1 ? "is-active" : ""}`}>
            Ontem
          </button>
          {[7, 15, 30, 60, 90, 180, 365].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onPeriodChange(value as PeriodDays)}
              className={`internacao-pill ${period === value ? "is-active" : ""}`}
            >
              {value} dias
            </button>
          ))}
        </div>

        <label className="glass-card internacao-filter-strip flex min-w-0 flex-col gap-1.5 p-2.5 sm:flex-row sm:items-center">
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--table-header-fg)]">Regional</span>
          <select className="filter-select min-w-0 flex-1" value={regional} onChange={(e) => onRegionalChange(e.target.value)}>
            <option value="ALL">Todas</option>
            {regionais.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="glass-card internacao-filter-strip flex min-w-0 flex-col gap-1.5 p-2.5 sm:flex-row sm:items-center">
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--table-header-fg)]">Unidade</span>
          <select className="filter-select min-w-0 flex-1" value={unidade} onChange={(e) => onUnidadeChange(e.target.value)}>
            <option value="ALL">Todas</option>
            {unidades.map((item) => (
              <option key={item} value={item}>
                {displayUnidade(item)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="rounded-xl border border-[var(--dash-critical)]/40 p-3 text-sm text-[var(--dash-critical)]">{error}</div>}

      {!error && loading && <GerencialLoadPanel progress={progress} message={rotatingLoadMessage} />}

      {!error && !loading && (
        <div className="internacao-kpi-layout">
          <div className="internacao-kpi-grid internacao-kpi-grid--totais card-grid" aria-label="Totais">
            {kpiCards.slice(0, INTERNACAO_KPI_TOP_TOTAL_CARDS).map((card, index) => (
              <motion.article
                key={card.id}
                className={`kpi-card internacao-card tone-${card.tone} ${card.cardClass}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
              >
                <div className="kpi-head">
                  <span className="kpi-icon">
                    {card.icon ? (
                      <span className="kpi-emoji internacao-kpi-lucide" aria-hidden>
                        {card.icon}
                      </span>
                    ) : (
                      <span className="kpi-emoji" role="img" aria-label={card.title}>
                        {card.emoji ?? ""}
                      </span>
                    )}
                  </span>
                  <span className="kpi-title" title={card.titleAttr}>
                    {card.title}
                  </span>
                  <span className="kpi-chip">{card.chipLabel}</span>
                </div>
                <p className="kpi-value">{card.value}</p>
                <p className="kpi-hint">{`Período ${periodLabel(period)} · ${scope}`}</p>
              </motion.article>
            ))}
          </div>
          <div className="internacao-kpi-grid internacao-kpi-grid--rates card-grid" aria-label="Taxas e indicadores">
            {Array.from({ length: INTERNACAO_KPI_GRID_SLOT_COUNT - INTERNACAO_KPI_TOP_TOTAL_CARDS }, (_, i) => {
              const slotIndex = INTERNACAO_KPI_TOP_TOTAL_CARDS + i;
              const card = kpiCards[slotIndex];
              if (!card) {
                return <div key={`internacao-kpi-slot-${slotIndex}`} className="internacao-kpi-slot" aria-hidden />;
              }
              return (
                <motion.article
                  key={card.id}
                  className={`kpi-card internacao-card tone-${card.tone} ${card.cardClass}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: slotIndex * 0.03 }}
                >
                  <div className="kpi-head">
                    <span className="kpi-icon">
                      {card.icon ? (
                        <span className="kpi-emoji internacao-kpi-lucide" aria-hidden>
                          {card.icon}
                        </span>
                      ) : (
                        <span className="kpi-emoji" role="img" aria-label={card.title}>
                          {card.emoji ?? ""}
                        </span>
                      )}
                    </span>
                    <span className="kpi-title" title={card.titleAttr}>
                      {card.title}
                    </span>
                    <span className="kpi-chip">{card.chipLabel}</span>
                  </div>
                  <p className="kpi-value">{card.value}</p>
                  <p className="kpi-hint">{`Período ${periodLabel(period)} · ${scope}`}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

