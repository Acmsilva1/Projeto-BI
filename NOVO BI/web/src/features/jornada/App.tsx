import { motion } from "framer-motion";
import { useEffect, useState, type ReactElement } from "react";
import { GerencialTopCards } from "../../components/gerencial/GerencialTopCards";
import { MetasPorVolumesTable } from "../../components/gerencial/MetasPorVolumesTable";
import { PsChegadasHeatmap } from "../../components/gerencial/PsChegadasHeatmap";
import { InternacaoMetasTable } from "../../components/internacao/InternacaoMetasTable";
import { InternacaoTopCards } from "../../components/internacao/InternacaoTopCards";
import { InternacaoGraficosVariados } from "../../components/internacao/InternacaoGraficosVariados";
import {
  clearGerencialSessionUnidade,
  readGerencialFilters,
  writeGerencialFilters,
  type PeriodDays
} from "../../lib/gerencialFiltersStorage";

export default function App(): ReactElement {
  const [psFilters, setPsFilters] = useState(() => readGerencialFilters("ps"));
  const [internacaoFilters, setInternacaoFilters] = useState(() => readGerencialFilters("internacao"));
  const [activeModule, setActiveModule] = useState<"ps" | "internacao">("ps");

  const currentFilters = activeModule === "ps" ? psFilters : internacaoFilters;
  const period: PeriodDays = currentFilters.period;
  const regional = currentFilters.regional;
  const unidade = currentFilters.unidade;

  const setPeriod = (next: PeriodDays): void => {
    if (activeModule === "ps") {
      setPsFilters((prev) => ({ ...prev, period: next }));
      return;
    }
    setInternacaoFilters((prev) => ({ ...prev, period: next }));
  };

  const setRegional = (next: string): void => {
    if (activeModule === "ps") {
      setPsFilters((prev) => ({ ...prev, regional: next }));
      return;
    }
    setInternacaoFilters((prev) => ({ ...prev, regional: next }));
  };

  const setUnidade = (next: string): void => {
    if (activeModule === "ps") {
      setPsFilters((prev) => ({ ...prev, unidade: next }));
      return;
    }
    setInternacaoFilters((prev) => ({ ...prev, unidade: next }));
  };

  useEffect(() => {
    clearGerencialSessionUnidade();
  }, []);

  useEffect(() => {
    writeGerencialFilters("ps", psFilters);
  }, [psFilters]);

  useEffect(() => {
    writeGerencialFilters("internacao", internacaoFilters);
  }, [internacaoFilters]);

  return (
    <div className="app-shell">
      <main className="mx-auto flex w-full max-w-[1820px] flex-col gap-6">
        <motion.section
          className="glass-card gerencial-hero p-5 md:p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="gerencial-hero-kicker">Painel Executivo</p>
              <h1 className="gerencial-hero-title">Módulo Gerencial</h1>
              <p className="gerencial-hero-subtitle">Visão consolidada de operação, metas e sazonalidade</p>
            </div>
            <div className="module-switch" role="tablist" aria-label="Seleção do módulo">
              <motion.button
                type="button"
                role="tab"
                aria-selected={activeModule === "ps"}
                className={`module-tab ${activeModule === "ps" ? "is-active" : ""}`}
                onClick={() => setActiveModule("ps")}
                whileHover={{ y: -1.5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="module-tab-icon" aria-hidden>
                  🚑
                </span>
                <span className="module-tab-label">Pronto Socorro</span>
              </motion.button>
              <motion.button
                type="button"
                role="tab"
                aria-selected={activeModule === "internacao"}
                className={`module-tab ${activeModule === "internacao" ? "is-active" : ""}`}
                onClick={() => setActiveModule("internacao")}
                whileHover={{ y: -1.5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="module-tab-icon" aria-hidden>
                  🛏️
                </span>
                <span className="module-tab-label">Internação</span>
              </motion.button>
            </div>
          </div>
        </motion.section>

        {activeModule === "ps" ? (
          <>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <GerencialTopCards
                period={period}
                regional={regional}
                unidade={unidade}
                onPeriodChange={setPeriod}
                onRegionalChange={setRegional}
                onUnidadeChange={setUnidade}
              />
            </motion.div>

            <motion.section
              className="glass-card module-shell module-shell--metas p-4 md:p-6"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
            >
              <div className="mb-3">
                <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--table-header-fg)] md:text-2xl">
                  Dashboard de Metas - Pronto socorro
                </h2>
              </div>
              <MetasPorVolumesTable period={period} regional={regional} unidade={unidade} />
            </motion.section>

            <motion.section
              className="glass-card module-shell module-shell--heatmap p-4 md:p-6"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
            >
              <div className="mb-3">
                <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--table-header-fg)] md:text-2xl">
                  Pronto Socorro - Mapa de calor
                </h2>
                <p className="mt-1 text-xs text-[var(--app-muted)]">
                  Baseado no fluxo diário dos pacientes do PS
                </p>
              </div>
              <PsChegadasHeatmap period={period} regional={regional} unidade={unidade} />
            </motion.section>
          </>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <InternacaoTopCards
                period={period}
                regional={regional}
                unidade={unidade}
                onPeriodChange={setPeriod}
                onRegionalChange={setRegional}
                onUnidadeChange={setUnidade}
              />
            </motion.div>

            <motion.section
              className="glass-card module-shell module-shell--metas p-4 md:p-6"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
            >
              <div className="mb-3">
                <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--table-header-fg)] md:text-2xl">
                  Dashboard de Metas - Internação
                </h2>
              </div>
              <InternacaoMetasTable period={period} regional={regional} unidade={unidade} />
            </motion.section>

            <motion.section
              className="glass-card module-shell module-shell--variados p-4 md:p-6"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
            >
              <div className="mb-3">
                <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--table-header-fg)] md:text-2xl">
                  Gráficos Variados - Internação
                </h2>
              </div>
              <InternacaoGraficosVariados period={period} regional={regional} unidade={unidade} />
            </motion.section>
          </>
        )}
      </main>
    </div>
  );
}
