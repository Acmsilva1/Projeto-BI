import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

function defaultDataDir(): string {
  const cwd = process.cwd();
  const bancoLocal = path.resolve(cwd, "..", "banco local");
  const dados = path.resolve(cwd, "..", "dados");
  const markerPq = "tbl_tempos_entrada_consulta_saida.parquet";
  const markerCsv = "tbl_tempos_entrada_consulta_saida.csv";
  if (fs.existsSync(path.join(bancoLocal, markerPq)) || fs.existsSync(path.join(bancoLocal, markerCsv))) {
    return bancoLocal;
  }
  return dados;
}

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
  /** Pasta de datasets (Parquet preferido; CSV legado). `CSV_DATA_DIR` mantém o nome da env. */
  csvDataDir: process.env.CSV_DATA_DIR ? path.resolve(process.env.CSV_DATA_DIR) : defaultDataDir(),
  dataGateway: readDataGateway(process.env.DATA_GATEWAY),
  duckdbPath: process.env.DUCKDB_PATH ?? ":memory:"
};
