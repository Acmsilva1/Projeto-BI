import { Router } from "express";
import { psMedicacaoController } from "../controllers/psMedicacao.controller.js";

export const psMedicacaoRoutes = Router();

psMedicacaoRoutes.get("/", psMedicacaoController);
