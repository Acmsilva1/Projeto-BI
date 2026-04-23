import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export type Env = {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  csvDataDir: string;
  dataGateway: "csv-memory" | "duckdb";
  duckdbPath: string;
};

function readPort(rawValue: string | undefined): number {
  const parsed = Number.parseInt(rawValue ?? "3333", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 3333;
  }
  return parsed;
}

function readDataGateway(rawValue: string | undefined): "csv-memory" | "duckdb" {
  const normalized = (rawValue ?? "csv-memory").trim().toLowerCase();
  if (normalized === "duckdb") return "duckdb";
  return "csv-memory";
}

export const env: Env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: readPort(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  csvDataDir: process.env.CSV_DATA_DIR ?? path.resolve(process.cwd(), "..", "dados"),
  dataGateway: readDataGateway(process.env.DATA_GATEWAY),
  duckdbPath: process.env.DUCKDB_PATH ?? ":memory:"
};
