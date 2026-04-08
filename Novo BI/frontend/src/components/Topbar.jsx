/**
 * Topbar.jsx — Cabeçalho global com filtros + status
 */
import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const REGIONAIS = [
  { value: '', label: 'Todas Regionais' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'MG', label: 'Minas Gerais' },
];

const PERIODOS = [
  { value: 30,  label: 'Últimos 30 dias' },
  { value: 90,  label: 'Últimos 90 dias' },
  { value: 365, label: 'Ano Atual' },
];

const Topbar = ({ filters, onFilterChange, onRefresh, sectionLabel, apiOnline }) => {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ' —'));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const selectCls = 'bg-transparent border-none text-xs font-medium focus:ring-0 text-slate-200 cursor-pointer py-1';

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 bg-slate-900/60 border-b border-slate-800 backdrop-blur-sm z-10">
      {/* Breadcrumb */}
      <div className="flex flex-col">
        <h1 className="text-sm font-bold text-white">{sectionLabel}</h1>
        <p className="text-[10px] text-slate-500 font-mono">{clock}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Filtros */}
        <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 px-3 py-1.5 rounded-xl">
          <select
            className={selectCls}
            value={filters.regional}
            onChange={(e) => onFilterChange({ regional: e.target.value, unidade: '' })}
          >
            {REGIONAIS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>

          <div className="w-px h-4 bg-slate-700" />

          <select
            className={selectCls}
            value={filters.period}
            onChange={(e) => onFilterChange({ period: Number(e.target.value) })}
          >
            {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-hospital-500 hover:bg-hospital-600 text-white transition-all active:scale-90 shadow-md shadow-hospital-500/30"
        >
          <RefreshCw size={15} />
        </button>

        {/* Status */}
        <div className="flex items-center gap-2 pl-1">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${apiOnline ? 'bg-emerald-400' : 'bg-rose-400'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${apiOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          </span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {apiOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
