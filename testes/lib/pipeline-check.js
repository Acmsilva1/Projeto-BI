/**
 * Verificações da pipeline: build BACKEND, build FRONTEND (opcional), smoke API (opcional).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.join(__dirname, '..', '..');

function runCmd(cwd, command, args, log, label) {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const shell = isWin;
    const proc = spawn(command, args, {
      cwd,
      shell,
      env: { ...process.env },
    });
    let combined = '';
    const append = (buf) => {
      combined += buf.toString();
    };
    proc.stdout?.on('data', append);
    proc.stderr?.on('data', append);
    proc.on('error', (err) => {
      log.write(`[ERRO spawn] ${label}: ${err.message}`);
      resolve({ ok: false, label, code: -1, combined });
    });
    proc.on('close', (code) => {
      const ok = code === 0;
      if (!ok) {
        const tail = combined.slice(-12000);
        log.write(`[FALHA] ${label} (exit ${code})\n${tail}`);
      } else {
        log.write(`[OK] ${label}`);
      }
      resolve({ ok, label, code: code ?? -1, combined });
    });
  });
}

export async function npmRunBuild(cwd, log, label) {
  return runCmd(cwd, 'npm', ['run', 'build'], log, label);
}

export async function runDockerComposeConfig(log) {
  if (process.env.SKIP_DOCKER_COMPOSE === '1') {
    log.write('[SKIP] docker compose (SKIP_DOCKER_COMPOSE=1)');
    return { ok: true, label: 'docker compose config', skipped: true };
  }
  return runCmd(REPO_ROOT, 'docker', ['compose', 'config', '-q'], log, 'docker compose config -q');
}

export async function runApiSmoke(log) {
  const base = String(process.env.TESTES_API_BASE || '').trim().replace(/\/+$/, '');
  if (!base) {
    log.write('[SKIP] API smoke (defina TESTES_API_BASE=http://127.0.0.1:3020)');
    return { ok: true, label: 'API smoke', skipped: true };
  }
  try {
    const health = await fetch(`${base}/health`);
    if (!health.ok) {
      log.write(`[FALHA] GET /health → ${health.status}`);
      return { ok: false, label: 'GET /health', code: health.status };
    }
    const j = await health.json().catch(() => ({}));
    log.write(`[OK] GET /health → ${JSON.stringify(j).slice(0, 200)}`);

    const meta = await fetch(`${base}/api/v1/_meta/stack`);
    if (!meta.ok) {
      log.write(`[FALHA] GET /api/v1/_meta/stack → ${meta.status}`);
      return { ok: false, label: 'GET /api/v1/_meta/stack', code: meta.status };
    }
    const mj = await meta.json().catch(() => ({}));
    log.write(`[OK] GET /api/v1/_meta/stack → ${JSON.stringify(mj).slice(0, 400)}`);
    return { ok: true, label: 'API smoke', code: 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.write(`[FALHA] API smoke: ${msg}`);
    return { ok: false, label: 'API smoke', code: -1 };
  }
}

/**
 * @param {{ write: Function, banner: Function }} log
 * @returns {Promise<{ ok: boolean, failures: string[] }>}
 */
export async function runFullPipeline(log) {
  const failures = [];
  log.banner('Início da verificação da pipeline');

  const backendDir = path.join(REPO_ROOT, 'BACKEND');
  const frontendDir = path.join(REPO_ROOT, 'FRONTEND');

  if (!fs.existsSync(path.join(backendDir, 'package.json'))) {
    log.write('[ERRO] BACKEND/package.json não encontrado');
    return { ok: false, failures: ['BACKEND ausente'] };
  }

  const r1 = await npmRunBuild(backendDir, log, 'BACKEND npm run build');
  if (!r1.ok) failures.push(r1.label);

  if (process.env.SKIP_FRONTEND_BUILD !== '1') {
    if (fs.existsSync(path.join(frontendDir, 'package.json'))) {
      const r2 = await npmRunBuild(frontendDir, log, 'FRONTEND npm run build');
      if (!r2.ok) failures.push(r2.label);
    } else {
      log.write('[SKIP] FRONTEND ausente');
    }
  } else {
    log.write('[SKIP] FRONTEND build (SKIP_FRONTEND_BUILD=1)');
  }

  const r3 = await runDockerComposeConfig(log);
  if (!r3.ok && !r3.skipped) failures.push(r3.label);

  const r4 = await runApiSmoke(log);
  if (!r4.ok && !r4.skipped) failures.push(r4.label);

  const ok = failures.length === 0;
  log.banner(ok ? 'RESULTADO: SUCESSO (nenhuma falha)' : `RESULTADO: FALHA → ${failures.join(', ')}`);
  return { ok, failures };
}
