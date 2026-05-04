import { useEffect, useRef, useState } from "react";

/** Frases variadas para o painel de carregamento (cards e metas). */
export const GERENCIAL_LOAD_PHRASES = [
  "Consolidando os indicadores com base nos filtros aplicados.",
  "Processando as informações retornadas pelo servidor.",
  "Carregando volumes operacionais e metas do período selecionado.",
  "Sincronizando regional, unidade e janela de análise informados.",
  "Validando os dados antes de exibir o painel gerencial.",
  "Montando a visão consolidada do recorte atual.",
  "Aguarde: organizando os principais KPIs para exibição.",
  "Cruzando bases de atendimento, exames e indicadores assistenciais.",
  "Preparando o desempenho operacional para visualização.",
  "Atualizando os totais conforme os parâmetros informados."
] as const;

let lastPhraseWhenLoadEnded: string | null = null;

function shuffleOrderAvoidingFirstRepeat(last: string | null): string[] {
  const arr = [...GERENCIAL_LOAD_PHRASES] as string[];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = arr[i]!;
    const b = arr[j]!;
    arr[i] = b;
    arr[j] = a;
  }
  if (last && arr[0] === last) {
    const k = arr.findIndex((p) => p !== last);
    if (k > 0) {
      const t = arr[0]!;
      arr[0] = arr[k]!;
      arr[k] = t;
    }
  }
  return arr;
}

/** Grava a ultima frase mostrada para o proximo carregamento nao comecar com a mesma. */
export function rememberGerencialLoadPhrase(phrase: string): void {
  if (phrase.trim().length > 0) lastPhraseWhenLoadEnded = phrase;
}

/**
 * Rotacao pseudo-aleatoria de frases enquanto `active` e true.
 * `sessionKey` deve mudar a cada nova “onda” de pedido (ex.: filtros ou sessao da matriz).
 */
export function useRotatingGerencialLoadPhrases(active: boolean, sessionKey: string): string {
  const [message, setMessage] = useState<string>(() => String(GERENCIAL_LOAD_PHRASES[0]));
  const orderRef = useRef<string[]>([]);
  const idxRef = useRef(0);
  const shownRef = useRef(message);
  /** DOM devolve `number`; com @types/node o tipo global pode ser `Timeout`. */
  const timeoutRef = useRef<number | null>(null);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (wasActiveRef.current && !active) {
      rememberGerencialLoadPhrase(shownRef.current);
    }
    wasActiveRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const clearScheduled = (): void => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    orderRef.current = shuffleOrderAvoidingFirstRepeat(lastPhraseWhenLoadEnded);
    idxRef.current = 0;
    const first = orderRef.current[0] ?? String(GERENCIAL_LOAD_PHRASES[0]);
    shownRef.current = first;
    setMessage(first);

    const scheduleTick = (): void => {
      const delayMs = 1100 + Math.floor(Math.random() * 1700);
      timeoutRef.current = window.setTimeout(() => {
        const order = orderRef.current;
        if (order.length === 0) return;
        let nextIdx = idxRef.current;
        let nextPhrase: string;
        let guard = 0;
        do {
          nextIdx = (nextIdx + 1) % order.length;
          nextPhrase = order[nextIdx]!;
          guard += 1;
        } while (nextPhrase === shownRef.current && guard <= order.length + 2);
        idxRef.current = nextIdx;
        shownRef.current = nextPhrase;
        setMessage(nextPhrase);
        scheduleTick();
      }, delayMs) as unknown as number;
    };

    scheduleTick();
    return () => {
      clearScheduled();
    };
  }, [active, sessionKey]);

  return message;
}
