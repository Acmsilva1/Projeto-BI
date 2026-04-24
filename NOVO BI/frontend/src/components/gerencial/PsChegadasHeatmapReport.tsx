import { type ReactElement } from "react";
import type { CardResumoFaixa, CelulaDestaque, HourProfile, PsHeatmapAnalysis } from "./psChegadasHeatmapAnalysis";

export type PsChegadasHeatmapReportProps = {
  unidade: string;
  mesLabel: string;
  analysis: PsHeatmapAnalysis;
};

function CardFaixaGestao(props: {
  titulo: string;
  card: CardResumoFaixa;
  destaqueClass: string;
}): ReactElement {
  const { titulo, card, destaqueClass } = props;
  return (
    <div className="rounded-xl border border-[var(--table-grid)] bg-[var(--background)]/25 p-4">
      <p className="text-xs font-medium text-[var(--app-muted)]">{titulo}</p>
      <p className="mt-2 text-lg font-bold leading-snug text-[var(--foreground)]">{card.destaqueLinha1}</p>
      <p className={`mt-1 text-base font-semibold leading-snug ${destaqueClass}`}>{card.destaqueLinha2}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--app-muted)]">{card.complemento}</p>
    </div>
  );
}

function rotuloHoraClass(rotulo: string): string {
  if (rotulo === "Horário mais cheio") return "bg-emerald-500/15 text-emerald-200";
  if (rotulo === "Vários dias acima do usual") return "bg-amber-500/15 text-amber-100";
  if (rotulo === "Alguns picos") return "bg-sky-500/12 text-sky-100";
  return "bg-[var(--app-elevated)] text-[var(--app-muted)]";
}

function CardHoraMes(props: { row: HourProfile }): ReactElement {
  const { row } = props;
  return (
    <div className="flex flex-col rounded-xl border border-[var(--table-grid)] bg-[var(--background)]/25 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold tabular-nums text-[var(--table-header-fg)]">{row.label}</p>
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight ${rotuloHoraClass(row.rotulo)}`}>
          {row.rotulo}
        </span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-[var(--foreground)]">
        {row.mediaPorDia.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
      </p>
      <p className="text-[11px] text-[var(--app-muted)]">média / dia</p>
      <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--dash-live)]">
        pico {row.picoNoMes.toLocaleString("pt-BR")}
      </p>
      <p className="text-[11px] text-[var(--app-muted)]">maior dia no mês</p>
    </div>
  );
}

/** Cor do card conforme chegadas naquele pico (demanda na hora). */
type DestaqueAccent = {
  bar: string;
  tint: string;
  badge: string;
  qty: string;
  horaStrong: string;
  divider: string;
};

const ACCENT_1_A_9: DestaqueAccent = {
  bar: "border-l-sky-500",
  tint: "from-sky-500/[0.14] via-[var(--background)]/30 to-transparent",
  badge: "bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/25",
  qty: "text-sky-200",
  horaStrong: "text-sky-100",
  divider: "border-sky-500/20"
};

const ACCENT_10_A_19: DestaqueAccent = {
  bar: "border-l-amber-500",
  tint: "from-amber-500/[0.14] via-[var(--background)]/30 to-transparent",
  badge: "bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/25",
  qty: "text-amber-200",
  horaStrong: "text-amber-100",
  divider: "border-amber-500/20"
};

const ACCENT_20_OU_MAIS: DestaqueAccent = {
  bar: "border-l-rose-500",
  tint: "from-rose-500/[0.14] via-[var(--background)]/30 to-transparent",
  badge: "bg-rose-500/25 text-rose-100 ring-1 ring-rose-400/25",
  qty: "text-rose-200",
  horaStrong: "text-rose-100",
  divider: "border-rose-500/20"
};

function accentPorQtdNoPico(qtd: number): DestaqueAccent {
  const n = Math.max(0, Math.floor(Number(qtd)));
  if (n <= 9) return ACCENT_1_A_9;
  if (n <= 19) return ACCENT_10_A_19;
  return ACCENT_20_OU_MAIS;
}

function LegendaFaixaDemanda(): ReactElement {
  const chip =
    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums";
  return (
    <div className="mt-2 flex flex-wrap gap-2" role="list" aria-label="Legenda de cores por volume de chegadas no pico">
      <span className={`${chip} border-sky-500/35 bg-sky-500/10 text-sky-100`} role="listitem">
        <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-hidden />
        1 a 9
      </span>
      <span className={`${chip} border-amber-500/35 bg-amber-500/10 text-amber-100`} role="listitem">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
        10 a 19
      </span>
      <span className={`${chip} border-rose-500/35 bg-rose-500/10 text-rose-100`} role="listitem">
        <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden />
        20 ou mais
      </span>
    </div>
  );
}

function CardDestaquePico(props: { c: CelulaDestaque; index: number }): ReactElement {
  const { c, index } = props;
  const ac = accentPorQtdNoPico(c.qtd);
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl border border-[var(--table-grid)] border-l-4 bg-gradient-to-br p-4 shadow-sm ${ac.tint} ${ac.bar}`}
    >
      <div className={`flex items-center justify-between gap-2 border-b pb-2 ${ac.divider}`}>
        <div>
          <p className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ac.badge}`}>
            Pico #{index + 1}
          </p>
          <p className="mt-2 text-base font-bold text-[var(--table-header-fg)]">{c.dataLabel}</p>
        </div>
        <p className={`text-2xl font-bold tabular-nums drop-shadow-sm ${ac.qty}`}>{c.qtd.toLocaleString("pt-BR")}</p>
      </div>
      <p className="mt-2 text-sm capitalize text-[var(--app-muted)]">
        {c.diaSemana}
        {c.feriado && (
          <span className="ml-2 inline-block rounded-md bg-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-50 ring-1 ring-amber-300/40">
            feriado
          </span>
        )}
      </p>
      <p className="mt-1 text-sm tabular-nums text-[var(--app-fg)]">
        às <span className={`font-semibold ${ac.horaStrong}`}>{c.horaLabel}</span>
      </p>
      <p className="mt-3 flex-1 border-t border-[var(--table-grid)]/50 pt-3 text-xs leading-relaxed text-[var(--app-muted)]">
        {c.motivoSimples}
      </p>
    </div>
  );
}

export function PsChegadasHeatmapReport(props: PsChegadasHeatmapReportProps): ReactElement {
  const { analysis, unidade, mesLabel } = props;
  const a = analysis;
  const horasJanela = [...a.horasOrdenadas]
    .filter((h) => h.hora >= 8 && h.hora <= 19)
    .sort((x, y) => x.hora - y.hora);

  return (
    <div className="mt-4 space-y-5 rounded-2xl border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_94%,transparent)] p-4 md:p-6">
      <header className="border-b border-[var(--table-grid)] pb-3">
        <h3 className="text-base font-bold text-[var(--table-header-fg)] md:text-lg">Leitura para gestão — chegadas ao PS</h3>
        <p className="mt-1 text-xs text-[var(--app-muted)]">
          {unidade} · {mesLabel}
        </p>
      </header>

      <p className="text-sm leading-relaxed text-[var(--app-fg)]">{a.textoSimples}</p>

      <p className="rounded-lg bg-[var(--background)]/30 px-3 py-2 text-xs leading-relaxed text-[var(--app-muted)]">{a.feriadosResumo}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--table-grid)] bg-[var(--background)]/25 p-4">
          <p className="text-xs text-[var(--app-muted)]">Chegadas no mês</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--foreground)]">{a.totalChegadas.toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-[11px] text-[var(--app-muted)]">Total agregado da unidade no período</p>
        </div>
        <div className="rounded-xl border border-[var(--table-grid)] bg-[var(--background)]/25 p-4">
          <p className="text-xs text-[var(--app-muted)]">Entre 8h e 19h</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--dash-live)]">{a.volumeNaJanela08a19.toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-[11px] text-[var(--app-muted)]">chegadas nessa janela (onde o PS mais recebe)</p>
        </div>

        {a.cardPiorFaixa ? (
          <CardFaixaGestao titulo={a.cardPiorFaixa.etiqueta} card={a.cardPiorFaixa} destaqueClass="text-[var(--dash-critical)]" />
        ) : (
          <div className="rounded-xl border border-[var(--table-grid)] bg-[var(--background)]/25 p-4">
            <p className="text-xs text-[var(--app-muted)]">Onde o mês mais apertou</p>
            <p className="mt-2 text-sm text-[var(--app-muted)]">Sem dados suficientes para destacar uma faixa de três horas neste mês.</p>
          </div>
        )}

        {a.cardMelhorFaixa ? (
          <CardFaixaGestao titulo={a.cardMelhorFaixa.etiqueta} card={a.cardMelhorFaixa} destaqueClass="text-[var(--dash-live)]" />
        ) : (
          <div className="rounded-xl border border-[var(--table-grid)] bg-[var(--background)]/25 p-4">
            <p className="text-xs text-[var(--app-muted)]">Onde o mês mais respirou</p>
            <p className="mt-2 text-sm text-[var(--app-muted)]">
              Não há outra faixa de três horas distinta da anterior para comparar, ou os dados são insuficientes neste recorte.
            </p>
          </div>
        )}
      </div>

      <section>
        <h4 className="mb-1 text-sm font-semibold text-[var(--table-header-fg)]">Horário a horário (média no mês)</h4>
        <p className="mb-3 text-[11px] text-[var(--app-muted)]">8h às 19h — média diária e maior volume num único dia.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {horasJanela.map((row) => (
            <CardHoraMes key={row.hora} row={row} />
          ))}
        </div>
      </section>

      {a.destaques.length > 0 && (
        <section className="rounded-xl border border-[var(--table-grid)]/80 bg-[var(--background)]/10 p-4 md:p-5">
          <div className="mb-3">
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-9 shrink-0 gap-0.5 self-center" aria-hidden>
                <span className="w-1 rounded-full bg-sky-500" />
                <span className="w-1 rounded-full bg-amber-500" />
                <span className="w-1 rounded-full bg-rose-500" />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-[var(--table-header-fg)]">Onde mais chama atenção</h4>
                <p className="mt-0.5 text-[11px] text-[var(--app-muted)]">
                  Picos que fogem do padrão esperado para aquele dia e hora. A cor do card segue o volume de chegadas naquela célula.
                </p>
                <LegendaFaixaDemanda />
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {a.destaques.map((c, i) => (
              <CardDestaquePico key={`${c.dataLabel}-${c.hora}-${i}`} c={c} index={i} />
            ))}
          </div>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--app-muted)]">{a.notaCurta}</p>
    </div>
  );
}
