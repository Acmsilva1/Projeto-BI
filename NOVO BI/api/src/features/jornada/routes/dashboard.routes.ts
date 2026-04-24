import { Router } from "express";
import { dashboardCatalogController, dashboardQueryController } from "../controllers/dashboard.controller.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/slugs", dashboardCatalogController);
dashboardRoutes.get("/:slug", dashboardQueryController);
