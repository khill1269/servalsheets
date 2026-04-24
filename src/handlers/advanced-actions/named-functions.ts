import { ErrorCodes } from '../error-codes.js';
import type { sheets_v4 } from 'googleapis';
import type { HandlerContext } from '../base.js';
import type { SheetsAdvancedInput, AdvancedResponse } from '../../schemas/index.js';
import type { ErrorDetail, MutationSummary } from '../../schemas/shared.js';

type CreateNamedFunctionRequest = Extract<
  SheetsAdvancedInput['request'],
  { action: 'create_named_function' }
>;
type ListNamedFunctionsRequest = Extract<
  SheetsAdvancedInput['request'],
  { action: 'list_named_functions' }
>;
type GetNamedFunctionRequest = Extract<
  SheetsAdvancedInput['request'],
  { action: 'get_named_function' }
>;
type UpdateNamedFunctionRequest = Extract<
  SheetsAdvancedInput['request'],
  { action: 'update_named_function' }
>;
type DeleteNamedFunctionRequest = Extract<
  SheetsAdvancedInput['request'],
  { action: 'delete_named_function' }
>;

interface NamedFunctionsDeps {
  sheetsApi: sheets_v4.Sheets;
  context: HandlerContext;
  paginateItems: <T>(
    items: T[],
    cursor: string | undefined,
    pageSize: number
  ) => { page: T[]; nextCursor: string | undefined; hasMore: boolean; totalCount: number };
  success: (
    action: string,
    data: Record<string, unknown>,
    mutation?: MutationSummary,
    dryRun?: boolean
  ) => AdvancedResponse;
  error: (error: ErrorDetail) => AdvancedResponse;
}

function namedFunctionsUnavailable(
  action:
    | CreateNamedFunctionRequest['action']
    | ListNamedFunctionsRequest['action']
    | GetNamedFunctionRequest['action']
    | UpdateNamedFunctionRequest['action']
    | DeleteNamedFunctionRequest['action'],
  deps: NamedFunctionsDeps
): AdvancedResponse {
  return deps.error({
    code: ErrorCodes.FEATURE_UNAVAILABLE,
    message: `Named functions (${action}) are permanently unsupported — Google Sheets does not expose named function management via the public Sheets API v4. Retrying will always return this error.`,
    category: 'client',
    severity: 'medium',
    retryable: false,
    suggestedFix:
      'Use the Sheets UI (Data > Named functions) to create or manage named functions. For API-driven reusable logic, use named ranges (sheets_advanced.add_named_range) or Apps Script (sheets_appsscript.create).',
    resolution:
      'Named function management is a UI-only feature in Google Sheets. The sheets_advanced named-function actions exist for schema compatibility but cannot be fulfilled server-side.',
  });
}

export async function handleCreateNamedFunctionAction(
  _req: CreateNamedFunctionRequest,
  deps: NamedFunctionsDeps
): Promise<AdvancedResponse> {
  return namedFunctionsUnavailable('create_named_function', deps);
}

export async function handleListNamedFunctionsAction(
  _req: ListNamedFunctionsRequest,
  deps: NamedFunctionsDeps
): Promise<AdvancedResponse> {
  return namedFunctionsUnavailable('list_named_functions', deps);
}

export async function handleGetNamedFunctionAction(
  _req: GetNamedFunctionRequest,
  deps: NamedFunctionsDeps
): Promise<AdvancedResponse> {
  return namedFunctionsUnavailable('get_named_function', deps);
}

export async function handleUpdateNamedFunctionAction(
  _req: UpdateNamedFunctionRequest,
  deps: NamedFunctionsDeps
): Promise<AdvancedResponse> {
  return namedFunctionsUnavailable('update_named_function', deps);
}

export async function handleDeleteNamedFunctionAction(
  _req: DeleteNamedFunctionRequest,
  deps: NamedFunctionsDeps
): Promise<AdvancedResponse> {
  return namedFunctionsUnavailable('delete_named_function', deps);
}
