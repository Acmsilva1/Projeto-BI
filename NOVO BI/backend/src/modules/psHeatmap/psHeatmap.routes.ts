import { Router } from "express";
import { psHeatmapChegadasController } from "../../controllers/psHeatmap.controller.js";

export const psHeatmapRoutes = Router();

psHeatmapRoutes.get("/chegadas", psHeatmapChegadasController);
