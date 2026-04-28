import cors from "cors";
import express from "express";
import { gerencialContextPrewarmController } from "./features/jornada/controllers/dashboard.controller.js";
import { env } from "./config/env.js";
import { coreRoutes } from "./features/jornada/routes/core.routes.js";
import { dataRoutes } from "./features/jornada/routes/data.routes.js";
import { dashboardRoutes } from "./features/jornada/routes/dashboard.routes.js";
import { internacaoDashboardRoutes } from "./features/jornada/routes/internacaoDashboard.routes.js";
import { psHeatmapRoutes } from "./features/jornada/routes/psHeatmap.routes.js";

export const app = express();

app.use(
  cors({
    origin: env.corsOrigin
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_, response) => {
  response.status(200).json({
    app: "novo-bi-api",
    status: "online",
    docs: "/api/v1/health"
  });
});

/** Rota exata no app (evita 404 se o router do dashboard nao corresponder ao ambiente). */
app.get("/api/v1/dashboard/prewarm/gerencial-context", gerencialContextPrewarmController);
app.post("/api/v1/dashboard/prewarm/gerencial-context", gerencialContextPrewarmController);

app.use("/api/v1", coreRoutes);
app.use("/api/v1/data", dataRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/internacao", internacaoDashboardRoutes);
app.use("/api/v1/ps-heatmap", psHeatmapRoutes);
