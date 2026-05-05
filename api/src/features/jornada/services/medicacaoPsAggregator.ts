import { type ViasVolumeRow, type MonthAgg, EXCLUDED_MATERIAL_IDS, type FarmaciaRow } from "./metasPorVolumesAggregator.js";

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
  rankingNaoPadrao: Array<{ unidade: string; qtd: number }>;
};

export function buildMedicacaoPsDashboard(
  vias: ViasVolumeRow[],
  farmacia: FarmaciaRow[],
  cds: Set<number>,
  unidadesMap: Map<number, string>,
  m: MonthAgg
): MedicacaoPsDashboardData {
  // 1. Filtrar Vias (já existente)
  const filteredVias = vias.filter(v => 
    cds.has(v.cd) && 
    v.dataMs >= m.startMs && 
    v.dataMs <= m.endMs &&
    !EXCLUDED_MATERIAL_IDS.has(v.cdMaterial)
  );

  // 2. Filtrar Farmácia (Não Padrão) — mesma janela temporal das vias (DT_LIBERACAO vs DATA)
  const filteredFarmacia = farmacia.filter(f => {
    const p = (f.padrao || "").trim().toUpperCase();
    const isNaoPadrao = p.startsWith("N");
    const fCd = Number(f.cd);
    if (!cds.has(fCd) || !isNaoPadrao) return false;
    if (!Number.isFinite(f.dataMs) || f.dataMs < m.startMs || f.dataMs > m.endMs) return false;
    return true;
  });

  const stats = {
    total: filteredVias.length,
    lenta: 0,
    rapida: 0,
    viasMap: new Map<string, number>(),
    topLentaMap: new Map<string, number>(),
    topRapidaMap: new Map<string, number>(),
    unidadeMap: new Map<number, { lenta: number; rapida: number }>(),
    farmaciaMap: new Map<number, number>()
  };

  // Processar Vias
  for (const v of filteredVias) {
    const rawVia = (v.ieViaAplicacao || "N/D").trim().toUpperCase();
    const viaExibida = (rawVia === "EV" && v.ieAplicBolus === "S") ? "EV BOLUS" : rawVia;
    const isRapida = rawVia === "IM" || rawVia === "VO" || (rawVia === "EV" && v.ieAplicBolus === "S");

    if (isRapida) stats.rapida++;
    else stats.lenta++;

    stats.viasMap.set(viaExibida, (stats.viasMap.get(viaExibida) || 0) + 1);

    const targetMap = isRapida ? stats.topRapidaMap : stats.topLentaMap;
    const material = (v.dsMaterial || "N/D").trim().toUpperCase();
    targetMap.set(material, (targetMap.get(material) || 0) + 1);

    const vCd = Number(v.cd);
    if (!stats.unidadeMap.has(vCd)) {
      stats.unidadeMap.set(vCd, { lenta: 0, rapida: 0 });
    }
    const u = stats.unidadeMap.get(vCd)!;
    if (isRapida) u.rapida++;
    else u.lenta++;
  }

  // Processar Farmácia (Não Padrão)
  for (const f of filteredFarmacia) {
    const fCd = Number(f.cd);
    stats.farmaciaMap.set(fCd, (stats.farmaciaMap.get(fCd) || 0) + 1);
  }

  // Formatar Vias
  const rawViasArr = Array.from(stats.viasMap.entries())
    .map(([via, qtd]) => ({ via, qtd }))
    .sort((a, b) => b.qtd - a.qtd);

  const viasFinal: Array<{ via: string; qtd: number }> = [];
  let outrosQtd = 0;
  for (const item of rawViasArr) {
    const pct = stats.total > 0 ? (item.qtd / stats.total) * 100 : 0;
    if (pct < 1 && rawViasArr.length > 8) outrosQtd += item.qtd;
    else viasFinal.push(item);
  }
  if (outrosQtd > 0) viasFinal.push({ via: "OUTROS", qtd: outrosQtd });

  const formatTop = (map: Map<string, number>) => 
    Array.from(map.entries())
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);

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

  // Formatar Ranking Não Padrão (Incluir todas as unidades do PS, mesmo com 0)
  const rankingNaoPadrao = Array.from(cds)
    .map(cd => {
      const fCd = Number(cd);
      const unitName = unidadesMap.get(fCd);
      return {
        unidade: unitName || `Unidade ${fCd}`,
        qtd: stats.farmaciaMap.get(fCd) || 0
      };
    })
    .sort((a, b) => b.qtd - a.qtd);

  return {
    totalMedicacoes: stats.total,
    infusao: {
      lenta: stats.lenta,
      rapida: stats.rapida
    },
    vias: viasFinal,
    topLenta: formatTop(stats.topLentaMap),
    topRapida: formatTop(stats.topRapidaMap),
    porUnidade,
    rankingNaoPadrao
  };
}
