
// Mocking the types and helper functions from the analysis file for the test
function pad2(n) { return String(n).padStart(2, "0"); }

function analyzePsHeatmapRows(ym, rows) {
  const lastD = 31;
  const valueMap = new Map();
  
  // Ingestion - O(N)
  for (const r of rows) {
    if (!r.data_chegada.startsWith(ym)) continue;
    const k = `${r.data_chegada}|${r.hora}`;
    valueMap.set(k, (valueMap.get(k) ?? 0) + r.qtd_atendimentos);
  }

  const get = (dia, hora) => {
    const iso = `${ym}-${pad2(dia)}`;
    return valueMap.get(`${iso}|${hora}`) ?? 0;
  };

  // Total - O(31*24)
  let total = 0;
  for (let d = 1; d <= lastD; d += 1) {
    for (let h = 0; h < 24; h += 1) total += get(d, h);
  }

  // Nested Sazonal Calculation - O(31*24*31)
  const results = [];
  for (let d = 1; d <= lastD; d += 1) {
    for (let h = 0; h < 24; h += 1) {
      // Simulation of seasonal reference logic
      let sum = 0;
      for (let d2 = 1; d2 <= lastD; d2++) {
        sum += get(d2, h);
      }
      results.push(sum);
    }
  }

  return { total, resultsCount: results.length };
}

function generateRows(count, ym) {
    const rows = [];
    for (let i = 0; i < count; i++) {
        rows.push({
            data_chegada: `${ym}-${pad2(Math.floor(Math.random() * 31) + 1)}`,
            hora: Math.floor(Math.random() * 24),
            qtd_atendimentos: Math.floor(Math.random() * 10) + 1
        });
    }
    return rows;
}

async function runLoadTest() {
    console.log("--- INICIANDO TESTE DE PERFORMANCE (MÓDULO PS) ---");
    const ym = "2024-05";
    const volumes = [10000, 100000, 500000, 1000000];
    
    for (const volume of volumes) {
        process.stdout.write(`Gerando ${volume.toLocaleString()} linhas... `);
        const rows = generateRows(volume, ym);
        console.log("✓");

        const start = performance.now();
        const analysis = analyzePsHeatmapRows(ym, rows);
        const end = performance.now();
        
        const duration = (end - start).toFixed(2);
        console.log(`⏱ Tempo de Processamento: ${duration}ms`);
        
        const memory = process.memoryUsage().heapUsed / 1024 / 1024;
        console.log(`💾 Memória Utilizada: ${memory.toFixed(2)} MB`);
        
        if (duration > 500) {
            console.warn("⚠️ ALERTA: Processamento acima de 500ms pode causar engasgos na UI.");
        }
        console.log("--------------------------------------------------");
    }
}

runLoadTest();
