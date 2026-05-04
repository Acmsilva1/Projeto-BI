import { buildMetasPorVolumesMatrix } from "../src/features/jornada/services/metasPorVolumesAggregator.js";
import { performance } from "node:perf_hooks";

/**
 * Script de teste de carga para validar a performance da lógica de Z-Score.
 */

function generateSyntheticData(count: number) {
  const flux = [];
  const now = Date.now();
  const oneDay = 86400000;
  
  console.log(`[LoadTest] Gerando ${count} registros sintéticos...`);
  
  for (let i = 0; i < count; i++) {
    flux.push({
      cd: Math.floor(Math.random() * 10) + 1, // 10 unidades
      nr: `A${i}`,
      dataMs: now - (Math.random() * 400 * oneDay), // Dados espalhados por 400 dias
      destino: Math.random() > 0.9 ? "internado" : "casa",
      dtInternacaoMs: now,
      minTriagem: Math.random() * 30,
      minConsulta: Math.random() * 120,
      minPermanencia: Math.random() * 300,
      dtDesfechoMs: now,
      medAtend: "MED1",
      medDesfecho: "MED1"
    });
  }
  
  return {
    unidadesCds: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    flux,
    med: [],
    lab: [],
    tc: [],
    reav: [],
    vias: []
  };
}

async function runTest() {
  const data = generateSyntheticData(100000); // 100k registros
  
  console.log("[LoadTest] Iniciando agregação com Z-Score (12 meses históricos)...");
  
  const start = performance.now();
  const result = buildMetasPorVolumesMatrix(data);
  const end = performance.now();
  
  console.log("------------------------------------------------");
  console.log(`Tempo de Execução: ${(end - start).toFixed(2)}ms`);
  console.log(`Indicadores processados: ${result.indicators.length}`);
  console.log(`Células com Z-Score calculado: ${result.indicators[0]?.months.length ?? 0}`);
  console.log("------------------------------------------------");
  
  if ((end - start) > 1000) {
    console.warn("⚠️ AVISO: A performance está acima de 1 segundo. Pode ser necessário otimizar o cache de histórico.");
  } else {
    console.log("✅ PERFORMANCE OK: O sistema processou 100k registros em menos de 1 segundo.");
  }
}

runTest();
