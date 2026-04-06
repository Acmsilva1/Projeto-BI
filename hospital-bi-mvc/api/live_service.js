const { fetchView } = require('./db');

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
const COLORS = ['#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#22c55e'];

const sum = (arr, field) => arr.reduce((a, x) => a + Number(x[field] || 0), 0);
const avg = (arr, field) => (arr.length ? sum(arr, field) / arr.length : 0);
const monthLabel = (d) => new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

function adjustPercentByMeta(basePercent, baseMeta, customMeta) {
  if (!baseMeta || !customMeta) return Number(basePercent || 0);
  const ratio = Number(baseMeta) / Number(customMeta);
  return clamp(Number(basePercent || 0) * ratio, 0, 100);
}

function parseMetaOverrides(filters = {}) {
  return {
    triagem: Number(filters.meta_triagem || 12),
    consulta: Number(filters.meta_consulta || 90),
    medicacao: Number(filters.meta_medicacao || 30),
    permanencia: Number(filters.meta_permanencia || 180),
  };
}

class LiveService {
  async getKPIs(filters = {}) {
    const rows = await fetchView('vw_realtime_kpi', filters);
    return {
      taxaOcupacao: { valor: avg(rows, 'taxa_ocupacao'), unidade: '%', variacao: 0, tendencia: 'estavel', meta: 85 },
      tempoMedioInternacao: { valor: avg(rows, 'tempo_medio_internacao'), unidade: 'dias', variacao: 0, tendencia: 'estavel', meta: 4.5 },
      cirurgiasNoMes: { valor: sum(rows, 'cirurgias_mes'), unidade: 'proced.', variacao: 0, tendencia: 'estavel', meta: 300 },
      taxaReadmissao: { valor: avg(rows, 'taxa_readmissao'), unidade: '%', variacao: 0, tendencia: 'estavel', meta: 4.0 },
      satisfacaoPaciente: { valor: avg(rows, 'satisfacao_paciente'), unidade: '%', variacao: 0, tendencia: 'estavel', meta: 90 },
      faturamentoMes: { valor: sum(rows, 'faturamento_mes'), unidade: 'R$', variacao: 0, tendencia: 'estavel', meta: 4500000 },
      leitosDisponiveis: { valor: sum(rows, 'leitos_disponiveis'), unidade: 'leitos', variacao: 0, tendencia: 'estavel', meta: 30 },
      pacientesAtivos: { valor: sum(rows, 'pacientes_ativos'), unidade: 'pac.', variacao: 0, tendencia: 'estavel', meta: 200 },
    };
  }

  async getKpiUnidades(filters = {}) {
    const rows = await fetchView('vw_realtime_kpi', filters, {
      columns: 'unidade_id,unidade_nome,regional,taxa_ocupacao,pacientes_ativos,cirurgias_mes,leitos_disponiveis',
      orderBy: 'unidade_id',
    });
    return rows.map((r) => ({
      unidadeId: r.unidade_id,
      unidadeNome: r.unidade_nome,
      regional: r.regional,
      taxaOcupacao: Number(r.taxa_ocupacao || 0),
      pacientesAtivos: Number(r.pacientes_ativos || 0),
      cirurgiasMes: Number(r.cirurgias_mes || 0),
      leitosDisponiveis: Number(r.leitos_disponiveis || 0),
    }));
  }

  async getPSVolumes(filters = {}) {
    const rows = await fetchView('vw_realtime_ps_volumes', filters, {
      columns: 'atendimentos,exames_laboratoriais,rx_ecg,tc_us,prescricoes,evasoes,conversao_internacao,reavaliacoes',
    });
    return {
      atendimentos: sum(rows, 'atendimentos'),
      examesLaboratoriais: sum(rows, 'exames_laboratoriais'),
      rxEcg: sum(rows, 'rx_ecg'),
      tcUs: sum(rows, 'tc_us'),
      prescricoes: sum(rows, 'prescricoes'),
      evasoes: sum(rows, 'evasoes'),
      conversaoInternacao: avg(rows, 'conversao_internacao').toFixed(1),
      reavaliacoes: sum(rows, 'reavaliacoes'),
    };
  }

  async getPSKpis(filters = {}) {
    try {
      const rows = await fetchView('vw_realtime_ps_kpis', filters);
      return {
        tempoPermanenciaMin: Number(avg(rows, 'tempo_permanencia_min').toFixed(1)),
        tempoConsultaMin: Number(avg(rows, 'tempo_consulta_min').toFixed(1)),
        examesTotal: sum(rows, 'exames_total'),
        medicacaoTotal: sum(rows, 'medicacao_total'),
        conversaoInternacao: Number(avg(rows, 'conversao_internacao').toFixed(1)),
        altas: sum(rows, 'altas_ps'),
        obitos: sum(rows, 'obitos_ps'),
      };
    } catch (_) {
      const vol = await this.getPSVolumes(filters);
      const sla = await this.getPSSlas(filters);
      return {
        tempoPermanenciaMin: Number(sla.permanencia?.meta || 0),
        tempoConsultaMin: Number(sla.consulta?.meta || 0),
        examesTotal: Number(vol.examesLaboratoriais || 0) + Number(vol.rxEcg || 0) + Number(vol.tcUs || 0),
        medicacaoTotal: Number(vol.prescricoes || 0),
        conversaoInternacao: Number(vol.conversaoInternacao || 0),
        altas: 0,
        obitos: 0,
      };
    }
  }

  async getPSSlas(filters = {}) {
    const overrides = parseMetaOverrides(filters);
    const rows = await fetchView('vw_realtime_ps_slas', filters, {
      columns: 'categoria,total,acima,meta_minutos',
    });
    const grouped = {};
    rows.forEach((r) => {
      if (!grouped[r.categoria]) grouped[r.categoria] = [];
      grouped[r.categoria].push(r);
    });

    const out = {};
    ['triagem', 'consulta', 'medicacao', 'reavaliacao', 'rx_ecg', 'tc_us', 'permanencia'].forEach((c) => {
      const arr = grouped[c] || [];
      const total = sum(arr, 'total');
      const acima = sum(arr, 'acima');
      const baseMeta = arr.length ? Number(arr[0].meta_minutos || 0) : 0;
      const basePercent = total ? Number(((acima / total) * 100).toFixed(2)) : 0;
      const customMeta = overrides[c] || baseMeta;
      const adjustedPercent = Number(adjustPercentByMeta(basePercent, baseMeta, customMeta).toFixed(2));
      const adjustedAcima = Math.round((adjustedPercent / 100) * total);

      out[c] = {
        total,
        acima: adjustedAcima,
        percent: adjustedPercent,
        meta: customMeta,
      };
    });
    return out;
  }

  async getPSMatrix(filters = {}) {
    const overrides = parseMetaOverrides(filters);
    const rows = await fetchView('vw_realtime_ps_matrix', filters, {
      columns: 'unidade_nome,triagem_percent,consulta_percent,medicacao_percent,imagem_percent,alta_percent',
      orderBy: 'unidade_nome',
    });
    return rows.map((r) => ({
      unidade: r.unidade_nome,
      triagemPercent: Number(adjustPercentByMeta(r.triagem_percent || 0, 12, overrides.triagem).toFixed(2)),
      consultaPercent: Number(adjustPercentByMeta(r.consulta_percent || 0, 90, overrides.consulta).toFixed(2)),
      medicacaoPercent: Number(adjustPercentByMeta(r.medicacao_percent || 0, 30, overrides.medicacao).toFixed(2)),
      imagemPercent: Number(r.imagem_percent || 0),
      altaPercent: Number(adjustPercentByMeta(r.alta_percent || 0, 180, overrides.permanencia).toFixed(2)),
    }));
  }

  async getFinanceiroResumo(filters = {}) {
    const rows = await fetchView('vw_grafico_financeiro_resumo_12m', filters, { orderBy: 'mes_ref' });
    const byMonth = new Map();
    rows.forEach((r) => {
      const key = r.mes_ref;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(r);
    });
    const months = [...byMonth.keys()];
    return {
      labels: months.map(monthLabel),
      receitas: months.map((m) => sum(byMonth.get(m), 'receita')),
      despesas: months.map((m) => sum(byMonth.get(m), 'despesa')),
      meta: months.length ? sum(byMonth.get(months[months.length - 1]), 'meta_receita') : 0,
      glosasPercent: months.map((m) => Number(avg(byMonth.get(m), 'glosa_percent').toFixed(2))),
    };
  }

  async getFinanceiroConvenio(filters = {}) {
    const rows = await fetchView('vw_realtime_financeiro_convenio', filters);
    const byConv = new Map();
    rows.forEach((r) => {
      if (!byConv.has(r.convenio)) byConv.set(r.convenio, { valor: 0, cor_hex: r.cor_hex || '#94a3b8' });
      byConv.get(r.convenio).valor += Number(r.valor || 0);
    });
    const items = [...byConv.entries()].sort((a, b) => b[1].valor - a[1].valor);
    return {
      labels: items.map(([k]) => k),
      valores: items.map(([, v]) => v.valor),
      cores: items.map(([, v]) => v.cor_hex),
    };
  }

  async getFinanceiroGlosas(filters = {}) {
    const rows = await fetchView('vw_realtime_financeiro_glosa_motivo', filters);
    const byMotivo = new Map();
    rows.forEach((r) => byMotivo.set(r.motivo, (byMotivo.get(r.motivo) || 0) + Number(r.valor || 0)));
    const itens = [...byMotivo.entries()].map(([motivo, valor]) => ({ motivo, valor })).sort((a, b) => b.valor - a.valor);
    const total = itens.reduce((a, x) => a + x.valor, 0);
    return {
      total,
      percentualFaturamento: 0,
      porMotivo: itens.map((x) => ({ ...x, percentual: total ? Math.round((x.valor / total) * 100) : 0 })),
    };
  }

  async getOcupacaoSetor(filters = {}) {
    const rows = await fetchView('vw_realtime_ocupacao_setor', filters);
    const bySetor = new Map();
    rows.forEach((r) => {
      if (!bySetor.has(r.setor)) bySetor.set(r.setor, { total: 0, ocupados: 0 });
      bySetor.get(r.setor).total += Number(r.leitos_total || 0);
      bySetor.get(r.setor).ocupados += Number(r.leitos_ocupados || 0);
    });
    return {
      setores: [...bySetor.entries()].map(([nome, v]) => ({
        nome,
        ocupados: v.ocupados,
        total: v.total,
        percentual: v.total ? Number(((v.ocupados / v.total) * 100).toFixed(2)) : 0,
      })),
    };
  }

  async getInternacaoKPIs(filters = {}) {
    const rows = await fetchView('vw_realtime_internacao_kpis', filters, {
      columns: 'altas_acumuladas,obitos_acumulados,tempo_medio_permanencia,taxa_readmissao',
    });
    return {
      altasAcumuladas: sum(rows, 'altas_acumuladas'),
      obitosAcumulados: sum(rows, 'obitos_acumulados'),
      tempoMedioPermanencia: avg(rows, 'tempo_medio_permanencia').toFixed(1),
      taxaReadmissao: avg(rows, 'taxa_readmissao').toFixed(1),
    };
  }

  async getInternacaoResumo(filters = {}) {
    try {
      const rows = await fetchView('vw_realtime_internacao_resumo', filters);
      return {
        quantidadeInternacoes: sum(rows, 'qtd_internacoes'),
        altas: sum(rows, 'altas'),
        obitos: sum(rows, 'obitos'),
        pacientesClinicos: sum(rows, 'pacientes_clinicos'),
        pacientesCirurgicos: sum(rows, 'pacientes_cirurgicos'),
        pacientesInternos: sum(rows, 'pacientes_internos'),
        pacientesExternos: sum(rows, 'pacientes_externos'),
      };
    } catch (_) {
      const rows = await this.getInternacoes(filters);
      const quantidadeInternacoes = rows.length;
      const altas = rows.filter((r) => String(r.status || '').includes('Alta')).length;
      const obitos = rows.filter((r) => String(r.status || '').toLowerCase() === 'obito').length;
      return {
        quantidadeInternacoes,
        altas,
        obitos,
        pacientesClinicos: 0,
        pacientesCirurgicos: 0,
        pacientesInternos: 0,
        pacientesExternos: 0,
      };
    }
  }

  async getInternacoes(filters = {}) {
    const rows = await fetchView('vw_realtime_internacoes', filters, {
      columns: 'id,paciente_ref,setor,convenio,dias_internacao,data_entrada,status',
      orderBy: 'data_entrada',
      ascending: false,
      limit: 240,
    });
    return rows.map((r) => ({
      id: r.id,
      pacienteRef: r.paciente_ref,
      setor: r.setor,
      convenio: r.convenio,
      diasInternacao: Number(r.dias_internacao || 0),
      dataEntrada: new Date(r.data_entrada).toLocaleDateString('pt-BR'),
      status: r.status,
    }));
  }

  async getOcupacaoTendencia(filters = {}) {
    const rows = await fetchView('vw_grafico_ocupacao_tendencia_30d', filters, { orderBy: 'referencia_data' });
    const labels = [...new Set(rows.map((r) => new Date(r.referencia_data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })))];
    const bySerie = new Map();
    rows.forEach((r) => {
      if (!bySerie.has(r.serie_nome)) bySerie.set(r.serie_nome, []);
      bySerie.get(r.serie_nome).push(Number(r.percentual || 0));
    });
    const series = [...bySerie.entries()].map(([nome, dados], i) => ({ nome, cor: COLORS[i % COLORS.length], dados }));
    return { labels, series, meta: 85 };
  }

  async getOcupacaoQualidade() {
    const rows = await fetchView('vw_grafico_ocupacao_qualidade_6m', {}, { orderBy: 'mes_ref' });
    return {
      labels: rows.map((r) => monthLabel(r.mes_ref)),
      infeccaoHospitalar: rows.map((r) => Number(r.infeccao_hospitalar || 0)),
      quedas: rows.map((r) => Number(r.quedas || 0)),
      ulcerasPressao: rows.map((r) => Number(r.ulceras_pressao || 0)),
      nps: rows.map((r) => Number(r.nps || 0)),
      meta: 2.0,
      metaNps: 90,
    };
  }

  async getCirurgiaEspecialidade(filters = {}) {
    const rows = await fetchView('vw_realtime_cirurgia_especialidade', filters, { orderBy: 'especialidade' });
    const byEsp = new Map();
    rows.forEach((r) => {
      if (!byEsp.has(r.especialidade)) byEsp.set(r.especialidade, { q: 0, m: Number(r.meta || 0) });
      byEsp.get(r.especialidade).q += Number(r.quantidade || 0);
    });
    const items = [...byEsp.entries()];
    return {
      labels: items.map(([k]) => k),
      dados: items.map(([, v]) => v.q),
      meta: items.map(([, v]) => v.m),
    };
  }

  async getCirurgiaEvolucao(filters = {}) {
    const rows = await fetchView('vw_grafico_cirurgia_evolucao_12m', filters, { orderBy: 'mes_ref' });
    const byMonth = new Map();
    rows.forEach((r) => {
      if (!byMonth.has(r.mes_ref)) byMonth.set(r.mes_ref, []);
      byMonth.get(r.mes_ref).push(r);
    });
    const months = [...byMonth.keys()];
    return {
      labels: months.map(monthLabel),
      eletivas: months.map((m) => sum(byMonth.get(m), 'eletivas')),
      urgencias: months.map((m) => sum(byMonth.get(m), 'urgencias')),
      meta: months.length ? avg(byMonth.get(months[months.length - 1]), 'meta') : 0,
    };
  }

  async getCirurgiaTempoCentro(filters = {}) {
    const tempoRows = await fetchView('vw_realtime_cirurgia_tempo_semana', filters, { orderBy: 'dia_semana' });
    const heatRows = await fetchView('vw_realtime_cirurgia_heatmap', filters, { orderBy: 'hora_label' });

    const byDay = new Map();
    tempoRows.forEach((r) => {
      if (!byDay.has(r.dia_semana)) byDay.set(r.dia_semana, []);
      byDay.get(r.dia_semana).push(r);
    });
    const mediaTempoMin = [1, 2, 3, 4, 5, 6, 7].map((d) => Number(avg(byDay.get(d) || [], 'media_tempo_min').toFixed(0)));

    const horasLabels = [...new Set(heatRows.map((r) => r.hora_label))];
    const heatmap = horasLabels.map((h) => {
      const linha = [];
      for (let d = 1; d <= 7; d += 1) {
        const vals = heatRows.filter((r) => r.hora_label === h && Number(r.dia_semana) === d);
        linha.push(Number(avg(vals, 'utilizacao_percent').toFixed(0)));
      }
      return linha;
    });

    return { labels: DIAS_SEMANA, mediaTempoMin, heatmap, horasLabels };
  }

  async getCCPerformance(filters = {}) {
    const rows = await fetchView('vw_realtime_cc_performance', filters);
    return {
      atraso30min: avg(rows, 'atraso_30_min').toFixed(1),
      ociosidadeSala: avg(rows, 'ociosidade_sala').toFixed(1),
      subutilizacaoFiltrado: Math.round(avg(rows, 'subutilizacao_filtrado')),
      taxaReabordagem: avg(rows, 'taxa_reabordagem').toFixed(1),
      totalCirurgias: sum(rows, 'total_cirurgias'),
    };
  }

  async getCCKpis(filters = {}) {
    try {
      const rows = await fetchView('vw_realtime_cc_kpis', filters);
      return {
        tempoCirurgiaMin: Number(avg(rows, 'tempo_cirurgia_min').toFixed(1)),
        tempoSalaMin: Number(avg(rows, 'tempo_sala_min').toFixed(1)),
        tempoAnestesiaMin: Number(avg(rows, 'tempo_anestesia_min').toFixed(1)),
        altas: sum(rows, 'altas_cc'),
        obitos: sum(rows, 'obitos_cc'),
        eletivas: sum(rows, 'eletivas'),
        urgencias: sum(rows, 'urgencias'),
      };
    } catch (_) {
      const perf = await this.getCCPerformance(filters);
      const evo = await this.getCirurgiaEvolucao(filters);
      return {
        tempoCirurgiaMin: Number(perf.subutilizacaoFiltrado || 0),
        tempoSalaMin: Number(perf.subutilizacaoFiltrado || 0) + 20,
        tempoAnestesiaMin: 45,
        altas: 0,
        obitos: 0,
        eletivas: (evo.eletivas || []).reduce((a, x) => a + Number(x || 0), 0),
        urgencias: (evo.urgencias || []).reduce((a, x) => a + Number(x || 0), 0),
      };
    }
  }

  async getCCPerformanceTimeline(filters = {}) {
    const rows = await fetchView('vw_realtime_cc_timeline', filters, { orderBy: 'sequencia' });
    const grouped = new Map();
    rows.forEach((r) => {
      const key = `${r.sala_nome}-${r.nr_cirurgia}`;
      if (!grouped.has(key)) grouped.set(key, { unidade: r.sala_nome, nrCirurgia: r.nr_cirurgia, eventos: [] });
      grouped.get(key).eventos.push({
        sequencia: Number(r.sequencia),
        nome: r.evento_nome,
        data: new Date(r.evento_data).toISOString(),
      });
    });
    return [...grouped.values()];
  }
}

module.exports = new LiveService();



