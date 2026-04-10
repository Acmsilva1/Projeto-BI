import { GERENCIA_CHART_KINDS } from '../utils/gerenciaChartOptions.js';

export default function GerenciaChartToolbar({ theme, chartKind, onChartKindChange, className = '' }) {
  const isLight = theme === 'light';

  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`}>
      <label
        className={`flex items-center gap-1.5 text-[11px] font-semibold ${isLight ? 'text-black/70' : 'text-white'}`}
      >
        <span className="whitespace-nowrap">Tipo</span>
        <select
          className={
            isLight
              ? 'min-w-[7.5rem] rounded-lg border border-black/10 bg-white px-2 py-1 text-[11px] font-semibold text-black shadow-sm'
              : 'min-w-[7.5rem] rounded-lg border border-white/10 bg-[color-mix(in_srgb,var(--surface-2)_88%,transparent)] px-2 py-1 text-[11px] font-semibold text-white shadow-sm'
          }
          value={chartKind}
          onChange={(e) => onChartKindChange?.(e.target.value)}
        >
          {GERENCIA_CHART_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
