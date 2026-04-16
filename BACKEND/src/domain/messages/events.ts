/**
 * Nomes estáveis de eventos de domínio (mensageria interna).
 */
export const DomainEvents = {
  GerenciaDashboardBundleBuilt: 'domain.gerencia.dashboard.bundle.built',
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];
