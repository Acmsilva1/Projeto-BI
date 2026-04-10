import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GERENCIA_CHART_KINDS } from '../utils/gerenciaChartOptions.js';

export default function GerenciaChartToolbar({ theme, chartKind, onChartKindChange, className = '' }) {
  const isLight = theme === 'light';
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const current = GERENCIA_CHART_KINDS.find((k) => k.id === chartKind) ?? GERENCIA_CHART_KINDS[0];

  const pick = (id) => {
    onChartKindChange?.(id);
    close();
  };

  const btnBase =
    'min-w-[7.5rem] rounded-lg border px-2 py-1 text-left text-[11px] font-semibold shadow-sm flex w-full items-center justify-between gap-1 outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_55%,transparent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--app-bg)]';
  const btnTheme = isLight
    ? 'border-black/15 bg-white text-black hover:bg-slate-50'
    : 'border-white/25 bg-[var(--app-elevated)] text-white ring-1 ring-inset ring-white/10 hover:bg-white/[0.08]';

  const menuTheme = isLight
    ? 'border-black/15 bg-white text-black shadow-lg ring-1 ring-black/5'
    : 'border-white/25 bg-[var(--app-elevated)] text-white shadow-[0_10px_28px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/10';

  const itemActive = isLight
    ? 'bg-sky-100 font-bold text-sky-950'
    : 'bg-[color-mix(in_srgb,var(--primary)_38%,var(--app-elevated))] font-bold text-white';
  const itemIdle = isLight ? 'text-black hover:bg-slate-100' : 'text-white hover:bg-white/12';

  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`}>
      <div className="flex items-center gap-1.5">
        <span className={`whitespace-nowrap text-[11px] font-semibold ${isLight ? 'text-black/70' : 'text-white'}`}>
          Tipo
        </span>
        <div ref={rootRef} className="relative z-30">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Tipo de gráfico: ${current.label}`}
            className={`${btnBase} ${btnTheme}`}
            onClick={() => setOpen((o) => !o)}
          >
            <span>{current.label}</span>
            <span className="shrink-0 text-[9px] opacity-75" aria-hidden>
              {open ? '▲' : '▼'}
            </span>
          </button>
          {open ? (
            <ul
              role="listbox"
              aria-label="Tipo de gráfico"
              className={`absolute right-0 z-[200] mt-1 min-w-full overflow-hidden rounded-lg border py-0.5 ${menuTheme}`}
            >
              {GERENCIA_CHART_KINDS.map((k) => {
                const active = k.id === chartKind;
                return (
                  <li key={k.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`w-full px-2.5 py-1.5 text-left text-[11px] font-semibold ${active ? itemActive : itemIdle}`}
                      onClick={() => pick(k.id)}
                    >
                      {k.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
