import path from "node:path";

export type InternacaoEndpointKey = "filtros" | "topo" | "metas" | "variados";

const TABLES_BY_ENDPOINT: Record<InternacaoEndpointKey, readonly string[]> = {
  filtros: ["tbl_unidades"],
  topo: ["tbl_unidades", "tbl_intern_internacoes", "tbl_intern_conversoes", "tbl_intern_movimentacoes"],
  metas: ["tbl_unidades", "tbl_intern_internacoes", "tbl_intern_conversoes"],
  variados: ["tbl_unidades", "tbl_intern_internacoes"]
};

export function getInternacaoDuckTables(endpoint: InternacaoEndpointKey): readonly string[] {
  return TABLES_BY_ENDPOINT[endpoint];
}

export function getInternacaoDuckReadPaths(csvDataDir: string, endpoint: InternacaoEndpointKey): string[] {
  const tables = getInternacaoDuckTables(endpoint);
  return tables.map((table) => path.resolve(csvDataDir, `${table}.parquet`).replaceAll("\\", "/"));
}
