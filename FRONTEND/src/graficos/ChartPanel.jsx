import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Área visual padrão para gráficos ECharts no dashboard (Visão Gerência, módulos).
 * Usa tokens de tabela (`border-table-grid`) e superfície clara/escura alinhadas ao tema.
 *
 * @param {'card' | 'embedded'} variant
 * - **card**: caixa com `rounded-xl` + borda completa (gráfico isolado ou com `mt-4`).
 * - **embedded**: só `border-t` sob o cabeçalho do painel (`.dashboard-panel` já arredonda o bloco).
 */
export default function ChartPanel({
  children,
  theme,
  variant = 'card',
  className = '',
  minHeightClass = '',
  paddingClassName = 'p-1 sm:p-2',
  loading = false,
}) {
  const isLight = theme === 'light';
  const surface = isLight ? 'bg-white shadow-sm' : 'bg-slate-900/25 shadow-inner';

  const shell =
    variant === 'embedded'
      ? `relative min-w-0 border-t border-table-grid ${paddingClassName} ${surface}`
      : `relative min-w-0 rounded-xl border border-table-grid ${paddingClassName} ${surface}`;

  const overlayRounded = variant === 'card' ? 'rounded-xl' : '';

  return (
    <div className={`${shell} ${minHeightClass} ${className}`.trim()}>
      {loading ? (
        <div
          className={[
            'absolute inset-0 z-10 flex items-center justify-center',
            isLight ? 'bg-white/80' : 'bg-slate-950/40',
            overlayRounded,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-busy="true"
          aria-live="polite"
        >
          <Loader2 className="h-8 w-8 animate-spin text-sky-500" aria-hidden />
        </div>
      ) : null}
      {children}
    </div>
  );
}
