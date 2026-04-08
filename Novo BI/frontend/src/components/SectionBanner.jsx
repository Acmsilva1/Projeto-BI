import React from 'react';

/**
 * Cabeçalho estilo relatório Power BI por área (PS / CC / Internação).
 */
export default function SectionBanner({ titulo, subtitulo, cor = 'hospital' }) {
  const bar =
    cor === 'emerald'
      ? 'from-emerald-500/80 to-emerald-600/40'
      : cor === 'violet'
        ? 'from-violet-500/80 to-violet-600/40'
        : cor === 'amber'
          ? 'from-amber-500/80 to-amber-600/40'
          : 'from-sky-500/80 to-hospital-600/40';

  return (
    <header className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden mb-6">
      <div className={`h-1 bg-gradient-to-r ${bar}`} />
      <div className="px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">{subtitulo}</p>
        <h1 className="text-xl font-bold text-white tracking-tight">{titulo}</h1>
      </div>
    </header>
  );
}
