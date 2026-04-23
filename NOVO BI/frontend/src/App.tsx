import { motion } from "framer-motion";
import { type ReactElement } from "react";
import { AnimatedEmojiField } from "./components/AnimatedEmojiField";
import { GerencialTopCards } from "./components/gerencial/GerencialTopCards";
import { MetasPorVolumesTable } from "./components/gerencial/MetasPorVolumesTable";
import { PsChegadasHeatmap } from "./components/gerencial/PsChegadasHeatmap";
import { Button } from "./components/ui/button";

export default function App(): ReactElement {
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
          <GerencialTopCards />
        </motion.div>

        <motion.section
          className="glass-card p-4 md:p-6"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
        >
          <div className="mb-3">
            <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--table-header-fg)] md:text-2xl">Metas por volume</h2>
          </div>
          <MetasPorVolumesTable />
        </motion.section>

        <motion.section
          className="glass-card p-4 md:p-6"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          <PsChegadasHeatmap />
        </motion.section>
      </main>
    </div>
  );
}
