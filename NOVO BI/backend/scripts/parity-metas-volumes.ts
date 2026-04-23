/**
 * Testes pontuais de paridade (lógica de calendário e agregador Metas por volume).
 * Executar: npm run test:parity-metas (a partir de NOVO BI/backend)
 */
import assert from "node:assert/strict";
import { buildMetasPorVolumesMatrix, resolveLastThreeMonths } from "../src/services/metasPorVolumesAggregator.js";

function testMonthsFromAnchor(): void {
  const anchor = Date.UTC(2026, 2, 15);
  const triplet = resolveLastThreeMonths(anchor);
  assert.equal(triplet.length, 3);
  assert.equal(triplet[0]?.yearMonth, 202601);
  assert.equal(triplet[1]?.yearMonth, 202602);
  assert.equal(triplet[2]?.yearMonth, 202603);
}

function testSyntheticTriagemRg(): void {
  const triplet = resolveLastThreeMonths(Date.UTC(2026, 0, 20));
  const mJan = triplet[2]!;
  const flux = [
    {
      cd: 1,
      nr: "a1",
      dataMs: mJan.startMs + 86400000,
      destino: "",
      dtInternacaoMs: null,
      minTriagem: 5,
      minConsulta: 10,
      minPermanencia: 100,
      dtDesfechoMs: null,
      medAtend: "A",
      medDesfecho: "A"
    },
    {
      cd: 1,
      nr: "a2",
      dataMs: mJan.startMs + 86400000,
      destino: "",
      dtInternacaoMs: null,
      minTriagem: 20,
      minConsulta: 10,
      minPermanencia: 100,
      dtDesfechoMs: null,
      medAtend: "B",
      medDesfecho: "B"
    }
  ];
  const matrix = buildMetasPorVolumesMatrix({
    unidadesCds: new Set([1]),
    flux,
    med: [],
    lab: [],
    tc: [],
    reav: [],
    vias: []
  });
  const tri = matrix.indicators.find((i) => i.key === "triagem_rg");
  assert.ok(tri);
  const vLast = tri!.months[2]?.value;
  assert.equal(vLast, 0.5);
}

testMonthsFromAnchor();
testSyntheticTriagemRg();
console.log("[parity-metas-volumes] OK");
