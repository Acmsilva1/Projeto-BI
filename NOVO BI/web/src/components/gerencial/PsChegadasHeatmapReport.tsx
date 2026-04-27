import { type ReactElement } from "react";
import type { CardResumoFaixa, CelulaDestaque, PsHeatmapAnalysis } from "./psChegadasHeatmapAnalysis";

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
      <p className="mt-3 text-2xl font-bold tabular-nums text-[var(--foreground)]">
        {card.totalChegadasFaixa.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--app-muted)]">total no período</p>
    </div>
  );
}

function LegendaFaixaPico(): ReactElement {
  const chip =
    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums";
  return (
    <div className="mt-2 flex flex-wrap gap-2" role="list" aria-label="Intensidade do pico (chegadas na célula)">
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

function CardPicoAtencao(props: { c: CelulaDestaque }): ReactElement {
  const { c } = props;
  const critico = c.qtd >= 20;
  const bar = critico ? "border-l-rose-500" : "border-l-amber-500";
  const tint = critico
    ? "from-rose-500/[0.12] via-[var(--background)]/25 to-transparent"
    : "from-amber-500/[0.12] via-[var(--background)]/25 to-transparent";
  const horaClass = critico ? "text-rose-100" : "text-amber-100";
  const qtdClass = critico ? "text-rose-200" : "text-amber-200";
  const metaBadge = critico
    ? "bg-rose-500/25 text-rose-50 ring-1 ring-rose-400/35"
    : "bg-amber-500/25 text-amber-50 ring-1 ring-amber-400/35";

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl border border-[var(--table-grid)] border-l-4 bg-gradient-to-br p-4 shadow-sm ${tint} ${bar}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-[var(--app-muted)]">
        <span className="tabular-nums text-[var(--table-header-fg)]">{c.dataLabel}</span>
        <span className="text-[var(--app-muted)]" aria-hidden>
          ·
        </span>
        <span className="capitalize text-[var(--app-fg)]">{c.diaSemana}</span>
        {c.feriado ? (
          <span className="rounded-md bg-amber-500/25 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-100 ring-1 ring-amber-400/30">
            feriado
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-2xl font-bold tabular-nums leading-none ${horaClass}`}>{c.horaLabel}</p>
          <p className={`mt-2 text-3xl font-bold tabular-nums tracking-tight ${qtdClass}`}>
            {c.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-[var(--app-muted)]">chegadas nesta hora</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-muted)]">Total geral do dia</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-[var(--foreground)]">
            {c.totalChegadasDia.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>
      <p className={`mt-4 inline-flex w-fit rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${metaBadge}`}>
        Acima da meta
      </p>
    </div>
  );
}

export function PsChegadasHeatmapReport(props: PsChegadasHeatmapReportProps): ReactElement {
  const { analysis, unidade, mesLabel } = props;
  const a = analysis;

  return (
    <div className="mt-4 space-y-5 rounded-2xl border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_94%,transparent)] p-4 md:p-6">
      <header className="border-b border-[var(--table-grid)] pb-3">
        <h3 className="text-base font-bold text-[var(--table-header-fg)] md:text-lg">Resumo de fluxo</h3>
        <p className="mt-1 text-xs text-[var(--app-muted)]">
          {unidade} · {mesLabel}
        </p>
      </header>

      <p className="rounded-lg border border-[color-mix(in_srgb,var(--dash-live)_42%,var(--table-grid))] bg-[color-mix(in_srgb,var(--dash-live)_14%,var(--background))] px-3 py-3 text-sm font-medium leading-relaxed text-[color-mix(in_srgb,#ecfdf5_88%,var(--dash-live))]">
        {a.textoSimples}
      </p>

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

      {a.destaques.length > 0 && (
        <section className="rounded-xl border border-[var(--table-grid)]/80 bg-[var(--background)]/10 p-4 md:p-5">
          <div className="mb-1">
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-9 shrink-0 gap-0.5 self-center" aria-hidden>
                <span className="w-1 rounded-full bg-amber-500" />
                <span className="w-1 rounded-full bg-rose-500" />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-[var(--table-header-fg)]">Onde mais chama atenção</h4>
                <p className="mt-0.5 text-[11px] text-[var(--app-muted)]">
                  Células com <strong className="font-medium text-[var(--app-fg)]">10 ou mais</strong> chegadas fora do
                  padrão sazonal. A cor do card segue a intensidade (10–19 ou 20+); abaixo de 10 não aparece aqui.
                </p>
                <LegendaFaixaPico />
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {a.destaques.map((c, i) => (
              <CardPicoAtencao key={`${c.dataLabel}-${c.hora}-${i}`} c={c} />
            ))}
          </div>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--app-muted)]">{a.notaCurta}</p>
    </div>
  );
}
