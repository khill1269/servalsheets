/**
 * AppsScriptHandlerAccess — interface used by all appsscript-actions submodule functions.
 *
 * Submodule standalone functions receive an `AppsScriptHandlerAccess` object instead of `this`,
 * which exposes the protected BaseHandler capabilities through public `_delegate` wrappers
 * defined on SheetsAppsScriptHandler.
 */

import type { HandlerContext } from '../base.js';
import type { AppsScriptResponse } from '../../schemas/index.js';
import type { ErrorDetail } from '../../schemas/shared.js';

export type AppsScriptHandlerAccess = {
  success: (action: string, data: Record<string, unknown>) => AppsScriptResponse;
  error: (e: ErrorDetail) => AppsScriptResponse;
  context: HandlerContext;
  apiRequest: <T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    timeoutMs?: number
  ) => Promise<T>;
  resolveScriptIdFromSpreadsheet: (spreadsheetId: string) => Promise<string>;
  rememberBoundScript: (spreadsheetId: string, scriptId: string) => void;
};
