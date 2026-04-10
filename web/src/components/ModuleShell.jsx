/**
 * Área reservada para o módulo — sem KPIs nem gráficos até ligar dados no backend.
 */
export default function ModuleShell({ title, subtitle }) {
  return (
    <div className="animate-fade-in-up rounded-2xl border border-dashed border-slate-700/90 bg-slate-900/25 px-8 py-16 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-hospital-400/90">Módulo</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-100">{title}</h2>
      <p className="mt-3 text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">{subtitle}</p>
    </div>
  );
}
