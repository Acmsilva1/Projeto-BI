require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors    = require('cors');
const liveService = require('./live_service');

const app  = express();
const PORT = process.env.PORT || 3001;

// CORS — aceita o dev do Vite e origin do front em produção
const ALLOWED = [
  'http://127.0.0.1:5174',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:1573',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({ origin: ALLOWED, credentials: true }));
app.use(express.json());
app.get('/favicon.ico', (_, res) => res.status(204).end());

/** Evita 404 HTML em GET /api — clientes devem usar /api/v1/... */
app.get(['/api', '/api/'], (_, res) => {
  res.status(404).json({
    ok: false,
    error: 'Rota inválida. Use prefixo /api/v1 (ex.: GET /api/v1/kpi).',
  });
});

/** Rotas: Postgres entrega via views; handler só orquestra fetch + shape leve de resposta. */
const route = (handler) => async (req, res) => {
  try {
    const data = await handler(req, res);
    res.json({ ok: true, data });
  } catch (error) {
    const errMsg =
      error?.message ||
      error?.errors?.[0]?.message ||
      error?.code ||
      'Erro interno ao consultar dados';
    console.error('API error:', errMsg, error?.code || '');
    res.status(500).json({ ok: false, error: errMsg });
  }
};

/**
 * Roteador de KPIs Principais
 */
app.get('/api/v1/kpi', route((req) => liveService.getKPIs(req.query)));
app.get('/api/v1/kpi/unidades', route((req) => liveService.getKpiUnidades(req.query)));
app.get('/api/v1/overview/indicadores', route((req) => liveService.getIndicadoresGerais(req.query)));
app.get('/api/v1/overview/metas-volumes', route((req) => liveService.getOverviewMetasVolumes(req.query)));

/**
 * Gerência — matriz Metas por volumes + unidades com PS (filtro topo)
 */
app.get('/api/v1/gerencia/unidades-ps', route((req) => liveService.getGerenciaUnidadesPs(req.query)));
app.get('/api/v1/gerencia/metas-por-volumes', route((req) => liveService.getGerenciaMetasPorVolumes(req.query)));
app.get(
  '/api/v1/gerencia/metricas-por-unidade',
  route((req) => liveService.getGerenciaMetricasPorUnidade(req.query)),
);
app.get('/api/v1/gerencia/totais-ps', route((req) => liveService.getGerenciaTotaisPs(req.query)));
app.get(
  '/api/v1/gerencia/tempo-medio-etapas',
  route((req) => liveService.getGerenciaTempoMedioEtapas(req.query)),
);
app.get(
  '/api/v1/gerencia/metas-acompanhamento-gestao',
  route((req) => liveService.getGerenciaMetasAcompanhamentoGestao(req.query)),
);
app.get(
  '/api/v1/gerencia/metas-conformes-por-unidade',
  route((req) => liveService.getGerenciaMetasConformesPorUnidade(req.query)),
);
app.get(
  '/api/v1/gerencia/metas-por-volumes/indicador/:indicadorKey/unidades',
  route((req) => liveService.getGerenciaMetasPorVolumesPorIndicador(req.params.indicadorKey, req.query)),
);

/**
 * Roteador Pronto Socorro (PS)
 */
const psRouter = express.Router();
psRouter.get('/volumes', route((req) => liveService.getPSVolumes(req.query)));
psRouter.get('/kpis', route((req) => liveService.getPSKpis(req.query)));
psRouter.get('/slas', route((req) => liveService.getPSSlas(req.query)));
psRouter.get('/matrix', route((req) => liveService.getPSMatrix(req.query)));
psRouter.get('/history', route((req) => liveService.getPSHistory(req.query)));
psRouter.get('/perfil', route((req) => liveService.getPSPerfil(req.query)));
psRouter.get('/fluxos', route((req) => liveService.getPSFluxos(req.query)));
psRouter.get('/medicacao', route((req) => liveService.getPSMedicacao(req.query)));
psRouter.get('/conversao', route((req) => liveService.getPSConversao(req.query)));
app.use('/api/v1/ps', psRouter);

/**
 * Roteador Financeiro
 */
const finRouter = express.Router();
finRouter.get('/resumo', route((req) => liveService.getFinanceiroResumo(req.query)));
finRouter.get('/convenio', route((req) => liveService.getFinanceiroConvenio(req.query)));
finRouter.get('/glosas', route((req) => liveService.getFinanceiroGlosas(req.query)));
app.use('/api/v1/financeiro', finRouter);

/**
 * Roteador Ocupacao
 */
const ocupRouter = express.Router();
ocupRouter.get('/setor', route((req) => liveService.getOcupacaoSetor(req.query)));
ocupRouter.get('/kpis', route((req) => liveService.getInternacaoKPIs(req.query)));
ocupRouter.get('/resumo', route((req) => liveService.getInternacaoResumo(req.query)));
ocupRouter.get('/internacoes', route((req) => liveService.getInternacoes(req.query)));
ocupRouter.get('/tendencia', route((req) => liveService.getOcupacaoTendencia(req.query)));
ocupRouter.get('/qualidade', route(() => liveService.getOcupacaoQualidade()));
app.use('/api/v1/ocupacao', ocupRouter);

/**
 * Roteador Cirurgias (Visao Geral)
 */
const cirurgiaRouter = express.Router();
cirurgiaRouter.get('/especialidade', route((req) => liveService.getCirurgiaEspecialidade(req.query)));
cirurgiaRouter.get('/evolucao', route((req) => liveService.getCirurgiaEvolucao(req.query)));
cirurgiaRouter.get('/tempo-centro', route((req) => liveService.getCirurgiaTempoCentro(req.query)));
app.use('/api/v1/cirurgia', cirurgiaRouter);

/**
 * Roteador Centro Cirurgico (CC)
 */
const ccRouter = express.Router();
ccRouter.get('/performance', route((req) => liveService.getCCPerformance(req.query)));
ccRouter.get('/kpis', route((req) => liveService.getCCKpis(req.query)));
ccRouter.get('/timeline', route((req) => liveService.getCCPerformanceTimeline(req.query)));
app.use('/api/v1/cc', ccRouter);

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    api: 'v1',
    description: 'Express JSON — implemente live_service para preencher /api/v1/*',
  });
});

app.listen(PORT, () => {
  console.log(`[Hospital BI] API iniciada na porta ${PORT}`);
});





