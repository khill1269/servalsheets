/**
 * CollaborateHandlerAccess — interface used by all collaborate-actions submodule functions.
 *
 * Submodule standalone functions receive a deps object of this type instead of `this`,
 * which exposes the protected BaseHandler capabilities through public wrappers
 * defined on CollaborateHandler.
 */

import type { drive_v3, sheets_v4 } from 'googleapis';
import type { HandlerContext } from '../base.js';
import type { CollaborateResponse, MutationSummary } from '../../schemas/index.js';
import type { ErrorDetail } from '../../schemas/shared.js';

export type CollaborateHandlerAccess = {
  driveApi: drive_v3.Drive;
  sheetsApi?: sheets_v4.Sheets;
  context: HandlerContext;
  mapPermission: (
    permission: drive_v3.Schema$Permission | undefined
  ) => NonNullable<Extract<CollaborateResponse, { success: true }>['permission']>;
  mapComment: (
    comment: drive_v3.Schema$Comment | undefined
  ) => NonNullable<Extract<CollaborateResponse, { success: true }>['comment']>;
  checkOperationScopes: (operation: string) => void;
  success: (
    action: string,
    data: Record<string, unknown>,
    mutation?: MutationSummary,
    dryRun?: boolean
  ) => CollaborateResponse;
  error: (errorDetail: ErrorDetail) => CollaborateResponse;
  mapError: (error: unknown) => CollaborateResponse;
};
