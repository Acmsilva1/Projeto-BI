import { app } from "./app.js";
import { env } from "./config/env.js";
import { prewarmDashboardStore } from "./services/dashboard.service.js";
import { ensureDuckDbReady } from "./services/duckdb.service.js";

async function bootstrap(): Promise<void> {
  console.log(`[data] gateway configurado: ${env.dataGateway}`);

  if (env.dataGateway === "duckdb") {
    try {
      await ensureDuckDbReady();
      console.log("[data] DuckDB pronto.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha desconhecida";
      console.error(`[data] DuckDB indisponivel, fallback para CSV-memory: ${message}`);
    }
  } else {
    console.log("[data] CSV memory gateway pronto.");
  }

  const prewarmStarted = Date.now();
  void prewarmDashboardStore()
    .then(() => {
      console.log(
        `[data] prewarm fase 1 (store + contexto 7d) em ${Date.now() - prewarmStarted}ms; demais periodos em background.`
      );
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "falha desconhecida";
      console.error(`[data] prewarm store falhou: ${message}`);
    });

  app.listen(env.port, () => {
    console.log(`[api] novo-bi listening on http://localhost:${env.port}`);
  });
}

void bootstrap();
