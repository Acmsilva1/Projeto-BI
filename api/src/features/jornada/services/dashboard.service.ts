import { env } from "../../../core/config/env.js";
import { loadDatasetBasesInParallel, withMemoryDatasetDb } from "../../../data/utils/datasetTableLoader.js";
import { PS_DASHBOARD_RETENTION_DAYS } from "../config/psDashboardRetention.js";
import { listDashboardQueryCatalog } from "../domain/dashboard/dashboardQueryCatalog.js";
import { queryDuckDb } from "../../../data/services/duckdb.service.js";
import {
  buildMetasPorVolumesDrill,
  buildMetasPorVolumesMatrix,
  computeIndicator,
  type MetasWeekSlice,
  rollingWindowForGerencial,
  yesterdayLocalBoundsMs,
  type FluxoVolumeRow,
  type LabVolumeRow,
  type MedicacaoVolumeRow,
  type MonthAgg,
  type ReavVolumeRow,
  type TcUsVolumeRow,
  type ViasVolumeRow,
  VOLUME_META_DEFINITIONS
} from "./metasPorVolumesAggregator.js";
import { buildMedicacaoPsDashboard, type MedicacaoPsDashboardData } from "./medicacaoPsAggregator.js";

type DashboardCatalogItem = {
  slug: string;
  description: string;
  sourceView: string;
};

type DashboardCatalogPayload = {
  ok: true;
  count: number;
  slugs: DashboardCatalogItem[];
};

type DashboardQueryPayload = {
  ok: true;
  slug: string;
  sourceView: string;
  appliedFilters: {
    periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;
    regional: string | null;
    unidade: string | null;
    indicadorKey?: string | null;
    mes?: string | null;
    semana?: string | null;
  };
  rowCount: number;
  rows: Record<string, unknown>[];
};

type UnidadeDim = {
  cd: number;
  unidade: string;
  regional: string;
};

type SnapshotRow = {
  cd: number;
  ativos: number;
  transferencia: number;
  acomodacao: number;
  tcUsPendente: number;
  reavaliacaoAcimaMeta: number;
  ocupacaoInternacaoPct: number;
  ocupacaoUtiPct: number;
  metasAcimaTotal: number;
  metasAtencaoTotal: number;
  metasOkTotal: number;
  metasDetalhadas: MetaBreakdownItem[];
};

type MetaBreakdownItem = {
  key: string;
  label: string;
  ok: number;
  atencao: number;
  acima: number;
};

type TempoEvent = {
  cd: number;
  atendimento: string;
  pessoa: string;
  dtMs: number;
  minTriagem: number;
  minConsulta: number;
  minPermanencia: number;
};

type InternEvent = {
  cd: number;
  dtMs: number;
};

type ExamEvent = {
  cd: number;
  dtMs: number;
  minutos: number;
};

type AltaEvent = {
  cd: number;
  dtMs: number;
  alta: number;
  obito: number;
  evasao: number;
};

type MetaRule = {
  valueMin: number;
  alertMin: number;
};

type DataStore = {
  unidades: UnidadeDim[];
  snapshotByCd: Map<number, SnapshotRow>;
  metasByKey: Map<string, MetaRule>;
  tempos: TempoEvent[];
  internacoes: InternEvent[];
  exames: ExamEvent[];
  altas: AltaEvent[];
  maxEventMs: number;
  unitMaxEventMs: Map<number, number>;
  fluxoVolume: FluxoVolumeRow[];
  medicacaoVolume: MedicacaoVolumeRow[];
  laboratorioVolume: LabVolumeRow[];
  tcUsVolume: TcUsVolumeRow[];
  reavaliacaoVolume: ReavVolumeRow[];
  viasMedicamentos: ViasVolumeRow[];
  farmacia: FarmaciaRow[];
};

function parseYearMonthFilter(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const text = value.trim();
  if (!/^\d{4}-\d{2}$/.test(text)) return undefined;
  const [yearText, monthText] = text.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const month = Number.parseInt(monthText ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return undefined;
  if (year < 1900 || year > 2100) return undefined;
  if (month < 1 || month > 12) return undefined;
  return year * 100 + month;
}

function parseWeekSliceFilter(value: string | undefined): MetasWeekSlice | undefined {
  const text = (value ?? "").trim().toUpperCase();
  if (text === "W1" || text === "W2" || text === "W3" || text === "W4") return text;
  return undefined;
}

type UnitAggregate = {
  atendimentos: number;
  pacientesUnicos: number;
  somaEsperaMin: number;
  somaPermanenciaMin: number;
  somaExamesMin: number;
  countExames: number;
  internacoes: number;
  altas: number;
  obitos: number;
  evasoes: number;
  metaTriagem: { ok: number; atencao: number; acima: number };
  metaConsulta: { ok: number; atencao: number; acima: number };
  metaPermanencia: { ok: number; atencao: number; acima: number };
};

type ComputedContext = {
  unidadesSelecionadas: UnidadeDim[];
  unitAggByCd: Map<number, UnitAggregate>;
  pacientesUnicosGlobal: number;
};

const ACIMA_COLS = [
  "triagem_acima_meta",
  "consulta_acima_meta",
  "permanencia_acima_meta",
  "rx_ecg_acima_meta",
  "tc_us_acima_meta",
  "tc_us_laudo_acima_meta",
  "reavaliacao_acima_meta",
  "medicacao_acima_meta",
  "procedimento_acima_meta",
  "farmacia_acima_meta"
];

const ATENCAO_COLS = [
  "triagem_em_atencao",
  "consulta_em_atencao",
  "permanencia_em_atencao",
  "rx_ecg_em_atencao",
  "tc_us_em_atencao",
  "tc_us_laudo_em_atencao",
  "reavaliacao_em_atencao",
  "medicacao_em_atencao",
  "procedimento_em_atencao",
  "farmacia_em_atencao"
];

const OK_COLS = [
  "triagem_ok",
  "consulta_ok",
  "permanencia_ok",
  "rx_ecg_ok",
  "tc_us_ok",
  "tc_us_laudo_ok",
  "reavaliacao_ok",
  "medicacao_ok",
  "procedimento_ok",
  "farmacia_ok"
];

const META_DEFINITIONS: Array<{
  key: string;
  label: string;
  okCol: string;
  atencaoCol: string;
  acimaCol: string;
}> = [
  { key: "triagem", label: "Triagem", okCol: "triagem_ok", atencaoCol: "triagem_em_atencao", acimaCol: "triagem_acima_meta" },
  { key: "consulta", label: "Consulta", okCol: "consulta_ok", atencaoCol: "consulta_em_atencao", acimaCol: "consulta_acima_meta" },
  { key: "permanencia", label: "Permanencia", okCol: "permanencia_ok", atencaoCol: "permanencia_em_atencao", acimaCol: "permanencia_acima_meta" },
  { key: "rx_ecg", label: "RX/ECG", okCol: "rx_ecg_ok", atencaoCol: "rx_ecg_em_atencao", acimaCol: "rx_ecg_acima_meta" },
  { key: "tc_us", label: "TC/US", okCol: "tc_us_ok", atencaoCol: "tc_us_em_atencao", acimaCol: "tc_us_acima_meta" },
  { key: "tc_us_laudo", label: "TC/US Laudo", okCol: "tc_us_laudo_ok", atencaoCol: "tc_us_laudo_em_atencao", acimaCol: "tc_us_laudo_acima_meta" },
  { key: "reavaliacao", label: "Reavaliacao", okCol: "reavaliacao_ok", atencaoCol: "reavaliacao_em_atencao", acimaCol: "reavaliacao_acima_meta" },
  { key: "medicacao", label: "Medicacao", okCol: "medicacao_ok", atencaoCol: "medicacao_em_atencao", acimaCol: "medicacao_acima_meta" },
  { key: "procedimento", label: "Procedimento", okCol: "procedimento_ok", atencaoCol: "procedimento_em_atencao", acimaCol: "procedimento_acima_meta" },
  { key: "farmacia", label: "Farmacia", okCol: "farmacia_ok", atencaoCol: "farmacia_em_atencao", acimaCol: "farmacia_acima_meta" }
];

let storeCache: DataStore | null = null;
/** Evita N cargas completas em paralelo (Promise.all no front → vários GETs ao mesmo tempo → risco de OOM / 500). */
let storeLoadPromise: Promise<DataStore> | null = null;
/** Dias de facts efetivamente materializados no último `loadDataStoreIntoCache` (90 → 180 → 365 conforme pills). */
let storeCommittedRetentionDays = 0;
const queryCache = new Map<string, ComputedContext>();

type GerencialPeriodDays = 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;

/** 1d–60d usam bootstrap 90d; 90/180/365 pedem pelo menos esse recorte no store (cortado pelo teto env). */
function storeRetentionDaysForPeriod(periodDays: GerencialPeriodDays): number {
  return Math.min(env.gerencialStoreRetentionDays, Math.max(90, periodDays));
}

function pick(row: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = row[key];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

function toNumber(value: string | undefined): number {
  const n = Number(value ?? "0");
  return Number.isFinite(n) ? n : 0;
}

function parseDateMs(value: string | undefined): number {
  if (!value) return Number.NaN;
  const normalized = value.trim().replace(" ", "T");
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function normalizeForMatch(value: string | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isObitoFromAlta(tipo: string | undefined, motivo: string | undefined, obitoQtd: number): boolean {
  if (obitoQtd > 0) return true;
  const tipoNorm = normalizeForMatch(tipo);
  const motivoNorm = normalizeForMatch(motivo);
  return tipoNorm.includes("obito") || motivoNorm.includes("obito");
}

function isEvasaoFromAlta(tipo: string | undefined, motivo: string | undefined): boolean {
  const tipoNorm = normalizeForMatch(tipo);
  const motivoNorm = normalizeForMatch(motivo);
  return (
    tipoNorm.includes("evas") ||
    tipoNorm.includes("evad") ||
    tipoNorm.includes("aband") ||
    motivoNorm.includes("evas") ||
    motivoNorm.includes("evad") ||
    motivoNorm.includes("aband")
  );
}

function sumColumns(row: Record<string, string>, columns: string[]): number {
  return columns.reduce((acc, key) => acc + toNumber(row[key]), 0);
}

function avg(sum: number, count: number): number {
  return count > 0 ? sum / count : 0;
}

function accumulateMetaCounter(
  counter: { ok: number; atencao: number; acima: number },
  valueMin: number,
  rule: MetaRule | undefined
): void {
  if (!rule) return;
  if (!Number.isFinite(valueMin) || valueMin < 0) return;
  if (valueMin > rule.valueMin) {
    counter.acima += 1;
    return;
  }
  if (valueMin > rule.alertMin) {
    counter.atencao += 1;
    return;
  }
  counter.ok += 1;
}

async function ensureStore(periodDays: GerencialPeriodDays = 1): Promise<DataStore> {
  const needed = storeRetentionDaysForPeriod(periodDays);

  for (;;) {
    if (storeCache !== null && storeCommittedRetentionDays >= needed) {
      return storeCache;
    }

    if (storeLoadPromise !== null) {
      await storeLoadPromise;
      continue;
    }

    if (storeCache !== null && storeCommittedRetentionDays < needed) {
      console.log(
        `[data] store: expandindo recorte de ${storeCommittedRetentionDays}d para ${needed}d (pill/periodo ${periodDays}d).`
      );
      storeCache = null;
      queryCache.clear();
      storeCommittedRetentionDays = 0;
    }

    storeLoadPromise = loadDataStoreIntoCache(needed).finally(() => {
      storeLoadPromise = null;
    });
    const store = await storeLoadPromise;
    storeCommittedRetentionDays = needed;
    return store;
  }
}

const MS_PER_DAY = 86_400_000;

/** Maior timestamp encontrado nos facts brutos (antes do recorte) — ancora para janela rolante. */
function computePsFactsAnchorMs(
  temposRows: Record<string, string>[],
  internRows: Record<string, string>[],
  examesRxRows: Record<string, string>[],
  examesTcRows: Record<string, string>[],
  altasRows: Record<string, string>[],
  medicacaoRows: Record<string, string>[],
  laboratorioRows: Record<string, string>[],
  reavaliacaoRows: Record<string, string>[],
  viasRows: Record<string, string>[],
  farmaciaLibRows: Record<string, string>[],
  farmaciaPenRows: Record<string, string>[]
): number {
  let m = 0;
  const bump = (ms: number): void => {
    if (Number.isFinite(ms) && ms > m) m = ms;
  };

  // ... (previous bumps)
  for (const row of temposRows) {
    bump(parseDateMs(pick(row, "DT_ENTRADA", "dt_entrada")));
    bump(parseDateMs(pick(row, "DATA", "data")));
  }
  for (const row of internRows) {
    bump(parseDateMs(pick(row, "DT_ENTRADA", "dt_entrada")));
  }

  const bumpExam = (row: Record<string, string>): void => {
    bump(parseDateMs(pick(row, "DT_EXAME", "dt_exame", "DT_REALIZADO", "dt_realizado")));
  };
  for (const row of examesRxRows) bumpExam(row);
  for (const row of examesTcRows) bumpExam(row);

  for (const row of altasRows) {
    bump(parseDateMs(pick(row, "DT_ALTA", "dt_alta", "DT_ENTRADA", "dt_entrada")));
  }

  for (const row of medicacaoRows) {
    const tAdm = parseDateMs(pick(row, "DT_ADMINISTRACAO", "dt_administracao"));
    const tPre = parseDateMs(pick(row, "DT_PRESCRICAO", "dt_prescricao"));
    const tData = parseDateMs(pick(row, "DATA", "data"));
    bump(Number.isFinite(tAdm) ? tAdm : Number.isFinite(tPre) ? tPre : tData);
  }

  for (const row of laboratorioRows) {
    const tEx = parseDateMs(pick(row, "DT_EXAME", "dt_exame"));
    const tSol = parseDateMs(pick(row, "DT_SOLICITACAO", "dt_solicitacao"));
    const tData = parseDateMs(pick(row, "DATA", "data"));
    bump(Number.isFinite(tEx) ? tEx : Number.isFinite(tSol) ? tSol : tData);
  }

  for (const row of reavaliacaoRows) {
    bump(parseDateMs(pick(row, "DATA", "data")));
  }

  for (const row of viasRows) {
    bump(parseDateMs(pick(row, "DATA", "data")));
  }

  for (const row of farmaciaLibRows) {
    bump(parseDateMs(pick(row, "DT_LIBERACAO", "dt_liberacao")));
  }
  for (const row of farmaciaPenRows) {
    bump(parseDateMs(pick(row, "DT_LIBERACAO", "dt_liberacao")));
  }

  return m;
}

/** Ordem fixa: índices usados ao descompactar `loadDatasetBasesInParallel`. */
const GERENCIAL_STORE_TABLE_BASES = [
  "tbl_unidades",
  "ps_resumo_unidades_snapshot_prod",
  "tbl_tempos_entrada_consulta_saida",
  "tbl_intern_conversoes",
  "tbl_tempos_rx_e_ecg",
  "tbl_tempos_tc_e_us",
  "tbl_altas_ps",
  "meta_tempos",
  "tbl_tempos_medicacao",
  "tbl_tempos_laboratorio",
  "tbl_tempos_reavaliacao",
  "tbl_vias_medicamentos",
  "tbl_farm_relatorio_liberadas_base",
  "tbl_farm_relatorio_pendentes_base"
] as const;

async function loadDataStoreIntoCache(factsRetentionDays: number): Promise<DataStore> {
  return withMemoryDatasetDb(async (db, _conn) => {
    const loaded = await loadDatasetBasesInParallel(db, env.csvDataDir, GERENCIAL_STORE_TABLE_BASES, env.storeLoadConcurrency);
    const unidadesRows = loaded[0] ?? [];
    const snapshotRows = loaded[1] ?? [];
    const temposRows = loaded[2] ?? [];
    const internRows = loaded[3] ?? [];
    const examesRxRows = loaded[4] ?? [];
    const examesTcRows = loaded[5] ?? [];
    const altasRows = loaded[6] ?? [];
    const metasRows = loaded[7] ?? [];
    const medicacaoRows = loaded[8] ?? [];
    const laboratorioRows = loaded[9] ?? [];
    const reavaliacaoRows = loaded[10] ?? [];
    const viasRows = loaded[11] ?? [];
    const farmaciaLibRows = loaded[12] ?? [];
    const farmaciaPenRows = loaded[13] ?? [];

  const unidades = unidadesRows
    .filter((row) => {
      // Tenta chave minúscula e maiúscula; aceita boolean true (parquet nativo) ou strings "true/1/t"
      const raw = pick(row, "ps", "PS");
      if (raw === undefined || raw === "") return false;
      const lower = raw.toLowerCase().trim();
      return lower === "true" || lower === "1" || lower === "t";
    })
    .map((row) => ({
      cd: toNumber(pick(row, "cd_estabelecimento", "CD_ESTABELECIMENTO")),
      unidade: pick(row, "nome", "NOME") ?? "",
      regional: (pick(row, "uf", "UF") ?? "").toUpperCase()
    }))
    .filter((row): row is UnidadeDim => row.cd > 0 && row.unidade.length > 0 && row.regional.length > 0);

  const snapshotByCd = new Map<number, SnapshotRow>();
  for (const row of snapshotRows) {
    const cd = toNumber(pick(row, "cd_estabelecimento", "CD_ESTABELECIMENTO"));
    if (!cd) continue;
    const metasDetalhadas = META_DEFINITIONS.map((meta) => ({
      key: meta.key,
      label: meta.label,
      ok: toNumber(pick(row, meta.okCol)),
      atencao: toNumber(pick(row, meta.atencaoCol)),
      acima: toNumber(pick(row, meta.acimaCol))
    }));

    snapshotByCd.set(cd, {
      cd,
      ativos: toNumber(pick(row, "ativos")),
      transferencia: toNumber(pick(row, "transferencia")),
      acomodacao: toNumber(pick(row, "acomodacao")),
      tcUsPendente: toNumber(pick(row, "tc_us_pendente")),
      reavaliacaoAcimaMeta: toNumber(pick(row, "reavaliacao_acima_meta")),
      ocupacaoInternacaoPct: toNumber(pick(row, "ocupacao_internacao_pct")),
      ocupacaoUtiPct: toNumber(pick(row, "ocupacao_uti_pct")),
      metasAcimaTotal: sumColumns(row, ACIMA_COLS),
      metasAtencaoTotal: sumColumns(row, ATENCAO_COLS),
      metasOkTotal: sumColumns(row, OK_COLS),
      metasDetalhadas
    });
  }

  const metasByKey = new Map<string, MetaRule>();
  for (const row of metasRows) {
    const key = (pick(row, "CHAVE", "chave") ?? "").toUpperCase();
    if (!key) continue;
    metasByKey.set(key, {
      valueMin: toNumber(pick(row, "VALOR_MIN", "valor_min")),
      alertMin: toNumber(pick(row, "ALERTA_MIN", "alerta_min"))
    });
  }

  const anchorMs = computePsFactsAnchorMs(
    temposRows,
    internRows,
    examesRxRows,
    examesTcRows,
    altasRows,
    medicacaoRows,
    laboratorioRows,
    reavaliacaoRows,
    viasRows,
    farmaciaLibRows,
    farmaciaPenRows
  );
  const retentionDays = factsRetentionDays;
  const cutoffMs =
    anchorMs > 0 && retentionDays > 0 ? anchorMs - retentionDays * MS_PER_DAY : Number.NEGATIVE_INFINITY;

  const tempos: TempoEvent[] = [];
  const internacoes: InternEvent[] = [];
  const exames: ExamEvent[] = [];
  const altas: AltaEvent[] = [];
  let maxEventMs = 0;
  const unitMaxEventMs = new Map<number, number>();
  const updateUnitMax = (cd: number, dtMs: number): void => {
    const curr = unitMaxEventMs.get(cd) ?? 0;
    if (dtMs > curr) unitMaxEventMs.set(cd, dtMs);
  };

  for (const row of temposRows) {
    const cd = toNumber(pick(row, "CD_ESTABELECIMENTO", "cd_estabelecimento"));
    if (!cd) continue;
    const dtMs = parseDateMs(pick(row, "DT_ENTRADA", "dt_entrada"));
    if (!Number.isFinite(dtMs)) continue;
    if (dtMs < cutoffMs) continue;
    if (dtMs > maxEventMs) maxEventMs = dtMs;
    updateUnitMax(cd, dtMs);

    tempos.push({
      cd,
      atendimento: pick(row, "NR_ATENDIMENTO", "nr_atendimento") ?? "",
      pessoa: pick(row, "CD_PESSOA_FISICA", "cd_pessoa_fisica") ?? "",
      dtMs,
      minTriagem: toNumber(pick(row, "MIN_ENTRADA_X_TRIAGEM", "min_entrada_x_triagem")),
      minConsulta: toNumber(pick(row, "MIN_ENTRADA_X_CONSULTA", "min_entrada_x_consulta")),
      minPermanencia: toNumber(pick(row, "MIN_ENTRADA_X_ALTA", "min_entrada_x_alta"))
    });
  }

  for (const row of internRows) {
    const cd = toNumber(pick(row, "CD_ESTAB_URG", "cd_estab_urg"));
    if (!cd) continue;
    const dtMs = parseDateMs(pick(row, "DT_ENTRADA", "dt_entrada"));
    if (!Number.isFinite(dtMs)) continue;
    if (dtMs < cutoffMs) continue;
    if (dtMs > maxEventMs) maxEventMs = dtMs;
    updateUnitMax(cd, dtMs);
    internacoes.push({ cd, dtMs });
  }

  const pushExam = (row: Record<string, string>): void => {
    const cd = toNumber(pick(row, "CD_ESTABELECIMENTO", "cd_estabelecimento"));
    if (!cd) return;
    const dtMs = parseDateMs(pick(row, "DT_EXAME", "dt_exame", "DT_REALIZADO", "dt_realizado"));
    if (!Number.isFinite(dtMs)) return;
    if (dtMs < cutoffMs) return;
    if (dtMs > maxEventMs) maxEventMs = dtMs;
    updateUnitMax(cd, dtMs);
    exames.push({
      cd,
      dtMs,
      minutos: toNumber(pick(row, "MINUTOS", "minutos"))
    });
  };

  for (const row of examesRxRows) pushExam(row);
  for (const row of examesTcRows) pushExam(row);

  for (const row of altasRows) {
    const cd = toNumber(pick(row, "CD_ESTABELECIMENTO", "cd_estabelecimento"));
    if (!cd) continue;
    const dtMs = parseDateMs(pick(row, "DT_ALTA", "dt_alta", "DT_ENTRADA", "dt_entrada"));
    if (!Number.isFinite(dtMs)) continue;
    if (dtMs < cutoffMs) continue;
    if (dtMs > maxEventMs) maxEventMs = dtMs;
    updateUnitMax(cd, dtMs);

    const tipo = pick(row, "TIPO_DESFECHO", "tipo_desfecho");
    const motivo = pick(row, "DS_MOTIVO_ALTA", "ds_motivo_alta");
    const tipoNorm = normalizeForMatch(tipo);
    const motivoNorm = normalizeForMatch(motivo);
    const obitoQtd = toNumber(pick(row, "QTD_OBITO", "qtd_obito"));
    const isObito = isObitoFromAlta(tipo, motivo, obitoQtd);
    const isAlta = tipoNorm.includes("alta") || motivoNorm.includes("alta");
    const isEvasao = isEvasaoFromAlta(tipo, motivo);

    altas.push({
      cd,
      dtMs,
      alta: isAlta ? 1 : 0,
      obito: isObito ? 1 : 0,
      evasao: isEvasao ? 1 : 0
    });
  }

  const fluxoVolume: FluxoVolumeRow[] = [];
  for (const row of temposRows) {
    const cd = toNumber(pick(row, "CD_ESTABELECIMENTO", "cd_estabelecimento"));
    if (!cd) continue;
    const dataMs = parseDateMs(pick(row, "DATA", "data"));
    if (!Number.isFinite(dataMs)) continue;
    if (dataMs < cutoffMs) continue;
    const di = parseDateMs(pick(row, "DT_INTERNACAO", "dt_internacao"));
    const dd = parseDateMs(pick(row, "DT_DESFECHO", "dt_desfecho"));
    fluxoVolume.push({
      cd,
      nr: pick(row, "NR_ATENDIMENTO", "nr_atendimento") ?? "",
      dataMs,
      destino: pick(row, "DESTINO", "destino") ?? "",
      dtInternacaoMs: Number.isFinite(di) ? di : null,
      minTriagem: toNumber(pick(row, "MIN_ENTRADA_X_TRIAGEM", "min_entrada_x_triagem")),
      minConsulta: toNumber(pick(row, "MIN_ENTRADA_X_CONSULTA", "min_entrada_x_consulta")),
      minPermanencia: toNumber(pick(row, "MIN_ENTRADA_X_ALTA", "min_entrada_x_alta")),
      dtDesfechoMs: Number.isFinite(dd) ? dd : null,
      medAtend: pick(row, "MEDICO_ATENDIMENTO", "medico_atendimento") ?? "",
      medDesfecho: pick(row, "MEDICO_DESFECHO", "medico_desfecho") ?? ""
    });
  }

  const medicacaoVolume: MedicacaoVolumeRow[] = [];
  for (const row of medicacaoRows) {
    const cd = toNumber(pick(row, "CD_ESTABELECIMENTO", "cd_estabelecimento"));
    if (!cd) continue;
    const tAdm = parseDateMs(pick(row, "DT_ADMINISTRACAO", "dt_administracao"));
    const tPre = parseDateMs(pick(row, "DT_PRESCRICAO", "dt_prescricao"));
    const tData = parseDateMs(pick(row, "DATA", "data"));
    const dtMs = Number.isFinite(tAdm) ? tAdm : Number.isFinite(tPre) ? tPre : tData;
    if (!Number.isFinite(dtMs)) continue;
    if (dtMs < cutoffMs) continue;
    medicacaoVolume.push({
      cd,
      nr: pick(row, "NR_ATENDIMENTO", "nr_atendimento") ?? "",
      dtMs,
      minutos: toNumber(pick(row, "MINUTOS", "minutos")),
      geraLote: (pick(row, "GERA_LOTE", "gera_lote") ?? "").toUpperCase()
    });
  }

  const laboratorioVolume: LabVolumeRow[] = [];
  for (const row of laboratorioRows) {
    const cd = toNumber(pick(row, "CD_ESTABELECIMENTO", "cd_estabelecimento"));
    if (!cd) continue;
    const tEx = parseDateMs(pick(row, "DT_EXAME", "dt_exame"));
    const tSol = parseDateMs(pick(row, "DT_SOLICITACAO", "dt_solicitacao"));
    const tData = parseDateMs(pick(row, "DATA", "data"));
    const dtMs = Number.isFinite(tEx) ? tEx : Number.isFinite(tSol) ? tSol : tData;
    if (!Number.isFinite(dtMs)) continue;
    if (dtMs < cutoffMs) continue;
    laboratorioVolume.push({
      cd,
      nr: pick(row, "NR_ATENDIMENTO", "nr_atendimento") ?? "",
      dtMs
    });
  }

  /** TC/US + RX/ECG: mesma estrutura para KPIs de cobertura (% RX, % ECG, % TC, % US) a partir dos CSVs carregados. */
  const tcUsVolume: TcUsVolumeRow[] = [];
  for (const row of examesTcRows) {
    const cd = toNumber(pick(row, "CD_ESTABELECIMENTO", "cd_estabelecimento"));
    if (!cd) continue;
    const tEx = parseDateMs(pick(row, "DT_EXAME", "dt_exame"));
    const tRe = parseDateMs(pick(row, "DT_REALIZADO", "dt_realizado"));
    const dtMs = Number.isFinite(tEx) ? tEx : tRe;
    if (!Number.isFinite(dtMs)) continue;
    if (dtMs < cutoffMs) continue;
    tcUsVolume.push({
      cd,
      nr: pick(row, "NR_ATENDIMENTO", "nr_atendimento") ?? "",
      tipo: pick(row, "TIPO", "tipo") ?? "",
      dtMs,
      origin: "tc_us"
    });
  }
  for (const row of examesRxRows) {
    const cd = toNumber(pick(row, "CD_ESTABELECIMENTO", "cd_estabelecimento"));
    if (!cd) continue;
    const tEx = parseDateMs(pick(row, "DT_EXAME", "dt_exame"));
    const tSol = parseDateMs(pick(row, "DT_SOLICITACAO", "dt_solicitacao"));
    const dtMs = Number.isFinite(tEx) ? tEx : tSol;
    if (!Number.isFinite(dtMs)) continue;
    if (dtMs < cutoffMs) continue;
    tcUsVolume.push({
      cd,
      nr: pick(row, "NR_ATENDIMENTO", "nr_atendimento") ?? "",
      tipo: (pick(row, "TIPO", "tipo") ?? "").trim(),
      dtMs,
      origin: "rx_ecg"
    });
  }

  const reavaliacaoVolume: ReavVolumeRow[] = [];
  for (const row of reavaliacaoRows) {
    const cd = toNumber(pick(row, "CD_ESTABELECIMENTO", "cd_estabelecimento"));
    if (!cd) continue;
    const dtAxis = parseDateMs(pick(row, "DATA", "data"));
    if (!Number.isFinite(dtAxis)) continue;
    if (dtAxis < cutoffMs) continue;
    const ds = parseDateMs(pick(row, "DT_SOLIC_REAVALIACAO", "dt_solic_reavaliacao"));
    const ev = parseDateMs(pick(row, "DT_EVO_PRESC", "dt_evo_presc"));
    const fi = parseDateMs(pick(row, "DT_FIM_REAVALIACAO", "dt_fim_reavaliacao"));
    reavaliacaoVolume.push({
      cd,
      nr: pick(row, "NR_ATENDIMENTO", "nr_atendimento") ?? "",
      dtMs: dtAxis,
      dtSolicMs: Number.isFinite(ds) ? ds : null,
      dtEvoMs: Number.isFinite(ev) ? ev : null,
      dtFimMs: Number.isFinite(fi) ? fi : null
    });
  }

  const viasMedicamentos: ViasVolumeRow[] = [];
  for (const row of viasRows) {
    const cd = toNumber(pick(row, "CD_ESTABELECIMENTO", "cd_estabelecimento"));
    if (!cd) continue;
    const dataMs = parseDateMs(pick(row, "DATA", "data"));
    if (!Number.isFinite(dataMs)) continue;
    if (dataMs < cutoffMs) continue;
    viasMedicamentos.push({
      cd,
      nr: pick(row, "NR_ATENDIMENTO", "nr_atendimento") ?? "",
      dataMs,
      nrPrescricao: pick(row, "NR_PRESCRICAO", "nr_prescricao") ?? "",
      cdMaterial: Math.trunc(toNumber(pick(row, "CD_MATERIAL", "cd_material"))),
      dsMaterial: pick(row, "DS_MATERIAL", "ds_material") ?? "",
      ieViaAplicacao: pick(row, "IE_VIA_APLICACAO", "ie_via_aplicacao") ?? "",
      ieAplicBolus: (pick(row, "IE_APLIC_BOLUS", "ie_aplic_bolus") ?? "").toUpperCase(),
      ieAplicLenta: (pick(row, "IE_APLIC_LENTA", "ie_aplic_lenta") ?? "").toUpperCase()
    });
  }

  const farmacia: FarmaciaRow[] = [];
  const pushFarmacia = (row: Record<string, string>): void => {
    const cd = toNumber(pick(row, "CD_ESTABELECIMENTO", "cd_estabelecimento"));
    if (!cd) return;
    const dataMs = parseDateMs(pick(row, "DT_LIBERACAO", "dt_liberacao")) || 0;
    farmacia.push({
      cd,
      unidade: pick(row, "UNIDADE", "unidade") ?? "",
      padrao: (pick(row, "PADRAO", "padrao") ?? "S").trim().toUpperCase(),
      dataMs
    });
  };
  for (const row of farmaciaLibRows) pushFarmacia(row);
  for (const row of farmaciaPenRows) pushFarmacia(row);

  storeCache = {
    unidades,
    snapshotByCd,
    metasByKey,
    tempos,
    internacoes,
    exames,
    altas,
    maxEventMs,
    unitMaxEventMs,
    fluxoVolume,
    medicacaoVolume,
    laboratorioVolume,
    tcUsVolume,
    reavaliacaoVolume,
    viasMedicamentos,
    farmacia
  };
  queryCache.clear();
  const maxEvtHint =
    maxEventMs > 0 ? new Date(maxEventMs).toISOString().replace("T", " ").slice(0, 16) + "Z" : "n/d";
  const anchorHint =
    anchorMs > 0 ? new Date(anchorMs).toISOString().replace("T", " ").slice(0, 16) + "Z" : "n/d";
  const cutoffHint =
    anchorMs > 0 && Number.isFinite(cutoffMs) && cutoffMs > Number.NEGATIVE_INFINITY
      ? new Date(cutoffMs).toISOString().replace("T", " ").slice(0, 16) + "Z"
      : "n/d";
  console.log(
    `[data] store em RAM: unidades=${unidades.length} tempos=${tempos.length} fluxo=${fluxoVolume.length} intern=${internacoes.length} exames=${exames.length} altas=${altas.length} med=${medicacaoVolume.length} lab=${laboratorioVolume.length} tcUs=${tcUsVolume.length} reav=${reavaliacaoVolume.length} vias=${viasMedicamentos.length} farmacia=${farmacia.length} | maior=${maxEvtHint}. Recorte facts desta carga=${retentionDays}d (env GERENCIAL_STORE_RETENTION_DAYS=${env.gerencialStoreRetentionDays} é teto opcional; pills 1–60d usam bootstrap 90d; 180/365 expandem). ref. pill≤${PS_DASHBOARD_RETENTION_DAYS.gerencialResumoPillMax}d metas≤${PS_DASHBOARD_RETENTION_DAYS.metasPorVolumes}d heatmap≤${PS_DASHBOARD_RETENTION_DAYS.mapaCalorPs}d | ancora≈${anchorHint} minRetido≈${cutoffHint}. DuckDB lê ficheiros inteiros; fora da janela descarta-se ao montar o store.`
  );
  return storeCache;
  });
}

function queryKey(options: { periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365; regional?: string; unidade?: string }): string {
  return `${options.periodDays}|${options.regional ?? ""}|${options.unidade ?? ""}`;
}

function eventInGerencialPeriod(
  dtMs: number,
  periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365,
  windowEndForCd: (cd: number) => number,
  cd: number,
  periodMs: number
): boolean {
  if (periodDays === 1) {
    const { startMs, endMs } = yesterdayLocalBoundsMs();
    return dtMs >= startMs && dtMs <= endMs;
  }
  const unitMax = windowEndForCd(cd);
  const minMs = unitMax - periodMs;
  return dtMs >= minMs && dtMs <= unitMax;
}

function computeContext(store: DataStore, options: { periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365; regional?: string; unidade?: string }): ComputedContext {
  const key = queryKey(options);
  const cached = queryCache.get(key);
  if (cached) return cached;

  const unidadesSelecionadas = store.unidades.filter((u) => {
    if (options.regional && options.regional !== "ALL" && u.regional !== options.regional.toUpperCase()) return false;
    if (options.unidade && u.unidade !== options.unidade) return false;
    return true;
  });
  const selectedCd = new Set(unidadesSelecionadas.map((u) => u.cd));
  const periodMs =
    options.periodDays === 1 ? 0 : (options.periodDays - 1) * 24 * 60 * 60 * 1000;
  /**
   * Sem unidade especifica ("Todas"): uma unica ancora de fim = max entre as unidades do recorte e volumes,
   * alinhado ao `rollingWindowForGerencial` (evita totais num periodo e % em outro).
   */
  const unidadeScoped = Boolean(options.unidade);
  let recorteEndMs = store.maxEventMs;
  if (!unidadeScoped && selectedCd.size > 0) {
    let fromUnits = 0;
    for (const cd of selectedCd) {
      const v = store.unitMaxEventMs.get(cd) ?? store.maxEventMs;
      if (v > fromUnits) fromUnits = v;
    }
    const fromVol = maxMsVolumeDataForCds(store, selectedCd);
    recorteEndMs = Math.max(fromUnits > 0 ? fromUnits : store.maxEventMs, fromVol);
  }
  const windowEndForCd = (cd: number): number =>
    unidadeScoped ? (store.unitMaxEventMs.get(cd) ?? store.maxEventMs) : recorteEndMs;

  const unitAggByCd = new Map<number, UnitAggregate>();
  const atendimentosByCd = new Map<number, Set<string>>();
  const pacientesByCd = new Map<number, Set<string>>();
  const pacientesGlobal = new Set<string>();

  const ensureAgg = (cd: number): UnitAggregate => {
    let agg = unitAggByCd.get(cd);
    if (!agg) {
      agg = {
        atendimentos: 0,
        pacientesUnicos: 0,
        somaEsperaMin: 0,
        somaPermanenciaMin: 0,
        somaExamesMin: 0,
        countExames: 0,
        internacoes: 0,
        altas: 0,
        obitos: 0,
        evasoes: 0,
        metaTriagem: { ok: 0, atencao: 0, acima: 0 },
        metaConsulta: { ok: 0, atencao: 0, acima: 0 },
        metaPermanencia: { ok: 0, atencao: 0, acima: 0 }
      };
      unitAggByCd.set(cd, agg);
      atendimentosByCd.set(cd, new Set<string>());
      pacientesByCd.set(cd, new Set<string>());
    }
    return agg;
  };

  for (const event of store.tempos) {
    if (!selectedCd.has(event.cd)) continue;
    if (!eventInGerencialPeriod(event.dtMs, options.periodDays, windowEndForCd, event.cd, periodMs)) continue;

    const agg = ensureAgg(event.cd);
    agg.somaEsperaMin += event.minConsulta;
    agg.somaPermanenciaMin += event.minPermanencia;
    accumulateMetaCounter(agg.metaTriagem, event.minTriagem, store.metasByKey.get("TRIAGEM_MIN"));
    accumulateMetaCounter(agg.metaConsulta, event.minConsulta, store.metasByKey.get("CONSULTA_MIN"));
    accumulateMetaCounter(agg.metaPermanencia, event.minPermanencia, store.metasByKey.get("PERMANENCIA_MIN"));

    if (event.atendimento) atendimentosByCd.get(event.cd)!.add(event.atendimento);
    if (event.pessoa) {
      pacientesByCd.get(event.cd)!.add(event.pessoa);
      pacientesGlobal.add(event.pessoa);
    }
  }

  for (const event of store.internacoes) {
    if (!selectedCd.has(event.cd)) continue;
    if (!eventInGerencialPeriod(event.dtMs, options.periodDays, windowEndForCd, event.cd, periodMs)) continue;
    ensureAgg(event.cd).internacoes += 1;
  }

  for (const event of store.exames) {
    if (!selectedCd.has(event.cd)) continue;
    if (!eventInGerencialPeriod(event.dtMs, options.periodDays, windowEndForCd, event.cd, periodMs)) continue;
    const agg = ensureAgg(event.cd);
    agg.somaExamesMin += event.minutos;
    agg.countExames += 1;
  }

  for (const event of store.altas) {
    if (!selectedCd.has(event.cd)) continue;
    if (!eventInGerencialPeriod(event.dtMs, options.periodDays, windowEndForCd, event.cd, periodMs)) continue;
    const agg = ensureAgg(event.cd);
    agg.altas += event.alta;
    agg.obitos += event.obito;
    agg.evasoes += event.evasao;
  }

  for (const [cd, agg] of unitAggByCd.entries()) {
    agg.atendimentos = atendimentosByCd.get(cd)?.size ?? 0;
    agg.pacientesUnicos = pacientesByCd.get(cd)?.size ?? 0;
  }

  const computed: ComputedContext = {
    unidadesSelecionadas,
    unitAggByCd,
    pacientesUnicosGlobal: pacientesGlobal.size
  };
  queryCache.set(key, computed);
  return computed;
}

function metaStatus(averageMin: number, meta: MetaRule | undefined): { status: "positivo" | "negativo" | "neutro"; deltaMin: number } {
  if (!meta || meta.valueMin <= 0) return { status: "neutro", deltaMin: 0 };
  const deltaMin = Number((meta.valueMin - averageMin).toFixed(1));
  if (averageMin <= meta.valueMin) return { status: "positivo", deltaMin };
  return { status: "negativo", deltaMin };
}

type GerencialKpiPanelEntry = {
  id: string;
  label: string;
  format: "number" | "percent";
  value: number | null;
  metaLine: string;
  metaSituation: "positivo" | "negativo" | "neutro";
  chipLabel: string;
};

function countRowsForCdsInWindow(rows: Array<{ cd: number; dtMs: number }>, cds: Set<number>, m: MonthAgg | null): number {
  if (!m || cds.size === 0) return 0;
  let n = 0;
  for (const r of rows) {
    if (!cds.has(r.cd)) continue;
    if (r.dtMs >= m.startMs && r.dtMs <= m.endMs) n += 1;
  }
  return n;
}

function countTcUsOriginInWindow(rows: TcUsVolumeRow[], cds: Set<number>, origin: "rx_ecg" | "tc_us", m: MonthAgg | null): number {
  if (!m || cds.size === 0) return 0;
  let n = 0;
  for (const r of rows) {
    if (r.origin !== origin) continue;
    if (!cds.has(r.cd)) continue;
    if (r.dtMs >= m.startMs && r.dtMs <= m.endMs) n += 1;
  }
  return n;
}

/** Maior timestamp em tabelas de volume (quando DT_ENTRADA dos tempos nao ancora o max). */
function ymdLocalFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hourLocalFromMs(ms: number): number {
  return new Date(ms).getHours();
}

function buildPsChegadasHeatmapRowsForMonth(
  store: DataStore,
  mes: string,
  regional: string | undefined,
  unidade: string,
  limit: number
): Record<string, unknown>[] {
  if (!/^\d{4}-\d{2}$/.test(mes)) return [];
  const context = computeContext(store, { periodDays: 90, regional, unidade });
  const selectedCd = new Set(context.unidadesSelecionadas.map((u) => u.cd));
  if (selectedCd.size === 0) return [];

  const parts = mes.split("-");
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return [];
  const startMs = new Date(y, mo - 1, 1, 0, 0, 0, 0).getTime();
  const endMs = new Date(y, mo, 0, 23, 59, 59, 999).getTime();

  const cells = new Map<string, Set<string>>();
  for (const event of store.tempos) {
    if (!selectedCd.has(event.cd)) continue;
    if (event.dtMs < startMs || event.dtMs > endMs) continue;
    const atend = event.atendimento.trim();
    if (!atend) continue;
    const dataChegada = ymdLocalFromMs(event.dtMs);
    const hora = hourLocalFromMs(event.dtMs);
    if (hora < 0 || hora > 23) continue;
    const key = `${dataChegada}|${hora}`;
    let set = cells.get(key);
    if (!set) {
      set = new Set();
      cells.set(key, set);
    }
    set.add(atend);
  }

  const rows: Record<string, unknown>[] = [];
  for (const [key, set] of cells) {
    const pipe = key.indexOf("|");
    const dataChegada = key.slice(0, pipe);
    const hora = Number(key.slice(pipe + 1));
    const dayPart = dataChegada.slice(-2);
    const diaMes = Number.parseInt(dayPart, 10);
    rows.push({
      data_chegada: dataChegada,
      dia_mes: Number.isFinite(diaMes) ? diaMes : null,
      hora,
      qtd_atendimentos: set.size
    });
  }
  rows.sort((a, b) => {
    const da = String(a.data_chegada ?? "");
    const db = String(b.data_chegada ?? "");
    if (da !== db) return da.localeCompare(db);
    return Number(a.hora) - Number(b.hora);
  });
  return rows.slice(0, Math.max(1, limit));
}

function maxMsVolumeDataForCds(store: DataStore, cds: Set<number>): number {
  if (cds.size === 0) return 0;
  let max = 0;
  for (const r of store.fluxoVolume) {
    if (cds.has(r.cd) && r.dataMs > max) max = r.dataMs;
  }
  for (const r of store.medicacaoVolume) {
    if (cds.has(r.cd) && r.dtMs > max) max = r.dtMs;
  }
  for (const r of store.laboratorioVolume) {
    if (cds.has(r.cd) && r.dtMs > max) max = r.dtMs;
  }
  for (const r of store.tcUsVolume) {
    if (cds.has(r.cd) && r.dtMs > max) max = r.dtMs;
  }
  for (const r of store.reavaliacaoVolume) {
    if (cds.has(r.cd) && r.dtMs > max) max = r.dtMs;
  }
  for (const r of store.viasMedicamentos) {
    if (cds.has(r.cd) && r.dataMs > max) max = r.dataMs;
  }
  return max;
}

function buildGerencialKpisTopoRow(
  store: DataStore,
  context: ComputedContext,
  periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365
): Record<string, unknown> {
  const cds = new Set(context.unidadesSelecionadas.map((u) => u.cd));
  const anchorFallback = maxMsVolumeDataForCds(store, cds);
  const m =
    cds.size === 0
      ? null
      : rollingWindowForGerencial(
          store.unitMaxEventMs,
          store.maxEventMs,
          cds,
          periodDays,
          anchorFallback > 0 ? anchorFallback : undefined
        );

  let atend = 0;
  let altas = 0;
  let obitos = 0;
  let intern = 0;
  let evasoes = 0;
  let somaEspera = 0;
  let somaPermanencia = 0;
  let somaExames = 0;
  let qtdExames = 0;
  let pacientesAtivos = 0;
  let metasAcima = 0;
  let metasAtencao = 0;
  let metasOk = 0;
  for (const u of context.unidadesSelecionadas) {
    const a = context.unitAggByCd.get(u.cd);
    if (a) {
      atend += a.atendimentos;
      altas += a.altas;
      obitos += a.obitos;
      intern += a.internacoes;
      evasoes += a.evasoes;
      somaEspera += a.somaEsperaMin;
      somaPermanencia += a.somaPermanenciaMin;
      somaExames += a.somaExamesMin;
      qtdExames += a.countExames;
    }
    const snap = store.snapshotByCd.get(u.cd);
    if (snap) {
      pacientesAtivos += snap.ativos;
      metasAcima += snap.metasAcimaTotal;
      metasAtencao += snap.metasAtencaoTotal;
      metasOk += snap.metasOkTotal;
    }
  }

  const mediaEspera = avg(somaEspera, atend);
  const mediaPermanencia = avg(somaPermanencia, atend);
  const mediaExames = avg(somaExames, qtdExames);
  const ruleConsulta = store.metasByKey.get("CONSULTA_MIN");
  const rulePermanencia = store.metasByKey.get("PERMANENCIA_MIN");
  const ruleExames = store.metasByKey.get("TC_US_MIN") ?? store.metasByKey.get("RX_ECG_MIN");
  const metaConsulta = metaStatus(mediaEspera, ruleConsulta);
  const metaPermanencia = metaStatus(mediaPermanencia, rulePermanencia);
  const metaExames = metaStatus(mediaExames, ruleExames);
  const metasPositivas = [metaConsulta, metaPermanencia, metaExames].filter((x) => x.status === "positivo").length;
  const metasNegativas = [metaConsulta, metaPermanencia, metaExames].filter((x) => x.status === "negativo").length;
  const metasTotal = metasOk + metasAcima + metasAtencao;

  const baseCounts = {
    kind: "gerencial-kpis-topo",
    total_unidades: context.unidadesSelecionadas.length,
    atendimentos_hoje: atend,
    internacoes_total: intern,
    altas_total: altas,
    obitos_total: obitos,
    evasoes_total: evasoes,
    pacientes_ativos: pacientesAtivos,
    pacientes_unicos_periodo: context.pacientesUnicosGlobal,
    tempo_medio_consulta_min: Number(mediaEspera.toFixed(1)),
    tempo_medio_exames_min: Number(mediaExames.toFixed(1)),
    tempo_medio_alta_min: Number(mediaPermanencia.toFixed(1)),
    metas_acima_total: metasAcima,
    metas_atencao_total: metasAtencao,
    metas_ok_total: metasOk,
    metas_conformidade_pct: metasTotal > 0 ? Number(((metasOk * 100) / metasTotal).toFixed(1)) : 0,
    metas_positivas: metasPositivas,
    metas_negativas: metasNegativas,
    meta_consulta_min: ruleConsulta?.valueMin ?? null,
    meta_exames_min: ruleExames?.valueMin ?? null,
    meta_permanencia_min: rulePermanencia?.valueMin ?? null,
    meta_consulta_status: metaConsulta.status,
    meta_consulta_delta_min: metaConsulta.deltaMin,
    meta_exames_status: metaExames.status,
    meta_exames_delta_min: metaExames.deltaMin,
    meta_permanencia_status: metaPermanencia.status,
    meta_permanencia_delta_min: metaPermanencia.deltaMin
  };

  let conversao: number | null = null;
  let totalExamesLab = 0;
  let totalRxEcg = 0;
  let totalTcUsExames = 0;
  let totalPrescricoesMed = 0;
  let totalReavaliacoes = 0;

  if (m !== null && cds.size > 0) {
    const ctxInd = {
      flux: store.fluxoVolume,
      med: store.medicacaoVolume,
      lab: store.laboratorioVolume,
      tc: store.tcUsVolume,
      reav: store.reavaliacaoVolume,
      vias: store.viasMedicamentos,
      cds,
      m
    };
    conversao = computeIndicator("conversao", ctxInd);
  }
  if (cds.size > 0) {
    totalExamesLab = countRowsForCdsInWindow(store.laboratorioVolume, cds, m);
    totalRxEcg = countTcUsOriginInWindow(store.tcUsVolume, cds, "rx_ecg", m);
    totalTcUsExames = countTcUsOriginInWindow(store.tcUsVolume, cds, "tc_us", m);
    totalPrescricoesMed = countRowsForCdsInWindow(store.medicacaoVolume, cds, m);
    totalReavaliacoes = countRowsForCdsInWindow(store.reavaliacaoVolume, cds, m);
  }

  const semUnidades = context.unidadesSelecionadas.length === 0;
  const metaLineAtend = semUnidades
    ? "Nenhuma unidade no filtro — ajuste regional ou unidade."
    : "Atendimentos unicos no periodo (NR_ATENDIMENTO distinto)";
  const metaLineVol =
    "Volumes (tbl_tempos_*) no mesmo recorte temporal dos atendimentos — contagem de linhas no periodo selecionado.";

  /** Seis cards principais alinhados ao painel institucional (volumes por CSV). */
  const kpi_panel: GerencialKpiPanelEntry[] = [
    {
      id: "total_atendimentos",
      label: "Total de atendimentos",
      format: "number",
      value: atend,
      metaLine: metaLineAtend,
      metaSituation: "neutro",
      chipLabel: "Volume"
    },
    {
      id: "total_exames_laboratorio",
      label: "Total de exames laborator.",
      format: "number",
      value: totalExamesLab,
      metaLine: metaLineVol,
      metaSituation: "neutro",
      chipLabel: "Volume"
    },
    {
      id: "total_rx_ecg",
      label: "Total de RX/ECG",
      format: "number",
      value: totalRxEcg,
      metaLine: metaLineVol,
      metaSituation: "neutro",
      chipLabel: "Volume"
    },
    {
      id: "total_tc_us",
      label: "Total de TC/US",
      format: "number",
      value: totalTcUsExames,
      metaLine: metaLineVol,
      metaSituation: "neutro",
      chipLabel: "Volume"
    },
    {
      id: "total_prescricoes_medicacao",
      label: "Total de prescric. medicação",
      format: "number",
      value: totalPrescricoesMed,
      metaLine: metaLineVol,
      metaSituation: "neutro",
      chipLabel: "Volume"
    },
    {
      id: "total_reavaliacoes",
      label: "Total de reavaliações",
      format: "number",
      value: totalReavaliacoes,
      metaLine: metaLineVol,
      metaSituation: "neutro",
      chipLabel: "Volume"
    },
    {
      id: "altas",
      label: "Altas",
      format: "number",
      value: altas,
      metaLine: "Desfechos de alta no periodo.",
      metaSituation: "neutro",
      chipLabel: "Assistencial"
    },
    {
      id: "obitos",
      label: "Óbitos",
      format: "number",
      value: obitos,
      metaLine: "Óbitos registrados no período.",
      metaSituation: "neutro",
      chipLabel: "Assistencial"
    },
    {
      id: "evasoes",
      label: "Evasões",
      format: "number",
      value: evasoes,
      metaLine: "Evasões registradas no período.",
      metaSituation: "neutro",
      chipLabel: "Assistencial"
    }
  ];

  const taxaConversaoPct =
    conversao !== null && Number.isFinite(conversao)
      ? Number((conversao * 100).toFixed(1))
      : atend > 0
        ? Number(((intern * 100) / atend).toFixed(1))
        : 0;

  return {
    ...baseCounts,
    taxa_conversao_internacao_pct: taxaConversaoPct,
    total_exames_laboratorio: totalExamesLab,
    total_rx_ecg: totalRxEcg,
    total_tc_us: totalTcUsExames,
    total_prescricoes_medicacao: totalPrescricoesMed,
    total_reavaliacoes: totalReavaliacoes,
    kpi_panel
  };
}

function sqlQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function toNum(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toInt(value: unknown): number {
  return Math.trunc(toNum(value));
}

function toText(value: unknown): string {
  return String(value ?? "");
}

function buildUnitsFilterSql(options: { regional?: string; unidade?: string }): string {
  const clauses = ["lower(coalesce(ps,'')) IN ('true','1','t')"];
  if (options.regional) clauses.push(`upper(uf) = upper(${sqlQuote(options.regional)})`);
  if (options.unidade) clauses.push(`nome = ${sqlQuote(options.unidade)}`);
  return clauses.join(" AND ");
}

async function loadMetaRulesFromDuckDb(): Promise<Map<string, MetaRule>> {
  const rows = await queryDuckDb(`
    SELECT upper(chave) AS chave, try_cast(valor_min AS DOUBLE) AS value_min, try_cast(alerta_min AS DOUBLE) AS alert_min
    FROM meta_tempos
    WHERE upper(chave) IN ('CONSULTA_MIN', 'PERMANENCIA_MIN', 'TC_US_MIN', 'RX_ECG_MIN')
  `);
  const out = new Map<string, MetaRule>();
  for (const row of rows) {
    const key = toText(row.chave).toUpperCase();
    if (!key) continue;
    out.set(key, { valueMin: toNum(row.value_min), alertMin: toNum(row.alert_min) });
  }
  return out;
}

/** Sobrescreve totais de volume e entradas correspondentes em `kpi_panel` (mesmos ids do backend). */
function patchGerencialTopoVolumeFields(
  row: Record<string, unknown>,
  vol: { lab: number; rx: number; tc: number; med: number; reav: number }
): void {
  row.total_exames_laboratorio = vol.lab;
  row.total_rx_ecg = vol.rx;
  row.total_tc_us = vol.tc;
  row.total_prescricoes_medicacao = vol.med;
  row.total_reavaliacoes = vol.reav;
  const panel = row.kpi_panel;
  if (!Array.isArray(panel)) return;
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of panel) {
    if (item != null && typeof item === "object" && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const id = String(o.id ?? "").trim();
      if (id) byId.set(id, o);
    }
  }
  const setVal = (id: string, v: number): void => {
    const o = byId.get(id);
    if (o) o.value = v;
  };
  setVal("total_exames_laboratorio", vol.lab);
  setVal("total_rx_ecg", vol.rx);
  setVal("total_tc_us", vol.tc);
  setVal("total_prescricoes_medicacao", vol.med);
  setVal("total_reavaliacoes", vol.reav);
}

/** Alinha contagens DuckDB ao rollingWindow / ontem usados em computeContext (timestamps Unix em segundos). */
function duckVolumeTimeWhere(dateExpr: string, m: MonthAgg | null): string {
  if (!m) return "1=0";
  const s = m.startMs / 1000;
  const e = m.endMs / 1000;
  return `(${dateExpr}) IS NOT NULL AND (${dateExpr}) >= to_timestamp(${s}) AND (${dateExpr}) <= to_timestamp(${e})`;
}

/**
 * Com DATA_GATEWAY=duckdb: contagens dos CSV grandes via SQL (read_csv_auto nas views),
 * pois o parser linha-a-linha em memoria pode falhar ou esvaziar colunas em arquivos muito grandes.
 * Metas, snapshot e atendimentos no periodo continuam a partir do agregador CSV-memory.
 */
async function buildGerencialKpisTopoDuckDbPayload(options: {
  limit: number;
  periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;
  regional?: string;
  unidade?: string;
}): Promise<DashboardQueryPayload> {
  const store = await ensureStore(options.periodDays);
  const context = computeContext(store, options);
  const row = buildGerencialKpisTopoRow(store, context, options.periodDays) as Record<string, unknown>;
  const unitsFilterSql = buildUnitsFilterSql(options);
  const cds = new Set(context.unidadesSelecionadas.map((u) => u.cd));
  const anchorFb = maxMsVolumeDataForCds(store, cds);
  const mVol =
    cds.size === 0
      ? null
      : rollingWindowForGerencial(
          store.unitMaxEventMs,
          store.maxEventMs,
          cds,
          options.periodDays,
          anchorFb > 0 ? anchorFb : undefined
        );

  const labDt = `coalesce(
    try_cast(replace(l.dt_exame, ' ', 'T') AS TIMESTAMP),
    try_cast(replace(l.dt_solicitacao, ' ', 'T') AS TIMESTAMP),
    try_cast(replace(l.data, ' ', 'T') AS TIMESTAMP)
  )`;
  const rxDt = `coalesce(
    try_cast(replace(r.dt_exame, ' ', 'T') AS TIMESTAMP),
    try_cast(replace(r.dt_solicitacao, ' ', 'T') AS TIMESTAMP)
  )`;
  const tcDt = `coalesce(
    try_cast(replace(t.dt_exame, ' ', 'T') AS TIMESTAMP),
    try_cast(replace(t.dt_realizado, ' ', 'T') AS TIMESTAMP)
  )`;
  const medDt = `coalesce(
    try_cast(replace(m.dt_administracao, ' ', 'T') AS TIMESTAMP),
    try_cast(replace(m.dt_prescricao, ' ', 'T') AS TIMESTAMP),
    try_cast(replace(m.data, ' ', 'T') AS TIMESTAMP)
  )`;
  const reavDt = `try_cast(replace(v.data, ' ', 'T') AS TIMESTAMP)`;

  const wLab = duckVolumeTimeWhere(labDt, mVol);
  const wRx = duckVolumeTimeWhere(rxDt, mVol);
  const wTc = duckVolumeTimeWhere(tcDt, mVol);
  const wMed = duckVolumeTimeWhere(medDt, mVol);
  const wReav = duckVolumeTimeWhere(reavDt, mVol);

  const sql = `
WITH unidades AS (
  SELECT try_cast(cd_estabelecimento AS BIGINT) AS cd
  FROM tbl_unidades
  WHERE ${unitsFilterSql}
)
SELECT
  coalesce((
    SELECT count(*)::BIGINT
    FROM tbl_tempos_laboratorio AS l
    WHERE try_cast(l.cd_estabelecimento AS BIGINT) IN (SELECT u.cd FROM unidades AS u)
      AND ${wLab}
  ), 0) AS total_exames_laboratorio,
  coalesce((
    SELECT count(*)::BIGINT
    FROM tbl_tempos_rx_e_ecg AS r
    WHERE try_cast(r.cd_estabelecimento AS BIGINT) IN (SELECT u.cd FROM unidades AS u)
      AND ${wRx}
  ), 0) AS total_rx_ecg,
  coalesce((
    SELECT count(*)::BIGINT
    FROM tbl_tempos_tc_e_us AS t
    WHERE try_cast(t.cd_estabelecimento AS BIGINT) IN (SELECT u.cd FROM unidades AS u)
      AND ${wTc}
  ), 0) AS total_tc_us,
  coalesce((
    SELECT count(*)::BIGINT
    FROM tbl_tempos_medicacao AS m
    WHERE try_cast(m.cd_estabelecimento AS BIGINT) IN (SELECT u.cd FROM unidades AS u)
      AND ${wMed}
  ), 0) AS total_prescricoes_medicacao,
  coalesce((
    SELECT count(*)::BIGINT
    FROM tbl_tempos_reavaliacao AS v
    WHERE try_cast(v.cd_estabelecimento AS BIGINT) IN (SELECT u.cd FROM unidades AS u)
      AND ${wReav}
  ), 0) AS total_reavaliacoes
`;
  try {
    const hits = await queryDuckDb(sql);
    const hit = hits[0];
    if (hit) {
      patchGerencialTopoVolumeFields(row, {
        lab: toInt(hit.total_exames_laboratorio),
        rx: toInt(hit.total_rx_ecg),
        tc: toInt(hit.total_tc_us),
        med: toInt(hit.total_prescricoes_medicacao),
        reav: toInt(hit.total_reavaliacoes)
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[duckdb] contagens de volume para gerencial-kpis-topo falharam (mantendo so CSV-memory): ${msg}`);
  }
  return {
    ok: true,
    slug: "gerencial-kpis-topo",
    sourceView: "duckdb:contagens_volume + csv_memory:metas_snapshot_tempos",
    appliedFilters: {
      periodDays: options.periodDays,
      regional: options.regional ?? null,
      unidade: options.unidade ?? null
    },
    rowCount: 1,
    rows: [row]
  };
}

async function getDashboardPayloadFromDuckDb(
  slug: string,
  options: { limit: number; periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365; regional?: string; unidade?: string }
): Promise<DashboardQueryPayload | null> {
  if (!["gerencial-filtros", "gerencial-kpis-topo", "gerencial-unidades-ranking"].includes(slug)) {
    return null;
  }

  const safeLimit = Math.max(1, Math.min(options.limit || 200, 5000));
  const unitsFilterSql = buildUnitsFilterSql(options);
  const days = Math.max(1, options.periodDays);
  const isYesterday = options.periodDays === 1;
  const duckDtInPeriod = (col: string): string =>
    isYesterday
      ? `${col} IS NOT NULL AND cast(${col} AS DATE) = cast(CURRENT_DATE AS DATE) - INTERVAL 1 DAY`
      : `${col} IS NOT NULL AND (max_dt IS NULL OR ${col} BETWEEN (max_dt - INTERVAL '${days - 1} DAY') AND max_dt)`;

  if (slug === "gerencial-filtros") {
    const rows = await queryDuckDb(`
      WITH unidades AS (
        SELECT
          try_cast(cd_estabelecimento AS BIGINT) AS cd,
          nome AS unidade,
          upper(uf) AS regional
        FROM tbl_unidades
        WHERE ${unitsFilterSql}
      )
      SELECT regional, unidade
      FROM unidades
      WHERE cd IS NOT NULL AND unidade IS NOT NULL AND regional IS NOT NULL
      ORDER BY regional, unidade
      LIMIT ${safeLimit}
    `);

    return {
      ok: true,
      slug,
      sourceView: "duckdb:tbl_unidades",
      appliedFilters: {
        periodDays: options.periodDays,
        regional: options.regional ?? null,
        unidade: options.unidade ?? null
      },
      rowCount: rows.length,
      rows
    };
  }

  /** KPIs do topo: base em CSV-memory; contagens dos 5 volumes grandes via SQL no DuckDB (read_csv_auto). */
  if (slug === "gerencial-kpis-topo") {
    return await buildGerencialKpisTopoDuckDbPayload(options);
  }

  const [rankingRows, metaRules] = await Promise.all([
    queryDuckDb(`
      WITH unidades AS (
        SELECT
          try_cast(cd_estabelecimento AS BIGINT) AS cd,
          nome AS unidade,
          upper(uf) AS regional
        FROM tbl_unidades
        WHERE ${unitsFilterSql}
      ),
      snapshot AS (
        SELECT
          try_cast("CD_ESTABELECIMENTO" AS BIGINT) AS cd,
          try_cast(ativos AS DOUBLE) AS ativos,
          try_cast(transferencia_total AS DOUBLE) AS transferencia,
          try_cast(ocupacao_internacao_pct AS DOUBLE) AS ocupacao_internacao_pct
        FROM ww_painel_ps_base
      ),
      tempos_base AS (
        SELECT
          try_cast(cd_estabelecimento AS BIGINT) AS cd,
          nr_atendimento,
          try_cast(replace(dt_entrada, ' ', 'T') AS TIMESTAMP) AS dt_ref,
          try_cast(min_entrada_x_consulta AS DOUBLE) AS min_consulta,
          try_cast(min_entrada_x_alta AS DOUBLE) AS min_alta
        FROM tbl_tempos_entrada_consulta_saida
        WHERE try_cast(cd_estabelecimento AS BIGINT) IN (SELECT cd FROM unidades)
      ),
      tempos_window AS (SELECT max(dt_ref) AS max_dt FROM tempos_base),
      tempos AS (
        SELECT *
        FROM tempos_base, tempos_window
        WHERE ${duckDtInPeriod("dt_ref")}
      ),
      tempos_agg AS (
        SELECT
          cd,
          count(DISTINCT nr_atendimento) AS atendimentos_hoje,
          avg(min_consulta) AS tempo_medio_espera_min,
          avg(min_alta) AS tempo_medio_alta_min
        FROM tempos
        GROUP BY cd
      ),
      intern_base AS (
        SELECT
          try_cast(cd_estab_urg AS BIGINT) AS cd,
          try_cast(replace(dt_entrada, ' ', 'T') AS TIMESTAMP) AS dt_ref
        FROM tbl_intern_conversoes
        WHERE try_cast(cd_estab_urg AS BIGINT) IN (SELECT cd FROM unidades)
      ),
      intern_window AS (SELECT max(dt_ref) AS max_dt FROM intern_base),
      intern_agg AS (
        SELECT cd, count(*) AS internacoes
        FROM intern_base, intern_window
        WHERE ${duckDtInPeriod("dt_ref")}
        GROUP BY cd
      ),
      exames_base AS (
        SELECT
          try_cast(cd_estabelecimento AS BIGINT) AS cd,
          try_cast(replace(dt_exame, ' ', 'T') AS TIMESTAMP) AS dt_ref,
          try_cast(minutos AS DOUBLE) AS minutos
        FROM tbl_tempos_rx_e_ecg
        WHERE try_cast(cd_estabelecimento AS BIGINT) IN (SELECT cd FROM unidades)
        UNION ALL
        SELECT
          try_cast(cd_estabelecimento AS BIGINT) AS cd,
          coalesce(
            try_cast(replace(dt_exame, ' ', 'T') AS TIMESTAMP),
            try_cast(replace(dt_realizado, ' ', 'T') AS TIMESTAMP)
          ) AS dt_ref,
          try_cast(minutos AS DOUBLE) AS minutos
        FROM tbl_tempos_tc_e_us
        WHERE try_cast(cd_estabelecimento AS BIGINT) IN (SELECT cd FROM unidades)
      ),
      exames_window AS (SELECT max(dt_ref) AS max_dt FROM exames_base),
      exames_agg AS (
        SELECT cd, avg(minutos) AS tempo_medio_exames_min
        FROM exames_base, exames_window
        WHERE ${duckDtInPeriod("dt_ref")}
        GROUP BY cd
      ),
      altas_base AS (
        SELECT
          try_cast(cd_estabelecimento AS BIGINT) AS cd,
          coalesce(
            try_cast(replace(dt_alta, ' ', 'T') AS TIMESTAMP),
            try_cast(replace(dt_entrada, ' ', 'T') AS TIMESTAMP)
          ) AS dt_ref,
          lower(coalesce(tipo_desfecho, '')) AS tipo,
          lower(coalesce(ds_motivo_alta, '')) AS motivo,
          try_cast(qtd_obito AS DOUBLE) AS qtd_obito
        FROM tbl_altas_ps
        WHERE try_cast(cd_estabelecimento AS BIGINT) IN (SELECT cd FROM unidades)
      ),
      altas_window AS (SELECT max(dt_ref) AS max_dt FROM altas_base),
      altas_agg AS (
        SELECT
          cd,
          sum(CASE WHEN tipo LIKE '%alta%' OR motivo LIKE '%alta%' THEN 1 ELSE 0 END) AS altas_total,
          sum(
            CASE
              WHEN coalesce(qtd_obito, 0) > 0
                OR tipo LIKE '%obito%'
                OR motivo LIKE '%obito%'
                OR tipo LIKE '%óbito%'
                OR motivo LIKE '%óbito%'
              THEN 1 ELSE 0
            END
          ) AS obitos_total,
          sum(CASE WHEN tipo LIKE '%evas%' OR tipo LIKE '%evad%' OR motivo LIKE '%evas%' OR motivo LIKE '%evad%' THEN 1 ELSE 0 END) AS evasoes_total
        FROM altas_base, altas_window
        WHERE ${duckDtInPeriod("dt_ref")}
        GROUP BY cd
      )
      SELECT
        u.unidade,
        u.regional,
        coalesce(t.atendimentos_hoje, 0) AS atendimentos_hoje,
        coalesce(s.ativos, 0) AS pacientes_ativos,
        coalesce(i.internacoes, 0) AS internacoes,
        coalesce(a.altas_total, 0) AS altas_total,
        coalesce(a.obitos_total, 0) AS obitos_total,
        coalesce(a.evasoes_total, 0) AS evasoes_total,
        coalesce(t.tempo_medio_espera_min, 0) AS tempo_medio_espera_min,
        coalesce(e.tempo_medio_exames_min, 0) AS tempo_medio_exames_min,
        coalesce(t.tempo_medio_alta_min, 0) AS tempo_medio_alta_min,
        coalesce(s.transferencia, 0) AS transferencias,
        coalesce(s.ocupacao_internacao_pct, 0) AS ocupacao_internacao_pct
      FROM unidades u
      LEFT JOIN tempos_agg t ON t.cd = u.cd
      LEFT JOIN intern_agg i ON i.cd = u.cd
      LEFT JOIN exames_agg e ON e.cd = u.cd
      LEFT JOIN altas_agg a ON a.cd = u.cd
      LEFT JOIN snapshot s ON s.cd = u.cd
    `),
    loadMetaRulesFromDuckDb()
  ]);

  const metaConsulta = metaRules.get("CONSULTA_MIN");
  const metaPermanencia = metaRules.get("PERMANENCIA_MIN");
  const metaExames = metaRules.get("TC_US_MIN") ?? metaRules.get("RX_ECG_MIN");

  const rows = rankingRows
    .map((row) => {
      const atendimentos = toNum(row.atendimentos_hoje);
      const internacoes = toNum(row.internacoes);
      const obitos = toNum(row.obitos_total);
      const ocupacao = toNum(row.ocupacao_internacao_pct);
      const mediaEspera = toNum(row.tempo_medio_espera_min);
      const mediaExames = toNum(row.tempo_medio_exames_min);
      const mediaAlta = toNum(row.tempo_medio_alta_min);

      const m1 = metaStatus(mediaEspera, metaConsulta);
      const m2 = metaStatus(mediaExames, metaExames);
      const m3 = metaStatus(mediaAlta, metaPermanencia);
      const metasPos = [m1, m2, m3].filter((m) => m.status === "positivo").length;
      const metasNeg = [m1, m2, m3].filter((m) => m.status === "negativo").length;
      const score = Math.max(0, 100 + metasPos * 6 - metasNeg * 8 - Math.max(ocupacao - 85, 0) * 0.6 - obitos * 4);

      return {
        unidade: toText(row.unidade),
        atendimentos_hoje: toInt(row.atendimentos_hoje),
        pacientes_ativos: toInt(row.pacientes_ativos),
        internacoes: toInt(row.internacoes),
        altas_total: toInt(row.altas_total),
        obitos_total: toInt(row.obitos_total),
        evasoes_total: toInt(row.evasoes_total),
        taxa_conversao_internacao_pct: atendimentos > 0 ? Number(((internacoes * 100) / atendimentos).toFixed(1)) : 0,
        tempo_medio_espera_min: Number(mediaEspera.toFixed(1)),
        tempo_medio_exames_min: Number(mediaExames.toFixed(1)),
        tempo_medio_alta_min: Number(mediaAlta.toFixed(1)),
        transferencias: toInt(row.transferencias),
        ocupacao_internacao_pct: Number(ocupacao.toFixed(1)),
        metas_positivas: metasPos,
        metas_negativas: metasNeg,
        meta_status: metasNeg > metasPos ? "negativo" : "positivo",
        meta_consulta_status: m1.status,
        meta_consulta_delta_min: m1.deltaMin,
        meta_exames_status: m2.status,
        meta_exames_delta_min: m2.deltaMin,
        meta_permanencia_status: m3.status,
        meta_permanencia_delta_min: m3.deltaMin,
        metas_detalhadas: [] as Array<Record<string, unknown>>,
        score_operacional: Number(score.toFixed(1))
      };
    })
    .sort((a, b) => b.score_operacional - a.score_operacional || b.atendimentos_hoje - a.atendimentos_hoje)
    .slice(0, safeLimit);

  return {
    ok: true,
    slug,
    sourceView: "duckdb:gerencial_ranking (ww_painel_ps_base + fatos periodo)",
    appliedFilters: {
      periodDays: options.periodDays,
      regional: options.regional ?? null,
      unidade: options.unidade ?? null
    },
    rowCount: rows.length,
    rows
  };
}

export async function getDashboardCatalogPayload(): Promise<DashboardCatalogPayload> {
  const slugs = listDashboardQueryCatalog().map((entry) => ({
    slug: entry.slug,
    description: entry.description,
    sourceView: entry.sourceView
  }));
  return {
    ok: true,
    count: slugs.length,
    slugs
  };
}

export async function getDashboardQueryPayload(
  slug: string,
  options: {
    limit: number;
    periodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;
    regional?: string;
    unidade?: string;
    indicadorKey?: string;
    mes?: string;
    semana?: string;
  }
): Promise<DashboardQueryPayload> {
  if (env.dataGateway === "duckdb") {
    try {
      const payload = await getDashboardPayloadFromDuckDb(slug, options);
      if (payload) return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha desconhecida";
      console.warn(`[duckdb] fallback csv-memory para slug "${slug}": ${message}`);
      // fallback para csv-memory sem quebrar endpoint
    }
  }

  const store = await ensureStore(options.periodDays);
  const context = computeContext(store, options);
  const safeLimit = Math.max(1, Math.min(options.limit || 200, 5000));
  let rows: Record<string, unknown>[] = [];
  let sourceView = "csv_memory";

  if (slug === "gerencial-filtros") {
    sourceView = "dataset:tbl_unidades";
    rows = context.unidadesSelecionadas
      .map((u) => ({ regional: u.regional, unidade: u.unidade }))
      .sort((a, b) => `${a.regional}${a.unidade}`.localeCompare(`${b.regional}${b.unidade}`))
      .slice(0, safeLimit);
  } else if (slug === "gerencial-kpis-topo") {
    sourceView =
      "csv: kpi_panel = 6 volumes principais (atend, lab, rx_ecg, tc_us, presc med, reav) + base metas/snapshot";
    rows = [buildGerencialKpisTopoRow(store, context, options.periodDays)];
  } else if (slug === "gerencial-unidades-ranking") {
    sourceView =
      "dataset: fluxo + internacoes + altas + rx_ecg + tc_us + metas";
    const metaConsulta = store.metasByKey.get("CONSULTA_MIN");
    const metaPermanencia = store.metasByKey.get("PERMANENCIA_MIN");
    const metaExames = store.metasByKey.get("TC_US_MIN") ?? store.metasByKey.get("RX_ECG_MIN");

    rows = context.unidadesSelecionadas
      .map((u) => {
        const agg = context.unitAggByCd.get(u.cd);
        const snap = store.snapshotByCd.get(u.cd);
        const atendimentos = agg?.atendimentos ?? 0;
        const internacoes = agg?.internacoes ?? 0;
        const altas = agg?.altas ?? 0;
        const obitos = agg?.obitos ?? 0;
        const mediaEspera = avg(agg?.somaEsperaMin ?? 0, atendimentos);
        const mediaPermanencia = avg(agg?.somaPermanenciaMin ?? 0, atendimentos);
        const mediaExames = avg(agg?.somaExamesMin ?? 0, agg?.countExames ?? 0);
        const conversao = atendimentos > 0 ? (internacoes * 100) / atendimentos : 0;

        const m1 = metaStatus(mediaEspera, metaConsulta);
        const m2 = metaStatus(mediaExames, metaExames);
        const m3 = metaStatus(mediaPermanencia, metaPermanencia);
        const metasPos = [m1, m2, m3].filter((m) => m.status === "positivo").length;
        const metasNeg = [m1, m2, m3].filter((m) => m.status === "negativo").length;

        const ocupacao = snap?.ocupacaoInternacaoPct ?? 0;
        const score = Math.max(0, 100 + metasPos * 6 - metasNeg * 8 - Math.max(ocupacao - 85, 0) * 0.6 - obitos * 4);
        const metasDetalhadas = (snap?.metasDetalhadas ?? META_DEFINITIONS.map((meta) => ({
          key: meta.key,
          label: meta.label,
          ok: 0,
          atencao: 0,
          acima: 0
        }))).map((meta) => {
          const overrideFromTempo =
            meta.key === "triagem"
              ? agg?.metaTriagem
              : meta.key === "consulta"
                ? agg?.metaConsulta
                : meta.key === "permanencia"
                  ? agg?.metaPermanencia
                  : undefined;
          const okValue = overrideFromTempo ? overrideFromTempo.ok : meta.ok;
          const atencaoValue = overrideFromTempo ? overrideFromTempo.atencao : meta.atencao;
          const acimaValue = overrideFromTempo ? overrideFromTempo.acima : meta.acima;
          const positivo = meta.ok;
          const negativo = meta.atencao + meta.acima;
          const positivoReal = okValue;
          const negativoReal = atencaoValue + acimaValue;
          const total = positivoReal + negativoReal;
          const positivoPct = total > 0 ? Number(((positivoReal * 100) / total).toFixed(1)) : null;
          const negativoPct = total > 0 ? Number(((negativoReal * 100) / total).toFixed(1)) : null;
          return {
            key: meta.key,
            label: meta.label,
            ok: okValue,
            atencao: atencaoValue,
            acima: acimaValue,
            positivo: positivoReal,
            negativo: negativoReal,
            total,
            positivo_pct: positivoPct,
            negativo_pct: negativoPct,
            status: total === 0 ? "sem_dado" : positivoReal >= negativoReal ? "positivo" : "negativo"
          };
        });

        return {
          unidade: u.unidade,
          atendimentos_hoje: atendimentos,
          pacientes_ativos: snap?.ativos ?? 0,
          internacoes,
          altas_total: altas,
          obitos_total: obitos,
          taxa_conversao_internacao_pct: Number(conversao.toFixed(1)),
          tempo_medio_espera_min: Number(mediaEspera.toFixed(1)),
          tempo_medio_exames_min: Number(mediaExames.toFixed(1)),
          tempo_medio_alta_min: Number(mediaPermanencia.toFixed(1)),
          transferencias: snap?.transferencia ?? 0,
          ocupacao_internacao_pct: Number(ocupacao.toFixed(1)),
          metas_positivas: metasPos,
          metas_negativas: metasNeg,
          meta_status: metasNeg > metasPos ? "negativo" : "positivo",
          meta_consulta_status: m1.status,
          meta_consulta_delta_min: m1.deltaMin,
          meta_exames_status: m2.status,
          meta_exames_delta_min: m2.deltaMin,
          meta_permanencia_status: m3.status,
          meta_permanencia_delta_min: m3.deltaMin,
          metas_detalhadas: metasDetalhadas,
          score_operacional: Number(score.toFixed(1))
        };
      })
      .sort((a, b) => b.score_operacional - a.score_operacional || b.atendimentos_hoje - a.atendimentos_hoje)
      .slice(0, safeLimit);
  } else if (slug === "gerencial-metas-por-volumes") {
    sourceView =
      "tbl_tempos_entrada_consulta_saida + tbl_tempos_medicacao + tbl_tempos_laboratorio + tbl_tempos_tc_e_us + tbl_tempos_reavaliacao + tbl_vias_medicamentos";
    const cds = new Set(context.unidadesSelecionadas.map((u) => u.cd));
    const selectedYearMonth = parseYearMonthFilter(options.mes);
    const selectedWeek = parseWeekSliceFilter(options.semana);
    const matrix = buildMetasPorVolumesMatrix({
      unidadesCds: cds,
      flux: store.fluxoVolume,
      med: store.medicacaoVolume,
      lab: store.laboratorioVolume,
      tc: store.tcUsVolume,
      reav: store.reavaliacaoVolume,
      vias: store.viasMedicamentos,
      selectedYearMonth,
      selectedWeek
    });
    rows = [
      {
        kind: "metas-por-volumes",
        availableMonths: matrix.availableMonths,
        months: matrix.months,
        anchorYearMonth: matrix.anchorYearMonth,
        indicators: matrix.indicators,
        metaDefinitions: VOLUME_META_DEFINITIONS
      }
    ];
  } else if (slug === "gerencial-metas-por-volumes-drill") {
    sourceView =
      "tbl_tempos_entrada_consulta_saida + tbl_tempos_medicacao + tbl_tempos_laboratorio + tbl_tempos_tc_e_us + tbl_tempos_reavaliacao + tbl_vias_medicamentos";
    const indicador = (options.indicadorKey ?? "").trim();
    if (!indicador) {
      throw new Error('Parametro "indicador" e obrigatorio para o drill (ex.: conversao).');
    }
    const selectedYearMonth = parseYearMonthFilter(options.mes);
    const selectedWeek = parseWeekSliceFilter(options.semana);
    const cds = new Set(context.unidadesSelecionadas.map((u) => u.cd));
    const drillInput = {
      unidadesCds: cds,
      flux: store.fluxoVolume,
      med: store.medicacaoVolume,
      lab: store.laboratorioVolume,
      tc: store.tcUsVolume,
      reav: store.reavaliacaoVolume,
      vias: store.viasMedicamentos,
      selectedYearMonth,
      selectedWeek
    };
    const drillRows = buildMetasPorVolumesDrill(drillInput, indicador, context.unidadesSelecionadas);
    rows = drillRows.map((r) => ({ kind: "metas-por-volumes-drill", indicador, ...r })) as Record<string, unknown>[];
  } else {
    throw new Error(`Slug de dashboard nao suportado: ${slug}`);
  }

  const appliedFilters: DashboardQueryPayload["appliedFilters"] = {
    periodDays: options.periodDays,
    regional: options.regional ?? null,
    unidade: options.unidade ?? null
  };
  if (slug === "gerencial-metas-por-volumes-drill") {
    appliedFilters.indicadorKey = (options.indicadorKey ?? "").trim() || null;
  }
  if (slug === "gerencial-metas-por-volumes" || slug === "gerencial-metas-por-volumes-drill") {
    const mes = (options.mes ?? "").trim();
    const semana = (options.semana ?? "").trim().toUpperCase();
    appliedFilters.mes = /^\d{4}-\d{2}$/.test(mes) ? mes : null;
    appliedFilters.semana = semana === "W1" || semana === "W2" || semana === "W3" || semana === "W4" ? semana : null;
  }

  return {
    ok: true,
    slug,
    sourceView,
    appliedFilters,
    rowCount: rows.length,
    rows
  };
}

export type PsChegadasHeatmapApplied = {
  mes: string;
  unidade: string;
  regional: string | null;
};

/**
 * Endpoint dedicado `/api/v1/ps-heatmap/chegadas`: agrega chegadas por dia do mes civil e hora,
 * uma unidade e um mes obrigatorios (COUNT DISTINCT nr_atendimento).
 */
export async function getPsChegadasHeatmapPayload(options: {
  mes: string;
  unidade: string;
  regional?: string;
  limit: number;
}): Promise<{
  ok: true;
  rows: Record<string, unknown>[];
  rowCount: number;
  sourceView: string;
  applied: PsChegadasHeatmapApplied;
}> {
  const mes = options.mes.trim();
  const unidade = options.unidade.trim();
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    throw new Error('Parametro "mes" invalido (use YYYY-MM).');
  }
  if (!unidade) {
    throw new Error('Parametro "unidade" e obrigatorio.');
  }
  const safeLimit = Math.max(1, Math.min(options.limit || 2500, 5000));
  const regional = options.regional?.trim();
  const unitsFilterSql = buildUnitsFilterSql({ regional, unidade });

  if (env.dataGateway === "duckdb") {
    try {
      const rows = await queryDuckDb(`
        WITH unidades AS (
          SELECT try_cast(cd_estabelecimento AS BIGINT) AS cd, nome AS unidade, upper(uf) AS regional
          FROM tbl_unidades
          WHERE ${unitsFilterSql}
        ),
        tempos AS (
          SELECT
            try_cast(cd_estabelecimento AS BIGINT) AS cd,
            nr_atendimento,
            try_cast(replace(dt_entrada, ' ', 'T') AS TIMESTAMP) AS dt_ref
          FROM tbl_tempos_entrada_consulta_saida
          WHERE try_cast(cd_estabelecimento AS BIGINT) IN (SELECT cd FROM unidades)
            AND try_cast(replace(dt_entrada, ' ', 'T') AS TIMESTAMP) IS NOT NULL
            AND strftime(try_cast(replace(dt_entrada, ' ', 'T') AS TIMESTAMP), '%Y-%m') = ${sqlQuote(mes)}
        )
        SELECT
          cast(dt_ref AS DATE) AS data_chegada,
          extract(day FROM cast(dt_ref AS DATE))::INTEGER AS dia_mes,
          hour(dt_ref)::INTEGER AS hora,
          count(DISTINCT nr_atendimento)::BIGINT AS qtd_atendimentos
        FROM tempos
        GROUP BY 1, 2, 3
        ORDER BY 1, 3
        LIMIT ${safeLimit}
      `);
      return {
        ok: true,
        rows,
        rowCount: rows.length,
        sourceView: "duckdb:ps_heatmap_chegadas",
        applied: { mes, unidade, regional: regional ?? null }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[duckdb] ps-heatmap chegadas; fallback csv-memory: ${message}`);
    }
  }

  const store = await ensureStore(90);
  const rows = buildPsChegadasHeatmapRowsForMonth(store, mes, regional, unidade, safeLimit);
  return {
    ok: true,
    rows,
    rowCount: rows.length,
    sourceView: "csv:ps_heatmap_chegadas",
    applied: { mes, unidade, regional: regional ?? null }
  };
}

export function clearDashboardCsvCache(): void {
  /* nome histórico: cache do store em memória (Parquet/CSV via DuckDB read) */
  storeCache = null;
  storeLoadPromise = null;
  storeCommittedRetentionDays = 0;
  queryCache.clear();
}

const GERENCIAL_PERIOD_DAYS: Array<1 | 7 | 15 | 30 | 60 | 90 | 180 | 365> = [1, 7, 15, 30, 60, 90, 180, 365];

/**
 * Arranque: carrega o store e materializa o contexto de **Ontem** (padrao da UI).
 * Os demais periodos rodam em background para troca rapida de pill sem bloquear "servidor pronto".
 */
export async function prewarmDashboardStore(): Promise<void> {
  const store = await ensureStore(1);
  computeContext(store, { periodDays: 1 });
  setImmediate(() => {
    for (const periodDays of GERENCIAL_PERIOD_DAYS) {
      if (periodDays === 1) continue;
      computeContext(store, { periodDays });
    }
  });
}

/**
 * Apos o usuario ja ver os cards do periodo atual (CSV-memory): pre-calcula os outros periodos
 * com os mesmos filtros regional/unidade para troca instantanea de pill.
 */
export function scheduleGerencialContextPrewarm(options: {
  activePeriodDays: 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;
  regional?: string;
  unidade?: string;
}): void {
  void ensureStore(options.activePeriodDays).then((store) => {
    setImmediate(() => {
      for (const periodDays of GERENCIAL_PERIOD_DAYS) {
        if (periodDays === options.activePeriodDays) continue;
        computeContext(store, {
          periodDays,
          regional: options.regional,
          unidade: options.unidade
        });
      }
    });
  });
}

export async function getPsMedicacaoPayload(options: {
  periodDays: GerencialPeriodDays;
  regional?: string;
  unidade?: string;
}): Promise<MedicacaoPsDashboardData> {
  const store = await ensureStore(options.periodDays);
  const { unidadesSelecionadas } = computeContext(store, options);
  const cds = new Set(unidadesSelecionadas.map((u) => u.cd));
  const unidadesMap = new Map(unidadesSelecionadas.map((u) => [u.cd, u.unidade]));

  const window = rollingWindowForGerencial(
    store.unitMaxEventMs,
    store.maxEventMs,
    cds,
    options.periodDays
  );

  if (!window) {
    return {
      totalMedicacoes: 0,
      infusao: { lenta: 0, rapida: 0 },
      vias: [],
      topLenta: [],
      topRapida: [],
      porUnidade: [],
      rankingNaoPadrao: []
    };
  }

  return buildMedicacaoPsDashboard(store.viasMedicamentos, store.farmacia, cds, unidadesMap, window);
}

