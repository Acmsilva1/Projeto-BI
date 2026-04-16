/**
 * Subscrições de teste para o bus de fatia Gerência (janela temporal).
 * Ative com `GERENCIA_MESSAGING_DEBUG=1`.
 */
import { DomainEvents } from '../domain/messages/events.js';
import { domainEventBus } from './domainEventBus.js';

export function registerGerenciaDataSliceMessaging(): void {
  if (String(process.env.GERENCIA_MESSAGING_DEBUG || '').trim() !== '1') return;

  domainEventBus.on(DomainEvents.GerenciaDataSliceRequested, (payload) => {
    console.log('[gerencia-msg] fatia pedida', payload);
  });
  domainEventBus.on(DomainEvents.GerenciaDataSliceLoaded, (payload) => {
    console.log('[gerencia-msg] fatia carregada', payload);
  });
}
