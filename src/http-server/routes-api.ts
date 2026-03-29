import type { Router } from 'express';
import {
  registerApiRoutes as registerPackagedApiRoutes,
  type FormulaEvalDeps as PackagedFormulaEvalDeps,
} from '#mcp-http/routes-api';
import { logger } from '../utils/logger.js';
export type FormulaEvalDeps = Omit<PackagedFormulaEvalDeps, 'log'>;

export function registerApiRoutes(router: Router, deps: FormulaEvalDeps): void {
  registerPackagedApiRoutes(router, {
    ...deps,
    log: logger,
  });
}
