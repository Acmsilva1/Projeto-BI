import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Plus, Minus, Loader2, ListFilter } from 'lucide-react';
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

/** Cores estilo Power BI: reverso = menor % melhor; desfecho = maior melhor. */
function mainCellClass(v, row) {
  const n = Number(v);
  const isZero = !Number.isFinite(n) || (n === 0 && Number(row?.m1?.d) === 0);
  if (isZero) return 'bg-slate-800/25 text-slate-500 border border-slate-700/40';

  if (row.isP && row.isReverso) {
    if (n <= 5) return 'bg-emerald-900/35 text-emerald-50 border border-emerald-700/35';
    if (n <= 12) return 'bg-amber-900/30 text-amber-50 border border-amber-700/30';
    return 'bg-orange-950/40 text-orange-100 border border-orange-800/35';
  }
  if (row.isP && !row.isReverso) {
    if (n >= 88) return 'bg-emerald-900/35 text-emerald-50 border border-emerald-700/35';
    if (n >= 75) return 'bg-slate-700/50 text-slate-100 border border-slate-600/40';
    return 'bg-amber-900/25 text-amber-100 border border-amber-800/25';
  }
  return 'bg-slate-800/40 text-slate-100 border border-slate-600/35';
}

function deltaCellClass(d) {
  const n = Number(d);
  if (!Number.isFinite(n) || n === 0) return 'text-slate-500 bg-slate-900/40';
  if (n > 0) return 'text-emerald-400 bg-slate-900/40';
  return 'text-rose-400 bg-slate-900/40';
}

function totalValueClass(v, row) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return 'text-slate-400';
  if (row.isP && row.isReverso) return n <= 8 ? 'text-emerald-400 font-semibold' : 'text-rose-300 font-semibold';
  if (row.isP && !row.isReverso) return n >= 85 ? 'text-emerald-400 font-semibold' : 'text-amber-300 font-semibold';
  return 'text-slate-100 font-semibold';
}

function ytdClass(y, row) {
  const n = Number(y);
  if (!Number.isFinite(n) || n === 0) return 'text-slate-500';
  if (row.isReverso) return n < 0 ? 'text-emerald-400' : n > 0 ? 'text-rose-400' : 'text-slate-400';
  return n > 0 ? 'text-emerald-400' : n < 0 ? 'text-rose-400' : 'text-slate-400';
}

function MonthPair({ row, mk }) {
  const cell = row[mk] || { v: 0, d: 0 };
  return (
    <>
      <td className={`px-1.5 py-2 text-right tabular-nums ${mainCellClass(cell.v, row)}`}>
        {fmtMain(cell.v, row.isP)}
      </td>
      <td className={`px-1.5 py-2 text-right tabular-nums text-[11px] ${deltaCellClass(cell.d)}`}>
        {fmtDelta(cell.d, row.isP)}
      </td>
    </>
  );
}

const STICKY_IND = 'sticky left-0 z-[15] w-52 min-w-[13rem] max-w-[13rem]';
const STICKY_UNI = 'sticky left-52 z-[14] w-56 min-w-[14rem] max-w-[14rem] border-l border-slate-800/80';

function DataRow({
  row,
  depth,
  expanded,
  onToggle,
  rowId,
  hasChildren,
  indicatorLabel,
  unitLabel,
}) {
  const t = row.t || { v: 0, ytd: 0, sec: '(0)' };

  return (
    <tr className={depth > 0 ? 'bg-slate-950/60 hover:bg-slate-900/80' : 'bg-slate-900/40 hover:bg-slate-900/70'}>
      <td className={`${STICKY_IND} border-r border-slate-700 bg-inherit px-2 py-1.5 font-medium text-slate-200`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {depth === 0 ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? 'Recolher unidades' : 'Expandir unidades'}
              className={`shrink-0 flex h-7 w-7 items-center justify-center rounded border border-slate-600 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white ${
                !hasChildren ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              onClick={() => hasChildren && onToggle(rowId)}
              disabled={!hasChildren}
            >
              {expanded ? <Minus size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
            </button>
          ) : (
            <span className="inline-block h-7 w-7 shrink-0" aria-hidden />
          )}
          <span className="truncate text-[12px] leading-tight">{indicatorLabel ?? ''}</span>
        </div>
      </td>
      <td
        className={`${STICKY_UNI} border-r border-slate-700 bg-inherit px-2 py-1.5 text-[12px] text-slate-300`}
        title={unitLabel || undefined}
      >
        {unitLabel ? <span className="block truncate">{unitLabel}</span> : <span className="text-slate-600">—</span>}
      </td>
      {['m1', 'm2', 'm3'].map((mk) => (
        <MonthPair key={mk} row={row} mk={mk} />
      ))}
      <td className={`px-2 py-2 text-right tabular-nums text-[12px] border-l border-slate-700 ${totalValueClass(t.v, row)}`}>
        {fmtMain(t.v, row.isP)}
      </td>
      <td className="px-2 py-2 text-center tabular-nums text-[11px] text-slate-500 border-slate-700">
        {t.sec || '—'}
      </td>
      <td className={`px-2 py-2 text-right tabular-nums text-[11px] font-medium border-r border-slate-700 ${ytdClass(t.ytd, row)}`}>
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
  const colSpan = 2 + months.length * 2 + 3;

  if (error) {
    return (
      <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
        {error}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-700/90 bg-slate-900/50 shadow-xl shadow-black/20 overflow-hidden">
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 bg-slate-900/80 px-4 py-3">
        <h2 className="text-base font-semibold tracking-tight text-white">
          {data?.meta?.titulo || 'Metas por volumes'}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
              <ListFilter className="h-3.5 w-3.5 text-hospital-400" aria-hidden />
              Indicadores e unidades
              <span className="text-slate-500">▾</span>
            </summary>
            <div
              className="absolute right-0 z-30 mt-1 w-[min(100vw-2rem,20rem)] max-h-[min(70vh,22rem)] overflow-y-auto rounded-xl border border-slate-600 bg-slate-950 py-2 shadow-2xl shadow-black/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-800 px-3 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Indicadores</span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      className="text-[10px] text-hospital-400 hover:underline"
                      onClick={selectAllInd}
                    >
                      Todos
                    </button>
                    <button type="button" className="text-[10px] text-slate-500 hover:underline" onClick={clearAllInd}>
                      Nenhum
                    </button>
                  </span>
                </div>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                  {rows.map((r) => (
                    <li key={r.key}>
                      <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-slate-900">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-slate-600"
                          checked={visInd == null ? true : visInd.has(r.key)}
                          onChange={() => toggleIndKey(r.key)}
                        />
                        <span className="text-[11px] leading-snug text-slate-200">{r.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-3 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unidades (drill)</span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      className="text-[10px] text-hospital-400 hover:underline"
                      onClick={selectAllUni}
                    >
                      Todas
                    </button>
                    <button type="button" className="text-[10px] text-slate-500 hover:underline" onClick={clearAllUni}>
                      Nenhuma
                    </button>
                  </span>
                </div>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                  {unidadeOptions.map(([id, label]) => (
                    <li key={id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-slate-900">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-slate-600"
                          checked={visUni == null ? true : visUni.has(id)}
                          onChange={() => toggleUniId(id)}
                        />
                        <span className="text-[11px] leading-snug text-slate-200">{label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
          {loading ? (
            <span className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Atualizando…
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              Filtro topo + slicers
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-950/90 text-slate-300">
              <th
                rowSpan={2}
                className={`${STICKY_IND} z-20 border-b border-r border-slate-700 bg-slate-950 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wide`}
              >
                Indicador
              </th>
              <th
                rowSpan={2}
                className={`${STICKY_UNI} z-20 border-b border-r border-slate-700 bg-slate-950 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wide`}
              >
                Unidade
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  colSpan={2}
                  className="border-b border-slate-700 px-1 py-2 text-center text-[11px] font-semibold text-slate-200"
                >
                  {m}
                </th>
              ))}
              <th
                colSpan={3}
                className="border-b border-l border-slate-600 bg-slate-900/90 px-1 py-2 text-center text-[11px] font-semibold text-slate-100"
              >
                Total
              </th>
            </tr>
            <tr className="border-b border-slate-700 bg-slate-950/95 text-[9px] font-medium uppercase tracking-wider text-slate-500">
              {months.map((m) => (
                <React.Fragment key={`${m}-sub`}>
                  <th className="px-1 py-1.5 text-right font-normal">Valor</th>
                  <th className="px-1 py-1.5 text-right font-normal border-r border-slate-800/80">Var.</th>
                </React.Fragment>
              ))}
              <th className="border-l border-slate-600 pl-2 pr-1 py-1.5 text-right font-normal">Valor</th>
              <th className="px-1 py-1.5 text-center font-normal">(ref.)</th>
              <th className="pr-2 pl-1 py-1.5 text-right font-normal">YTD</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse border-b border-slate-800/80">
                    <td className="bg-slate-900 py-3" colSpan={colSpan}>
                      <div className="mx-2 h-3 rounded bg-slate-800" />
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
