/**
 * Verifica o agregador do dashboard PS medicação (ranking não padrão + janela temporal)
 * e executa um micro stress de CPU sem subir HTTP nem DuckDB.
 */
import { performance } from "node:perf_hooks";
import { buildMedicacaoPsDashboard } from "../src/features/jornada/services/medicacaoPsAggregator.js";
import type { FarmaciaRow, ViasVolumeRow } from "../src/features/jornada/services/metasPorVolumesAggregator.js";

const windowAgg = { startMs: 1_000, endMs: 2_000, yearMonth: 0, label: "test" };

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function testRankingAndFarmaciaWindow(): void {
  const cds = new Set([1, 2, 3]);
  const unidadesMap = new Map<number, string>([
    [1, "Unidade A"],
    [2, "Unidade B"],
    [3, "Unidade C"]
  ]);

  const vias: ViasVolumeRow[] = [
    {
      cd: 1,
      nr: "n1",
      dataMs: 1_500,
      nrPrescricao: "",
      cdMaterial: 100,
      dsMaterial: "med",
      ieViaAplicacao: "EV",
      ieAplicBolus: "N",
      ieAplicLenta: "S"
    }
  ];

  const farmacia: FarmaciaRow[] = [
    { cd: 1, unidade: "", padrao: "NAO", dataMs: 1_500 },
    { cd: 2, unidade: "", padrao: "NAO", dataMs: 500 },
    { cd: 3, unidade: "", padrao: "SIM", dataMs: 1_500 }
  ];

  const d = buildMedicacaoPsDashboard(vias, farmacia, cds, unidadesMap, windowAgg);
  assert(d.rankingNaoPadrao.length === 3, "ranking deve listar todas as unidades do recorte");

  const q = new Map(d.rankingNaoPadrao.map((r) => [r.unidade, r.qtd]));
  assert(q.get("Unidade A") === 1, "contagem na janela para A");
  assert(q.get("Unidade B") === 0, "farmácia fora da janela não deve contar em B");
  assert(q.get("Unidade C") === 0, "padrão SIM não entra no ranking não padrão");

  const sorted = [...d.rankingNaoPadrao].sort((a, b) => b.qtd - a.qtd);
  assert(
    sorted.every((r, i) => r.unidade === d.rankingNaoPadrao[i].unidade && r.qtd === d.rankingNaoPadrao[i].qtd),
    "ranking deve estar ordenado por qtd desc"
  );
}

function stress(iterations: number, cdsSize: number): void {
  const cds = new Set<number>();
  const unidadesMap = new Map<number, string>();
  for (let i = 1; i <= cdsSize; i++) {
    cds.add(i);
    unidadesMap.set(i, `U${i}`);
  }

  const vias: ViasVolumeRow[] = [];
  for (let i = 0; i < 4_000; i++) {
    const cd = (i % cdsSize) + 1;
    vias.push({
      cd,
      nr: `nr-${i}`,
      dataMs: 1_200 + (i % 500),
      nrPrescricao: "p",
      cdMaterial: 200 + (i % 50),
      dsMaterial: `M${i % 200}`,
      ieViaAplicacao: i % 3 === 0 ? "IM" : "EV",
      ieAplicBolus: i % 3 === 0 ? "S" : "N",
      ieAplicLenta: "N"
    });
  }

  const farmacia: FarmaciaRow[] = [];
  for (let i = 0; i < 800; i++) {
    const cd = (i % cdsSize) + 1;
    farmacia.push({
      cd,
      unidade: "",
      padrao: i % 2 === 0 ? "NAO" : "SIM",
      dataMs: 1_100 + (i % 600)
    });
  }

  const t0 = performance.now();
  for (let k = 0; k < iterations; k++) {
    buildMedicacaoPsDashboard(vias, farmacia, cds, unidadesMap, windowAgg);
  }
  const ms = performance.now() - t0;
  console.log(
    `[stress] ${iterations} agregações (${cdsSize} unidades, ${vias.length} vias, ${farmacia.length} farmácia) em ${ms.toFixed(0)} ms (${(iterations / (ms / 1000)).toFixed(0)} ops/s)`
  );
}

testRankingAndFarmaciaWindow();
stress(400, 40);
console.log("[verify-medicacao-ps-aggregator] OK");
