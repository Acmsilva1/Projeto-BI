import React, { useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useTheme } from '../context/ThemeContext';
import ExportCsvButton from './ExportCsvButton';
import { datedExportBasename, downloadCsv, roundCsvNumber } from '../utils/downloadCsv';

/** Emojis alinhados aos nomes enviados pela API (icons: ['Ticket', …]). */
const EMOJI_BY_ICON = {
  Ticket: '🎫',
  Megaphone: '📢',
  Stethoscope: '🩺',
  ClipboardList: '📋',
  Pill: '💊',
  ScanLine: '🔬',
  Scan: '🩻',
  PencilLine: '✏️',
  RefreshCw: '🔄',
  Building2: '🏥',
  Clock: '⏱️',
};

function fmtMin(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return '—';
  return Math.round(x).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

/** Seta mais visível que o caractere Unicode → (ex.: Totem ➡️ Triagem). */
function labelComSetaEmoji(label) {
  if (!label) return '';
  return String(label).replace(/\s*→\s*/g, '\u00A0➡️\u00A0');
}

function HeaderIcons({ names }) {
  return (
    <span className="mt-1 flex items-center justify-center gap-1" aria-hidden>
      {names.map((name) => {
        const ch = EMOJI_BY_ICON[name];
        if (!ch) return null;
        return (
          <span key={name} className="text-[15px] leading-none">
            {ch}
          </span>
        );
      })}
    </span>
  );
}

/** Divisórias — tokens --table-* (todos os temas) */
const COL_RULE = 'border-r border-table-grid';
const STICKY_RULE = 'border-r border-table-grid-strong';

const STICKY_UN =
  'sticky left-0 z-[12] min-w-[8.5rem] max-w-[11.5rem] bg-gradient-to-r from-[color:var(--table-sticky-a)] via-[color:var(--table-sticky-b)] to-[color:var(--table-sticky-c)]';

/**
 * Jornada: tempo médio por etapa (min) — GET /api/v1/gerencia/tempo-medio-etapas
 */
export default function TempoMedioEtapasTable({ filters }) {
  const params = useMemo(
    () => ({
      period: filters.period,
      regional: filters.regional,
      unidade: filters.unidade,
    }),
    [filters.period, filters.regional, filters.unidade],
  );

  const { data, loading, error } = useApi('gerencia/tempo-medio-etapas', params);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const etapas = data?.etapas ?? [];
  const linhas = data?.linhas ?? [];
  const totais = data?.totais ?? {};

  /** Fora do SLA = ruim (vermelho negrito); dentro = destaque negrito (branco no escuro). */
  const isForaDaMeta = (etapa, raw) => {
    const lim = etapa?.slaMaxMinutos;
    const v = Number(raw);
    if (lim == null || !Number.isFinite(lim) || lim <= 0) return false;
    if (!Number.isFinite(v)) return false;
    return v > lim;
  };

  const colDataClass = (e, raw) => {
    if (isForaDaMeta(e, raw)) {
      return isLight
        ? 'bg-rose-100 text-rose-900 font-bold ring-1 ring-inset ring-rose-300/70'
        : 'bg-rose-950/45 text-rose-200 font-bold ring-1 ring-inset ring-rose-500/35';
    }
    return 'bg-table-cell-neutral text-table-header-fg font-bold';
  };

  /** Cabeçalhos neutros; cor de alerta só nas células fora da meta. */
  const colHeadClass = () => 'bg-transparent text-table-header-fg';

  const onExportCsv = useCallback(() => {
    const head = ['Unidade', ...etapas.map((e) => e.label ?? e.key ?? '')];
    const body = linhas.map((row) => [
      row.unidadeLabel ?? '',
      ...etapas.map((e) => roundCsvNumber(row.valores?.[e.key], 0)),
    ]);
    const foot = [
      'Total',
      ...etapas.map((e) => roundCsvNumber(totais[e.key], 0)),
    ];
    downloadCsv(`${datedExportBasename('gerencia-tempo-medio-etapas')}.csv`, [head, ...body, foot]);
  }, [etapas, linhas, totais]);

  if (error) {
    return (
      <div className="dashboard-panel px-4 py-3 text-sm text-pipeline-critical border border-app-border">
        {error}
      </div>
    );
  }

  return (
    <section className="dashboard-panel overflow-hidden shadow-xl shadow-black/30 ring-1 ring-inset ring-pipeline-live/35">
      <div className="gerencia-panel-head flex flex-col gap-2.5 px-3 py-2.5 pl-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3 sm:pl-5">
        <div className="flex items-center justify-center gap-2 min-w-0 sm:justify-start">
          <span className="shrink-0 text-lg leading-none" aria-hidden>
            ⏱️
          </span>
          <h2 className="text-center text-sm font-semibold tracking-tight text-app-fg sm:text-left">
            {data?.titulo || 'Tempo médio por etapa (min)'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          {!loading && linhas.length > 0 ? (
            <ExportCsvButton onClick={onExportCsv} title="Baixar tabela em CSV (minutos por etapa)" />
          ) : null}
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-pipeline-live" aria-hidden /> : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-[10px] sm:text-[11px]">
          <thead>
            <tr className="border-b-2 border-table-thead table-head-gradient">
              <th
                className={`${STICKY_UN} ${STICKY_RULE} z-[13] px-1.5 py-1.5 text-[9px] font-bold uppercase tracking-wide sm:px-2 sm:py-2 sm:text-[10px]`}
              >
                Unidade
              </th>
              {etapas.map((e, i) => (
                <th
                  key={e.key}
                  className={`px-0.5 py-1.5 text-center text-[8px] font-semibold uppercase leading-tight sm:px-1 sm:text-[9px] md:text-[10px] ${colHeadClass()} ${
                    i < etapas.length - 1 ? COL_RULE : ''
                  }`}
                  title={e.label}
                >
                  <span className="block leading-tight">{labelComSetaEmoji(e.label)}</span>
                  {e.icons?.length ? <HeaderIcons names={e.icons} /> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((row, idx) => (
              <tr
                key={row.unidadeId}
                className={`border-b border-table-row ${
                  idx % 2 === 0 ? 'bg-table-zebra-odd' : 'bg-table-zebra-even'
                } hover:bg-table-row-hover`}
              >
                <td
                  className={`${STICKY_UN} ${STICKY_RULE} z-[12] px-1.5 py-1 font-bold text-table-header-fg sm:px-2 sm:py-1.5`}
                  title={row.unidadeLabel}
                >
                  <span className="line-clamp-2 text-[10px] sm:text-[11px]">{row.unidadeLabel}</span>
                </td>
                {etapas.map((e, i) => {
                  const raw = row.valores?.[e.key];
                  const vRule = i < etapas.length - 1 ? COL_RULE : '';
                  return (
                    <td
                      key={e.key}
                      className={`px-0.5 py-1 text-right tabular-nums sm:px-1 sm:py-1.5 ${vRule} ${colDataClass(e, raw)}`}
                    >
                      {fmtMin(raw)}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-table-footer-b bg-table-footer-bg font-bold shadow-[inset_0_1px_0_0_var(--table-head-inset)]">
              <td
                className={`${STICKY_UN} ${STICKY_RULE} z-[12] px-1.5 py-2 font-bold uppercase tracking-wide text-table-header-fg sm:px-2`}
              >
                Total
              </td>
              {etapas.map((e, i) => {
                const raw = totais[e.key];
                const vRule = i < etapas.length - 1 ? COL_RULE : '';
                return (
                  <td
                    key={e.key}
                    className={`px-0.5 py-2 text-right tabular-nums sm:px-1 ${vRule} ${colDataClass(e, raw)}`}
                  >
                    {fmtMin(raw)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
