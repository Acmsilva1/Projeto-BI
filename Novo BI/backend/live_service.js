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

  async getOverviewMetasVolumes() {
    return { months: [], data: [] };
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
    return this.getOverviewMetasVolumes();
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
