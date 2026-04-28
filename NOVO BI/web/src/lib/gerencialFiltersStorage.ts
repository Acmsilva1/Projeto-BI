export type GerencialModule = "ps" | "internacao";

const GERENCIAL_FILTERS_STORAGE_KEY: Record<GerencialModule, string> = {
  ps: "novo-bi:gerencial:ps:filters",
  internacao: "novo-bi:gerencial:internacao:filters"
};
/** Unidade só na sessão do separador: nova aba abre sempre visão global (Todas). */
const SESSION_UNIDADE_KEY: Record<GerencialModule, string> = {
  ps: "novo-bi:gerencial:ps:unidade-session",
  internacao: "novo-bi:gerencial:internacao:unidade-session"
};

export type PeriodDays = 1 | 7 | 15 | 30 | 60 | 90 | 180 | 365;

const ALLOWED_PERIODS: readonly PeriodDays[] = [1, 7, 15, 30, 60, 90, 180, 365];

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
export function clearGerencialSessionUnidade(module?: GerencialModule): void {
  try {
    if (module) {
      window.sessionStorage.removeItem(SESSION_UNIDADE_KEY[module]);
      return;
    }
    window.sessionStorage.removeItem(SESSION_UNIDADE_KEY.ps);
    window.sessionStorage.removeItem(SESSION_UNIDADE_KEY.internacao);
  } catch {
    /* noop */
  }
}

function readUnidadeFromSession(module: GerencialModule): string {
  try {
    const raw = window.sessionStorage.getItem(SESSION_UNIDADE_KEY[module]);
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
export function readGerencialFilters(module: GerencialModule): { period: PeriodDays; regional: string; unidade: string } {
  try {
    const raw = window.localStorage.getItem(GERENCIAL_FILTERS_STORAGE_KEY[module]);
    if (!raw) return { period: 1, regional: "ALL", unidade: readUnidadeFromSession(module) };
    const parsed = JSON.parse(raw) as PersistedFilters;
    const regional = parsed.regional && parsed.regional.trim().length > 0 ? parsed.regional : "ALL";
    return { period: normalizeStoredPeriod(parsed.period), regional, unidade: readUnidadeFromSession(module) };
  } catch {
    return { period: 1, regional: "ALL", unidade: readUnidadeFromSession(module) };
  }
}

export function writeGerencialFilters(module: GerencialModule, payload: { period: PeriodDays; regional: string; unidade: string }): void {
  try {
    window.localStorage.setItem(
      GERENCIAL_FILTERS_STORAGE_KEY[module],
      JSON.stringify({ period: payload.period, regional: payload.regional })
    );
    if (payload.unidade === "ALL") {
      window.sessionStorage.removeItem(SESSION_UNIDADE_KEY[module]);
    } else {
      window.sessionStorage.setItem(SESSION_UNIDADE_KEY[module], payload.unidade);
    }
  } catch {
    /* storage indisponivel */
  }
  notify();
}
