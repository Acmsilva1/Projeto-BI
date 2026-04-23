import { type ReactElement } from "react";
import type { CardResumoFaixa, PsHeatmapAnalysis } from "./psChegadasHeatmapAnalysis";

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
        <h4 className="mb-2 text-sm font-semibold text-[var(--table-header-fg)]">Horário a horário (média no mês)</h4>
        <div className="overflow-x-auto rounded-xl border border-[var(--table-grid)]">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="bg-[var(--app-elevated)] text-[11px] text-[var(--app-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Horário</th>
                <th className="px-3 py-2 text-right font-medium">Média por dia</th>
                <th className="px-3 py-2 text-right font-medium">Maior dia</th>
                <th className="px-3 py-2 font-medium">Leitura rápida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--table-row-sep)] text-[var(--app-fg)]">
              {horasJanela.map((row) => (
                <tr key={row.hora} className="bg-[var(--background)]/15">
                  <td className="px-3 py-2 font-medium text-[var(--table-header-fg)]">{row.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.mediaPorDia.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.picoNoMes.toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 text-[var(--app-muted)]">{row.rotulo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {a.destaques.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-[var(--table-header-fg)]">Onde mais chama atenção</h4>
          <div className="overflow-x-auto rounded-xl border border-[var(--table-grid)]">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="bg-[var(--app-elevated)] text-[11px] text-[var(--app-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Dia</th>
                  <th className="px-3 py-2 font-medium">Hora</th>
                  <th className="px-3 py-2 text-right font-medium">Chegadas</th>
                  <th className="px-3 py-2 font-medium">Por quê</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--table-row-sep)] text-[var(--app-fg)]">
                {a.destaques.map((c, i) => (
                  <tr key={`${c.dataLabel}-${c.hora}-${i}`} className="bg-[var(--background)]/15">
                    <td className="px-3 py-2 font-medium text-[var(--table-header-fg)]">{c.dataLabel}</td>
                    <td className="px-3 py-2 capitalize text-[var(--app-muted)]">
                      {c.diaSemana}
                      {c.feriado && (
                        <span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                          feriado
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{c.horaLabel}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-[var(--foreground)]">
                      {c.qtd.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-[var(--app-muted)]">{c.motivoSimples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--app-muted)]">{a.notaCurta}</p>
    </div>
  );
}
