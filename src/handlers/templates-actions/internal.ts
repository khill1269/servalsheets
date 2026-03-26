/**
 * Internal types for the templates handler submodules.
 * Provides access to handler methods without exposing private class internals.
 */

import type { sheets_v4, drive_v3 } from 'googleapis';
import type { TemplatesResponse, ErrorDetail } from '../../schemas/index.js';
import type { TemplateStore } from '../../services/template-store.js';

export interface TemplatesHandlerAccess {
  sheetsApi: sheets_v4.Sheets;
  driveApi: drive_v3.Drive;
  templateStore: TemplateStore;
  validateScopes(operation: string): TemplatesResponse | null;
  success(action: string, data: Record<string, unknown>): TemplatesResponse;
  error(params: ErrorDetail): TemplatesResponse;
  sendProgress(current: number, total: number, message: string): Promise<void>;
  letterToColumn(letter: string): number;
}
