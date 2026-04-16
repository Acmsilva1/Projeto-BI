# SQL versionado (Hospital BI — BACKEND)

Convenção para evoluir de **SQL dinâmico em TypeScript** (`src/models/db_postgres.ts`) para **consultas nomeadas**:

- Colocar ficheiros `.sql` por agregado, ex.: `gerencia/fluxo_periodo.sql`.
- O `ReadRepository` pode ganhar `loadSql(relativePath)` que lê ficheiros desta pasta, parametriza e executa (prepared statements).
- Manter o **mapa lógico → tabela física** em `src/models/db_sqlite.ts` até todas as leituras migrarem.

Nenhum ficheiro aqui é executado automaticamente hoje — é preparação de caminho.
