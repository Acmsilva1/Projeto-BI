import { Router } from "express";
import { dataViewRowsController, dataViewsController } from "../controllers/data.controller.js";

export const dataRoutes = Router();

dataRoutes.get("/views", dataViewsController);
dataRoutes.get("/view/:viewName", dataViewRowsController);
