#!/usr/bin/env node
/**
 * Observa alterações em BACKEND/src, FRONTEND/src e ficheiros-chave da pipeline,
 * reexecuta builds (e opcionalmente docker compose + API) e escreve logs em testes/logs/.
 *
 * Uso (na pasta testes):
 *   npm install
 *   npm start                    # watch contínuo
 *   npm run once                 # uma execução e sair
 *
 * Variáveis:
 *   TESTES_API_BASE=http://127.0.0.1:3020   — smoke GET /health e /api/v1/_meta/stack
 *   SKIP_FRONTEND_BUILD=1                 — não corre vite build
 *   SKIP_DOCKER_COMPOSE=1                 — não corre docker compose config
 *   TESTES_DEBOUNCE_MS=3000               — silêncio antes de disparar após mudanças
 */
import chokidar from 'chokidar';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunLogger } from './lib/logger.js';
import { REPO_ROOT, runFullPipeline } from './lib/pipeline-check.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = REPO_ROOT;

const debounceMs = Number(process.env.TESTES_DEBOUNCE_MS || 3500);
const once = process.argv.includes('--once');

const watchTargets = [
  path.join(root, 'BACKEND', 'src'),
  path.join(root, 'FRONTEND', 'src'),
  path.join(root, 'BACKEND', 'package.json'),
  path.join(root, 'FRONTEND', 'package.json'),
  path.join(root, 'BACKEND', 'tsconfig.json'),
  path.join(root, 'docker-compose.yml'),
  path.join(root, 'BACKEND', 'Dockerfile'),
  path.join(root, 'FRONTEND', 'Dockerfile'),
];

let debounceTimer = null;
let running = false;
let pending = false;

async function executeRun(reason) {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  pending = false;

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const log = createRunLogger(runId);
  log.write(`Disparo: ${reason || 'manual'}`);

  try {
    const { ok, failures } = await runFullPipeline(log);
    if (!ok) {
      console.error(`\n[testes/pipeline] FALHA: ${failures.join(', ')}\nVer: ${log.historyPath}\n`);
      process.exitCode = 1;
    } else {
      console.log(`\n[testes/pipeline] OK — log: ${log.historyPath}\n`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.write(`[ERRO FATAL] ${msg}`);
    console.error(msg);
    process.exitCode = 1;
  } finally {
    running = false;
    if (pending) {
      pending = false;
      scheduleRun('pendente (mudanças durante execução)');
    }
  }
}

function scheduleRun(reason) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void executeRun(reason);
  }, debounceMs);
}

async function main() {
  console.log('[testes/pipeline] Raiz do repo:', root);
  console.log('[testes/pipeline] Logs em:', path.join(__dirname, 'logs'));
  console.log('[testes/pipeline] Debounce:', debounceMs, 'ms');

  await executeRun('arranque inicial');

  if (once) {
    process.exit(process.exitCode || 0);
  }

  const watcher = chokidar.watch(watchTargets, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 150 },
    ignored: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/testes/logs/**',
    ],
  });

  watcher.on('all', (event, filePath) => {
    if (!['add', 'change', 'unlink'].includes(event)) return;
    console.log(`[testes/pipeline] ${event}: ${path.relative(root, filePath)}`);
    scheduleRun(`${event} ${path.relative(root, filePath)}`);
  });

  watcher.on('error', (err) => console.error('[testes/pipeline] watcher:', err));

  console.log('[testes/pipeline] A observar mudanças (Ctrl+C para sair)…');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
