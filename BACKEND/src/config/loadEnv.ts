/**
 * Carrega .env antes de models/db avaliar DATABASE_URL / SQLITE_PATH.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..', '..');
const repoRoot = path.join(backendRoot, '..');

const envCandidates = [
  path.join(backendRoot, 'pipeline', '.env'),
  path.join(backendRoot, '.env'),
  path.join(repoRoot, '.env'),
];
envCandidates.forEach((p) => {
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
});
const rootEnvPath = path.join(repoRoot, '.env');
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath, override: true });
