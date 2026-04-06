require('dotenv').config();
const express = require('express');
const cors = require('cors');
const liveService = require('./live_service');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.get('/favicon.ico', (_, res) => res.status(204).end());

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

/**
 * Roteador Pronto Socorro (PS)
 */
const psRouter = express.Router();
psRouter.get('/volumes', route((req) => liveService.getPSVolumes(req.query)));
psRouter.get('/kpis', route((req) => liveService.getPSKpis(req.query)));
psRouter.get('/slas', route((req) => liveService.getPSSlas(req.query)));
psRouter.get('/matrix', route((req) => liveService.getPSMatrix(req.query)));
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
  res.json({ status: "ok", mode: "Node.js Live (sem mock)", architecture: "MVC" });
});

app.listen(PORT, () => {
  console.log(`"" Hospital BI API - Node.js Backend iniciada na porta ${PORT}`);
});





