/**
 * Ponto de entrada — carrega env, cria app MVC e escuta a porta da API.
 */
import './config/loadEnv.js';
import { initStaleCache } from './cache/redisMemoryCache.js';
import { createApp } from './app.js';
import { registerGerenciaDataSliceMessaging } from './messaging/registerGerenciaDataSliceMessaging.js';
import { ensureGerenciaWarmPlan } from './repositories/gerenciaRepository.js';
import {
  ensureGerenciaAperitivoHotBootLoaded,
  ensureGerenciaAperitivoSeedLoaded,
  ensureGerenciaPeriod30HotBootLoaded,
} from './services/liveService.js';

registerGerenciaDataSliceMessaging();

const PORT = Number(process.env.HOSPITAL_BI_API_PORT || 3020);
const BIND_HOST = String(process.env.BIND_HOST || '127.0.0.1').trim() || '127.0.0.1';

const app = createApp();

void initStaleCache()
  .catch((e) => console.warn('[cache] initStaleCache:', e))
  .then(() => ensureGerenciaAperitivoSeedLoaded().catch((e) => console.warn('[gerencia] aperitivo seed boot:', e)))
  .then(() => {
    app.listen(PORT, BIND_HOST, () => {
      console.log(
        `[Hospital BI] API http://${BIND_HOST}:${PORT}  |  dev UI: npm run dev:vite no BACKEND (Vite em VITE_PORT, proxy /api -> esta porta)`,
      );
      // Prewarm pesado em background para não atrasar o boot da API.
      void ensureGerenciaAperitivoHotBootLoaded().catch((e) =>
        console.warn('[gerencia] aperitivo prewarm boot:', e),
      );
      void ensureGerenciaPeriod30HotBootLoaded().catch((e) =>
        console.warn('[gerencia] 30d prewarm boot:', e),
      );
      if (String(process.env.GERENCIA_PREWARM_ON_BOOT || '').trim() === '1') {
        ensureGerenciaWarmPlan();
        console.log('[Hospital BI] Gerencia: pre-aquecimento 30d/60d iniciado (GERENCIA_PREWARM_ON_BOOT=1).');
      }
    });
  });
