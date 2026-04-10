import React, { useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useTheme } from '../context/ThemeContext';
import ExportCsvButton from './ExportCsvButton';
import { datedExportBasename, downloadCsv, roundCsvNumber } from '../utils/downloadCsv';

function fmtCell(kind, raw) {
  if (kind === 'text') {
    const s = raw == null ? '' : String(raw).trim();
    return s || '—';
  }
  const n = Number(raw);
  if (Number.isNaN(n)) return '—';
  if (kind === 'int') return Math.round(n).toLocaleString('pt-BR');
  if (kind === 'pct') {
    return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }
  if (kind === 'decimal') {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(n);
}

/** Valores numéricos alinhados à tela: % com 1 casa, decimais com 2 (sem sufixo % no CSV). */
function exportCell(kind, raw) {
  if (kind === 'text') {
    const s = raw == null ? '' : String(raw).trim();
    return s;
  }
  const n = Number(raw);
  if (Number.isNaN(n)) return '';
  if (kind === 'int') return Math.round(n);
  if (kind === 'pct') return roundCsvNumber(n, 1);
  if (kind === 'decimal') return roundCsvNumber(n, 2);
  return roundCsvNumber(n, 2);
}

/**
 * Cores por coluna: API envia pctSense + limiares (high_good / low_good).
 * Modo claro: verde/vermelho mais escuros para contraste no fundo claro.
 */
function cellDataClass(col, raw, isLight) {
  const ok = isLight ? 'text-emerald-700 font-bold' : 'text-emerald-400 font-bold';
  const ruim = isLight ? 'text-rose-700 font-bold' : 'text-rose-400 font-bold';
  const neutro = 'text-table-header-fg font-bold';
  const muted = 'text-table-header-muted font-bold';

  const kind = col.kind;
  if (kind === 'text') {
    const s = raw == null ? '' : String(raw).trim();
    if (!s) return muted;
    return neutro;
  }

  if (kind === 'pct') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return muted;
    const sense = col.pctSense;
    const g = col.pctGreenAt;
    const r = col.pctRedAt;
    if (sense === 'high_good' && (g != null || r != null)) {
      if (g != null && n >= g) return ok;
      if (r != null && n <= r) return ruim;
      return neutro;
    }
    if (sense === 'low_good' && (g != null || r != null)) {
      if (g != null && n <= g) return ok;
      if (r != null && n >= r) return ruim;
      return neutro;
    }
    return neutro;
  }

  const isZero = raw === 0 || raw === null || raw === undefined || Number(raw) === 0;
  if (isZero) return muted;
  return neutro;
}

/** Divisórias — tokens --table-* em index.css (escuro / claro / verde / azul) */
const COL_RULE = 'border-r border-table-grid';
const STICKY_RULE = 'border-r border-table-grid-strong';

const STICKY_UN =
  'sticky left-0 z-[12] w-[min(17rem,42vw)] min-w-[11rem] max-w-[18rem] bg-gradient-to-r from-[color:var(--table-sticky-a)] via-[color:var(--table-sticky-b)] to-[color:var(--table-sticky-c)]';

/**
 * Grade de indicadores por unidade PS — GET /api/v1/gerencia/metricas-por-unidade
 */
export default function MetricasPorUnidadeTable({ filters }) {
  const params = useMemo(
    () => ({
      period: filters.period,
      regional: filters.regional,
      unidade: filters.unidade,
    }),
    [filters.period, filters.regional, filters.unidade],
  );

  const { data, loading, error } = useApi('gerencia/metricas-por-unidade', params);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const colunas = data?.colunas ?? [];
  const linhas = data?.linhas ?? [];

  const onExportCsv = useCallback(() => {
    const head = ['Unidade', ...colunas.map((c) => c.label ?? c.key ?? '')];
    const body = linhas.map((linha) => [
      linha.label ?? '',
      ...colunas.map((c) => exportCell(c.kind, linha.valores?.[c.key])),
    ]);
    downloadCsv(`${datedExportBasename('gerencia-metricas-por-unidade')}.csv`, [head, ...body]);
  }, [colunas, linhas]);

  if (error) {
    return (
      <div className="rounded-xl state-error-banner px-4 py-3 text-sm border">
        {error}
      </div>
    );
  }

  return (
    <section className="dashboard-panel overflow-hidden shadow-xl shadow-black/30 ring-1 ring-inset ring-pipeline-live/35">
      <div className="gerencia-panel-head flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 pl-4 sm:px-4 sm:py-3 sm:pl-5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-hospital-400 shadow-[0_0_10px_rgb(56_189_248/0.45)]"
            aria-hidden
          />
          <h2 className="text-lg font-semibold tracking-tight text-app-fg">
            <span className="mr-2 text-xl leading-none align-middle" aria-hidden>
              📑
            </span>
            {data?.meta?.titulo || 'Indicadores por unidade (PS)'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!loading && linhas.length > 0 ? (
            <ExportCsvButton onClick={onExportCsv} title="Baixar indicadores por unidade em CSV" />
          ) : null}
          {loading ? (
            <span className="flex items-center gap-2 text-xs text-app-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-pipeline-live" />
              Atualizando…
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-app-muted">
              Volumes e percentuais · filtro do topo
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-left text-[10px] sm:text-[11px]">
          <thead>
            <tr className="border-b-2 border-table-thead table-head-gradient">
              <th
                className={`${STICKY_UN} ${STICKY_RULE} z-[13] px-2 py-2.5 text-[9px] font-bold uppercase tracking-wide text-table-header-fg sm:text-[10px]`}
              >
                Unidade
              </th>
              {colunas.map((c) => (
                <th
                  key={c.key}
                  className={`min-w-[5.5rem] max-w-[7rem] whitespace-normal ${COL_RULE} bg-table-head-metric px-1.5 py-2 text-center text-[8px] font-semibold uppercase leading-snug text-table-header-fg last:border-r-0 sm:min-w-[6rem] sm:max-w-none sm:whitespace-nowrap sm:px-2 sm:text-[9px] md:text-[10px]`}
                  title={c.label}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && linhas.length === 0 ? (
              <tr className="border-b border-table-row">
                <td className={`${STICKY_UN} ${STICKY_RULE} bg-app-elevated py-3`} colSpan={Math.max(colunas.length + 1, 8)}>
                  <div className="mx-2 h-3 rounded bg-app-border" />
                </td>
              </tr>
            ) : null}
            {linhas.map((linha) => (
              <tr
                key={linha.unidadeId}
                className="border-b border-table-row odd:bg-table-zebra-odd even:bg-table-zebra-even hover:bg-table-row-hover"
              >
                <td
                  className={`${STICKY_UN} ${STICKY_RULE} z-[12] bg-inherit px-2 py-1.5 text-[10px] font-bold text-table-header-fg sm:py-2 sm:text-[11px]`}
                  title={linha.label}
                >
                  <span className="line-clamp-2 sm:line-clamp-none">{linha.label}</span>
                </td>
                {colunas.map((c) => {
                  const v = linha.valores?.[c.key];
                  return (
                    <td
                      key={c.key}
                      className={`min-w-[5.5rem] ${COL_RULE} px-1.5 py-1.5 text-right tabular-nums text-[9px] last:border-r-0 sm:min-w-[6rem] sm:px-2 sm:text-[10px] ${cellDataClass(c, v, isLight)}`}
                    >
                      {fmtCell(c.kind, v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
