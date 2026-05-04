import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";

export type GerencialLoadPanelProps = {
  progress: number;
  message: string;
};

/**
 * Painel de carregamento (barra + mensagem) alinhado ao módulo de cards gerenciais.
 */
export function GerencialLoadPanel(props: GerencialLoadPanelProps): ReactElement {
  return (
    <div
      className="mb-6 overflow-hidden rounded-2xl border border-[var(--table-grid)] bg-[color-mix(in_srgb,var(--app-elevated)_88%,transparent)] shadow-[0_0_40px_-12px_rgba(45,212,191,0.25)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-1 w-full bg-[var(--table-row-sep)]">
        <div
          className="h-full bg-gradient-to-r from-[var(--dash-live)] to-teal-300 transition-[width] duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(2, props.progress))}%` }}
        />
      </div>
      <div className="flex gap-4 p-5 md:p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--dash-live)]/35 bg-[color-mix(in_srgb,var(--dash-live)_12%,transparent)]">
          <Loader2 className="animate-spin text-[var(--dash-live)]" size={26} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Carregando dados</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--table-header-fg)]">{props.message}</p>
        </div>
      </div>
      <div className="px-5 pb-5 md:px-6 md:pb-6">
        <div className="h-2.5 overflow-hidden rounded-full bg-[var(--table-row-sep)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--dash-live)] via-teal-400 to-cyan-300 transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(3, props.progress))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
