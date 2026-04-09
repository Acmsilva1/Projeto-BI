/**
 * live_service.js — Camada de API (fina).
 *
 * Arquitetura desejada:
 *   PostgreSQL (views/ETL prontos) → fetchView() → mapeamento leve linha→JSON → { ok, data }.
 *
 * Não fazer aqui: agregações pesadas, joins simulados em JS, laços sobre fatos
 * brutos grandes — isso aumenta delay. O “pesado” fica no Postgres; scripts
 * de referência vivem em ../postgres/sql/ (ver ../postgres/ORIENTACAO.txt).
 *
 * Hoje: respostas vazias/zeradas até religar require('./db') + fetchView por método.
 */

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

const emptyKpiField = () => ({
  valor: 0,
  unidade: '',
  variacao: 0,
  tendencia: 'estavel',
  meta: 0,
});

const emptySla = () => ({
  total: 0,
  acima: 0,
  percent: 0,
  meta: 0,
  mu: 0,
  sigma: 0,
  zScore: 0,
});

const slaKeys = ['triagem', 'consulta', 'medicacao', 'reavaliacao', 'rx_ecg', 'tc_us', 'permanencia'];

/** Indicadores da matriz “Metas por volumes” (alinhado ao modelo Power BI). */
const METAS_POR_VOLUMES_INDICADORES = [
  { key: 'conversao', name: 'Conversão', isReverso: true, isP: true },
  { key: 'pacs_medicados', name: 'Pacs medicados', isReverso: true, isP: true },
  { key: 'medicacoes_por_paciente', name: 'Medicações por paciente', isReverso: true, isP: false },
  { key: 'pacs_exames_lab', name: 'Pacs c/ exames laboratoriais', isReverso: true, isP: true },
  { key: 'lab_por_paciente', name: 'Laboratório por paciente', isReverso: true, isP: false },
  { key: 'pacs_exames_tc', name: 'Pacs c/ exames de TC', isReverso: true, isP: true },
  { key: 'tcs_por_paciente', name: 'TCs por paciente', isReverso: true, isP: false },
  { key: 'triagem_acima_meta', name: 'Triagem acima da meta', isReverso: true, isP: true },
  { key: 'consulta_acima_meta', name: 'Consulta acima da meta', isReverso: true, isP: true },
  { key: 'medicacao_acima_meta', name: 'Medicação acima da meta', isReverso: true, isP: true },
  { key: 'reavaliacao_acima_meta', name: 'Reavaliação acima da meta', isReverso: true, isP: true },
  { key: 'permanencia_acima_meta', name: 'Permanência acima da meta', isReverso: true, isP: true },
  { key: 'desfecho_medico', name: 'Desfecho do médico do atend.', isReverso: false, isP: true },
];

function emptyMetasMonthCells() {
  const z = () => ({ v: 0, d: 0 });
  return {
    m1: z(),
    m2: z(),
    m3: z(),
    t: { v: 0, ytd: 0, sec: '(0)' },
  };
}

function defaultRollingMonths() {
  const months = [];
  const mesKeys = [];
  for (let i = 2; i >= 0; i -= 1) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    mesKeys.push(`${y}-${m}`);
    months.push(
      d
        .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
        .replace(/\./g, '')
        .replace(/^\w/, (c) => c.toUpperCase()),
    );
  }
  return { months, mesKeys };
}

/**
 * Unidades PS de demonstração (mesmo padrão visual do Power BI: UF - Nome).
 * Substituir por fetchView quando o Postgres estiver ligado.
 */
const DEMO_UNIDADES_PS = [
  { unidadeId: 'df-ps-sig', unidadeNome: 'PS SIG', regional: 'DF' },
  { unidadeId: 'es-hosp-vitoria', unidadeNome: 'HOSPITAL VITORIA', regional: 'ES' },
  { unidadeId: 'mg-pampulha', unidadeNome: 'PAMPULHA', regional: 'MG' },
  { unidadeId: 'rj-ps-botafogo', unidadeNome: 'PS BOTAFOGO', regional: 'RJ' },
  { unidadeId: 'rj-ps-ipanema', unidadeNome: 'PS IPANEMA', regional: 'RJ' },
];

function labelUnidadePs(u) {
  return `${u.regional} - ${u.unidadeNome}`;
}

/** Lista para filtro do cabeçalho: respeita regional; não filtra por unidade (o select precisa de todas da regional). */
function listUnidadesPsParaFiltro(query = {}) {
  let list = [...DEMO_UNIDADES_PS];
  if (query.regional) list = list.filter((u) => u.regional === query.regional);
  return list;
}

/** Unidades no contexto da matriz (regional + opcionalmente uma unidade só). */
function filterUnidadesPsMatriz(query = {}) {
  let list = [...DEMO_UNIDADES_PS];
  if (query.regional) list = list.filter((u) => u.regional === query.regional);
  if (query.unidade) list = list.filter((u) => u.unidadeId === query.unidade);
  return list;
}

function subItemsMetasPorVolumesFromUnidades(units) {
  return units.map((u) => ({
    unidadeId: u.unidadeId,
    name: labelUnidadePs(u),
    ...emptyMetasMonthCells(),
  }));
}

function metasPorVolumesMatrixForQuery(query = {}) {
  const { months, mesKeys } = defaultRollingMonths();
  const units = filterUnidadesPsMatriz(query);
  const subTemplate = subItemsMetasPorVolumesFromUnidades(units);
  const data = METAS_POR_VOLUMES_INDICADORES.map((ind) => ({
    key: ind.key,
    name: ind.name,
    isReverso: ind.isReverso,
    isP: ind.isP,
    ...emptyMetasMonthCells(),
    subItems: subTemplate.map((s) => ({ ...s })),
  }));
  return {
    months,
    mesKeys,
    data,
    meta: {
      schemaVersion: 1,
      titulo: 'Metas por volumes',
      filtroUnidades: 'apenas_unidades_com_ps',
      unidadesNoContexto: units.length,
    },
  };
}

class LiveService {
  async getKPIs() {
    return {
      taxaOcupacao: { ...emptyKpiField(), unidade: '%' },
      tempoMedioInternacao: { ...emptyKpiField(), unidade: 'dias' },
      cirurgiasNoMes: { ...emptyKpiField(), unidade: 'proced.' },
      taxaReadmissao: { ...emptyKpiField(), unidade: '%' },
      satisfacaoPaciente: { ...emptyKpiField(), unidade: '%' },
      faturamentoMes: { ...emptyKpiField(), unidade: 'R$' },
      leitosDisponiveis: { ...emptyKpiField(), unidade: 'leitos' },
      pacientesAtivos: { ...emptyKpiField(), unidade: 'pac.' },
    };
  }

  async getKpiUnidades() {
    return [];
  }

  async getIndicadoresGerais() {
    return { linhas: [], totais: {} };
  }

  async getOverviewMetasVolumes(query = {}) {
    return this.getGerenciaMetasPorVolumes(query);
  }

  /**
   * Unidades que possuem PS — para o filtro do cabeçalho na visão Gerência.
   * Mesmo shape de getKpiUnidades: { unidadeId, unidadeNome, regional }.
   */
  async getGerenciaUnidadesPs(query = {}) {
    return listUnidadesPsParaFiltro(query);
  }

  /**
   * Matriz consolidada “Metas por volumes” + drill por unidade (subItems).
   */
  async getGerenciaMetasPorVolumes(query = {}) {
    return metasPorVolumesMatrixForQuery(query);
  }

  /**
   * Drill explícito por indicador (opcional se a view principal não trouxer subItems).
   * Query: ?period=&regional=&unidade=
   */
  async getGerenciaMetasPorVolumesPorIndicador(indicadorKey, filters) {
    const ind = METAS_POR_VOLUMES_INDICADORES.find((x) => x.key === indicadorKey);
    const units = filterUnidadesPsMatriz(filters || {});
    return {
      indicadorKey,
      indicadorNome: ind?.name ?? null,
      unidades: subItemsMetasPorVolumesFromUnidades(units),
    };
  }

  async getPSVolumes() {
    return {
      atendimentos: 0,
      examesLaboratoriais: 0,
      rxEcg: 0,
      tcUs: 0,
      prescricoes: 0,
      evasoes: 0,
      conversaoInternacao: '0',
      reavaliacoes: 0,
      pacsMedicados: 0,
      medicacoesPorPaciente: '0',
      pacsExamesLab: 0,
      labPorPaciente: '0',
      pacsTcs: 0,
      tcsPorPaciente: '0',
      desfechoMedico: '',
    };
  }

  async getPSKpis() {
    return {
      tempoPermanenciaMin: 0,
      tempoConsultaMin: 0,
      examesTotal: 0,
      medicacaoTotal: 0,
      conversaoInternacao: 0,
      altas: 0,
      obitos: 0,
    };
  }

  async getPSSlas() {
    const out = {};
    slaKeys.forEach((k) => {
      out[k] = emptySla();
    });
    return out;
  }

  async getPSMatrix() {
    return [];
  }

  async getPSHistory() {
    return this.getOverviewMetasVolumes({});
  }

  async getPSPerfil() {
    return { faixaEtaria: [], sexo: [], desfechoMedico: [] };
  }

  async getPSFluxos() {
    return {
      diasLabels: [],
      horasLabels: [],
      heatmapAtendimentos: [],
      heatmapTempoMedioMin: [],
      resumoPorHora: [],
      heatmapCalendario: { horasLabels: [], diasLabels: [], atendimentos: [] },
    };
  }

  async getPSMedicacao() {
    return { porVia: [], velocidade: { rapida: 0, lenta: 0 }, top10: [] };
  }

  async getPSConversao() {
    return {
      labels: [],
      taxaConversaoPct: [],
      atendimentos: [],
      internacoes: [],
      porUnidadeUltimoMes: [],
      kpis: {
        quantidadeAtendimentos: 0,
        quantidadeInternacoes: 0,
        taxaConversaoPct: 0,
        tempoMedioPsInternacaoHoras: null,
      },
    };
  }

  async getFinanceiroResumo() {
    return {
      labels: [],
      receitas: [],
      despesas: [],
      meta: 0,
      glosasPercent: [],
    };
  }

  async getFinanceiroConvenio() {
    return { labels: [], valores: [], cores: [] };
  }

  async getFinanceiroGlosas() {
    return { total: 0, percentualFaturamento: 0, porMotivo: [] };
  }

  async getOcupacaoSetor() {
    return { setores: [] };
  }

  async getInternacaoKPIs() {
    return {
      altasAcumuladas: 0,
      obitosAcumulados: 0,
      tempoMedioPermanencia: '0',
      taxaReadmissao: '0',
    };
  }

  async getInternacaoResumo() {
    return {
      quantidadeInternacoes: 0,
      altas: 0,
      obitos: 0,
      pacientesClinicos: 0,
      pacientesCirurgicos: 0,
      pacientesInternos: 0,
      pacientesExternos: 0,
    };
  }

  async getInternacoes() {
    return [];
  }

  async getOcupacaoTendencia() {
    return { labels: [], series: [], meta: 0 };
  }

  async getOcupacaoQualidade() {
    return {
      labels: [],
      infeccaoHospitalar: [],
      quedas: [],
      ulcerasPressao: [],
      nps: [],
      meta: 0,
      metaNps: 0,
    };
  }

  async getCirurgiaEspecialidade() {
    return { labels: [], dados: [], meta: [] };
  }

  async getCirurgiaEvolucao() {
    return { labels: [], eletivas: [], urgencias: [], meta: 0 };
  }

  async getCirurgiaTempoCentro() {
    return {
      labels: DIAS_SEMANA,
      mediaTempoMin: [0, 0, 0, 0, 0, 0, 0],
      heatmap: [],
      horasLabels: [],
    };
  }

  async getCCPerformance() {
    return {
      atraso30min: '0',
      ociosidadeSala: '0',
      subutilizacaoFiltrado: 0,
      taxaReabordagem: '0',
      totalCirurgias: 0,
    };
  }

  async getCCKpis() {
    return {
      tempoCirurgiaMin: 0,
      tempoSalaMin: 0,
      tempoAnestesiaMin: 0,
      altas: 0,
      obitos: 0,
      eletivas: 0,
      urgencias: 0,
    };
  }

  async getCCPerformanceTimeline() {
    return [];
  }
}

module.exports = new LiveService();
