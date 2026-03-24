/**
 * CompositeHandlerAccess — interface used by composite-actions submodule functions.
 *
 * Submodule standalone functions receive a `CompositeHandlerAccess` object instead of `this`,
 * which exposes the protected BaseHandler capabilities through public delegates.
 */

import type { sheets_v4, drive_v3 } from 'googleapis';
import type { HandlerContext } from '../base.js';
import type { CompositeOutput } from '../../schemas/composite.js';
import type { CompositeOperationsService } from '../../services/composite-operations.js';
import type { SheetResolver } from '../../services/sheet-resolver.js';

export type CompositeHandlerAccess = {
  context: HandlerContext;
  sheetsApi: sheets_v4.Sheets;
  driveApi: drive_v3.Drive | undefined;
  compositeService: CompositeOperationsService;
  sheetResolver: SheetResolver;
  success: (
    action: string,
    data: Record<string, unknown>,
    mutation?: { cellsAffected: number; reversible: boolean }
  ) => CompositeOutput['response'];
  error: (error: { code: string; message: string; category?: string; details?: unknown }) => CompositeOutput['response'];
  mapError: (e: unknown) => CompositeOutput['response'];
  sendProgress: (current: number, total: number, message?: string) => void;
  generateMeta: (
    action: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => unknown;
};
