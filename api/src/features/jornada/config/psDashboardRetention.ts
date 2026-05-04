/**
 * Janelas de referência por área — Pronto Socorro (documentação / alinhamento com produto).
 *
 * **Carga dinâmica (csv-memory):** `ensureStore(pill)` usa `min(GERENCIAL_STORE_RETENTION_DAYS, max(90, pill))` —
 * arranque com pills 1–60d → **90d** em RAM; ao escolher **180** ou **365**, o store **recarrega** com mais histórico (log `[data] store: expandindo...`).
 *
 * Futuro (Postgres): rotas distintas com `WHERE` por intervalo; aqui o DuckDB ainda lê o ficheiro inteiro.
 */
export const PS_DASHBOARD_RETENTION_DAYS = {
  /** Referência UX (pill); em csv-memory o store pode truncar antes — ver `gerencialStoreRetentionDays`. */
  gerencialResumoPillMax: 365,
  metasPorVolumes: 90,
  mapaCalorPs: 30
} as const;

/** Default de dias na 1.ª carga quando não há env (90 = teto do 2.º bloco / Metas). */
export function gerencialStoreRetentionDaysDefault(): number {
  return Math.max(PS_DASHBOARD_RETENTION_DAYS.metasPorVolumes, PS_DASHBOARD_RETENTION_DAYS.mapaCalorPs);
}
