/**
 * Mensageria em processo — pub/sub síncrono para desacoplar side-effects (logs, futuras filas).
 */
import type { DomainEventName } from '../domain/messages/events.js';

type Handler = (payload: unknown) => void;

const handlers = new Map<string, Set<Handler>>();

export const domainEventBus = {
  on(event: DomainEventName | string, fn: Handler): void {
    let set = handlers.get(event);
    if (!set) {
      set = new Set();
      handlers.set(event, set);
    }
    set.add(fn);
  },

  off(event: DomainEventName | string, fn: Handler): void {
    handlers.get(event)?.delete(fn);
  },

  emit(event: DomainEventName | string, payload?: unknown): void {
    const set = handlers.get(event);
    if (!set?.size) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[domainEventBus] handler error for ${event}:`, e);
      }
    }
  },
};
