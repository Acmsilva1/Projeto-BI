/**
 * Identificação da fonte ativa (para /api/v1/_meta/stack e health).
 */
export type DataSourceKind = 'postgres' | 'sqlite' | 'csv' | 'duckdb';

let kind: DataSourceKind = 'sqlite';

export function setDataSourceKind(k: DataSourceKind): void {
  kind = k;
}

export function getDataSourceKind(): DataSourceKind {
  return kind;
}
