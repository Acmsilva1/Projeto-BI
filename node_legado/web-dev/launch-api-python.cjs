/**
 * Sobe FastAPI (bi_api) na porta HOSPITAL_BI_API_PORT.
 * PYTHONPATH = raiz do repositório para imports bi_core / bi_gerencia / bi_api.
 */
const { spawn } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const port = process.env.HOSPITAL_BI_API_PORT || process.env.HOSPITAL_BI_PYTHON_PORT || '3020';

const env = { ...process.env, PYTHONPATH: repoRoot };
const p = spawn(
  'python',
  ['-m', 'uvicorn', 'bi_api.main:app', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: repoRoot, stdio: 'inherit', shell: true, env },
);

p.on('exit', (code) => process.exit(code == null ? 0 : code));
