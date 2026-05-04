import { Activity, ChartColumnBig } from "lucide-react";
import type { ReactElement } from "react";
import { EChartCanvas } from "./EChartCanvas";
import { MiniBarChart } from "./MiniBarChart";

export function BICanvasContainer(): ReactElement {
  return (
    <section className="dashboard-panel p-4 md:p-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">BI Canvas</p>
          <h2 className="mt-2 text-xl font-bold text-[var(--table-header-fg)] md:text-2xl">
            Container de Gráficos
          </h2>
          <p className="mt-1 text-sm text-[var(--table-header-muted)]">
            Estrutura pronta para receber painéis conforme você for direcionando o escopo.
          </p>
        </div>
        <div className="rounded-full border border-[var(--table-grid)] bg-[var(--app-elevated)] p-2 text-[var(--dash-live)]">
          <ChartColumnBig size={18} />
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="glass-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--app-muted)]">
            <Activity size={16} />
            Prévia ECharts
          </div>
          <EChartCanvas />
        </article>
        <article className="glass-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--app-muted)]">
            <Activity size={16} />
            Prévia Recharts
          </div>
          <MiniBarChart />
        </article>
      </div>
    </section>
  );
}
