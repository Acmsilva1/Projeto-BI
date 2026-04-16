/**
 * Ponto de entrada — carrega env, cria app MVC e escuta a porta da API.
 */
import './config/loadEnv.js';
import { initStaleCache } from './cache/redisMemoryCache.js';
import { createApp } from './app.js';
import { registerGerenciaDataSliceMessaging } from './messaging/registerGerenciaDataSliceMessaging.js';

registerGerenciaDataSliceMessaging();

const PORT = Number(process.env.HOSPITAL_BI_API_PORT || 3020);
const BIND_HOST = String(process.env.BIND_HOST || '127.0.0.1').trim() || '127.0.0.1';

const app = createApp();

void initStaleCache()
  .catch((e) => console.warn('[cache] initStaleCache:', e))
  .then(() => {
    app.listen(PORT, BIND_HOST, () => {
      console.log(`[Hospital BI] http://${BIND_HOST}:${PORT} (API + UI quando FRONTEND/dist existir)`);
    });
  });
