/**
 * Aplicação Express — middleware global e registo de rotas (controladores).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import { registerApiV1 } from './controllers/apiV1Routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Raiz do repositório (`BACKEND/src` ou `BACKEND/dist` → dois níveis acima). */
function repoRootDir(): string {
  return path.resolve(__dirname, '..', '..');
}

function frontendDistPath(): string {
  const override = String(process.env.FRONTEND_DIST || '').trim();
  if (override) {
    return path.isAbsolute(override) ? override : path.join(repoRootDir(), override);
  }
  return path.join(repoRootDir(), 'FRONTEND', 'dist');
}

const EXTRA_CORS = String(process.env.CORS_EXTRA_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED = [
  'http://127.0.0.1:5180',
  'http://localhost:5180',
  'http://127.0.0.1:5188',
  'http://localhost:5188',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:1573',
  'http://localhost',
  'http://127.0.0.1',
  process.env.FRONTEND_URL,
  ...EXTRA_CORS,
].filter(Boolean) as string[];

export function createApp(): Express {
  const app = express();
  app.use(cors({ origin: ALLOWED, credentials: true }));
  app.use(express.json());
  app.get('/favicon.ico', (_req: Request, res: Response) => res.status(204).end());

  registerApiV1(app);

  const spaDir = frontendDistPath();
  const spaIndex = path.join(spaDir, 'index.html');
  if (fs.existsSync(spaIndex)) {
    app.use(express.static(spaDir, { index: false }));
    app.get(/^(?!\/api\/).*/, (req: Request, res: Response, next) => {
      if (req.method !== 'GET') return next();
      if (req.path.startsWith('/api')) return next();
      res.sendFile(spaIndex, (err) => next(err));
    });
  } else {
    console.warn(
      '[Hospital BI] Sem UI estática: não existe FRONTEND/dist/index.html. Faça `npm run build:all` na pasta BACKEND ou defina FRONTEND_DIST.',
    );
  }

  return app;
}
