import { Router } from "express";
import {
  internacaoFiltrosController,
  internacaoMetasController,
  internacaoTopoController,
  internacaoVariadosController
} from "../controllers/internacaoDashboard.controller.js";

export const internacaoDashboardRoutes = Router();

internacaoDashboardRoutes.get("/filtros", internacaoFiltrosController);
internacaoDashboardRoutes.get("/topo", internacaoTopoController);
internacaoDashboardRoutes.get("/metas", internacaoMetasController);
internacaoDashboardRoutes.get("/variados", internacaoVariadosController);
