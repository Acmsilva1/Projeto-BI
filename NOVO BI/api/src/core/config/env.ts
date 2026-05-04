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
  /** Concorrência ao ler vários Parquet/CSV no primeiro carregamento do store (csv-memory). */
  storeLoadConcurrency: number;
  /**
   * Amostra para `read_csv_auto` quando existir CSV (ALL_VARCHAR).
   * `-1` = comportamento antigo (sniff em todo o ficheiro — mais lento em CSV gigantes).
   */
  csvReadSampleSize: number;
  /**
   * Teto máximo de dias de facts a carregar no store (csv-memory), após o bootstrap 90d.
   * Default **365**. `ensureStore` usa `min(env, max(90, pill))`.
   */
  gerencialStoreRetentionDays: number;
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

function readPositiveInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function readCsvReadSampleSize(rawValue: string | undefined): number {
  if (rawValue === undefined || rawValue.trim() === "") return 65536;
  const parsed = Number.parseInt(rawValue.trim(), 10);
  if (!Number.isFinite(parsed)) return 65536;
  return parsed;
}

function readGerencialStoreRetentionDays(): number {
  const raw = process.env.GERENCIAL_STORE_RETENTION_DAYS ?? process.env.PS_STORE_RETENTION_DAYS;
  return readPositiveInt(raw, 365);
}

export const env: Env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: readPort(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  /** Pasta de datasets (Parquet preferido; CSV legado). `CSV_DATA_DIR` mantém o nome da env. */
  csvDataDir: process.env.CSV_DATA_DIR ? path.resolve(process.env.CSV_DATA_DIR) : defaultDataDir(),
  dataGateway: readDataGateway(process.env.DATA_GATEWAY),
  duckdbPath: process.env.DUCKDB_PATH ?? ":memory:",
  storeLoadConcurrency: readPositiveInt(process.env.STORE_LOAD_CONCURRENCY, 5),
  csvReadSampleSize: readCsvReadSampleSize(process.env.CSV_READ_SAMPLE_SIZE),
  gerencialStoreRetentionDays: readGerencialStoreRetentionDays()
};
