import { app } from "../dist/app.js";
import { tableFromIPC } from "apache-arrow";

const PORT = 3340;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DURATION_SECONDS = 15;
const CONCURRENCY = 20;
const LATENCY_SAMPLE_SIZE = 60000;
const PARSE_SAMPLE_RATE = 0.2;

const scenarios = [
  {
    name: "json",
    headers: { Accept: "application/json" },
    extraQuery: "format=json"
  },
  {
    name: "arrow",
    headers: { Accept: "application/vnd.apache.arrow.stream, application/json" },
    extraQuery: "format=arrow"
  }
];

const routeMix = [
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

async function runScenario(scenario) {
  const latencySamples = [];
  let latencySeen = 0;
  let bytes = 0;
  let ok = 0;
  let errors = 0;
  let parsedRows = 0;
  const started = process.hrtime.bigint();
  const until = Date.now() + DURATION_SECONDS * 1000;

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
        if (!response.ok) {
          errors += 1;
          continue;
        }

        if (Math.random() < PARSE_SAMPLE_RATE) {
          const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
          if (contentType.includes("application/vnd.apache.arrow.stream")) {
            const table = tableFromIPC(new Uint8Array(ab));
            parsedRows += table.numRows;
          } else {
            const text = new TextDecoder().decode(ab);
            const data = JSON.parse(text);
            if (Array.isArray(data?.rows)) parsedRows += data.rows.length;
          }
        }
        ok += 1;
      } catch {
        errors += 1;
      } finally {
        const t1 = process.hrtime.bigint();
        recordLatency(toMs(t1 - t0));
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

  const ended = process.hrtime.bigint();
  const elapsedSec = toMs(ended - started) / 1000;
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
    latencySamples: sorted.length,
    totalMB: Number((bytes / 1024 / 1024).toFixed(2)),
    avgKBPerResponse: Number(((bytes / (ok + errors || 1)) / 1024).toFixed(2)),
    parsedRows
  };
}

function compare(json, arrow) {
  const delta = (a, b) => Number((((b - a) / (a || 1)) * 100).toFixed(2));
  return {
    reqPerSecPct: delta(json.reqPerSec, arrow.reqPerSec),
    p95MsPct: delta(json.p95Ms, arrow.p95Ms),
    avgMsPct: delta(json.avgMs, arrow.avgMs),
    totalMBPct: delta(json.totalMB, arrow.totalMB),
    avgKBPerResponsePct: delta(json.avgKBPerResponse, arrow.avgKBPerResponse),
    errorsDiff: arrow.errors - json.errors
  };
}

async function main() {
  const server = app.listen(PORT);
  try {
    await new Promise((r) => setTimeout(r, 1200));
    await fetch(`${BASE_URL}/api/v1/health`);

    const results = [];
    for (const scenario of scenarios) {
      const result = await runScenario(scenario);
      results.push(result);
    }

    const json = results.find((r) => r.scenario === "json");
    const arrow = results.find((r) => r.scenario === "arrow");
    const summary = json && arrow ? compare(json, arrow) : null;
    console.log(JSON.stringify({ config: { DURATION_SECONDS, CONCURRENCY, routeMix }, results, summary }, null, 2));
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
  function recordLatency(valueMs) {
    latencySeen += 1;
    if (latencySamples.length < LATENCY_SAMPLE_SIZE) {
      latencySamples.push(valueMs);
      return;
    }
    const idx = Math.floor(Math.random() * latencySeen);
    if (idx < LATENCY_SAMPLE_SIZE) latencySamples[idx] = valueMs;
  }
