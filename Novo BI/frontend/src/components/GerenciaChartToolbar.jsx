import { GERENCIA_CHART_KINDS } from '../utils/gerenciaChartOptions.js';

const btn =
  'rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--primary)_55%,transparent)]';

export default function GerenciaChartToolbar({
  theme,
  showViewToggle,
  viewMode,
  onViewModeChange,
  chartKind,
  onChartKindChange,
  tableModeLabel = 'Tabela',
  chartModeLabel = 'Gráfico',
  className = '',
}) {
  const inactive = theme === 'light' ? 'border-black/10 bg-white/70 text-black/70' : 'border-white/10 bg-white/5 text-white/70';
  const active = theme === 'light' ? 'border-black/15 bg-black/[0.04] text-black' : 'border-white/15 bg-white/10 text-white';
  const isLight = theme === 'light';

  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`}>
      {showViewToggle && onViewModeChange ? (
        <div
          className={
            isLight
              ? 'flex items-center gap-1 rounded-lg border border-black/10 bg-black/[0.02] p-0.5'
              : 'flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5'
          }
        >
          <button
            type="button"
            className={`${btn} ${viewMode === 'table' ? active : inactive}`}
            onClick={() => onViewModeChange('table')}
          >
            {tableModeLabel}
          </button>
          <button
            type="button"
            className={`${btn} ${viewMode === 'chart' ? active : inactive}`}
            onClick={() => onViewModeChange('chart')}
          >
            {chartModeLabel}
          </button>
        </div>
      ) : null}
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
