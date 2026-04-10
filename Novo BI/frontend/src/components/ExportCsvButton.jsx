import React from 'react';
import { Download } from 'lucide-react';

/**
 * Botão compacto para exportar dados tabulares em CSV (cliente, sem dependências).
 */
export default function ExportCsvButton({
  onClick,
  disabled,
  title = 'Baixar CSV (UTF-8, compatível com Excel)',
  className = '',
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-md border border-app-border bg-app-elevated/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-app-fg shadow-sm transition-colors',
        'hover:border-pipeline-live/50 hover:bg-app-elevated disabled:pointer-events-none disabled:opacity-45',
        className,
      ].join(' ')}
    >
      <Download className="h-3.5 w-3.5 text-pipeline-live" aria-hidden />
      CSV
    </button>
  );
}
