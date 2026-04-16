/**
 * Logs internos da suite de pipeline — ficheiros em testes/logs/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'logs');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

/** Um ficheiro por execução + append em latest.log */
export function createRunLogger(runId) {
  ensureLogDir();
  const historyPath = path.join(LOG_DIR, `run-${runId}.log`);
  const latestPath = path.join(LOG_DIR, 'latest.log');

  const write = (line) => {
    const withNl = line.endsWith('\n') ? line : `${line}\n`;
    fs.appendFileSync(historyPath, withNl, 'utf8');
    fs.appendFileSync(latestPath, withNl, 'utf8');
  };

  const banner = (title) => {
    const bar = '='.repeat(72);
    write('');
    write(bar);
    write(`  ${title}`);
    write(`  ${new Date().toISOString()}`);
    write(bar);
  };

  return { write, banner, historyPath, latestPath };
}
