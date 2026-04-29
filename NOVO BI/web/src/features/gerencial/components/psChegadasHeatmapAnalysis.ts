export type HeatmapRow = {
  data_chegada: string;
  dia_mes: number;
  hora: number;
  qtd_atendimentos: number;
};

function sortedNums(a: number[]): number[] {
  return [...a].sort((x, y) => x - y);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo] ?? 0;
  const vlo = sorted[lo] ?? 0;
  const vhi = sorted[hi] ?? 0;
  return vlo * (hi - idx) + vhi * (idx - lo);
}

function mean(a: number[]): number {
  if (a.length === 0) return 0;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

const JANELA_INICIO = 8;
const JANELA_FIM = 19;

const NOME_DIA: readonly string[] = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** Ex.: sexta-feira → "Nas sextas-feiras" */
function rotuloDiaPlural(wd: number): string {
  const d = NOME_DIA[wd] ?? "";
  if (wd === 0) return "Nos domingos";
  if (wd === 6) return "Nos sábados";
  const stem = d.replace("-feira", "");
  return `Nas ${stem}s-feiras`;
}

/** Faixa de 3 horas: 12–15 → horas 12,13,14; rótulo "das 12h às 15h". */
function labelFaixaTresHoras(horaInicio: number): string {
  const fim = horaInicio + 3;
  return `das ${pad2(horaInicio)}h às ${pad2(fim)}h`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfCalendarMonth(ym: string): number {
  const parts = ym.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return 31;
  return new Date(y, m, 0).getDate();
}

function toDateNoon(ym: string, dia: number): Date {
  return new Date(`${ym}-${pad2(dia)}T12:00:00`);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

/** Páscoa (algoritmo de Meeus/Jones/Butcher) — ano inteiro. */
function easterDate(y: number): Date {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Feriados nacionais recorrentes (fixos + móveis) que caem no mês `ym`. */
function feriadosNoMes(ym: string): Map<string, string> {
  const parts = ym.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const out = new Map<string, string>();
  if (!Number.isFinite(y) || !Number.isFinite(m)) return out;

  const pushIfMonth = (d: Date, nome: string): void => {
    if (d.getMonth() + 1 === m && d.getFullYear() === y) {
      out.set(toIsoDate(d), nome);
    }
  };

  const fixos: Array<[number, number, string]> = [
    [1, 1, "Confraternização universal"],
    [4, 21, "Tiradentes"],
    [5, 1, "Dia do trabalho"],
    [9, 7, "Independência"],
    [10, 12, "Nossa Senhora Aparecida"],
    [11, 2, "Finados"],
    [11, 15, "Proclamação da República"],
    [12, 25, "Natal"]
  ];
  for (const [mm, dd, nome] of fixos) {
    pushIfMonth(new Date(y, mm - 1, dd), nome);
  }

  const pascoa = easterDate(y);
  pushIfMonth(addDays(pascoa, -2), "Sexta-feira Santa");
  pushIfMonth(addDays(pascoa, -47), "Carnaval");
  pushIfMonth(addDays(pascoa, 60), "Corpus Christi");

  return out;
}

type HourProfile = {
  hora: number;
  label: string;
  mediaPorDia: number;
  picoNoMes: number;
  diasAcimaDoUsual: number;
  rotulo: string;
};

export type CelulaDestaque = {
  dia: number;
  dataLabel: string;
  diaSemana: string;
  hora: number;
  horaLabel: string;
  qtd: number;
  /** Soma de chegadas nesse dia civil (todas as horas, 0h–23h). */
  totalChegadasDia: number;
  feriado: boolean;
  motivoSimples: string;
};

/** Card para gestão: dia da semana + faixa de 3h + total de chegadas naquela combinação no mês. */
export type CardResumoFaixa = {
  etiqueta: string;
  destaqueLinha1: string;
  destaqueLinha2: string;
  /** Soma de chegadas na faixa (dia da semana × bloco de 3h) no período analisado. */
  totalChegadasFaixa: number;
};

export type PsHeatmapAnalysis = {
  ym: string;
  lastD: number;
  totalChegadas: number;
  volumeNaJanela08a19: number;
  pctVolumeJanela: number;
  pctVolumeAcimaDoEsperado: number;
  pctMomentosCarregados: number;
  slotsJanelaTotal: number;
  slotsAcima: number;
  destaques: CelulaDestaque[];
  textoSimples: string;
  notaCurta: string;
  feriadosResumo: string;
  /** Faixa 3h + dia da semana com mais “alertas” (acima do padrão sazonal); se empate sem alerta, a mais movimentada. */
  cardPiorFaixa: CardResumoFaixa | null;
  /** Faixa em que não houve alerta; se não existir, a menos crítica. */
  cardMelhorFaixa: CardResumoFaixa | null;
};

/**
 * Compara cada célula com o que é normal **naquele dia da semana e hora** (outros dias iguais no mês).
 * Em feriados, o limiar é um pouco mais tolerante para não alarmar sem motivo.
 */
export function analyzePsHeatmapRows(ym: string, rows: HeatmapRow[]): PsHeatmapAnalysis {
  const lastD = lastDayOfCalendarMonth(ym);
  const valueMap = new Map<string, number>();
  for (const r of rows) {
    if (!r.data_chegada.startsWith(ym)) continue;
    const k = `${r.data_chegada}|${r.hora}`;
    valueMap.set(k, (valueMap.get(k) ?? 0) + r.qtd_atendimentos);
  }

  const get = (dia: number, hora: number): number => {
    const iso = `${ym}-${pad2(dia)}`;
    return valueMap.get(`${iso}|${hora}`) ?? 0;
  };

  const feriados = feriadosNoMes(ym);
  const feriadosLista = [...feriados.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const feriadosResumo =
    feriadosLista.length === 0
      ? "Nenhum feriado nacional fixo ou móvel listado neste mês."
      : `Feriados considerados neste mês: ${feriadosLista.map(([iso, nome]) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} (${nome})`).join("; ")}.`;

  let total = 0;
  for (let d = 1; d <= lastD; d += 1) {
    for (let h = 0; h < 24; h += 1) total += get(d, h);
  }

  let volJanela = 0;
  for (let d = 1; d <= lastD; d += 1) {
    for (let h = JANELA_INICIO; h <= JANELA_FIM; h += 1) {
      volJanela += get(d, h);
    }
  }

  const valoresMesmaHora: number[][] = [];
  for (let h = 0; h < 24; h += 1) {
    const col: number[] = [];
    for (let d = 1; d <= lastD; d += 1) col.push(get(d, h));
    valoresMesmaHora.push(col);
  }

  const medianaPorHora = valoresMesmaHora.map((col) => percentile(sortedNums(col), 0.5));

  function referenciaSazonal(dia: number, hora: number): number {
    const t = toDateNoon(ym, dia);
    const wd = t.getDay();
    const pares: number[] = [];
    for (let d2 = 1; d2 <= lastD; d2 += 1) {
      if (d2 === dia) continue;
      const t2 = toDateNoon(ym, d2);
      if (t2.getDay() !== wd) continue;
      pares.push(get(d2, hora));
    }
    if (pares.length >= 2) return percentile(sortedNums(pares), 0.5);
    return medianaPorHora[hora] ?? 0;
  }

  const valoresJanelaNaoZero: number[] = [];
  for (let d = 1; d <= lastD; d += 1) {
    for (let h = JANELA_INICIO; h <= JANELA_FIM; h += 1) {
      const v = get(d, h);
      if (v > 0) valoresJanelaNaoZero.push(v);
    }
  }
  const p85Janela = percentile(sortedNums(valoresJanelaNaoZero), 0.85);

  function slotPressao(d: number, h: number): { v: number; ref: number; acima: boolean } {
    const v = get(d, h);
    const iso = `${ym}-${pad2(d)}`;
    const feriado = feriados.has(iso);
    const ref = referenciaSazonal(d, h);
    const mult = feriado ? 1.28 : 1.35;
    const piso = Math.max(3, (medianaPorHora[h] ?? 0) * 0.5);
    const limiteSazonal = Math.max(ref * mult, piso);
    const limiteGlobal = p85Janela > 0 ? p85Janela * (feriado ? 1.08 : 1) : 0;
    const limite = Math.max(limiteSazonal, limiteGlobal > 0 ? limiteGlobal * 0.92 : 0);
    const acima = ref > 0 && v >= limite;
    return { v, ref, acima };
  }

  function totalChegadasNoDiaCivil(d: number): number {
    let s = 0;
    for (let hh = 0; hh < 24; hh += 1) s += get(d, hh);
    return s;
  }

  let volAcima = 0;
  let slotsAcima = 0;
  const slotsJanela = lastD * (JANELA_FIM - JANELA_INICIO + 1);
  const destaqueCandidatos: CelulaDestaque[] = [];

  for (let d = 1; d <= lastD; d += 1) {
    const iso = `${ym}-${pad2(d)}`;
    const feriado = feriados.has(iso);
    const nomeFeriado = feriados.get(iso);
    const t = toDateNoon(ym, d);
    const diaSemana = NOME_DIA[t.getDay()] ?? "";
    const dataLabel = `${pad2(d)}/${ym.slice(5, 7)}/${ym.slice(0, 4)}`;

    for (let h = JANELA_INICIO; h <= JANELA_FIM; h += 1) {
      const { v, ref, acima } = slotPressao(d, h);
      if (v <= 0) continue;
      if (!acima) continue;

      volAcima += v;
      slotsAcima += 1;

      const pct = ref > 0 ? Math.round(((v - ref) / ref) * 100) : 0;
      let motivo = `Movimento ${pct}% acima do típico das ${diaSemana}s às ${pad2(h)}h neste mês.`;
      if (feriado) {
        motivo = `${nomeFeriado ?? "Feriado"}: volume alto para um feriado (comparado às outras ${diaSemana}s e ao restante do mês).`;
      }

      destaqueCandidatos.push({
        dia: d,
        dataLabel,
        diaSemana,
        hora: h,
        horaLabel: `${pad2(h)}:00`,
        qtd: v,
        totalChegadasDia: totalChegadasNoDiaCivil(d),
        feriado,
        motivoSimples: motivo
      });
    }
  }

  destaqueCandidatos.sort((a, b) => b.qtd - a.qtd);
  /** Picos fortes: 10+ chegadas na célula (abaixo disso não entra como destaque visual). Até 13 tópicos. */
  const destaques = destaqueCandidatos.filter((c) => c.qtd >= 10).slice(0, 13);

  type BandAgg = { wd: number; h0: number; acima: number; vol: number; slots: number };
  const bandas: BandAgg[] = [];
  for (let wd = 0; wd < 7; wd += 1) {
    for (let h0 = JANELA_INICIO; h0 <= JANELA_FIM - 2; h0 += 1) {
      let acimaC = 0;
      let volC = 0;
      let slotsC = 0;
      for (let d = 1; d <= lastD; d += 1) {
        if (toDateNoon(ym, d).getDay() !== wd) continue;
        for (let k = 0; k < 3; k += 1) {
          const hh = h0 + k;
          if (hh > JANELA_FIM) break;
          const { v, acima } = slotPressao(d, hh);
          slotsC += 1;
          volC += v;
          if (acima) acimaC += 1;
        }
      }
      if (slotsC < 3) continue;
      bandas.push({ wd, h0, acima: acimaC, vol: volC, slots: slotsC });
    }
  }

  function mesmoBloco(a: BandAgg | null, b: BandAgg | null): boolean {
    return Boolean(a && b && a.wd === b.wd && a.h0 === b.h0);
  }

  function escolherPiorFaixa(list: BandAgg[]): BandAgg | null {
    if (list.length === 0) return null;
    const maxA = Math.max(...list.map((b) => b.acima));
    const cands = list.filter((b) => b.acima === maxA);
    cands.sort((a, b) => b.vol - a.vol);
    return cands[0] ?? null;
  }

  function escolherFaixaMaisTranquila(list: BandAgg[]): BandAgg | null {
    if (list.length === 0) return null;
    const zeros = list.filter((b) => b.acima === 0);
    if (zeros.length > 0) {
      zeros.sort((a, b) => b.vol - a.vol);
      return zeros[0] ?? null;
    }
    const minA = Math.min(...list.map((b) => b.acima));
    const cands = list.filter((b) => b.acima === minA);
    cands.sort((a, b) => a.vol - b.vol);
    return cands[0] ?? null;
  }

  const piorBloco = escolherPiorFaixa(bandas);
  const excluir = piorBloco ? bandas.filter((b) => !mesmoBloco(b, piorBloco)) : bandas;
  const melhorBloco = escolherFaixaMaisTranquila(excluir.length > 0 ? excluir : bandas);

  let cardPiorFaixa: CardResumoFaixa | null = null;
  let cardMelhorFaixa: CardResumoFaixa | null = null;

  if (total > 0 && piorBloco) {
    const dl = rotuloDiaPlural(piorBloco.wd);
    const fx = labelFaixaTresHoras(piorBloco.h0);
    if (piorBloco.acima > 0) {
      cardPiorFaixa = {
        etiqueta: "Onde o mês mais apertou",
        destaqueLinha1: dl,
        destaqueLinha2: fx,
        totalChegadasFaixa: piorBloco.vol
      };
    } else {
      cardPiorFaixa = {
        etiqueta: "Onde mais chegou gente",
        destaqueLinha1: dl,
        destaqueLinha2: fx,
        totalChegadasFaixa: piorBloco.vol
      };
    }
  }

  if (total > 0 && melhorBloco && !mesmoBloco(melhorBloco, piorBloco)) {
    const dl = rotuloDiaPlural(melhorBloco.wd);
    const fx = labelFaixaTresHoras(melhorBloco.h0);
    if (melhorBloco.acima === 0) {
      cardMelhorFaixa = {
        etiqueta: "Onde o mês mais respirou",
        destaqueLinha1: dl,
        destaqueLinha2: fx,
        totalChegadasFaixa: melhorBloco.vol
      };
    } else {
      cardMelhorFaixa = {
        etiqueta: "O menos apertado entre as faixas",
        destaqueLinha1: dl,
        destaqueLinha2: fx,
        totalChegadasFaixa: melhorBloco.vol
      };
    }
  }

  const limiarPorHora: number[] = new Array(24).fill(0);
  for (let h = 0; h < 24; h += 1) {
    const refDiaTipo = medianaPorHora[h] ?? 0;
    limiarPorHora[h] = Math.max(refDiaTipo * 1.32, 4);
  }

  const horasOrdenadas: HourProfile[] = [];
  const medias: number[] = [];
  for (let h = 0; h < 24; h += 1) {
    const col = valoresMesmaHora[h] ?? [];
    const m = mean(col);
    medias.push(m);
    const mx = Math.max(...col, 0);
    const th = limiarPorHora[h] ?? 0;
    const diasAcima = col.filter((v) => v >= th && v > 0).length;
    horasOrdenadas.push({
      hora: h,
      label: `${pad2(h)}:00`,
      mediaPorDia: m,
      picoNoMes: mx,
      diasAcimaDoUsual: diasAcima,
      rotulo: "No padrão"
    });
  }
  const maxMedia = Math.max(...medias, 1);
  for (const ho of horasOrdenadas) {
    if (ho.mediaPorDia >= maxMedia * 0.78) ho.rotulo = "Horário mais cheio";
    else if (ho.diasAcimaDoUsual >= Math.ceil(lastD * 0.35)) ho.rotulo = "Vários dias acima do usual";
    else if (ho.diasAcimaDoUsual >= 3) ho.rotulo = "Alguns picos";
  }
  horasOrdenadas.sort((a, b) => b.mediaPorDia - a.mediaPorDia);

  const pctVolJanela = total > 0 ? (volJanela / total) * 100 : 0;
  const pctAcima = total > 0 ? (volAcima / total) * 100 : 0;
  const pctMomentos = slotsJanela > 0 ? (slotsAcima / slotsJanela) * 100 : 0;

  const horasQuentes = horasOrdenadas
    .filter((x) => x.hora >= JANELA_INICIO && x.hora <= JANELA_FIM)
    .slice(0, 4)
    .map((x) => x.label)
    .join(", ");

  const textoSimples =
    total === 0
      ? "Não há chegadas neste mês para esta unidade."
      : `Foram ${total.toLocaleString("pt-BR")} chegadas no mês; ${volJanela.toLocaleString("pt-BR")} concentraram-se entre 8h e 19h, onde o PS costuma estar mais movimentado. ` +
        `Os cartões abaixo destacam o recorte de dia da semana + três horas em que o calendário mais “apertou” e o que mais “respirou”, e os picos que mais fogem do padrão esperado. ` +
        (horasQuentes ? `Em média, as horas com mais chegadas foram: ${horasQuentes}.` : "");

  const notaCurta = "";

  return {
    ym,
    lastD,
    totalChegadas: total,
    volumeNaJanela08a19: volJanela,
    pctVolumeJanela: pctVolJanela,
    pctVolumeAcimaDoEsperado: pctAcima,
    pctMomentosCarregados: pctMomentos,
    slotsJanelaTotal: slotsJanela,
    slotsAcima,
    destaques,
    textoSimples,
    notaCurta,
    feriadosResumo,
    cardPiorFaixa,
    cardMelhorFaixa
  };
}
