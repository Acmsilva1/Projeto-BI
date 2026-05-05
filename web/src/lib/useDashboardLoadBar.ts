import { useLayoutEffect, useState } from "react";
import { useRotatingGerencialLoadPhrases } from "./gerencialLoadPhrases";

/**
 * Barra de carregamento padronizada: progresso suave + mensagens rotativas (mesmo padrão dos KPIs gerenciais).
 * `waveKey` deve mudar a cada novo pedido (filtros / período / sessão) para reiniciar as frases.
 *
 * Usa `useLayoutEffect` para repor o progresso **antes do paint** quando `active` volta a true — caso
 * contrário o último frame com `active` false deixa a barra em 100% e o painel de carga parece “já concluído”.
 */
export function useDashboardLoadBar(active: boolean, waveKey: string): { progress: number; message: string } {
  const message = useRotatingGerencialLoadPhrases(active, waveKey);
  const [progress, setProgress] = useState(12);

  useLayoutEffect(() => {
    if (!active) {
      setProgress(100);
      return;
    }
    setProgress(12);
    const id1 = window.setTimeout(() => setProgress((p) => Math.max(p, 40)), 280);
    const id2 = window.setTimeout(() => setProgress((p) => Math.max(p, 66)), 720);
    const id3 = window.setTimeout(() => setProgress((p) => Math.max(p, 88)), 1180);
    return () => {
      window.clearTimeout(id1);
      window.clearTimeout(id2);
      window.clearTimeout(id3);
    };
  }, [active, waveKey]);

  return { progress, message };
}
