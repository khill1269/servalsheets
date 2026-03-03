import type { sheets_v4 } from 'googleapis';
import type { HandlerContext } from '../base.js';
import type { SheetsAdvancedInput, AdvancedResponse } from '../../schemas/index.js';
import type { ErrorDetail, MutationSummary } from '../../schemas/shared.js';
import { confirmDestructiveAction } from '../../mcp/elicitation.js';
import { createSnapshotIfNeeded } from '../../utils/safety-helpers.js';

/**
 * Extended SpreadsheetProperties type that includes namedFunctions.
 * This property exists in the Google Sheets API but is missing from googleapis type definitions.
 */
interface ExtendedSpreadsheetProperties extends sheets_v4.Schema$SpreadsheetProperties {
  namedFunctions?: Array<{
    name?: string;
    functionBody?: string;
    description?: string;
    argumentNames?: string[];
  }>;
}

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

export async function handleCreateNamedFunctionAction(
  req: CreateNamedFunctionRequest,
  deps: NamedFunctionsDeps
): Promise<AdvancedResponse> {
  const paramDefs = req.parameterDefinitions?.map((p) => ({
    name: p.name,
    description: p.description ?? '',
  }));

  // Named function requests exist in Google Sheets API but are not in googleapis types.
  // Cast request items to allow addNamedFunction (valid API field, missing from types).
  await deps.sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: req.spreadsheetId!,
    requestBody: {
      requests: [
        {
          addNamedFunction: {
            namedFunction: {
              name: req.functionName!,
              description: req.description ?? '',
              functionBody: req.functionBody!,
              argumentNames: paramDefs?.map((p) => p.name),
            },
          },
        } as sheets_v4.Schema$Request,
      ],
    },
  });

  return deps.success('create_named_function', {
    namedFunction: {
      functionName: req.functionName!,
      functionBody: req.functionBody!,
      description: req.description,
      parameterDefinitions: paramDefs,
    },
  });
}

export async function handleListNamedFunctionsAction(
  req: ListNamedFunctionsRequest,
  deps: NamedFunctionsDeps
): Promise<AdvancedResponse> {
  const result = await deps.sheetsApi.spreadsheets.get({
    spreadsheetId: req.spreadsheetId!,
    fields: 'properties.namedFunctions',
  });

  // namedFunctions is a newer API field not yet in googleapis types
  const rawFunctions: unknown[] =
    (result.data.properties as ExtendedSpreadsheetProperties)?.namedFunctions ?? [];

  const allItems = rawFunctions.map((fn) => {
    const f = fn as {
      name?: string;
      functionBody?: string;
      description?: string;
      argumentNames?: string[];
    };
    return {
      functionName: f.name ?? '',
      functionBody: f.functionBody ?? '',
      description: f.description ?? undefined,
      parameterDefinitions: f.argumentNames?.map((name) => ({ name })),
    };
  });

  const { page, nextCursor, hasMore, totalCount } = deps.paginateItems(
    allItems,
    req.cursor,
    req.pageSize ?? 100
  );
  return deps.success('list_named_functions', {
    namedFunctions: page,
    nextCursor,
    hasMore,
    totalCount,
  });
}

export async function handleGetNamedFunctionAction(
  req: GetNamedFunctionRequest,
  deps: NamedFunctionsDeps
): Promise<AdvancedResponse> {
  const result = await deps.sheetsApi.spreadsheets.get({
    spreadsheetId: req.spreadsheetId!,
    fields: 'properties.namedFunctions',
  });

  const rawFunctions: unknown[] =
    (result.data.properties as ExtendedSpreadsheetProperties)?.namedFunctions ?? [];

  const fn = rawFunctions.find((f) => (f as { name?: string }).name === req.functionName);

  if (!fn) {
    return deps.error({
      code: 'NOT_FOUND',
      message: `Named function "${req.functionName}" not found`,
      retryable: false,
      suggestedFix: 'Use list_named_functions to see all available named functions',
    });
  }

  const f = fn as {
    name?: string;
    functionBody?: string;
    description?: string;
    argumentNames?: string[];
  };
  return deps.success('get_named_function', {
    namedFunction: {
      functionName: f.name ?? '',
      functionBody: f.functionBody ?? '',
      description: f.description ?? undefined,
      parameterDefinitions: f.argumentNames?.map((name) => ({ name })),
    },
  });
}

export async function handleUpdateNamedFunctionAction(
  req: UpdateNamedFunctionRequest,
  deps: NamedFunctionsDeps
): Promise<AdvancedResponse> {
  // First retrieve the existing function to build the update
  const getResult = await deps.sheetsApi.spreadsheets.get({
    spreadsheetId: req.spreadsheetId!,
    fields: 'properties.namedFunctions',
  });

  const rawFunctions: unknown[] =
    (getResult.data.properties as ExtendedSpreadsheetProperties)?.namedFunctions ?? [];

  const existing = rawFunctions.find(
    (f) => (f as { name?: string }).name === req.functionName
  ) as
    | { name?: string; functionBody?: string; description?: string; argumentNames?: string[] }
    | undefined;

  if (!existing) {
    return deps.error({
      code: 'NOT_FOUND',
      message: `Named function "${req.functionName}" not found`,
      retryable: false,
      suggestedFix: 'Use list_named_functions to see all available named functions',
    });
  }

  const updatedName = req.newFunctionName ?? existing.name ?? req.functionName!;
  const updatedBody = req.functionBody ?? existing.functionBody ?? '';
  const updatedDesc = req.description !== undefined ? req.description : (existing.description ?? '');
  const updatedArgs = req.parameterDefinitions
    ? req.parameterDefinitions.map((p) => p.name)
    : (existing.argumentNames ?? []);

  // Named function requests exist in Google Sheets API but are not in googleapis types.
  // Cast request items to allow updateNamedFunction (valid API field, missing from types).
  await deps.sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: req.spreadsheetId!,
    requestBody: {
      requests: [
        {
          updateNamedFunction: {
            namedFunction: {
              name: updatedName,
              description: updatedDesc,
              functionBody: updatedBody,
              argumentNames: updatedArgs,
            },
            oldName: req.functionName!,
            fields: 'name,description,functionBody,argumentNames',
          },
        } as sheets_v4.Schema$Request,
      ],
    },
  });

  return deps.success('update_named_function', {
    namedFunction: {
      functionName: updatedName,
      functionBody: updatedBody,
      description: updatedDesc || undefined,
      parameterDefinitions: updatedArgs.map((name) => ({ name })),
    },
  });
}

export async function handleDeleteNamedFunctionAction(
  req: DeleteNamedFunctionRequest,
  deps: NamedFunctionsDeps
): Promise<AdvancedResponse> {
  // Snapshot BEFORE confirmation (captures pre-op state; must exist before user approves)
  const snapshot = await createSnapshotIfNeeded(
    deps.context.snapshotService,
    {
      operationType: 'delete_named_function',
      isDestructive: true,
      spreadsheetId: req.spreadsheetId,
    },
    req.safety
  );

  if (deps.context.elicitationServer) {
    const confirmation = await confirmDestructiveAction(
      deps.context.elicitationServer,
      'delete_named_function',
      `Delete named function "${req.functionName}" from spreadsheet ${req.spreadsheetId}. This action cannot be undone.`
    );

    if (!confirmation.confirmed) {
      return deps.error({
        code: 'PRECONDITION_FAILED',
        message: confirmation.reason || 'User cancelled the operation',
        retryable: false,
        suggestedFix: 'Review the operation requirements and try again',
      });
    }
  }

  // Named function requests exist in Google Sheets API but are not in googleapis types.
  // Cast request items to allow deleteNamedFunction (valid API field, missing from types).
  await deps.sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: req.spreadsheetId!,
    requestBody: {
      requests: [
        {
          deleteNamedFunction: {
            name: req.functionName!,
          },
        } as sheets_v4.Schema$Request,
      ],
    },
  });

  return deps.success('delete_named_function', { snapshotId: snapshot?.snapshotId });
}
