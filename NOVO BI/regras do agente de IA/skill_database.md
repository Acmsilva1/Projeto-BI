# 🗄️ SKILL: THE DATA ARCHITECT (SOLO AGENT)

## 🏗️ ESTRATÉGIA DE CICLO DE VIDA DO DADO
Sempre que este arquivo for lido, siga este fluxo de maturidade:
1. **Prototipagem/Validação:** Use **CSV** (dados frios) e **DuckDB** (análise rápida/OLAP) ou **Redis** (cache/estado volátil).
2. **Produção/Persistência:** Migração estruturada para **SQL (PostgreSQL)** com foco em integridade e performance.

---

## 💎 SQL & POSTGRESQL (O PADRÃO OURO)
- **Modelagem:** Tabelas normalizadas (3NF) para transações, mas use **Views** e **Materialized Views** para dashboards (Censo/Financeiro).
- **Naming Convention:** `snake_case` para tudo. Tabelas no plural (ex: `pacientes`, `vendas_bolo`).
- **Otimização:** - Índices B-Tree em chaves estrangeiras e campos de busca frequente.
    - Índices GIN para campos de busca textual ou JSONB.
- **Tipagem:** Use `UUID` para chaves primárias em sistemas distribuídos e `TIMESTAMPTZ` para registros de data/hora.

---

## 🦆 DUCKDB & CSV (VALIDAÇÃO E ANALYTICS)
- **Ingestão:** Use DuckDB para ler arquivos CSV diretamente e realizar joins complexos antes de mover para o SQL.
- **Transformação:** Trate o DuckDB como sua ferramenta de ETL rápida. 
- **Validação:** Sempre verifique integridade de tipos e valores nulos nos CSVs de entrada antes de qualquer `INSERT INTO` em produção.

---

## ⚡ REDIS (PERFORMANCE & REAL-TIME)
- **Uso:** Cache de consultas pesadas do Censo Hospitalar, controle de sessões e filas de mensagens.
- **TTL:** Sempre defina um Time-To-Live (TTL) para evitar o "inchaço" da memória.
- **Pub/Sub:** Use para notificações em tempo real no dashboard quando um leito mudar de status.

---

## 📜 REGRAS DE OURO DE ENGENHARIA DE DADOS
1. **Migrations First:** Nunca sugira alterações diretas via SQL manual; sempre gere o código de migration (Prisma, Knex ou SQL puro estruturado).
2. **Segurança & LGPD:** - **PHI/PII:** Dados de saúde e financeiros nunca devem estar em texto claro em colunas de busca.
    - Aplique máscaras de dados em Views destinadas a usuários comuns.
3. **Performance de Query:** - Evite `SELECT *`. Especifique as colunas.
    - Use `EXPLAIN ANALYZE` para justificar sugestões de otimização de queries lentas.
4. **Relatórios:** Para dashboards, prefira funções agregadas e CTEs (Common Table Expressions) para manter a query legível.

---

## 🛑 PROTOCOLO DE MIGRAÇÃO
Ao detectar que a fase de prototipagem com CSV/DuckDB terminou, gere automaticamente o script de DDL (Data Definition Language) para PostgreSQL, incluindo as constraints (Check, Unique, Not Null) e índices necessários.
