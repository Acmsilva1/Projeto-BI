import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import {
  fetchDashboardJson,
  fetchDashboardRows,
  requestGerencialContextPrewarm,
  type DashboardRowsPayload
} from "../../features/jornada/api";
import { type PeriodDays } from "../../lib/gerencialFiltersStorage";
import { useRotatingGerencialLoadPhrases } from "../../lib/gerencialLoadPhrases";
import { GerencialLoadPanel } from "./GerencialLoadPanel";

export type GerencialShellFilters = {
  period: PeriodDays;
  regional: string;
  unidade: string;
  onPeriodChange: (value: PeriodDays) => void;
  onRegionalChange: (value: string) => void;
  onUnidadeChange: (value: string) => void;
};

type CardTone = "live" | "primary" | "critical" | "urgent";

type MetaSituation = "positivo" | "negativo" | "neutro";

type KpiCard = {
  id: string;
  title: string;
  value: string;
  hint: string;
  tone: CardTone;
  icon: string;
  metaSituation: MetaSituation;
  chipLabel: string;
};

type KpiPanelEntryRaw = {
  id?: string;
  label?: string;
  format?: string;
  value?: unknown;
  metaLine?: string;
  metaSituation?: string;
  chipLabel?: string;
};

type RankingRow = {
  unidade: string;
  atendimentos_hoje: number;
  pacientes_ativos: number;
  internacoes: number;
  altas_total: number;
  obitos_total: number;
  taxa_conversao_internacao_pct: number;
  tempo_medio_espera_min: number;
  tempo_medio_exames_min: number;
  transferencias: number;
  ocupacao_internacao_pct: number;
  tempo_medio_alta_min: number;
  metas_positivas: number;
  metas_negativas: number;
  meta_status: string;
  meta_consulta_status: string;
  meta_consulta_delta_min: number;
  meta_exames_status: string;
  meta_exames_delta_min: number;
  meta_permanencia_status: string;
  meta_permanencia_delta_min: number;
  metas_detalhadas: Array<{
    key: string;
    label: string;
    ok: number;
    atencao: number;
    acima: number;
    positivo: number;
    negativo: number;
    total: number;
    positivo_pct: number | null;
    negativo_pct: number | null;
    status: string;
  }>;
  score_operacional: number;
};

type FilterRow = {
  regional: string;
  unidade: string;
};

type FetchSlot =
  | { status: "loading" }
  | { status: "ready"; payload: DashboardRowsPayload }
  | { status: "error"; message: string };

type GerencialSlotsState = {
  filtros: FetchSlot;
  kpis: FetchSlot;
  ranking: FetchSlot;
  progress: number;
};

function initialGerencialSlots(): GerencialSlotsState {
  return {
    filtros: { status: "loading" },
    kpis: { status: "loading" },
    ranking: { status: "loading" },
    progress: 5
  };
}

function formatNumber(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function parseMetaSituation(raw: unknown): MetaSituation {
  const s = String(raw ?? "").toLowerCase();
  if (s === "positivo") return "positivo";
  if (s === "negativo") return "negativo";
  return "neutro";
}

function chipForMeta(s: MetaSituation): string {
  if (s === "positivo") return "Conforme";
  if (s === "negativo") return "Fora da meta";
  return "Neutro";
}

function kpiChipClass(s: MetaSituation): string {
  if (s === "positivo") return "kpi-chip kpi-chip--positivo";
  if (s === "negativo") return "kpi-chip kpi-chip--negativo";
  return "kpi-chip kpi-chip--neutro";
}

function toRankingRows(rows: Record<string, unknown>[]): RankingRow[] {
  return rows.map((row) => ({
    unidade: String(row.unidade ?? "Unidade"),
    atendimentos_hoje: Number(row.atendimentos_hoje ?? 0),
    pacientes_ativos: Number(row.pacientes_ativos ?? 0),
    internacoes: Number(row.internacoes ?? 0),
    altas_total: Number(row.altas_total ?? 0),
    obitos_total: Number(row.obitos_total ?? 0),
    taxa_conversao_internacao_pct: Number(row.taxa_conversao_internacao_pct ?? 0),
    tempo_medio_espera_min: Number(row.tempo_medio_espera_min ?? 0),
    tempo_medio_exames_min: Number(row.tempo_medio_exames_min ?? 0),
    transferencias: Number(row.transferencias ?? 0),
    ocupacao_internacao_pct: Number(row.ocupacao_internacao_pct ?? 0),
    tempo_medio_alta_min: Number(row.tempo_medio_alta_min ?? 0),
    metas_positivas: Number(row.metas_positivas ?? 0),
    metas_negativas: Number(row.metas_negativas ?? 0),
    meta_status: String(row.meta_status ?? "neutro"),
    meta_consulta_status: String(row.meta_consulta_status ?? "neutro"),
    meta_consulta_delta_min: Number(row.meta_consulta_delta_min ?? 0),
    meta_exames_status: String(row.meta_exames_status ?? "neutro"),
    meta_exames_delta_min: Number(row.meta_exames_delta_min ?? 0),
    meta_permanencia_status: String(row.meta_permanencia_status ?? "neutro"),
    meta_permanencia_delta_min: Number(row.meta_permanencia_delta_min ?? 0),
    metas_detalhadas: Array.isArray(row.metas_detalhadas)
      ? row.metas_detalhadas.map((meta) => ({
          key: String((meta as Record<string, unknown>).key ?? ""),
          label: String((meta as Record<string, unknown>).label ?? ""),
          ok: Number((meta as Record<string, unknown>).ok ?? 0),
          atencao: Number((meta as Record<string, unknown>).atencao ?? 0),
          acima: Number((meta as Record<string, unknown>).acima ?? 0),
          positivo: Number((meta as Record<string, unknown>).positivo ?? 0),
          negativo: Number((meta as Record<string, unknown>).negativo ?? 0),
          total: Number((meta as Record<string, unknown>).total ?? 0),
          positivo_pct:
            (meta as Record<string, unknown>).positivo_pct === null
              ? null
              : Number((meta as Record<string, unknown>).positivo_pct ?? 0),
          negativo_pct:
            (meta as Record<string, unknown>).negativo_pct === null
              ? null
              : Number((meta as Record<string, unknown>).negativo_pct ?? 0),
          status: String((meta as Record<string, unknown>).status ?? "neutro")
        }))
      : [],
    score_operacional: Number(row.score_operacional ?? 0)
  }));
}

function toFilterRows(rows: Record<string, unknown>[]): FilterRow[] {
  return rows
    .map((row) => ({
      regional: String(row.regional ?? "").trim(),
      unidade: String(row.unidade ?? "").trim()
    }))
    .filter((row) => row.regional.length > 0 && row.unidade.length > 0);
}

function periodLabel(period: PeriodDays): string {
  if (period === 1) return "ontem";
  return `${period}d`;
}

function selectedScopeLabel(regional: string, unidade: string): string {
  if (unidade !== "ALL") return `Unidade: ${unidade}`;
  if (regional !== "ALL") return `Regional: ${regional}`;
  return "Todas";
}

/** API envia razoes 0–1 para `format: "percent"` (exceto se ja vier em escala 0–100). */
function formatPanelValue(format: string | undefined, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (format === "percent") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    const pct = n >= 0 && n <= 1 ? n * 100 : n;
    return `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }
  return formatNumber(value);
}

function iconForKpiId(id: string): string {
  switch (id) {
    case "total_atendimentos":
    case "atendimentos":
      return "👥";
    case "total_exames_laboratorio":
      return "🧪";
    case "total_rx_ecg":
      return "☢️";
    case "total_tc_us":
      return "📡";
    case "total_prescricoes_medicacao":
      return "💉";
    case "total_reavaliacoes":
      return "🔁";
    case "altas":
      return "🏠";
    case "obitos":
      return "✝️";
    case "evasoes":
      return "🚫";
    default:
      return "📊";
  }
}

function toneForSituation(s: MetaSituation): CardTone {
  if (s === "negativo") return "critical";
  if (s === "positivo") return "live";
  return "primary";
}

function toneForKpi(id: string, situation: MetaSituation): CardTone {
  if (situation === "negativo") return "critical";
  if (id === "obitos") return "critical";
  if (id === "evasoes") return "urgent";
  if (id === "altas" || id === "total_reavaliacoes") return "live";
  if (id === "total_rx_ecg" || id === "total_tc_us") return "urgent";
  if (id === "total_prescricoes_medicacao") return "primary";
  return toneForSituation(situation);
}

/**
 * Fallback quando `kpi_panel` nao vem parseavel — seis volumes principais (mesma ordem do backend).
 */
const GERENCIAL_TOPO_KPI_SLOTS_FALLBACK: readonly { id: string; label: string; format: "number" | "percent" }[] = [
  { id: "total_atendimentos", label: "Total de atendimentos", format: "number" },
  { id: "total_exames_laboratorio", label: "Total de exames laborator.", format: "number" },
  { id: "total_rx_ecg", label: "Total de RX/ECG", format: "number" },
  { id: "total_tc_us", label: "Total de TC/US", format: "number" },
  { id: "total_prescricoes_medicacao", label: "Total de prescric. medicação", format: "number" },
  { id: "total_reavaliacoes", label: "Total de reavaliações", format: "number" },
  { id: "altas", label: "Altas", format: "number" },
  { id: "obitos", label: "Óbitos", format: "number" },
  { id: "evasoes", label: "Evasões", format: "number" }
];

const KPI_BORDER_BY_ID: Record<string, string> = {
  total_atendimentos: "#22c55e",
  atendimentos: "#22c55e",
  total_exames_laboratorio: "#38bdf8",
  total_rx_ecg: "#a78bfa",
  total_tc_us: "#14b8a6",
  total_prescricoes_medicacao: "#facc15",
  total_reavaliacoes: "#f97316",
  altas: "#84cc16",
  obitos: "#ef4444",
  evasoes: "#f472b6"
};

function borderAccentForKpi(id: string): string {
  return KPI_BORDER_BY_ID[id] ?? "var(--primary)";
}

function kpiEntryId(entry: KpiPanelEntryRaw): string {
  const rec = entry as Record<string, unknown>;
  const raw = entry.id ?? rec.id ?? rec.ID;
  return String(raw ?? "").trim();
}

/** Alguns proxies/serializadores nao expoem `value` como propriedade enumeravel; tenta aliases. */
function rawEntryValue(entry: KpiPanelEntryRaw): unknown {
  const r = entry as Record<string, unknown>;
  return r.value ?? r.Value ?? r.valor ?? r.VALOR;
}

/**
 * Quando o item do painel nao traz `value` (ex.: JSON sem chave), usa os totais da mesma linha
 * `gerencial-kpis-topo` (campos planos devolvidos pelo backend).
 */
function enrichKpiEntryFromTopoRow(entry: KpiPanelEntryRaw, first: Record<string, unknown> | undefined): KpiPanelEntryRaw {
  if (!first) return entry;
  const v0 = rawEntryValue(entry);
  if (v0 !== undefined && v0 !== null) return entry;
  const id = kpiEntryId(entry);
  const a = Number(first.atendimentos_hoje ?? 0);
  const alt = Number(first.altas_total ?? 0);
  const ob = Number(first.obitos_total ?? 0);
  const ev = Number(first.evasoes_total ?? 0);
  const intern = Number(first.internacoes_total ?? 0);
  let fallback: unknown;
  switch (id) {
    case "total_atendimentos":
    case "atendimentos":
      fallback = Number.isFinite(a) ? a : 0;
      break;
    case "total_exames_laboratorio":
      fallback = Number(first.total_exames_laboratorio ?? first.totalExamesLaboratorio ?? 0);
      break;
    case "total_rx_ecg":
      fallback = Number(first.total_rx_ecg ?? first.totalRxEcg ?? 0);
      break;
    case "total_tc_us":
      fallback = Number(first.total_tc_us ?? first.totalTcUs ?? 0);
      break;
    case "total_prescricoes_medicacao":
      fallback = Number(first.total_prescricoes_medicacao ?? first.totalPrescricoesMedicacao ?? 0);
      break;
    case "total_reavaliacoes":
      fallback = Number(first.total_reavaliacoes ?? first.totalReavaliacoes ?? 0);
      break;
    case "altas":
      fallback = Number.isFinite(alt) ? alt : 0;
      break;
    case "obitos":
      fallback = Number.isFinite(ob) ? ob : 0;
      break;
    case "evasoes":
      fallback = Number.isFinite(ev) ? ev : 0;
      break;
    case "internacoes":
      fallback = Number.isFinite(intern) ? intern : 0;
      break;
    case "saidas":
      fallback = Number.isFinite(alt + ob + ev) ? alt + ob + ev : 0;
      break;
    case "pct_evasao":
      fallback = a > 0 && Number.isFinite(ev) ? ev / a : null;
      break;
    case "pct_conversao": {
      const t = first.taxa_conversao_internacao_pct;
      if (t !== undefined && t !== null && Number.isFinite(Number(t))) {
        const n = Number(t);
        fallback = n > 1 ? n / 100 : n;
      }
      break;
    }
    default:
      fallback = undefined;
  }
  if (fallback === undefined) return entry;
  return { ...entry, value: fallback } as KpiPanelEntryRaw;
}

function extractKpiPanelRaw(first: Record<string, unknown> | undefined): unknown {
  if (!first) return undefined;
  const rec = first as Record<string, unknown>;
  return rec.kpi_panel ?? rec.kpiPanel ?? rec.KPI_PANEL;
}

/** Desembrulha string JSON (incl. dupla codificacao) ou objeto `{ "0": {...} }` ate obter array. */
function normalizeKpiPanelArray(raw: unknown): KpiPanelEntryRaw[] {
  let cur: unknown = raw;
  for (let i = 0; i < 8; i += 1) {
    if (cur === null || cur === undefined) return [];
    if (Array.isArray(cur)) {
      const flattened = (cur as unknown[]).flatMap((item) => {
        if (item == null) return [];
        if (typeof item === "string") {
          const t = item.trim();
          if (!t) return [];
          try {
            return [JSON.parse(t) as unknown];
          } catch {
            return [];
          }
        }
        return [item];
      });
      return flattened.filter(
        (item): item is KpiPanelEntryRaw =>
          item != null && typeof item === "object" && !Array.isArray(item) && kpiEntryId(item as KpiPanelEntryRaw).length > 0
      ) as KpiPanelEntryRaw[];
    }
    if (typeof cur === "string") {
      const t = cur.trim();
      if (!t) return [];
      try {
        cur = JSON.parse(t) as unknown;
      } catch {
        return [];
      }
      continue;
    }
    if (typeof cur === "object") {
      const o = cur as Record<string, unknown>;
      const keys = Object.keys(o).filter((k) => /^\d+$/.test(k));
      if (keys.length > 0) {
        cur = keys.sort((a, b) => Number(a) - Number(b)).map((k) => o[k]);
        continue;
      }
      return [];
    }
    return [];
  }
  return [];
}

function parseKpiPanelById(first: Record<string, unknown> | undefined): Map<string, KpiPanelEntryRaw> {
  const byId = new Map<string, KpiPanelEntryRaw>();
  for (const item of normalizeKpiPanelArray(extractKpiPanelRaw(first))) {
    const id = kpiEntryId(item);
    if (id) byId.set(id, item);
  }
  return byId;
}

/** Ordem e conjunto de KPIs vêm do `kpi_panel` na API (alinhado aos CSVs carregados no backend). */
function panelEntryToKpiCard(entry: KpiPanelEntryRaw, period: PeriodDays, selectedScope: string): KpiCard {
  const id = kpiEntryId(entry);
  const label = String(entry.label ?? id);
  const format = String(entry.format ?? "number");
  const metaSituation = parseMetaSituation(entry.metaSituation);
  const chipLabel = String(entry.chipLabel ?? chipForMeta(metaSituation));
  const cell = rawEntryValue(entry);
  return {
    id,
    title: label,
    value: formatPanelValue(format, cell),
    hint: `Periodo ${periodLabel(period)} · ${selectedScope}`,
    tone: toneForKpi(id, metaSituation),
    icon: iconForKpiId(id),
    metaSituation,
    chipLabel
  };
}

function parseKpiPanelOrdered(first: Record<string, unknown> | undefined): KpiPanelEntryRaw[] {
  const fromApi = normalizeKpiPanelArray(extractKpiPanelRaw(first));
  if (fromApi.length > 0) return fromApi;
  if (!first) return [];
  /** `kpi_panel` omitido ou serializado de forma nao parseavel — reconstruir os 6 slots a partir dos campos planos. */
  return GERENCIAL_TOPO_KPI_SLOTS_FALLBACK.map((slot) =>
    enrichKpiEntryFromTopoRow(
      {
        id: slot.id,
        label: slot.label,
        format: slot.format,
        value: undefined,
        metaSituation: "neutro",
        chipLabel: "Volume"
      } as KpiPanelEntryRaw,
      first
    )
  );
}

/** Cards: ordem da API; se o painel nao for parseavel, grelha fixa + merge por `id` (valores reais quando existirem). */
function buildKpiCardsFromTopoRow(first: Record<string, unknown> | undefined, period: PeriodDays, selectedScope: string): KpiCard[] {
  const ordered = parseKpiPanelOrdered(first);
  if (ordered.length > 0) {
    return ordered.map((entry) => panelEntryToKpiCard(enrichKpiEntryFromTopoRow(entry, first), period, selectedScope));
  }
  const byId = parseKpiPanelById(first);
  return GERENCIAL_TOPO_KPI_SLOTS_FALLBACK.map((slot) => {
    const api = byId.get(slot.id);
    const stub: KpiPanelEntryRaw = api ?? {
      id: slot.id,
      label: slot.label,
      format: slot.format,
      value: undefined,
      metaSituation: "neutro",
      chipLabel: "Neutro"
    };
    const enriched = enrichKpiEntryFromTopoRow(stub, first);
    const card = panelEntryToKpiCard(enriched, period, selectedScope);
    if (!api && (rawEntryValue(enriched) === undefined || rawEntryValue(enriched) === null)) {
      return {
        ...card,
        value: "—",
        chipLabel: "Neutro",
        tone: "primary" as CardTone
      };
    }
    return card;
  });
}

export function GerencialTopCards(props: GerencialShellFilters): ReactElement {
  const { period, regional, unidade, onPeriodChange, onRegionalChange, onUnidadeChange } = props;
  const [slots, setSlots] = useState<GerencialSlotsState>(() => initialGerencialSlots());
  const [lastFilterRows, setLastFilterRows] = useState<FilterRow[]>([]);
  const filterTripletRef = useRef<{ period: PeriodDays; regional: string; unidade: string } | null>(null);
  /** Lista de unidades só depende da regional na API — reutiliza sem novo round-trip. */
  const filtrosCacheRef = useRef<{ regional: string; payload: DashboardRowsPayload } | null>(null);

  useEffect(() => {
    if (slots.filtros.status === "ready") {
      setLastFilterRows(toFilterRows(slots.filtros.payload.rows));
    }
  }, [slots.filtros]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const prev = filterTripletRef.current;
    filterTripletRef.current = { period, regional, unidade };

    const regionalIgualAoAnterior = prev !== null && prev.regional === regional;
    const cacheFiltrosValido =
      filtrosCacheRef.current !== null && filtrosCacheRef.current.regional === regional;
    const skipFiltros = regionalIgualAoAnterior && cacheFiltrosValido;

    /** Sem novo pedido de filtros: 2 passos (ranking ou skip + KPIs); com filtros: 3. */
    const stepsTarget = skipFiltros ? 2 : 3;

    if (skipFiltros && filtrosCacheRef.current) {
      setSlots({
        ...initialGerencialSlots(),
        filtros: { status: "ready", payload: filtrosCacheRef.current.payload }
      });
    } else {
      setSlots(initialGerencialSlots());
    }

    /** Enquanto os cards do periodo atual carregam, o servidor materializa os outros periodos com os mesmos filtros. */
    requestGerencialContextPrewarm({
      activePeriod: period,
      regional,
      unidade
    });

    let stepsFinished = 0;
    const bumpProgress = (): void => {
      if (cancelled) return;
      stepsFinished += 1;
      if (stepsFinished > stepsTarget) return;
      const pct = Math.min(94, Math.round((stepsFinished / stepsTarget) * 100));
      setSlots((prev) => ({ ...prev, progress: pct }));
    };

    const rankingSkippedPayload: DashboardRowsPayload = {
      ok: true,
      slug: "gerencial-unidades-ranking",
      sourceView: "skipped-unidade-all",
      appliedFilters: {
        periodDays: period,
        regional: regional === "ALL" ? null : regional,
        unidade: null
      },
      rowCount: 0,
      rows: []
    };

    if (unidade === "ALL") {
      setSlots((prev) => ({ ...prev, ranking: { status: "ready", payload: rankingSkippedPayload } }));
      bumpProgress();
    } else {
      void fetchDashboardRows("gerencial-unidades-ranking", {
        period,
        regional: regional === "ALL" ? undefined : regional,
        unidade,
        limit: 12,
        signal: controller.signal
      })
        .then((rankingPayload) => {
          if (cancelled) return;
          setSlots((prev) => ({ ...prev, ranking: { status: "ready", payload: rankingPayload } }));
          bumpProgress();
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          const message = error instanceof Error ? error.message : "Falha ao carregar ranking.";
          if (!cancelled) setSlots((prev) => ({ ...prev, ranking: { status: "error", message } }));
        });
    }

    if (!skipFiltros) {
      void fetchDashboardRows("gerencial-filtros", {
        period,
        regional: regional === "ALL" ? undefined : regional,
        limit: 1000,
        signal: controller.signal
      })
        .then((filtersPayload) => {
          if (cancelled) return;
          filtrosCacheRef.current = { regional, payload: filtersPayload };
          setSlots((prev) => ({ ...prev, filtros: { status: "ready", payload: filtersPayload } }));
          bumpProgress();
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          const message = error instanceof Error ? error.message : "Falha ao carregar filtros.";
          if (!cancelled) setSlots((prev) => ({ ...prev, filtros: { status: "error", message } }));
        });
    }

    void fetchDashboardJson("gerencial-kpis-topo", {
      period,
      regional: regional === "ALL" ? undefined : regional,
      unidade: unidade === "ALL" ? undefined : unidade,
      signal: controller.signal
    })
      .then((kpisPayload) => {
        if (cancelled) return;
        setSlots((prev) => ({ ...prev, kpis: { status: "ready", payload: kpisPayload } }));
        bumpProgress();
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Falha ao carregar KPIs.";
        if (!cancelled) setSlots((prev) => ({ ...prev, kpis: { status: "error", message } }));
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [period, regional, unidade]);

  const allFilterRows = useMemo((): FilterRow[] => {
    if (slots.filtros.status === "ready") return toFilterRows(slots.filtros.payload.rows);
    return lastFilterRows;
  }, [slots.filtros, lastFilterRows]);

  useEffect(() => {
    if (allFilterRows.length === 0) return;
    const allowedUnits =
      regional === "ALL"
        ? [...new Set(allFilterRows.map((row) => row.unidade))]
        : [...new Set(allFilterRows.filter((row) => row.regional === regional).map((row) => row.unidade))];
    if (unidade !== "ALL" && !allowedUnits.includes(unidade)) {
      onUnidadeChange("ALL");
    }
  }, [regional, unidade, allFilterRows, onUnidadeChange]);

  const regionais = useMemo(() => {
    const rows = allFilterRows;
    return [...new Set(rows.map((row) => row.regional))].sort((a, b) => a.localeCompare(b));
  }, [allFilterRows]);

  const unidades = useMemo(() => {
    const rows = allFilterRows;
    const unidadesFiltered =
      regional === "ALL" ? rows.map((row) => row.unidade) : rows.filter((row) => row.regional === regional).map((row) => row.unidade);
    return [...new Set(unidadesFiltered)].sort((a, b) => a.localeCompare(b));
  }, [allFilterRows, regional]);

  const kpiCards = useMemo((): KpiCard[] => {
    if (slots.kpis.status !== "ready") return [];
    const rows = slots.kpis.payload.rows;
    const rawFirst = Array.isArray(rows) ? rows[0] : undefined;
    const first =
      rawFirst != null && typeof rawFirst === "object" && !Array.isArray(rawFirst)
        ? (rawFirst as Record<string, unknown>)
        : undefined;
    const scope = selectedScopeLabel(regional, unidade);
    return buildKpiCardsFromTopoRow(first, period, scope);
  }, [slots.kpis, period, regional, unidade]);

  const rankingCards = useMemo((): RankingRow[] => {
    if (slots.ranking.status !== "ready") return [];
    return toRankingRows(slots.ranking.payload.rows);
  }, [slots.ranking]);

  const cardBorderById = useMemo((): Map<string, string> => {
    const map = new Map<string, string>();
    for (const card of kpiCards) {
      map.set(card.id, borderAccentForKpi(card.id));
    }
    return map;
  }, [kpiCards]);

  const loadErrorMessage = useMemo((): string | null => {
    if (slots.kpis.status === "error") return slots.kpis.message;
    if (slots.filtros.status === "error") return slots.filtros.message;
    if (slots.ranking.status === "error") return slots.ranking.message;
    return null;
  }, [slots.kpis, slots.filtros, slots.ranking]);

  const kpisLoading = slots.kpis.status === "loading";
  const kpisReady = slots.kpis.status === "ready";
  const loadWaveKey = `${period}|${regional}|${unidade}`;
  const rotatingLoadMessage = useRotatingGerencialLoadPhrases(kpisLoading, loadWaveKey);

  return (
    <section className="dashboard-panel module-shell module-shell--resumo p-4 md:p-6" aria-label="Modulo gerencial">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[var(--table-header-fg)] md:text-2xl">Resumo Gerencial - Pronto Socorro</h2>
        </div>
      </header>

      <div className="mb-4 grid gap-3 md:grid-cols-[auto,1fr,1fr]">
        <div className="glass-card gerencial-filter-strip flex flex-wrap items-center gap-2 p-2.5">
          <button
            type="button"
            onClick={() => onPeriodChange(1)}
            className={`period-pill ${period === 1 ? "is-active" : ""}`}
          >
            Ontem
          </button>
          {[7, 15, 30, 60, 90, 180, 365].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onPeriodChange(value as PeriodDays)}
              className={`period-pill ${period === value ? "is-active" : ""}`}
            >
              {value} dias
            </button>
          ))}
        </div>

        <label className="glass-card gerencial-filter-strip flex min-w-0 flex-col gap-1.5 p-2.5 sm:flex-row sm:items-center">
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--table-header-fg)]">
            Regional
          </span>
          <select
            className={`filter-select min-w-0 flex-1${regional !== "ALL" ? " is-active" : ""}`}
            value={regional}
            onChange={(e) => onRegionalChange(e.target.value)}
          >
            <option value="ALL">Todas</option>
            {regionais.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="glass-card gerencial-filter-strip flex min-w-0 flex-col gap-1.5 p-2.5 sm:flex-row sm:items-center">
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--table-header-fg)]">
            Unidade
          </span>
          <select
            className={`filter-select min-w-0 flex-1${unidade !== "ALL" ? " is-active" : ""}`}
            value={unidade}
            onChange={(e) => onUnidadeChange(e.target.value)}
          >
            <option value="ALL">Todas</option>
            {unidades.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadErrorMessage !== null && (
        <div className="rounded-xl border border-[var(--dash-critical)]/40 bg-[color-mix(in_srgb,var(--dash-critical)_15%,transparent)] p-4 text-sm text-[var(--app-fg)]">
          {loadErrorMessage}
        </div>
      )}

      {kpisLoading && <GerencialLoadPanel progress={slots.progress} message={rotatingLoadMessage} />}

      {!kpisLoading && kpisReady && kpiCards.length > 0 && (
        <div className="card-grid pb-2" aria-label="Indicadores consolidados do periodo">
          {kpiCards.map((card, index) => (
            <motion.article
              key={card.id}
              className={`kpi-card tone-${card.tone}`}
              style={{ "--kpi-border-accent": cardBorderById.get(card.id) ?? "var(--primary)" } as CSSProperties}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.03 }}
              whileHover={{ y: -4 }}
            >
              <div className="kpi-head">
                <motion.span
                  className="kpi-icon"
                  animate={{ y: [0, -1.5, 0], scale: [1, 1.04, 1] }}
                  transition={{
                    duration: 2.2,
                    delay: Math.min(index, 12) * 0.08,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut"
                  }}
                  whileHover={{ scale: 1.12, rotate: 6 }}
                >
                  <span className="kpi-emoji" role="img" aria-label={card.title}>
                    {card.icon}
                  </span>
                </motion.span>
                <span className="kpi-title">{card.title}</span>
                <span className={kpiChipClass(card.metaSituation)}>{card.chipLabel}</span>
              </div>
              <p className="kpi-value">{card.value}</p>
              <p className="kpi-hint">{card.hint}</p>
            </motion.article>
          ))}
        </div>
      )}

      {!kpisLoading && kpisReady && kpiCards.length === 0 && (
        <div className="mb-4 rounded-xl border border-[var(--table-grid)] bg-[var(--app-elevated)] p-4 text-sm text-[var(--app-muted)]">
          A API devolveu sucesso mas sem linha de KPIs (`rows` vazio ou sem `kpi_panel`). Confirme a rota{" "}
          <code className="text-[var(--table-header-fg)]">/api/v1/dashboard/gerencial-kpis-topo</code> e a versao do backend.
        </div>
      )}

    </section>
  );
}
