/**
 * Controlador HTTP — regista rotas /api/v1 e delega ao serviço (camada de negócio).
 */
import type { Express } from 'express';
import { mountCcV1Routes } from '../modules/cc/cc.routes.js';
import { mountCirurgiaV1Routes } from '../modules/cirurgia/cirurgia.routes.js';
import {
  mountCoreV1Routes,
  mountInvalidApiRoot,
  mountStackMetaAndHealth,
} from '../modules/core/core.routes.js';
import { mountFinanceiroV1Routes } from '../modules/financeiro/financeiro.routes.js';
import { mountGerenciaV1Routes } from '../modules/gerencia/gerencia.routes.js';
import { mountOcupacaoV1Routes } from '../modules/ocupacao/ocupacao.routes.js';
import { mountPsV1Routes } from '../modules/ps/ps.routes.js';

export function registerApiV1(app: Express): void {
  mountInvalidApiRoot(app);
  mountCoreV1Routes(app);
  mountGerenciaV1Routes(app);
  mountPsV1Routes(app);
  mountFinanceiroV1Routes(app);
  mountOcupacaoV1Routes(app);
  mountCirurgiaV1Routes(app);
  mountCcV1Routes(app);
  mountStackMetaAndHealth(app);
}
