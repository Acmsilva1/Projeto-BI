export type DashboardQueryContext = {
  limit: number;
  periodDays: 7 | 15 | 30;
  regional?: string;
  unidade?: string;
};

export type DashboardQueryDefinition = {
  slug: string;
  description: string;
  sourceView: string;
  toSql: (context: DashboardQueryContext) => string;
};

const maxLimit = 5000;

function clampLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), maxLimit);
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

function buildGerencialBaseClauses(context: DashboardQueryContext): string[] {
  const clauses: string[] = [];

  if (context.regional) {
    clauses.push(`UPPER(TRIM(u.uf)) = '${escapeSqlString(context.regional.toUpperCase())}'`);
  }

  if (context.unidade) {
    clauses.push(`TRIM(u.nome) = '${escapeSqlString(context.unidade)}'`);
  }

  return clauses;
}

function buildGerencialPeriodClause(context: DashboardQueryContext): string {
  const periodWindow = context.periodDays - 1;
  return `
    DATE(t.DT_ENTRADA) >= (
      SELECT MAX(DATE(x.DT_ENTRADA))
      FROM "tbl_tempos_entrada_consulta_saida" x
    ) - INTERVAL '${periodWindow} days'
  `;
}

function buildGerencialWhere(context: DashboardQueryContext): string {
  const clauses = [...buildGerencialBaseClauses(context)];
  return clauses.join(" AND ");
}

function buildUnidadesCte(context: DashboardQueryContext): string {
  const where = buildGerencialWhere(context);
  const whereSql = where ? `AND ${where}` : "";

  return `
    unidades AS (
      SELECT DISTINCT
        TRY_CAST(cd_estabelecimento AS INTEGER) AS cd_estabelecimento,
        TRIM(nome) AS unidade,
        UPPER(TRIM(uf)) AS regional
      FROM "tbl_unidades" u
      WHERE LOWER(CAST(ps AS VARCHAR)) IN ('true', '1', 't')
      ${whereSql}
    )
  `;
}

const dashboardQueries: DashboardQueryDefinition[] = [
  {
    slug: "gerencial-filtros",
    description: "Lista regionais e unidades disponiveis para os filtros do painel gerencial.",
    sourceView: "tbl_unidades",
    toSql: (context) => `
      WITH
      ${buildUnidadesCte(context)}
      SELECT DISTINCT
        regional,
        unidade
      FROM unidades
      ORDER BY regional, unidade
      LIMIT ${clampLimit(context.limit)}
    `
  },
  {
    slug: "gerencial-kpis-topo",
    description: "KPI consolidados para cards do topo do modulo gerencial.",
    sourceView: "ps_resumo_unidades_snapshot_prod",
    toSql: (context) => `
      WITH
      ${buildUnidadesCte(context)},
      periodo_atendimentos AS (
        SELECT
          TRY_CAST(t.cd_estabelecimento AS INTEGER) AS cd_estabelecimento,
          COUNT(DISTINCT t.nr_atendimento) AS atendimentos_periodo,
          COUNT(DISTINCT t.cd_pessoa_fisica) AS pacientes_unicos_periodo,
          AVG(COALESCE(TRY_CAST(t.min_entrada_x_consulta AS DOUBLE), 0)) AS tempo_medio_consulta_min,
          AVG(COALESCE(TRY_CAST(t.min_entrada_x_alta AS DOUBLE), 0)) AS tempo_medio_alta_min
        FROM "tbl_tempos_entrada_consulta_saida" t
        INNER JOIN unidades u ON u.cd_estabelecimento = TRY_CAST(t.cd_estabelecimento AS INTEGER)
        WHERE ${buildGerencialPeriodClause(context)}
        GROUP BY TRY_CAST(t.cd_estabelecimento AS INTEGER)
      ),
      periodo_internacoes AS (
        SELECT
          TRY_CAST(c.cd_estab_urg AS INTEGER) AS cd_estabelecimento,
          COUNT(*) AS internacoes_periodo
        FROM "tbl_intern_conversoes" c
        INNER JOIN unidades u ON u.cd_estabelecimento = TRY_CAST(c.cd_estab_urg AS INTEGER)
        WHERE DATE(c.DT_ENTRADA) >= (
          SELECT MAX(DATE(x.DT_ENTRADA))
          FROM "tbl_intern_conversoes" x
        ) - INTERVAL '${context.periodDays - 1} days'
        GROUP BY TRY_CAST(c.cd_estab_urg AS INTEGER)
      ),
      snapshot_operacao AS (
        SELECT
          TRY_CAST(s.cd_estabelecimento AS INTEGER) AS cd_estabelecimento,
          SUM(COALESCE(TRY_CAST(s.ativos AS DOUBLE), 0)) AS pacientes_ativos,
          SUM(COALESCE(TRY_CAST(s.transferencia AS DOUBLE), 0)) AS transferencias_total,
          SUM(COALESCE(TRY_CAST(s.acomodacao AS DOUBLE), 0)) AS acomodacoes_total,
          SUM(COALESCE(TRY_CAST(s.tc_us_pendente AS DOUBLE), 0)) AS pendencias_tc_us,
          SUM(COALESCE(TRY_CAST(s.reavaliacao_acima_meta AS DOUBLE), 0)) AS reavaliacao_acima_meta,
          AVG(COALESCE(TRY_CAST(s.ocupacao_internacao_pct AS DOUBLE), 0)) AS ocupacao_media_internacao,
          AVG(COALESCE(TRY_CAST(s.ocupacao_uti_pct AS DOUBLE), 0)) AS ocupacao_media_uti,
          SUM(
            COALESCE(TRY_CAST(s.triagem_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.consulta_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.permanencia_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.rx_ecg_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.tc_us_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.tc_us_laudo_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.reavaliacao_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.medicacao_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.procedimento_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.farmacia_acima_meta AS DOUBLE), 0)
          ) AS metas_acima_total,
          SUM(
            COALESCE(TRY_CAST(s.triagem_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.consulta_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.permanencia_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.rx_ecg_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.tc_us_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.tc_us_laudo_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.reavaliacao_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.medicacao_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.procedimento_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.farmacia_em_atencao AS DOUBLE), 0)
          ) AS metas_atencao_total,
          SUM(
            COALESCE(TRY_CAST(s.triagem_ok AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.consulta_ok AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.permanencia_ok AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.rx_ecg_ok AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.tc_us_ok AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.tc_us_laudo_ok AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.reavaliacao_ok AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.medicacao_ok AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.procedimento_ok AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.farmacia_ok AS DOUBLE), 0)
          ) AS metas_ok_total
        FROM "ps_resumo_unidades_snapshot_prod" s
        INNER JOIN unidades u ON u.cd_estabelecimento = TRY_CAST(s.cd_estabelecimento AS INTEGER)
        GROUP BY TRY_CAST(s.cd_estabelecimento AS INTEGER)
      ),
      unidade_consolidada AS (
        SELECT
          u.unidade,
          u.regional,
          COALESCE(a.atendimentos_periodo, 0) AS atendimentos_periodo,
          COALESCE(a.pacientes_unicos_periodo, 0) AS pacientes_unicos_periodo,
          COALESCE(a.tempo_medio_consulta_min, 0) AS tempo_medio_consulta_min,
          COALESCE(a.tempo_medio_alta_min, 0) AS tempo_medio_alta_min,
          COALESCE(i.internacoes_periodo, 0) AS internacoes_periodo,
          COALESCE(s.pacientes_ativos, 0) AS pacientes_ativos,
          COALESCE(s.transferencias_total, 0) AS transferencias_total,
          COALESCE(s.acomodacoes_total, 0) AS acomodacoes_total,
          COALESCE(s.pendencias_tc_us, 0) AS pendencias_tc_us,
          COALESCE(s.reavaliacao_acima_meta, 0) AS reavaliacao_acima_meta,
          COALESCE(s.ocupacao_media_internacao, 0) AS ocupacao_media_internacao,
          COALESCE(s.ocupacao_media_uti, 0) AS ocupacao_media_uti,
          COALESCE(s.metas_acima_total, 0) AS metas_acima_total,
          COALESCE(s.metas_atencao_total, 0) AS metas_atencao_total,
          COALESCE(s.metas_ok_total, 0) AS metas_ok_total
        FROM unidades u
        LEFT JOIN periodo_atendimentos a ON a.cd_estabelecimento = u.cd_estabelecimento
        LEFT JOIN periodo_internacoes i ON i.cd_estabelecimento = u.cd_estabelecimento
        LEFT JOIN snapshot_operacao s ON s.cd_estabelecimento = u.cd_estabelecimento
      )
      SELECT
        COUNT(*) AS total_unidades,
        ROUND(SUM(pacientes_ativos), 0) AS pacientes_ativos,
        ROUND(SUM(atendimentos_periodo), 0) AS atendimentos_hoje,
        ROUND(SUM(internacoes_periodo), 0) AS internacoes_total,
        ROUND(SUM(transferencias_total), 0) AS transferencias_total,
        ROUND(SUM(acomodacoes_total), 0) AS acomodacoes_total,
        ROUND(SUM(pendencias_tc_us), 0) AS pendencias_tc_us,
        ROUND(SUM(reavaliacao_acima_meta), 0) AS reavaliacao_acima_meta,
        ROUND(SUM(pacientes_unicos_periodo), 0) AS pacientes_unicos_periodo,
        ROUND(
          SUM(tempo_medio_consulta_min * NULLIF(atendimentos_periodo, 0)) /
          NULLIF(SUM(NULLIF(atendimentos_periodo, 0)), 0),
          1
        ) AS tempo_medio_consulta_min,
        ROUND(
          SUM(tempo_medio_alta_min * NULLIF(atendimentos_periodo, 0)) /
          NULLIF(SUM(NULLIF(atendimentos_periodo, 0)), 0),
          1
        ) AS tempo_medio_alta_min,
        ROUND(AVG(ocupacao_media_internacao), 1) AS ocupacao_media_internacao,
        ROUND(AVG(ocupacao_media_uti), 1) AS ocupacao_media_uti,
        ROUND(
          SUM(internacoes_periodo) * 100.0 /
          NULLIF(SUM(atendimentos_periodo), 0),
          1
        ) AS taxa_conversao_internacao_pct,
        ROUND(SUM(metas_acima_total), 0) AS metas_acima_total,
        ROUND(SUM(metas_atencao_total), 0) AS metas_atencao_total,
        ROUND(SUM(metas_ok_total), 0) AS metas_ok_total,
        ROUND(
          SUM(metas_ok_total) * 100.0 /
          NULLIF(SUM(metas_ok_total + metas_acima_total + metas_atencao_total), 0),
          1
        ) AS metas_conformidade_pct
      FROM unidade_consolidada
    `
  },
  {
    slug: "gerencial-unidades-ranking",
    description: "Ranking de unidades por volume diario para cards deslizantes.",
    sourceView: "tbl_tempos_entrada_consulta_saida",
    toSql: (context) => `
      WITH
      ${buildUnidadesCte(context)},
      periodo_atendimentos AS (
        SELECT
          TRY_CAST(t.cd_estabelecimento AS INTEGER) AS cd_estabelecimento,
          COUNT(DISTINCT t.nr_atendimento) AS atendimentos_hoje,
          COUNT(DISTINCT t.cd_pessoa_fisica) AS pacientes_ativos,
          AVG(COALESCE(TRY_CAST(t.min_entrada_x_alta AS DOUBLE), 0)) AS tempo_medio_alta_min
        FROM "tbl_tempos_entrada_consulta_saida" t
        INNER JOIN unidades u ON u.cd_estabelecimento = TRY_CAST(t.cd_estabelecimento AS INTEGER)
        WHERE ${buildGerencialPeriodClause(context)}
        GROUP BY TRY_CAST(t.cd_estabelecimento AS INTEGER)
      ),
      periodo_internacoes AS (
        SELECT
          TRY_CAST(c.cd_estab_urg AS INTEGER) AS cd_estabelecimento,
          COUNT(*) AS internacoes
        FROM "tbl_intern_conversoes" c
        INNER JOIN unidades u ON u.cd_estabelecimento = TRY_CAST(c.cd_estab_urg AS INTEGER)
        WHERE DATE(c.DT_ENTRADA) >= (
          SELECT MAX(DATE(x.DT_ENTRADA))
          FROM "tbl_intern_conversoes" x
        ) - INTERVAL '${context.periodDays - 1} days'
        GROUP BY TRY_CAST(c.cd_estab_urg AS INTEGER)
      ),
      snapshot_operacao AS (
        SELECT
          TRY_CAST(s.cd_estabelecimento AS INTEGER) AS cd_estabelecimento,
          SUM(COALESCE(TRY_CAST(s.transferencia AS DOUBLE), 0)) AS transferencias,
          AVG(COALESCE(TRY_CAST(s.ocupacao_internacao_pct AS DOUBLE), 0)) AS ocupacao_internacao_pct,
          SUM(
            COALESCE(TRY_CAST(s.triagem_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.consulta_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.permanencia_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.rx_ecg_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.tc_us_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.tc_us_laudo_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.reavaliacao_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.medicacao_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.procedimento_acima_meta AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.farmacia_acima_meta AS DOUBLE), 0)
          ) AS metas_acima_total,
          SUM(
            COALESCE(TRY_CAST(s.triagem_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.consulta_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.permanencia_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.rx_ecg_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.tc_us_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.tc_us_laudo_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.reavaliacao_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.medicacao_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.procedimento_em_atencao AS DOUBLE), 0) +
            COALESCE(TRY_CAST(s.farmacia_em_atencao AS DOUBLE), 0)
          ) AS metas_atencao_total,
          SUM(COALESCE(TRY_CAST(s.tc_us_pendente AS DOUBLE), 0)) AS pendencias_tc_us
        FROM "ps_resumo_unidades_snapshot_prod" s
        INNER JOIN unidades u ON u.cd_estabelecimento = TRY_CAST(s.cd_estabelecimento AS INTEGER)
        GROUP BY TRY_CAST(s.cd_estabelecimento AS INTEGER)
      )
      SELECT
        u.unidade,
        ROUND(COALESCE(a.atendimentos_hoje, 0), 0) AS atendimentos_hoje,
        ROUND(COALESCE(a.pacientes_ativos, 0), 0) AS pacientes_ativos,
        ROUND(COALESCE(i.internacoes, 0), 0) AS internacoes,
        ROUND(COALESCE(s.transferencias, 0), 0) AS transferencias,
        ROUND(COALESCE(s.ocupacao_internacao_pct, 0), 1) AS ocupacao_internacao_pct,
        ROUND(COALESCE(a.tempo_medio_alta_min, 0), 1) AS tempo_medio_alta_min,
        ROUND(
          GREATEST(
            0,
            100
            - (COALESCE(s.metas_acima_total, 0) * 1.8)
            - (COALESCE(s.metas_atencao_total, 0) * 0.8)
            - (GREATEST(COALESCE(s.ocupacao_internacao_pct, 0) - 85, 0) * 0.6)
            - (COALESCE(s.pendencias_tc_us, 0) * 0.8)
          ),
          1
        ) AS score_operacional
      FROM unidades u
      LEFT JOIN periodo_atendimentos a ON a.cd_estabelecimento = u.cd_estabelecimento
      LEFT JOIN periodo_internacoes i ON i.cd_estabelecimento = u.cd_estabelecimento
      LEFT JOIN snapshot_operacao s ON s.cd_estabelecimento = u.cd_estabelecimento
      ORDER BY score_operacional DESC, atendimentos_hoje DESC
      LIMIT ${clampLimit(context.limit)}
    `
  },
  {
    slug: "gerencial-metas-por-volumes",
    description:
      "Matriz Metas por volume: tres ultimos meses civis (automatico), Total e YTD; ignora period da pagina. Fontes agregadas em Node/DuckDB.",
    sourceView: "tbl_tempos_entrada_consulta_saida + medicacao + laboratorio + tc_us + reavaliacao + vias",
    toSql: ({ limit }) => `SELECT 1 WHERE false LIMIT ${clampLimit(limit)}`
  },
  {
    slug: "gerencial-metas-por-volumes-drill",
    description: "Drill por unidade para um indicador de metas por volume (query indicador obrigatoria).",
    sourceView: "tbl_tempos_entrada_consulta_saida + medicacao + laboratorio + tc_us + reavaliacao + vias",
    toSql: ({ limit }) => `SELECT 1 WHERE false LIMIT ${clampLimit(limit)}`
  },
  {
    slug: "painel-ps-base",
    description: "Leitura base do painel PS para cards e listas iniciais.",
    sourceView: "vw_painel_ps_base",
    toSql: ({ limit }) => `SELECT * FROM "vw_painel_ps_base" LIMIT ${clampLimit(limit)}`
  },
  {
    slug: "metas-tempos",
    description: "Metas de tempo por etapa, pronta para graficos de referencia.",
    sourceView: "meta_tempos",
    toSql: ({ limit }) => `SELECT * FROM "meta_tempos" LIMIT ${clampLimit(limit)}`
  },
  {
    slug: "unidades",
    description: "Cadastro de unidades para filtros e selecao de contexto.",
    sourceView: "tbl_unidades",
    toSql: ({ limit }) => `SELECT * FROM "tbl_unidades" LIMIT ${clampLimit(limit)}`
  },
  {
    slug: "internacoes-conversoes",
    description: "Base de conversoes e internacoes para indicadores de fluxo.",
    sourceView: "tbl_intern_conversoes",
    toSql: ({ limit }) => `SELECT * FROM "tbl_intern_conversoes" LIMIT ${clampLimit(limit)}`
  }
];

const queriesBySlug = new Map(dashboardQueries.map((query) => [query.slug, query]));

export function listDashboardQueryCatalog(): DashboardQueryDefinition[] {
  return dashboardQueries;
}

export function getDashboardQueryDefinition(slug: string): DashboardQueryDefinition | undefined {
  return queriesBySlug.get(slug);
}
