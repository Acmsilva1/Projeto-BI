/**
 * Nomes estáveis de eventos de domínio (mensageria interna).
 */
export const DomainEvents = {
  GerenciaDashboardBundleBuilt: 'domain.gerencia.dashboard.bundle.built',
  /** Antes de carregar fact tables (janela = período do pedido). */
  GerenciaDataSliceRequested: 'domain.gerencia.data.slice.requested',
  /** Depois do carregamento — contagens por tabela (dados já filtrados à janela). */
  GerenciaDataSliceLoaded: 'domain.gerencia.data.slice.loaded',
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];
