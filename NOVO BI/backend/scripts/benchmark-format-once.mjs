import { app } from "../dist/app.js";
import { env } from "../dist/config/env.js";

const PORT = 3341;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DURATION_SECONDS = Number.parseInt(process.env.BENCH_DURATION_SECONDS ?? "10", 10) || 10;
const CONCURRENCY = Number.parseInt(process.env.BENCH_CONCURRENCY ?? "6", 10) || 6;
const LATENCY_SAMPLE_SIZE = 30000;

const format = (process.argv[2] ?? "json").toLowerCase() === "arrow" ? "arrow" : "json";
const profile = (process.argv[3] ?? "mix").toLowerCase();

const scenario =
  format === "arrow"
    ? {
        name: "arrow",
        headers: { Accept: "application/vnd.apache.arrow.stream, application/json" },
        extraQuery: "format=arrow"
      }
    : {
        name: "json",
        headers: { Accept: "application/json" },
        extraQuery: "format=json"
      };

const routeMix =
  profile === "heavy"
    ? ["/api/v1/dashboard/gerencial-unidades-ranking?period=30&limit=5000"]
    : [
        "/api/v1/dashboard/gerencial-kpis-topo?period=30",
        "/api/v1/dashboard/gerencial-unidades-ranking?period=30&limit=12",
        "/api/v1/dashboard/gerencial-filtros?period=30&limit=300"
      ];

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.floor((p / 100) * sortedValues.length));
  return sortedValues[idx];
}

function toMs(ns) {
  return Number(ns) / 1_000_000;
}

async function runScenario() {
  const latencySamples = [];
  let latencySeen = 0;
  let bytes = 0;
  let ok = 0;
  let errors = 0;
  const started = process.hrtime.bigint();
  const until = Date.now() + DURATION_SECONDS * 1000;

  function recordLatency(valueMs) {
    latencySeen += 1;
    if (latencySamples.length < LATENCY_SAMPLE_SIZE) {
      latencySamples.push(valueMs);
      return;
    }
    const idx = Math.floor(Math.random() * latencySeen);
    if (idx < LATENCY_SAMPLE_SIZE) latencySamples[idx] = valueMs;
  }

  async function worker(workerIndex) {
    let routeIndex = workerIndex % routeMix.length;
    while (Date.now() < until) {
      const route = routeMix[routeIndex];
      routeIndex = (routeIndex + 1) % routeMix.length;
      const separator = route.includes("?") ? "&" : "?";
      const url = `${BASE_URL}${route}${separator}${scenario.extraQuery}`;
      const t0 = process.hrtime.bigint();
      try {
        const response = await fetch(url, { headers: scenario.headers });
        const ab = await response.arrayBuffer();
        bytes += ab.byteLength;
        if (response.ok) ok += 1;
        else errors += 1;
      } catch {
        errors += 1;
      } finally {
        recordLatency(toMs(process.hrtime.bigint() - t0));
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  const elapsedSec = toMs(process.hrtime.bigint() - started) / 1000;
  const sorted = [...latencySamples].sort((a, b) => a - b);

  return {
    scenario: scenario.name,
    durationSec: Number(elapsedSec.toFixed(2)),
    concurrency: CONCURRENCY,
    requests: ok + errors,
    ok,
    errors,
    reqPerSec: Number(((ok + errors) / elapsedSec).toFixed(2)),
    p50Ms: Number(percentile(sorted, 50).toFixed(2)),
    p95Ms: Number(percentile(sorted, 95).toFixed(2)),
    p99Ms: Number(percentile(sorted, 99).toFixed(2)),
    avgMs: Number((sorted.reduce((acc, v) => acc + v, 0) / (sorted.length || 1)).toFixed(2)),
    totalMB: Number((bytes / 1024 / 1024).toFixed(2)),
    avgKBPerResponse: Number(((bytes / (ok + errors || 1)) / 1024).toFixed(2))
  };
}

async function main() {
  const server = app.listen(PORT);
  try {
    await new Promise((r) => setTimeout(r, 1000));
    await fetch(`${BASE_URL}/api/v1/health`);
    for (const route of routeMix) {
      const separator = route.includes("?") ? "&" : "?";
      await fetch(`${BASE_URL}${route}${separator}${scenario.extraQuery}`, { headers: scenario.headers });
    }
    const result = await runScenario();
    console.log(
      JSON.stringify(
        { gateway: env.dataGateway, format: scenario.name, config: { DURATION_SECONDS, CONCURRENCY, routeMix }, result },
        null,
        2
      )
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
