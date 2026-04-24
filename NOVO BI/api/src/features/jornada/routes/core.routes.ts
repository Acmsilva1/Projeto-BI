import { Router } from "express";
import { healthController, pingController } from "../controllers/core.controller.js";

export const coreRoutes = Router();

coreRoutes.get("/health", healthController);
coreRoutes.get("/ping", pingController);
