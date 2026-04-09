import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';

function fmtMain(v, isP) {
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  const s = n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return isP ? `${s}%` : s;
}

function fmtDelta(d, isP) {
  const n = Number(d);
  if (Number.isNaN(n)) return '—';
  if (n === 0) return isP ? '0,00%' : '0,00';
  const sign = n > 0 ? '+' : '−';
  const abs = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${isP ? `${abs}%` : abs}`;
}

/** Bom = verde negrito · ruim = vermelho negrito · neutro = texto de destaque (branco no escuro) negrito */
function mainCellClass(v, row) {
  const n = Number(v);
  const isZero = !Number.isFinite(n) || (n === 0 && Number(row?.m1?.d) === 0);
  if (isZero) return 'bg-slate-800/50 text-table-header-muted font-bold border border-slate-600/45';

  if (row.isP && row.isReverso) {
    if (n <= 5) return 'bg-emerald-900/40 text-emerald-300 font-bold border border-emerald-600/40';
    if (n <= 12) return 'bg-slate-800/45 text-table-header-fg font-bold border border-slate-600/40';
    return 'bg-rose-950/35 text-rose-300 font-bold border border-rose-700/35';
  }
  if (row.isP && !row.isReverso) {
    if (n >= 88) return 'bg-emerald-900/40 text-emerald-300 font-bold border border-emerald-600/40';
    if (n >= 75) return 'bg-slate-800/45 text-table-header-fg font-bold border border-slate-600/40';
    return 'bg-rose-950/30 text-rose-300 font-bold border border-rose-700/35';
  }
  return 'bg-slate-800/40 text-table-header-fg font-bold border border-slate-600/35';
}

function deltaCellClass(d) {
  const n = Number(d);
  if (!Number.isFinite(n) || n === 0) return 'text-table-header-muted font-bold bg-slate-900/55';
  if (n > 0) return 'text-emerald-400 font-bold bg-slate-900/40';
  return 'text-rose-400 font-bold bg-slate-900/40';
}

function totalValueClass(v, row) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return 'text-table-header-muted font-bold';
  if (row.isP && row.isReverso) return n <= 8 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
  if (row.isP && !row.isReverso) return n >= 85 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
  return 'text-table-header-fg font-bold';
}

function ytdClass(y, row) {
  const n = Number(y);
  if (!Number.isFinite(n) || n === 0) return 'text-table-header-muted font-bold';
  if (row.isReverso) return n < 0 ? 'text-emerald-400 font-bold' : n > 0 ? 'text-rose-400 font-bold' : 'text-table-header-muted font-bold';
  return n > 0 ? 'text-emerald-400 font-bold' : n < 0 ? 'text-rose-400 font-bold' : 'text-table-header-muted font-bold';
}

/** Divisórias — tokens --table-* (todos os temas) */
const COL_RULE = 'border-r border-table-grid';
const STICKY_RULE = 'border-r border-table-grid-strong';

function MonthPair({ row, mk }) {
  const cell = row[mk] || { v: 0, d: 0 };
  return (
    <>
      <td
        className={`${COL_RULE} px-0.5 py-1 text-right tabular-nums text-[10px] sm:px-1 sm:text-[11px] ${mainCellClass(cell.v, row)}`}
      >
        {fmtMain(cell.v, row.isP)}
      </td>
      <td
        className={`${COL_RULE} px-0.5 py-1 text-right tabular-nums text-[9px] sm:px-1 sm:text-[10px] ${deltaCellClass(cell.d)}`}
      >
        {fmtDelta(cell.d, row.isP)}
      </td>
    </>
  );
}

const STICKY_IND =
  'sticky left-0 z-[15] w-44 min-w-[10.5rem] max-w-[11.5rem] bg-gradient-to-r from-[color:var(--table-sticky-a)] via-[color:var(--table-sticky-b)] to-[color:var(--table-sticky-c)]';
const STICKY_UNI =
  'sticky left-44 z-[14] w-[11.5rem] min-w-[11rem] max-w-[12rem] border-l border-table-grid bg-gradient-to-r from-[color:var(--table-sticky-b)] via-[color:var(--table-sticky-c)] to-[color:var(--table-sticky-c)]';

function DataRow({
  row,
  depth,
  expanded,
  onToggle,
  rowId,
  hasChildren,
  indicatorLabel,
  unitLabel,
  showUnidadeColumn,
}) {
  const t = row.t || { v: 0, ytd: 0, sec: '(0)' };

  return (
    <tr
      className={
        depth > 0
          ? 'border-b border-table-row bg-table-nested hover:bg-table-row-hover'
          : 'border-b border-table-row odd:bg-table-zebra-odd even:bg-table-zebra-even hover:bg-table-row-hover'
      }
    >
      <td className={`${STICKY_IND} ${STICKY_RULE} px-1.5 py-1 font-bold text-table-header-fg sm:px-2 sm:py-1.5`}>
        <div className="flex items-center gap-1 min-w-0">
          {depth === 0 ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? 'Recolher unidades' : 'Expandir unidades'}
              className={`app-transition shrink-0 flex h-6 w-6 items-center justify-center rounded border border-app-border bg-app-elevated text-app-fg shadow-sm hover:border-[color:var(--primary)] hover:bg-app-surface ${
                !hasChildren ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              onClick={() => hasChildren && onToggle(rowId)}
              disabled={!hasChildren}
            >
              <span className="text-sm font-bold leading-none" aria-hidden>
                {expanded ? '➖' : '➕'}
              </span>
            </button>
          ) : (
            <span className="inline-block h-6 w-6 shrink-0" aria-hidden />
          )}
          <span className="truncate text-[10px] leading-tight sm:text-[11px]">{indicatorLabel ?? ''}</span>
        </div>
      </td>
      {showUnidadeColumn ? (
        <td
          className={`${STICKY_UNI} ${STICKY_RULE} px-1.5 py-1 text-[10px] font-bold text-table-header-fg sm:px-2 sm:text-[11px]`}
          title={unitLabel || undefined}
        >
          {unitLabel ? <span className="block truncate">{unitLabel}</span> : <span className="text-app-muted">—</span>}
        </td>
      ) : null}
      {['m1', 'm2', 'm3'].map((mk) => (
        <MonthPair key={mk} row={row} mk={mk} />
      ))}
      <td
        className={`border-l border-table-total ${COL_RULE} px-1 py-1 text-right tabular-nums text-[10px] sm:px-1.5 sm:text-[11px] ${totalValueClass(t.v, row)}`}
      >
        {fmtMain(t.v, row.isP)}
      </td>
      <td className={`${COL_RULE} px-0.5 py-1 text-center tabular-nums text-[9px] font-bold text-table-header-muted sm:px-1 sm:text-[10px]`}>
        {t.sec || '—'}
      </td>
      <td
        className={`px-0.5 py-1 text-right tabular-nums text-[9px] sm:px-1 sm:text-[10px] ${ytdClass(t.ytd, row)}`}
      >
        YTD {fmtDelta(t.ytd, row.isP)}
      </td>
    </tr>
  );
}

/**
 * Matriz “Metas por volumes” — GET /api/v1/gerencia/metas-por-volumes
 * Colunas Indicador + Unidade (como no Power BI) e painel de slicers locais.
 */
export default function MetasPorVolumesTable({ filters }) {
  const params = useMemo(
    () => ({
      period: filters.period,
      regional: filters.regional,
      unidade: filters.unidade,
    }),
    [filters.period, filters.regional, filters.unidade],
  );

  const { data, loading, error } = useApi('gerencia/metas-por-volumes', params);
  const [open, setOpen] = useState(() => new Set());
  const [visInd, setVisInd] = useState(null);
  const [visUni, setVisUni] = useState(null);

  const rows = data?.data ?? [];

  useEffect(() => {
    if (!data?.data?.length) return;
    setVisInd(new Set(data.data.map((r) => r.key)));
    const uids = [
      ...new Set(
        data.data.flatMap((r) => (r.subItems || []).map((s) => s.unidadeId).filter(Boolean)),
      ),
    ];
    setVisUni(new Set(uids));
    setOpen(new Set());
  }, [data]);

  const unidadeOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      (r.subItems || []).forEach((s) => {
        if (s.unidadeId) map.set(s.unidadeId, s.name || s.unidadeId);
      });
    });
    return [...map.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'));
  }, [rows]);

  const rowsFiltered = useMemo(() => {
    if (!visInd) return rows;
    return rows.filter((r) => visInd.has(r.key));
  }, [rows, visInd]);

  const toggle = useCallback((id) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleIndKey = useCallback(
    (key) => {
      setVisInd((prev) => {
        const base = prev ?? new Set(rows.map((r) => r.key));
        const next = new Set(base);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [rows],
  );

  const toggleUniId = useCallback(
    (uid) => {
      setVisUni((prev) => {
        const base = prev ?? new Set(unidadeOptions.map(([id]) => id));
        const next = new Set(base);
        if (next.has(uid)) next.delete(uid);
        else next.add(uid);
        return next;
      });
    },
    [unidadeOptions],
  );

  const selectAllInd = useCallback(() => {
    setVisInd(new Set(rows.map((r) => r.key)));
  }, [rows]);

  const clearAllInd = useCallback(() => {
    setVisInd(new Set());
  }, []);

  const selectAllUni = useCallback(() => {
    setVisUni(new Set(unidadeOptions.map(([id]) => id)));
  }, [unidadeOptions]);

  const clearAllUni = useCallback(() => {
    setVisUni(new Set());
  }, []);

  const months = data?.months?.length ? data.months : ['Mês 1', 'Mês 2', 'Mês 3'];
  const drillAberto = open.size > 0;
  const colSpan = (drillAberto ? 2 : 1) + months.length * 2 + 3;

  if (error) {
    return (
      <div className="rounded-xl state-error-banner px-4 py-3 text-sm border">
        {error}
      </div>
    );
  }

  return (
    <section className="dashboard-panel overflow-hidden shadow-xl shadow-black/30 ring-1 ring-inset ring-pipeline-live/35">
      <div className="relative gerencia-panel-head flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 pl-4 sm:px-4 sm:py-3 sm:pl-5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--primary)] shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
            aria-hidden
          />
          <h2 className="text-lg font-semibold tracking-tight text-app-fg">
            <span className="mr-2 text-xl leading-none align-middle" aria-hidden>
              📈
            </span>
            {data?.meta?.titulo || 'Metas por volumes'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-app-border border-l-[3px] border-l-pipeline-live/70 bg-app-elevated px-3 py-1.5 text-xs font-medium text-app-fg hover:border-l-pipeline-live hover:brightness-110 [&::-webkit-details-marker]:hidden">
              <span className="text-base leading-none" aria-hidden>
                📋
              </span>
              Indicadores e unidades
              <span className="text-app-muted">▾</span>
            </summary>
            <div
              className="absolute right-0 z-30 mt-1 w-[min(100vw-2rem,20rem)] max-h-[min(70vh,22rem)] overflow-y-auto rounded-xl border border-app-border bg-app-surface py-2 shadow-2xl shadow-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-app-border px-3 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-app-muted">Indicadores</span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      className="text-[10px] text-hospital-400 hover:underline"
                      onClick={selectAllInd}
                    >
                      Todos
                    </button>
                    <button type="button" className="text-[10px] text-app-muted hover:underline" onClick={clearAllInd}>
                      Nenhum
                    </button>
                  </span>
                </div>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                  {rows.map((r) => (
                    <li key={r.key}>
                      <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-app-elevated app-transition">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-app-border"
                          checked={visInd == null ? true : visInd.has(r.key)}
                          onChange={() => toggleIndKey(r.key)}
                        />
                        <span className="text-[11px] leading-snug text-app-fg">{r.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-3 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-app-muted">Unidades (drill)</span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      className="text-[10px] text-hospital-400 hover:underline"
                      onClick={selectAllUni}
                    >
                      Todas
                    </button>
                    <button type="button" className="text-[10px] text-app-muted hover:underline" onClick={clearAllUni}>
                      Nenhuma
                    </button>
                  </span>
                </div>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                  {unidadeOptions.map(([id, label]) => (
                    <li key={id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-app-elevated app-transition">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-app-border"
                          checked={visUni == null ? true : visUni.has(id)}
                          onChange={() => toggleUniId(id)}
                        />
                        <span className="text-[11px] leading-snug text-app-fg">{label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
          {loading ? (
            <span className="flex items-center gap-2 text-xs text-app-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-pipeline-live" />
              Atualizando…
            </span>
          ) : (
          <span className="text-[10px] uppercase tracking-wider text-app-muted">
            Filtro topo + slicers
          </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table
          className={`w-full border-collapse text-left text-[10px] sm:text-[11px] ${drillAberto ? 'min-w-[920px]' : 'min-w-[760px]'}`}
        >
          <thead>
            <tr className="border-b-2 border-table-thead table-head-gradient">
              <th
                rowSpan={2}
                className={`${STICKY_IND} ${STICKY_RULE} z-20 px-1.5 py-2 text-[9px] font-bold uppercase tracking-wide text-table-header-fg sm:px-2 sm:text-[10px]`}
              >
                Indicador
              </th>
              {drillAberto ? (
                <th
                  rowSpan={2}
                  className={`${STICKY_UNI} ${STICKY_RULE} z-20 px-1.5 py-2 text-[9px] font-bold uppercase tracking-wide text-table-header-fg sm:px-2 sm:text-[10px]`}
                >
                  Unidade
                </th>
              ) : null}
              {months.map((m) => (
                <th
                  key={m}
                  colSpan={2}
                  className={`border-r border-table-grid bg-table-head-metric px-0.5 py-1.5 text-center text-[10px] font-semibold text-table-header-fg sm:px-1 sm:text-[11px]`}
                >
                  {m}
                </th>
              ))}
              <th
                colSpan={3}
                className="border-l border-table-total bg-table-total-bg px-0.5 py-1.5 text-center text-[10px] font-semibold text-table-header-fg ring-1 ring-inset ring-pipeline-live/25 sm:text-[11px]"
              >
                Total
              </th>
            </tr>
            <tr className="border-b border-table-row table-subhead-row text-[8px] font-semibold uppercase tracking-wide sm:text-[9px]">
              {months.map((m) => (
                <React.Fragment key={`${m}-sub`}>
                  <th className={`${COL_RULE} px-0.5 py-1 text-right font-normal sm:px-1`}>Valor</th>
                  <th className={`${COL_RULE} px-0.5 py-1 text-right font-normal sm:px-1`}>Var.</th>
                </React.Fragment>
              ))}
              <th className="border-l border-table-total py-1 pl-1 pr-0.5 text-right font-normal sm:pl-2">Valor</th>
              <th className={`${COL_RULE} px-0.5 py-1 text-center font-normal sm:px-1`}>(ref.)</th>
              <th className="py-1 pl-0.5 pr-1 text-right font-normal sm:pr-2">YTD</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse border-b border-table-row">
                    <td className="bg-app-elevated py-3" colSpan={colSpan}>
                      <div className="mx-2 h-3 rounded bg-app-border" />
                    </td>
                  </tr>
                ))
              : null}
            {rowsFiltered.map((row) => {
              const rid = row.key || row.name;
              const subs = row.subItems || [];
              const subsFiltered =
                visUni == null ? subs : subs.filter((s) => s.unidadeId && visUni.has(s.unidadeId));
              const hasChildren = subsFiltered.length > 0;
              const expanded = open.has(rid);

              return (
                <React.Fragment key={rid}>
                  <DataRow
                    row={row}
                    depth={0}
                    expanded={expanded}
                    onToggle={toggle}
                    rowId={rid}
                    hasChildren={hasChildren}
                    indicatorLabel={row.name}
                    unitLabel={null}
                    showUnidadeColumn={drillAberto}
                  />
                  {expanded &&
                    subsFiltered.map((sub, j) => (
                      <DataRow
                        key={`${rid}-${sub.unidadeId ?? j}`}
                        row={{ ...sub, isReverso: row.isReverso, isP: row.isP }}
                        depth={1}
                        expanded={false}
                        onToggle={() => {}}
                        rowId={`${rid}-sub-${j}`}
                        hasChildren={false}
                        indicatorLabel={null}
                        unitLabel={sub.name}
                        showUnidadeColumn={drillAberto}
                      />
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
