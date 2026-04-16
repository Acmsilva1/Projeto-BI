/**
 * Mensageria leve (in-process) para UX da Gerência — EventTarget no módulo.
 * Útil para indicadores globais, logging de diagnóstico ou extensões futuras.
 */
const bus = new EventTarget();

/** @typedef {{ url?: string, params?: Record<string, unknown>, reason?: string }} GerenciaUxDetail */

export const GerenciaUxEvents = {
  /** Novo pedido ganhou sequência (pedido anterior abortado ou substituído). */
  RequestStart: 'gerencia-ux:request-start',
  /** Resposta aplicada ao estado (ok). */
  RequestSettled: 'gerencia-ux:request-settled',
  /** Pedido cancelado (troca de filtro, timeout ou desmontagem). */
  RequestAborted: 'gerencia-ux:request-aborted',
};

/**
 * @param {string} type
 * @param {GerenciaUxDetail} [detail]
 */
export function emitGerenciaUx(type, detail = {}) {
  try {
    bus.dispatchEvent(new CustomEvent(type, { detail }));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} type
 * @param {(detail: GerenciaUxDetail) => void} fn
 * @returns {() => void}
 */
export function onGerenciaUx(type, fn) {
  const w = (e) => fn(e.detail || {});
  bus.addEventListener(type, w);
  return () => bus.removeEventListener(type, w);
}
