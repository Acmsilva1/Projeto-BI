const GERENCIAL_FILTERS_STORAGE_KEY = "novo-bi:gerencial:filters";
/** Unidade só na sessão do separador: nova aba abre sempre visão global (Todas). */
const SESSION_UNIDADE_KEY = "novo-bi:gerencial:unidade-session";

export type PeriodDays = 7 | 15 | 30 | 60 | 90 | 180;

type PersistedFilters = {
  period?: number;
  regional?: string;
  /** Legado: antes da unidade ir para sessionStorage; ignorado na leitura. */
  unidade?: string;
};

const listeners = new Set<() => void>();

export function subscribeGerencialFilters(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function parsePeriod(raw: unknown): PeriodDays {
  const n = Number(raw);
  if (n === 15) return 15;
  if (n === 30) return 30;
  if (n === 60) return 60;
  if (n === 90) return 90;
  if (n === 180) return 180;
  return 7;
}

/** Ao abrir o modulo gerencial: visao global (deixa de herdar unidade de sessao anterior). */
export function clearGerencialSessionUnidade(): void {
  try {
    window.sessionStorage.removeItem(SESSION_UNIDADE_KEY);
  } catch {
    /* noop */
  }
}

function readUnidadeFromSession(): string {
  try {
    const raw = window.sessionStorage.getItem(SESSION_UNIDADE_KEY);
    if (!raw) return "ALL";
    const t = raw.trim();
    if (t.length === 0 || t.toUpperCase() === "ALL") return "ALL";
    return t;
  } catch {
    return "ALL";
  }
}

export function readGerencialFilters(): { period: PeriodDays; regional: string; unidade: string } {
  try {
    const raw = window.localStorage.getItem(GERENCIAL_FILTERS_STORAGE_KEY);
    if (!raw) return { period: 7, regional: "ALL", unidade: readUnidadeFromSession() };
    const parsed = JSON.parse(raw) as PersistedFilters;
    const regional = parsed.regional && parsed.regional.trim().length > 0 ? parsed.regional : "ALL";
    const period = parsePeriod(parsed.period);
    return { period, regional, unidade: readUnidadeFromSession() };
  } catch {
    return { period: 7, regional: "ALL", unidade: readUnidadeFromSession() };
  }
}

export function writeGerencialFilters(payload: { period: PeriodDays; regional: string; unidade: string }): void {
  try {
    window.localStorage.setItem(
      GERENCIAL_FILTERS_STORAGE_KEY,
      JSON.stringify({ period: payload.period, regional: payload.regional })
    );
    if (payload.unidade === "ALL") {
      window.sessionStorage.removeItem(SESSION_UNIDADE_KEY);
    } else {
      window.sessionStorage.setItem(SESSION_UNIDADE_KEY, payload.unidade);
    }
  } catch {
    /* storage indisponivel */
  }
  notify();
}
