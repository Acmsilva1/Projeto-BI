/**
 * “View” HTTP — envelope JSON { ok, data } / erros 500.
 */
import type { Request, Response, NextFunction } from 'express';

export type AsyncRouteHandler = (req: Request, res: Response) => Promise<unknown>;

export function asyncJsonRoute(handler: AsyncRouteHandler) {
  return async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const data = await handler(req, res);
      res.json({ ok: true, data });
    } catch (error: unknown) {
      const err = error as { message?: string; errors?: { message?: string }[]; code?: string };
      const errMsg =
        err?.message ||
        err?.errors?.[0]?.message ||
        err?.code ||
        'Erro interno ao consultar dados';
      console.error('API error:', errMsg, err?.code || '');
      res.status(500).json({ ok: false, error: errMsg });
    }
  };
}
