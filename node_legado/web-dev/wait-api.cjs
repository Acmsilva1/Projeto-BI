/**
 * Espera a API Hospital BI aceitar TCP em 127.0.0.1:PORT (evita 502 no primeiro load do Vite).
 * PORT = HOSPITAL_BI_API_PORT | VITE_API_PORT | 3020
 * Extensão .cjs porque web/package.json tem "type": "module".
 */
const net = require('net');

const port = Number(process.env.HOSPITAL_BI_API_PORT || process.env.VITE_API_PORT || 3020);
const host = '127.0.0.1';
const maxAttempts = 90;
const delayMs = 400;

function tryConnect() {
  return new Promise((resolve, reject) => {
    const s = net.connect({ port, host }, () => {
      s.end();
      resolve();
    });
    s.setTimeout(2500);
    s.on('error', reject);
    s.on('timeout', () => {
      s.destroy();
      reject(new Error('timeout'));
    });
  });
}

async function main() {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      await tryConnect();
      console.log(`[wait-api] ${host}:${port} a responder`);
      process.exit(0);
    } catch {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  console.error(
    `[wait-api] Timeout a aguardar ${host}:${port}. Confirme que "npm run api" sobe sem erros (Postgres/SQLite no .env da raiz).`,
  );
  process.exit(1);
}

main();
