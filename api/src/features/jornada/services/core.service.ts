import { env } from "../../../core/config/env.js";
import { ensureDuckDbReady, getDuckDbStatus } from "../../../data/services/duckdb.service.js";

export type HealthPayload = {
  ok: true;
  service: string;
  version: string;
  dataGateway: string;
  csvMemory: {
    status: "ready";
    csvDir: string;
  };
  duckdb?: {
    status: "disabled" | "ready" | "error";
    csvDir: string;
    dbPath: string;
    viewsLoaded: number;
    lastError: string | null;
  };
  timestamp: string;
};

export type PingPayload = {
  pong: true;
  timestamp: string;
};

export async function getHealthPayload(): Promise<HealthPayload> {
  if (env.dataGateway === "duckdb") {
    try {
      await ensureDuckDbReady();
    } catch {
      // health ainda responde com estado de erro sem derrubar API
    }
  }

  const duckStatus = getDuckDbStatus();
  const connectedGateway =
    env.dataGateway === "duckdb" && duckStatus.status === "ready" ? "duckdb:connected" : "csv-memory:connected";

  return {
    ok: true,
    service: "novo-bi-api",
    version: "0.1.0",
    dataGateway: connectedGateway,
    csvMemory: {
      status: "ready",
      csvDir: env.csvDataDir
    },
    duckdb: duckStatus,
    timestamp: new Date().toISOString()
  };
}

export function getPingPayload(): PingPayload {
  return {
    pong: true,
    timestamp: new Date().toISOString()
  };
}
