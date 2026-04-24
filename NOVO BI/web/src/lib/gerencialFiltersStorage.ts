const GERENCIAL_FILTERS_STORAGE_KEY = "novo-bi:gerencial:filters";
/** Unidade só na sessão do separador: nova aba abre sempre visão global (Todas). */
const SESSION_UNIDADE_KEY = "novo-bi:gerencial:unidade-session";

export type PeriodDays = 1 | 7 | 15 | 30 | 60 | 90 | 180;

const ALLOWED_PERIODS: readonly PeriodDays[] = [1, 7, 15, 30, 60, 90, 180];

type PersistedFilters = {
  period?: number;
  regional?: string;
  /** Legado: antes da unidade ir para sessionStorage; ignorado na leitura. */
  unidade?: string;
};

function normalizeStoredPeriod(raw: unknown): PeriodDays {
  const n = Number(raw);
  return ALLOWED_PERIODS.includes(n as PeriodDays) ? (n as PeriodDays) : 1;
}

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

/**
 * Abertura: **Ontem** (periodo 1) se nada persistido; senao restaura `period` e `regional` do localStorage.
 * Unidade ve da sessao do separador (`SESSION_UNIDADE_KEY`).
 */
export function readGerencialFilters(): { period: PeriodDays; regional: string; unidade: string } {
  try {
    const raw = window.localStorage.getItem(GERENCIAL_FILTERS_STORAGE_KEY);
    if (!raw) return { period: 1, regional: "ALL", unidade: readUnidadeFromSession() };
    const parsed = JSON.parse(raw) as PersistedFilters;
    const regional = parsed.regional && parsed.regional.trim().length > 0 ? parsed.regional : "ALL";
    return { period: normalizeStoredPeriod(parsed.period), regional, unidade: readUnidadeFromSession() };
  } catch {
    return { period: 1, regional: "ALL", unidade: readUnidadeFromSession() };
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
