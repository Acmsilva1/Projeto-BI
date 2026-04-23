/**
 * Agregação "Metas por volume" alinhada ao modelo Power BI (Medidas / Param metas de volumes).
 * Eixo: três últimos meses civis relativos ao max(DATA) do fluxo filtrado; YTD até o fim do mês âncora.
 */

export type FluxoVolumeRow = {
  cd: number;
  nr: string;
  dataMs: number;
  destino: string;
  dtInternacaoMs: number | null;
  minTriagem: number;
  minConsulta: number;
  minPermanencia: number;
  dtDesfechoMs: number | null;
  medAtend: string;
  medDesfecho: string;
};

export type MedicacaoVolumeRow = {
  cd: number;
  nr: string;
  dtMs: number;
  minutos: number;
  geraLote: string;
};

export type LabVolumeRow = {
  cd: number;
  nr: string;
  dtMs: number;
};

export type TcUsVolumeRow = {
  cd: number;
  nr: string;
  tipo: string;
  dtMs: number;
  /** CSV de origem — totais gerenciais separados (RX/ECG vs TC/US). */
  origin: "rx_ecg" | "tc_us";
};

export type ReavVolumeRow = {
  cd: number;
  nr: string;
  dtMs: number;
  dtSolicMs: number | null;
  dtEvoMs: number | null;
  dtFimMs: number | null;
};

export type ViasVolumeRow = {
  cd: number;
  nr: string;
  dataMs: number;
  nrPrescricao: string;
  cdMaterial: number;
};

export type VolumeMetaDefinition = {
  key: string;
  label: string;
  targetDisplay: string;
  /** Meta em escala exibida: % como 0–1 (ex.: 6% -> 0.06); médias como número absoluto */
  targetValue: number;
  format: "percent" | "number";
  /** "<" = menor valor melhor; ">" = maior melhor (desfecho) */
  direction: "<" | ">";
};

export type MetasWeekSlice = "W1" | "W2" | "W3" | "W4";

/** Metas alinhadas ao print institucional / parâmetros típicos do PBI */
export const VOLUME_META_DEFINITIONS: VolumeMetaDefinition[] = [
  { key: "conversao", label: "Conversão", targetDisplay: "(6%)", targetValue: 0.06, format: "percent", direction: "<" },
  { key: "pacs_medicados", label: "Pacs medicados", targetDisplay: "(50%)", targetValue: 0.5, format: "percent", direction: "<" },
  { key: "media_medicacoes", label: "Medicações por paciente", targetDisplay: "(2,5)", targetValue: 2.5, format: "number", direction: "<" },
  { key: "pacs_lab", label: "Pacs c/ exames laboratoriais", targetDisplay: "(22%)", targetValue: 0.22, format: "percent", direction: "<" },
  { key: "media_lab", label: "Laboratório por paciente", targetDisplay: "(4)", targetValue: 4, format: "number", direction: "<" },
  { key: "pacs_tc", label: "Pacs c/ exames de TC", targetDisplay: "(12%)", targetValue: 0.12, format: "percent", direction: "<" },
  { key: "media_tc", label: "TCs por paciente", targetDisplay: "(1,1)", targetValue: 1.1, format: "number", direction: "<" },
  { key: "triagem_rg", label: "Triagem acima da meta", targetDisplay: "(3%)", targetValue: 0.03, format: "percent", direction: "<" },
  { key: "consulta_rg", label: "Consulta acima da meta", targetDisplay: "(1%)", targetValue: 0.01, format: "percent", direction: "<" },
  { key: "medicacao_rg", label: "Medicação acima da meta", targetDisplay: "(4%)", targetValue: 0.04, format: "percent", direction: "<" },
  { key: "reav_rg", label: "Reavaliação acima da meta", targetDisplay: "(8%)", targetValue: 0.08, format: "percent", direction: "<" },
  { key: "perm_rg", label: "Permanência acima da meta", targetDisplay: "(10%)", targetValue: 0.1, format: "percent", direction: "<" },
  { key: "desfecho", label: "Desfecho do médico do atend.", targetDisplay: "(90%)", targetValue: 0.9, format: "percent", direction: ">" }
];

const EXCLUDED_MATERIAL_IDS = new Set([84278, 84288, 84153, 84271]);

const RG_TRIAGEM_MIN = 12;
const RG_CONSULTA_MIN = 90;
const RG_MEDICACAO_MIN = 30;
const RG_REAV_MIN = 45;
const RG_PERM_MIN = 180;

function utcMonthStart(year: number, month0: number): number {
  return Date.UTC(year, month0, 1, 0, 0, 0, 0);
}

function utcMonthEnd(year: number, month0: number): number {
  return Date.UTC(year, month0 + 1, 0, 23, 59, 59, 999);
}

function addMonths(year: number, month0: number, delta: number): { y: number; m0: number } {
  const d = new Date(Date.UTC(year, month0 + delta, 1));
  return { y: d.getUTCFullYear(), m0: d.getUTCMonth() };
}

function monthKey(y: number, m0: number): number {
  return y * 100 + (m0 + 1);
}

function monthLabelPt(y: number, m0: number): string {
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[m0]} ${y}`;
}

export function resolveLastThreeMonths(anchorMs: number): Array<{ yearMonth: number; label: string; startMs: number; endMs: number }> {
  const d = new Date(anchorMs);
  const y = d.getUTCFullYear();
  const m0 = d.getUTCMonth();
  const out: Array<{ yearMonth: number; label: string; startMs: number; endMs: number }> = [];
  for (let k = -2; k <= 0; k += 1) {
    const { y: yy, m0: mm } = addMonths(y, m0, k);
    out.push({
      yearMonth: monthKey(yy, mm),
      label: monthLabelPt(yy, mm),
      startMs: utcMonthStart(yy, mm),
      endMs: utcMonthEnd(yy, mm)
    });
  }
  return out;
}

function yearMonthToParts(yearMonth: number): { year: number; month0: number } | null {
  const year = Math.trunc(yearMonth / 100);
  const month = yearMonth % 100;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  return { year, month0: month - 1 };
}

function maxDayOfMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function utcDayStart(year: number, month0: number, day: number): number {
  return Date.UTC(year, month0, day, 0, 0, 0, 0);
}

function utcDayEnd(year: number, month0: number, day: number): number {
  return Date.UTC(year, month0, day, 23, 59, 59, 999);
}

function weekSliceLabel(week: MetasWeekSlice): string {
  if (week === "W1") return "29 - 4";
  if (week === "W2") return "5 - 11";
  if (week === "W3") return "12 - 18";
  return "19 - 29";
}

function resolveMonthAggByYearMonth(yearMonth: number): MonthAgg | null {
  const parts = yearMonthToParts(yearMonth);
  if (!parts) return null;
  const { year, month0 } = parts;
  return {
    yearMonth,
    label: monthLabelPt(year, month0),
    startMs: utcMonthStart(year, month0),
    endMs: utcMonthEnd(year, month0)
  };
}

function resolveWeekSliceAgg(yearMonth: number, week: MetasWeekSlice): MonthAgg | null {
  const parts = yearMonthToParts(yearMonth);
  if (!parts) return null;
  const { year, month0 } = parts;
  if (week === "W1") {
    const prev = addMonths(year, month0, -1);
    const prevLastDay = maxDayOfMonth(prev.y, prev.m0);
    return {
      yearMonth,
      label: weekSliceLabel(week),
      startMs: utcDayStart(prev.y, prev.m0, Math.min(29, prevLastDay)),
      endMs: utcDayEnd(year, month0, Math.min(4, maxDayOfMonth(year, month0)))
    };
  }

  const monthMaxDay = maxDayOfMonth(year, month0);
  const startDay = week === "W2" ? 5 : week === "W3" ? 12 : 19;
  const endDay = week === "W2" ? 11 : week === "W3" ? 18 : 29;
  return {
    yearMonth,
    label: weekSliceLabel(week),
    startMs: utcDayStart(year, month0, Math.min(startDay, monthMaxDay)),
    endMs: utcDayEnd(year, month0, Math.min(endDay, monthMaxDay))
  };
}

function resolveAnalysisMonths(anchorMs: number, selectedYearMonth?: number, selectedWeek?: MetasWeekSlice): {
  availableMonths: MonthAgg[];
  analysisMonths: MonthAgg[];
  anchorYearMonth: number;
} {
  const availableMonths = resolveLastThreeMonths(anchorMs);
  const fallbackAnchorYearMonth = availableMonths[2]?.yearMonth ?? 0;
  if (availableMonths.length === 0) {
    return { availableMonths: [], analysisMonths: [], anchorYearMonth: 0 };
  }

  const monthAgg = selectedYearMonth
    ? availableMonths.find((m) => m.yearMonth === selectedYearMonth) ?? resolveMonthAggByYearMonth(selectedYearMonth)
    : null;
  if (!monthAgg) {
    return { availableMonths, analysisMonths: availableMonths, anchorYearMonth: fallbackAnchorYearMonth };
  }
  if (selectedWeek) {
    const weekAgg = resolveWeekSliceAgg(monthAgg.yearMonth, selectedWeek);
    return {
      availableMonths,
      analysisMonths: weekAgg ? [weekAgg] : [monthAgg],
      anchorYearMonth: monthAgg.yearMonth
    };
  }
  const weekAggs: MonthAgg[] = (["W1", "W2", "W3", "W4"] as MetasWeekSlice[])
    .map((w) => resolveWeekSliceAgg(monthAgg.yearMonth, w))
    .filter((m): m is MonthAgg => m !== null);
  return {
    availableMonths,
    analysisMonths: weekAggs.length > 0 ? weekAggs : [monthAgg],
    anchorYearMonth: monthAgg.yearMonth
  };
}

function inClosedRange(ms: number, start: number, end: number): boolean {
  return ms >= start && ms <= end;
}

function isInternado(destino: string): boolean {
  return destino.trim().toLowerCase() === "internado";
}

function reavMinutos(row: ReavVolumeRow): number | null {
  if (row.dtSolicMs === null) return null;
  const ev = row.dtEvoMs;
  const fi = row.dtFimMs;
  let ref: number | null = null;
  if (ev === null && fi === null) ref = null;
  else if (ev === null) ref = fi;
  else if (fi === null) ref = ev;
  else ref = Math.min(ev, fi);
  if (ref === null) return null;
  return (ref - row.dtSolicMs) / 60000;
}

function distinct<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function toneForRatio(actual: number | null, target: number, direction: "<" | ">"): "ok" | "warn" | "bad" | "empty" {
  if (actual === null || !Number.isFinite(actual)) return "empty";
  const ratio = direction === "<" ? actual / target : target === 0 ? 1 : actual / target;
  if (direction === "<") {
    if (ratio <= 1) return "ok";
    if (ratio <= 1.15) return "warn";
    return "bad";
  }
  if (ratio >= 1) return "ok";
  if (ratio >= 0.9) return "warn";
  return "bad";
}

export type MonthAgg = { startMs: number; endMs: number; yearMonth: number; label: string };

/** Janela rolante alinhada ao max(data) entre as unidades do recorte (mesma ideia do computeContext). */
export function rollingWindowForGerencial(
  unitMaxByCd: Map<number, number>,
  globalMaxMs: number,
  cds: Set<number>,
  periodDays: 7 | 15 | 30 | 60 | 90 | 180,
  /** Se tempos/intern/altas nao povoam max (ex.: CSV com DATA so em fluxo/med), usa esta ancora em ms */
  anchorFallbackMs?: number
): MonthAgg | null {
  if (cds.size === 0) return null;
  let anchor = 0;
  for (const cd of cds) {
    const v = unitMaxByCd.get(cd) ?? globalMaxMs;
    if (v > anchor) anchor = v;
  }
  /** Sempre alinhar ao max de volumes (lab/med/TC/reav) no recorte — evita janela com fim antes dessas datas (KPIs zerados). */
  if (anchorFallbackMs !== undefined) {
    const fb = anchorFallbackMs;
    if (Number.isFinite(fb) && fb > 0) anchor = Math.max(anchor, fb);
  }
  if (!Number.isFinite(anchor) || anchor <= 0) return null;
  const periodMs = Math.max(0, periodDays - 1) * 24 * 60 * 60 * 1000;
  return {
    startMs: anchor - periodMs,
    endMs: anchor,
    yearMonth: 0,
    label: "rolling"
  };
}

export function pctComDesfechoRegistrado(flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const rows = fluxInMonth(flux, cds, m);
  const denom = new Set(rows.map((r) => r.nr).filter(Boolean));
  if (denom.size === 0) return null;
  const ok = new Set<string>();
  for (const r of rows) {
    if (r.nr && r.dtDesfechoMs !== null) ok.add(r.nr);
  }
  return ok.size / denom.size;
}

export function pctPacientesTipoExame(
  tc: TcUsVolumeRow[],
  flux: FluxoVolumeRow[],
  cds: Set<number>,
  m: MonthAgg,
  predicate: (tipo: string) => boolean
): number | null {
  const denom = distinct(fluxInMonth(flux, cds, m).map((r) => r.nr)).filter(Boolean).length;
  if (denom === 0) return null;
  const num = distinct(
    tc.filter((x) => cds.has(x.cd) && predicate(x.tipo) && inClosedRange(x.dtMs, m.startMs, m.endMs)).map((x) => x.nr)
  ).length;
  return num / denom;
}

function fluxInMonth(flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): FluxoVolumeRow[] {
  return flux.filter((r) => cds.has(r.cd) && inClosedRange(r.dataMs, m.startMs, m.endMs));
}

function conversao(flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const denom = flux.filter((r) => cds.has(r.cd) && inClosedRange(r.dataMs, m.startMs, m.endMs)).length;
  if (denom === 0) return null;
  const num = flux.filter(
    (r) => cds.has(r.cd) && isInternado(r.destino) && r.dtInternacaoMs !== null && inClosedRange(r.dtInternacaoMs, m.startMs, m.endMs)
  ).length;
  return num / denom;
}

function pctPacientesMedicados(vias: ViasVolumeRow[], flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const denomNrs = distinct(fluxInMonth(flux, cds, m).map((r) => r.nr)).filter(Boolean);
  if (denomNrs.length === 0) return null;
  const numNrs = distinct(
    vias.filter((v) => cds.has(v.cd) && inClosedRange(v.dataMs, m.startMs, m.endMs)).map((v) => v.nr)
  ).filter(Boolean);
  return numNrs.length / denomNrs.length;
}

function mediaMedicacoesPorPac(vias: ViasVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const byNr = new Map<string, Set<string>>();
  for (const v of vias) {
    if (!cds.has(v.cd) || !inClosedRange(v.dataMs, m.startMs, m.endMs)) continue;
    if (EXCLUDED_MATERIAL_IDS.has(v.cdMaterial)) continue;
    const key = `${v.nr}`;
    if (!byNr.has(key)) byNr.set(key, new Set());
    byNr.get(key)!.add(`${v.nrPrescricao}|${v.cdMaterial}`);
  }
  if (byNr.size === 0) return null;
  let sum = 0;
  for (const s of byNr.values()) sum += s.size;
  return sum / byNr.size;
}

/** Fallback quando não há linhas em vias: média de linhas de medicação por atendimento no mês */
function mediaMedicacoesFallback(med: MedicacaoVolumeRow[], flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const nrs = distinct(fluxInMonth(flux, cds, m).map((r) => r.nr)).filter(Boolean);
  if (nrs.length === 0) return null;
  const counts = new Map<string, number>();
  for (const row of med) {
    if (!cds.has(row.cd) || !inClosedRange(row.dtMs, m.startMs, m.endMs)) continue;
    counts.set(row.nr, (counts.get(row.nr) ?? 0) + 1);
  }
  let sum = 0;
  let n = 0;
  for (const nr of nrs) {
    const c = counts.get(nr) ?? 0;
    sum += c;
    n += 1;
  }
  return n === 0 ? null : sum / n;
}

function pctPacientesLab(lab: LabVolumeRow[], flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const denom = distinct(fluxInMonth(flux, cds, m).map((r) => r.nr)).filter(Boolean).length;
  if (denom === 0) return null;
  const num = distinct(lab.filter((x) => cds.has(x.cd) && inClosedRange(x.dtMs, m.startMs, m.endMs)).map((x) => x.nr)).length;
  return num / denom;
}

function mediaLabPorPac(lab: LabVolumeRow[], flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const nrs = distinct(fluxInMonth(flux, cds, m).map((r) => r.nr)).filter(Boolean);
  if (nrs.length === 0) return null;
  const counts = new Map<string, number>();
  for (const row of lab) {
    if (!cds.has(row.cd) || !inClosedRange(row.dtMs, m.startMs, m.endMs)) continue;
    counts.set(row.nr, (counts.get(row.nr) ?? 0) + 1);
  }
  let sum = 0;
  for (const nr of nrs) sum += counts.get(nr) ?? 0;
  return sum / nrs.length;
}

function pctPacientesTc(tc: TcUsVolumeRow[], flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const denom = distinct(fluxInMonth(flux, cds, m).map((r) => r.nr)).filter(Boolean).length;
  if (denom === 0) return null;
  const num = distinct(
    tc.filter((x) => cds.has(x.cd) && x.tipo.trim().toUpperCase() === "TC" && inClosedRange(x.dtMs, m.startMs, m.endMs)).map((x) => x.nr)
  ).length;
  return num / denom;
}

function mediaTcPorPac(tc: TcUsVolumeRow[], flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const nrs = distinct(
    tc.filter((x) => cds.has(x.cd) && x.tipo.trim().toUpperCase() === "TC" && inClosedRange(x.dtMs, m.startMs, m.endMs)).map((x) => x.nr)
  ).filter(Boolean);
  if (nrs.length === 0) return null;
  const counts = new Map<string, number>();
  for (const row of tc) {
    if (!cds.has(row.cd) || row.tipo.trim().toUpperCase() !== "TC") continue;
    if (!inClosedRange(row.dtMs, m.startMs, m.endMs)) continue;
    counts.set(row.nr, (counts.get(row.nr) ?? 0) + 1);
  }
  let sum = 0;
  for (const nr of nrs) sum += counts.get(nr) ?? 0;
  return sum / nrs.length;
}

function pctTriagemRg(flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const rows = fluxInMonth(flux, cds, m);
  if (rows.length === 0) return null;
  const acima = rows.filter((r) => r.minTriagem > RG_TRIAGEM_MIN).length;
  return acima / rows.length;
}

function pctConsultaRg(flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const rows = fluxInMonth(flux, cds, m);
  if (rows.length === 0) return null;
  const acima = rows.filter((r) => r.minConsulta > RG_CONSULTA_MIN).length;
  return acima / rows.length;
}

function pctMedicacaoRg(med: MedicacaoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const rows = med.filter((r) => cds.has(r.cd) && inClosedRange(r.dtMs, m.startMs, m.endMs));
  if (rows.length === 0) return null;
  const acima = rows.filter((r) => r.minutos > RG_MEDICACAO_MIN).length;
  return acima / rows.length;
}

function pctReavRg(reav: ReavVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  let total = 0;
  let acima = 0;
  for (const r of reav) {
    if (!cds.has(r.cd) || !inClosedRange(r.dtMs, m.startMs, m.endMs)) continue;
    const min = reavMinutos(r);
    if (min === null) continue;
    total += 1;
    if (min > RG_REAV_MIN) acima += 1;
  }
  if (total === 0) return null;
  return acima / total;
}

function pctPermRg(flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const rows = fluxInMonth(flux, cds, m);
  if (rows.length === 0) return null;
  const acima = rows.filter((r) => r.minPermanencia > RG_PERM_MIN).length;
  return acima / rows.length;
}

function pctDesfecho(flux: FluxoVolumeRow[], cds: Set<number>, m: MonthAgg): number | null {
  const rows = fluxInMonth(flux, cds, m);
  if (rows.length === 0) return null;
  const denomSet = new Set<string>();
  const okSet = new Set<string>();
  for (const r of rows) {
    denomSet.add(r.nr);
    if (r.dtDesfechoMs === null) continue;
    const a = r.medAtend.trim().toLowerCase();
    const b = r.medDesfecho.trim().toLowerCase();
    if (a.length > 0 && a === b) okSet.add(r.nr);
  }
  const denom = denomSet.size;
  if (denom === 0) return null;
  return okSet.size / denom;
}

export function computeIndicator(
  key: string,
  ctx: {
    flux: FluxoVolumeRow[];
    med: MedicacaoVolumeRow[];
    lab: LabVolumeRow[];
    tc: TcUsVolumeRow[];
    reav: ReavVolumeRow[];
    vias: ViasVolumeRow[];
    cds: Set<number>;
    m: MonthAgg;
  }
): number | null {
  const { flux, med, lab, tc, reav, vias, cds, m } = ctx;
  switch (key) {
    case "conversao":
      return conversao(flux, cds, m);
    case "pacs_medicados": {
      if (vias.length) return pctPacientesMedicados(vias, flux, cds, m);
      const denomNrs = distinct(fluxInMonth(flux, cds, m).map((r) => r.nr)).filter(Boolean);
      if (denomNrs.length === 0) return null;
      const medNrs = distinct(med.filter((x) => cds.has(x.cd) && inClosedRange(x.dtMs, m.startMs, m.endMs)).map((x) => x.nr));
      return medNrs.length / denomNrs.length;
    }
    case "media_medicacoes": {
      const v = mediaMedicacoesPorPac(vias, cds, m);
      return v !== null ? v : mediaMedicacoesFallback(med, flux, cds, m);
    }
    case "pacs_lab":
      return pctPacientesLab(lab, flux, cds, m);
    case "media_lab":
      return mediaLabPorPac(lab, flux, cds, m);
    case "pacs_tc":
      return pctPacientesTc(tc, flux, cds, m);
    case "media_tc":
      return mediaTcPorPac(tc, flux, cds, m);
    case "triagem_rg":
      return pctTriagemRg(flux, cds, m);
    case "consulta_rg":
      return pctConsultaRg(flux, cds, m);
    case "medicacao_rg":
      return pctMedicacaoRg(med, cds, m);
    case "reav_rg":
      return pctReavRg(reav, cds, m);
    case "perm_rg":
      return pctPermRg(flux, cds, m);
    case "desfecho":
      return pctDesfecho(flux, cds, m);
    default:
      return null;
  }
}

function indicatorCellCounts(
  key: string,
  ctx: {
    flux: FluxoVolumeRow[];
    med: MedicacaoVolumeRow[];
    lab: LabVolumeRow[];
    tc: TcUsVolumeRow[];
    reav: ReavVolumeRow[];
    vias: ViasVolumeRow[];
    cds: Set<number>;
    m: MonthAgg;
  }
): { numerator: number | null; denominator: number | null } {
  const { flux, med, lab, tc, reav, vias, cds, m } = ctx;
  switch (key) {
    case "conversao": {
      const denominator = flux.filter((r) => cds.has(r.cd) && inClosedRange(r.dataMs, m.startMs, m.endMs)).length;
      const numerator = flux.filter(
        (r) => cds.has(r.cd) && isInternado(r.destino) && r.dtInternacaoMs !== null && inClosedRange(r.dtInternacaoMs, m.startMs, m.endMs)
      ).length;
      return denominator > 0 ? { numerator, denominator } : { numerator: null, denominator: null };
    }
    case "pacs_medicados": {
      const denomNrs = distinct(fluxInMonth(flux, cds, m).map((r) => r.nr)).filter(Boolean);
      if (denomNrs.length === 0) return { numerator: null, denominator: null };
      if (vias.length) {
        const numNrs = distinct(
          vias.filter((v) => cds.has(v.cd) && inClosedRange(v.dataMs, m.startMs, m.endMs)).map((v) => v.nr)
        ).filter(Boolean);
        return { numerator: numNrs.length, denominator: denomNrs.length };
      }
      const medNrs = distinct(med.filter((x) => cds.has(x.cd) && inClosedRange(x.dtMs, m.startMs, m.endMs)).map((x) => x.nr)).filter(Boolean);
      return { numerator: medNrs.length, denominator: denomNrs.length };
    }
    case "pacs_lab": {
      const denominator = distinct(fluxInMonth(flux, cds, m).map((r) => r.nr)).filter(Boolean).length;
      const numerator = distinct(lab.filter((x) => cds.has(x.cd) && inClosedRange(x.dtMs, m.startMs, m.endMs)).map((x) => x.nr)).filter(Boolean).length;
      return denominator > 0 ? { numerator, denominator } : { numerator: null, denominator: null };
    }
    case "pacs_tc": {
      const denominator = distinct(fluxInMonth(flux, cds, m).map((r) => r.nr)).filter(Boolean).length;
      const numerator = distinct(
        tc.filter((x) => cds.has(x.cd) && x.tipo.trim().toUpperCase() === "TC" && inClosedRange(x.dtMs, m.startMs, m.endMs)).map((x) => x.nr)
      ).filter(Boolean).length;
      return denominator > 0 ? { numerator, denominator } : { numerator: null, denominator: null };
    }
    case "triagem_rg": {
      const rows = fluxInMonth(flux, cds, m);
      const denominator = rows.length;
      const numerator = rows.filter((r) => r.minTriagem > RG_TRIAGEM_MIN).length;
      return denominator > 0 ? { numerator, denominator } : { numerator: null, denominator: null };
    }
    case "consulta_rg": {
      const rows = fluxInMonth(flux, cds, m);
      const denominator = rows.length;
      const numerator = rows.filter((r) => r.minConsulta > RG_CONSULTA_MIN).length;
      return denominator > 0 ? { numerator, denominator } : { numerator: null, denominator: null };
    }
    case "medicacao_rg": {
      const rows = med.filter((r) => cds.has(r.cd) && inClosedRange(r.dtMs, m.startMs, m.endMs));
      const denominator = rows.length;
      const numerator = rows.filter((r) => r.minutos > RG_MEDICACAO_MIN).length;
      return denominator > 0 ? { numerator, denominator } : { numerator: null, denominator: null };
    }
    case "reav_rg": {
      let denominator = 0;
      let numerator = 0;
      for (const r of reav) {
        if (!cds.has(r.cd) || !inClosedRange(r.dtMs, m.startMs, m.endMs)) continue;
        const min = reavMinutos(r);
        if (min === null) continue;
        denominator += 1;
        if (min > RG_REAV_MIN) numerator += 1;
      }
      return denominator > 0 ? { numerator, denominator } : { numerator: null, denominator: null };
    }
    case "perm_rg": {
      const rows = fluxInMonth(flux, cds, m);
      const denominator = rows.length;
      const numerator = rows.filter((r) => r.minPermanencia > RG_PERM_MIN).length;
      return denominator > 0 ? { numerator, denominator } : { numerator: null, denominator: null };
    }
    case "desfecho": {
      const rows = fluxInMonth(flux, cds, m);
      const denomSet = new Set<string>();
      const okSet = new Set<string>();
      for (const r of rows) {
        if (!r.nr) continue;
        denomSet.add(r.nr);
        if (r.dtDesfechoMs === null) continue;
        const a = r.medAtend.trim().toLowerCase();
        const b = r.medDesfecho.trim().toLowerCase();
        if (a.length > 0 && a === b) okSet.add(r.nr);
      }
      return denomSet.size > 0 ? { numerator: okSet.size, denominator: denomSet.size } : { numerator: null, denominator: null };
    }
    default:
      return { numerator: null, denominator: null };
  }
}

function ytdEndMs(lastMonth: MonthAgg): number {
  return lastMonth.endMs;
}

function ytdStartMs(lastMonth: MonthAgg): number {
  const d = new Date(lastMonth.startMs);
  return Date.UTC(d.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
}

function computeYtd(
  key: string,
  ctx: Omit<Parameters<typeof computeIndicator>[1], "m">,
  lastMonth: MonthAgg
): number | null {
  const start = ytdStartMs(lastMonth);
  const end = ytdEndMs(lastMonth);
  const synthetic: MonthAgg = { startMs: start, endMs: end, yearMonth: lastMonth.yearMonth, label: "YTD" };
  return computeIndicator(key, { ...ctx, m: synthetic });
}

function monthAggFromYearMonth(yearMonth: number): MonthAgg | null {
  const parts = yearMonthToParts(yearMonth);
  if (!parts) return null;
  return {
    yearMonth,
    label: monthLabelPt(parts.year, parts.month0),
    startMs: utcMonthStart(parts.year, parts.month0),
    endMs: utcMonthEnd(parts.year, parts.month0)
  };
}

function previousYearMonth(yearMonth: number): number {
  const parts = yearMonthToParts(yearMonth);
  if (!parts) return yearMonth;
  const prev = addMonths(parts.year, parts.month0, -1);
  return monthKey(prev.y, prev.m0);
}

function januaryYearMonth(yearMonth: number): number {
  const year = Math.trunc(yearMonth / 100);
  return year * 100 + 1;
}

function computeYtdDiffFromJanuary(
  key: string,
  ctx: Omit<Parameters<typeof computeIndicator>[1], "m">,
  anchorMonth: MonthAgg,
  currentValue: number | null
): number | null {
  if (currentValue === null || !Number.isFinite(currentValue)) return null;
  const janAgg = monthAggFromYearMonth(januaryYearMonth(anchorMonth.yearMonth));
  if (!janAgg) return null;
  const janValue = computeIndicator(key, { ...ctx, m: janAgg });
  if (janValue === null || !Number.isFinite(janValue)) return null;
  return currentValue - janValue;
}

function toneForYtdDiff(diff: number | null, direction: "<" | ">"): "ok" | "warn" | "bad" | "empty" {
  if (diff === null || !Number.isFinite(diff)) return "empty";
  if (Math.abs(diff) < 1e-12) return "warn";
  if (direction === "<") return diff < 0 ? "ok" : "bad";
  return diff > 0 ? "ok" : "bad";
}

export type MetasPorVolumesInput = {
  unidadesCds: Set<number>;
  flux: FluxoVolumeRow[];
  med: MedicacaoVolumeRow[];
  lab: LabVolumeRow[];
  tc: TcUsVolumeRow[];
  reav: ReavVolumeRow[];
  vias: ViasVolumeRow[];
  selectedYearMonth?: number;
  selectedWeek?: MetasWeekSlice;
};

export type MetasPorVolumesMonthCell = {
  yearMonth: number;
  label: string;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  deltaVsPrev: number | null;
  tone: "ok" | "warn" | "bad" | "empty";
};

export type MetasPorVolumesIndicatorRow = {
  key: string;
  label: string;
  targetDisplay: string;
  targetValue: number;
  format: "percent" | "number";
  /** "<" menor melhor; ">" maior melhor (ex.: % desfecho) */
  direction: "<" | ">";
  months: MetasPorVolumesMonthCell[];
  total: {
    value: number | null;
    compareParen: number | null;
    variance: number | null;
    ytd: number | null;
    toneTotal: "ok" | "warn" | "bad" | "empty";
    toneYtd: "ok" | "warn" | "bad" | "empty";
  };
};

export function buildMetasPorVolumesMatrix(input: MetasPorVolumesInput): {
  availableMonths: Array<{ yearMonth: number; label: string }>;
  months: Array<{ yearMonth: number; label: string }>;
  anchorYearMonth: number;
  indicators: MetasPorVolumesIndicatorRow[];
} {
  const { unidadesCds, flux, med, lab, tc, reav, vias, selectedYearMonth, selectedWeek } = input;
  let anchorMs = 0;
  for (const r of flux) {
    if (!unidadesCds.has(r.cd)) continue;
    if (r.dataMs > anchorMs) anchorMs = r.dataMs;
  }
  if (anchorMs === 0) {
    return {
      availableMonths: [],
      months: [],
      anchorYearMonth: 0,
      indicators: VOLUME_META_DEFINITIONS.map((def) => ({
        key: def.key,
        label: def.label,
        targetDisplay: def.targetDisplay,
        targetValue: def.targetValue,
        format: def.format,
        direction: def.direction,
        months: [],
        total: {
          value: null,
          compareParen: null,
          variance: null,
          ytd: null,
          toneTotal: "empty",
          toneYtd: "empty"
        }
      }))
    };
  }

  const resolved = resolveAnalysisMonths(anchorMs, selectedYearMonth, selectedWeek);
  const availableMonthsMeta = resolved.availableMonths.map((m) => ({ yearMonth: m.yearMonth, label: m.label }));
  const monthsMeta = resolved.analysisMonths.map((m) => ({ yearMonth: m.yearMonth, label: m.label }));
  const ctxBase = { flux, med, lab, tc, reav, vias, cds: unidadesCds };
  const lastIdx = resolved.analysisMonths.length - 1;
  const totalAnchorMonth =
    (selectedYearMonth ? monthAggFromYearMonth(selectedYearMonth) : null) ?? resolved.analysisMonths[lastIdx]!;
  const prevMonthAgg = monthAggFromYearMonth(previousYearMonth(totalAnchorMonth.yearMonth));

  const indicators: MetasPorVolumesIndicatorRow[] = VOLUME_META_DEFINITIONS.map((def) => {
    const values: (number | null)[] = resolved.analysisMonths.map((m) => computeIndicator(def.key, { ...ctxBase, m }));
    const monthCells: MetasPorVolumesMonthCell[] = resolved.analysisMonths.map((m, idx) => {
      const value = values[idx] ?? null;
      const counts = indicatorCellCounts(def.key, { ...ctxBase, m });
      const prevFromVisible = idx > 0 ? values[idx - 1] ?? null : null;
      const prevFromHiddenMonth =
        idx === 0
          ? (() => {
              if (!selectedYearMonth) {
                const prevAgg = monthAggFromYearMonth(previousYearMonth(m.yearMonth));
                return prevAgg ? computeIndicator(def.key, { ...ctxBase, m: prevAgg }) : null;
              }
              if (m.label === weekSliceLabel("W1")) {
                const prevWeekAgg = resolveWeekSliceAgg(previousYearMonth(m.yearMonth), "W4");
                return prevWeekAgg ? computeIndicator(def.key, { ...ctxBase, m: prevWeekAgg }) : null;
              }
              return null;
            })()
          : null;
      const prev = prevFromVisible ?? prevFromHiddenMonth;
      const deltaVsPrev =
        value !== null && prev !== null && Number.isFinite(value) && Number.isFinite(prev) ? value - prev : null;
      const tone = toneForRatio(value, def.targetValue, def.direction);
      return {
        yearMonth: m.yearMonth,
        label: m.label,
        value,
        numerator: counts.numerator,
        denominator: counts.denominator,
        deltaVsPrev,
        tone
      };
    });

    const mLast = resolved.analysisMonths[lastIdx]!;
    const vLast = computeIndicator(def.key, { ...ctxBase, m: totalAnchorMonth });
    const vPrev = prevMonthAgg ? computeIndicator(def.key, { ...ctxBase, m: prevMonthAgg }) : null;
    const variance = vLast !== null && vPrev !== null ? vLast - vPrev : null;
    const ytd = computeYtdDiffFromJanuary(def.key, ctxBase, totalAnchorMonth, vLast);

    return {
      key: def.key,
      label: def.label,
      targetDisplay: def.targetDisplay,
      targetValue: def.targetValue,
      format: def.format,
      direction: def.direction,
      months: monthCells,
      total: {
        value: vLast,
        compareParen: vPrev,
        variance,
        ytd,
        toneTotal: toneForRatio(vLast, def.targetValue, def.direction),
        toneYtd: toneForYtdDiff(ytd, def.direction)
      }
    };
  });

  return {
    availableMonths: availableMonthsMeta,
    months: monthsMeta,
    anchorYearMonth: resolved.anchorYearMonth,
    indicators
  };
}

export function buildMetasPorVolumesDrill(
  input: MetasPorVolumesInput,
  indicatorKey: string,
  unidades: Array<{ cd: number; unidade: string; regional: string }>
): Array<{ cd: number; unidade: string; months: MetasPorVolumesMonthCell[]; ytd: number | null }> {
  const def = VOLUME_META_DEFINITIONS.find((d) => d.key === indicatorKey);
  if (!def) return [];
  let anchorMs = 0;
  for (const r of input.flux) {
    if (!input.unidadesCds.has(r.cd)) continue;
    if (r.dataMs > anchorMs) anchorMs = r.dataMs;
  }
  if (anchorMs === 0) return [];
  const resolved = resolveAnalysisMonths(anchorMs, input.selectedYearMonth, input.selectedWeek);
  const lastIdx = resolved.analysisMonths.length - 1;
  if (resolved.analysisMonths.length === 0) return [];
  const totalAnchorMonth =
    (input.selectedYearMonth ? monthAggFromYearMonth(input.selectedYearMonth) : null) ?? resolved.analysisMonths[lastIdx]!;

  return unidades
    .filter((u) => input.unidadesCds.has(u.cd))
    .map((u) => {
      const cds = new Set([u.cd]);
      const ctxBase = {
        flux: input.flux,
        med: input.med,
        lab: input.lab,
        tc: input.tc,
        reav: input.reav,
        vias: input.vias,
        cds
      };
      const values = resolved.analysisMonths.map((m) => computeIndicator(def.key, { ...ctxBase, m }));
      const months: MetasPorVolumesMonthCell[] = resolved.analysisMonths.map((m, idx) => {
        const value = values[idx] ?? null;
        const counts = indicatorCellCounts(def.key, { ...ctxBase, m });
        const prevFromVisible = idx > 0 ? values[idx - 1] ?? null : null;
        const prevFromHiddenMonth =
          idx === 0
            ? (() => {
                if (!input.selectedYearMonth) {
                  const prevAgg = monthAggFromYearMonth(previousYearMonth(m.yearMonth));
                  return prevAgg ? computeIndicator(def.key, { ...ctxBase, m: prevAgg }) : null;
                }
                if (m.label === weekSliceLabel("W1")) {
                  const prevWeekAgg = resolveWeekSliceAgg(previousYearMonth(m.yearMonth), "W4");
                  return prevWeekAgg ? computeIndicator(def.key, { ...ctxBase, m: prevWeekAgg }) : null;
                }
                return null;
              })()
            : null;
        const prev = prevFromVisible ?? prevFromHiddenMonth;
        const deltaVsPrev =
          value !== null && prev !== null && Number.isFinite(value) && Number.isFinite(prev) ? value - prev : null;
        const tone = toneForRatio(value, def.targetValue, def.direction);
        return {
          yearMonth: m.yearMonth,
          label: m.label,
          value,
          numerator: counts.numerator,
          denominator: counts.denominator,
          deltaVsPrev,
          tone
        };
      });
      const totalValue = computeIndicator(def.key, { ...ctxBase, m: totalAnchorMonth });
      const ytd = computeYtdDiffFromJanuary(def.key, ctxBase, totalAnchorMonth, totalValue);
      return { cd: u.cd, unidade: u.unidade, months, ytd };
    });
}

