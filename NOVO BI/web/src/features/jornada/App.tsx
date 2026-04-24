import { motion } from "framer-motion";
import { useEffect, useState, type ReactElement } from "react";
import { AnimatedEmojiField } from "../../components/AnimatedEmojiField";
import { GerencialTopCards } from "../../components/gerencial/GerencialTopCards";
import { MetasPorVolumesTable } from "../../components/gerencial/MetasPorVolumesTable";
import { PsChegadasHeatmap } from "../../components/gerencial/PsChegadasHeatmap";
import { Button } from "../../components/ui/button";
import {
  clearGerencialSessionUnidade,
  readGerencialFilters,
  writeGerencialFilters,
  type PeriodDays
} from "../../lib/gerencialFiltersStorage";

export default function App(): ReactElement {
  const initial = readGerencialFilters();
  const [period, setPeriod] = useState<PeriodDays>(initial.period);
  const [regional, setRegional] = useState<string>(initial.regional);
  const [unidade, setUnidade] = useState<string>(initial.unidade);

  useEffect(() => {
    clearGerencialSessionUnidade();
  }, []);

  useEffect(() => {
    writeGerencialFilters({ period, regional, unidade });
  }, [period, regional, unidade]);

  return (
    <div className="app-shell">
      <AnimatedEmojiField />

      <main className="mx-auto flex w-full max-w-[1820px] flex-col gap-6">
        <motion.section
          className="glass-card p-5 md:p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-[var(--foreground)] md:text-3xl">Módulo Gerencial</h1>
            </div>
            <Button variant="ghost">Visão de gestão</Button>
          </div>
        </motion.section>

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
          className="glass-card p-4 md:p-6"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
        >
          <div className="mb-3">
            <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--table-header-fg)] md:text-2xl">Metas por volume</h2>
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              Recorte alinhado ao painel acima (período, regional e unidade).
            </p>
          </div>
          <MetasPorVolumesTable period={period} regional={regional} unidade={unidade} />
        </motion.section>

        <motion.section
          className="glass-card p-4 md:p-6"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          <div className="mb-3">
            <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--table-header-fg)] md:text-2xl">
              Chegadas por hora (PS)
            </h2>
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              Regional segue o resumo acima; com unidade &quot;Todas&quot;, escolha a unidade do mapa no bloco. Mês civil
              (padrão: mês atual).
            </p>
          </div>
          <PsChegadasHeatmap period={period} regional={regional} unidade={unidade} />
        </motion.section>
      </main>
    </div>
  );
}
