import { type ViasVolumeRow, type MonthAgg, EXCLUDED_MATERIAL_IDS } from "./metasPorVolumesAggregator.js";

export type MedicacaoPsDashboardData = {
  totalMedicacoes: number;
  infusao: {
    lenta: number;
    rapida: number;
  };
  vias: Array<{ via: string; qtd: number }>;
  topLenta: Array<{ nome: string; qtd: number }>;
  topRapida: Array<{ nome: string; qtd: number }>;
  porUnidade: Array<{ 
    unidade: string; 
    lenta: number; 
    rapida: number; 
    pctLenta: number 
  }>;
};

export function buildMedicacaoPsDashboard(
  vias: ViasVolumeRow[],
  cds: Set<number>,
  unidadesMap: Map<number, string>,
  m: MonthAgg
): MedicacaoPsDashboardData {
  const filtered = vias.filter(v => 
    cds.has(v.cd) && 
    v.dataMs >= m.startMs && 
    v.dataMs <= m.endMs &&
    !EXCLUDED_MATERIAL_IDS.has(v.cdMaterial)
  );

  const stats = {
    total: filtered.length,
    lenta: 0,
    rapida: 0,
    viasMap: new Map<string, number>(),
    topLentaMap: new Map<string, number>(),
    topRapidaMap: new Map<string, number>(),
    unidadeMap: new Map<number, { lenta: number; rapida: number }>()
  };

  for (const v of filtered) {
    // Normalizar via
    const rawVia = (v.ieViaAplicacao || "N/D").trim().toUpperCase();
    
    // Regra de Via Exibida
    const viaExibida = (rawVia === "EV" && v.ieAplicBolus === "S") ? "EV BOLUS" : rawVia;
    
    // Regra de Velocidade
    const isRapida = rawVia === "IM" || rawVia === "VO" || (rawVia === "EV" && v.ieAplicBolus === "S");
    const velocidade = isRapida ? "Rápida" : "Lenta";

    if (isRapida) stats.rapida++;
    else stats.lenta++;

    // Agrupar por Via
    stats.viasMap.set(viaExibida, (stats.viasMap.get(viaExibida) || 0) + 1);

    // Agrupar Top 10 por Velocidade
    const targetMap = isRapida ? stats.topRapidaMap : stats.topLentaMap;
    const material = (v.dsMaterial || "N/D").trim().toUpperCase();
    targetMap.set(material, (targetMap.get(material) || 0) + 1);

    // Agrupar por Unidade
    if (!stats.unidadeMap.has(v.cd)) {
      stats.unidadeMap.set(v.cd, { lenta: 0, rapida: 0 });
    }
    const u = stats.unidadeMap.get(v.cd)!;
    if (isRapida) u.rapida++;
    else u.lenta++;
  }

  // Formatar Vias com agrupamento "OUTROS"
  const total = filtered.length;
  const rawViasArr = Array.from(stats.viasMap.entries())
    .map(([via, qtd]) => ({ via, qtd }))
    .sort((a, b) => b.qtd - a.qtd);

  const viasFinal: Array<{ via: string; qtd: number }> = [];
  let outrosQtd = 0;

  for (const item of rawViasArr) {
    const pct = total > 0 ? (item.qtd / total) * 100 : 0;
    if (pct < 1 && rawViasArr.length > 8) { // Só agrupa se tiver muitas vias
      outrosQtd += item.qtd;
    } else {
      viasFinal.push(item);
    }
  }

  if (outrosQtd > 0) {
    viasFinal.push({ via: "OUTROS", qtd: outrosQtd });
  }

  // Formatar Top 10
  const formatTop = (map: Map<string, number>) => 
    Array.from(map.entries())
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);

  // Formatar Unidades
  const porUnidade = Array.from(stats.unidadeMap.entries())
    .map(([cd, data]) => {
      const totalU = data.lenta + data.rapida;
      return {
        unidade: unidadesMap.get(cd) || `Unidade ${cd}`,
        lenta: data.lenta,
        rapida: data.rapida,
        pctLenta: totalU > 0 ? (data.lenta / totalU) * 100 : 0
      };
    })
    .sort((a, b) => (b.lenta + b.rapida) - (a.lenta + a.rapida));

  return {
    totalMedicacoes: stats.total,
    infusao: {
      lenta: stats.lenta,
      rapida: stats.rapida
    },
    vias: viasFinal,
    topLenta: formatTop(stats.topLentaMap),
    topRapida: formatTop(stats.topRapidaMap),
    porUnidade
  };
}
