/**
 * Trigger Operations — create_trigger, list_triggers, delete_trigger, update_trigger
 *
 * Apps Script does not expose trigger CRUD through REST. SERVAL installs small
 * in-project helper functions that use ScriptApp, and these handlers delegate
 * to those helpers through scripts.run.
 */

import { ErrorCodes } from '../error-codes.js';
import type { AppsScriptHandlerAccess } from './internal.js';
import type {
  AppsScriptCreateTriggerInput,
  AppsScriptListTriggersInput,
  AppsScriptDeleteTriggerInput,
  AppsScriptUpdateTriggerInput,
  AppsScriptResponse,
} from '../../schemas/index.js';

interface ScriptRunResponse {
  done?: boolean;
  response?: {
    result?: unknown;
  };
  error?: {
    message?: string;
    details?: Array<{
      errorMessage?: string;
      errorType?: string;
    }>;
  };
}

interface TriggerRunResult {
  triggers?: unknown[];
  nextPageToken?: string | null;
  trigger?: unknown;
  deleted?: boolean;
  triggerId?: string;
}

async function runTriggerHelper(
  access: AppsScriptHandlerAccess,
  scriptId: string,
  functionName: string,
  parameters: Record<string, unknown>
): Promise<AppsScriptResponse | TriggerRunResult> {
  const result = await access.apiRequest<ScriptRunResponse>('POST', `/scripts/${scriptId}:run`, {
    function: functionName,
    parameters: [parameters],
    devMode: true,
  });

  if (result.error) {
    const detail = result.error.details?.[0];
    return access.error({
      code: ErrorCodes.INVALID_PARAMS,
      message:
        detail?.errorMessage ?? result.error.message ?? `Apps Script helper ${functionName} failed`,
      retryable: false,
      details: detail?.errorType ? { errorType: detail.errorType } : undefined,
    });
  }

  return (result.response?.result ?? {}) as TriggerRunResult;
}

export async function handleCreateTrigger(
  access: AppsScriptHandlerAccess,
  req: AppsScriptCreateTriggerInput & { scriptId: string }
): Promise<AppsScriptResponse> {
  const helperResult = await runTriggerHelper(access, req.scriptId, 'serval_createTrigger', {
    functionName: req.functionName,
    triggerType: req.triggerType,
    everyMinutes: req.everyMinutes,
    atHour: req.atHour,
    weekDay: req.weekDay,
  });
  if ('success' in helperResult) {
    return helperResult;
  }

  return access.success('create_trigger', {
    scriptId: req.scriptId,
    trigger: helperResult,
  });
}

export async function handleListTriggers(
  access: AppsScriptHandlerAccess,
  req: AppsScriptListTriggersInput & { scriptId: string }
): Promise<AppsScriptResponse> {
  const helperResult = await runTriggerHelper(access, req.scriptId, 'serval_listTriggers', {
    pageSize: req.pageSize ?? 50,
    pageToken: req.pageToken,
  });
  if ('success' in helperResult) {
    return helperResult;
  }

  return access.success('list_triggers', {
    scriptId: req.scriptId,
    triggers: helperResult.triggers ?? [],
    nextPageToken: helperResult.nextPageToken ?? undefined,
  });
}

export async function handleDeleteTrigger(
  access: AppsScriptHandlerAccess,
  req: AppsScriptDeleteTriggerInput & { scriptId: string }
): Promise<AppsScriptResponse> {
  const helperResult = await runTriggerHelper(access, req.scriptId, 'serval_deleteTrigger', {
    triggerId: req.triggerId,
  });
  if ('success' in helperResult) {
    return helperResult;
  }

  return access.success('delete_trigger', {
    scriptId: req.scriptId,
    deleted: helperResult.deleted ?? false,
    trigger: helperResult.trigger,
    triggerId: helperResult.triggerId ?? req.triggerId,
  });
}

export async function handleUpdateTrigger(
  access: AppsScriptHandlerAccess,
  req: AppsScriptUpdateTriggerInput & { scriptId: string }
): Promise<AppsScriptResponse> {
  if (!req.functionName) {
    return access.error({
      code: ErrorCodes.INVALID_PARAMS,
      message:
        'update_trigger requires functionName because Apps Script trigger metadata does not expose enough schedule details to reconstruct an existing trigger.',
      retryable: false,
      suggestedFix:
        'Call delete_trigger, then create_trigger with functionName and the desired trigger schedule.',
    });
  }

  const deleteResult = await runTriggerHelper(access, req.scriptId, 'serval_deleteTrigger', {
    triggerId: req.triggerId,
  });
  if ('success' in deleteResult) {
    return deleteResult;
  }

  const createResult = await runTriggerHelper(access, req.scriptId, 'serval_createTrigger', {
    functionName: req.functionName,
    triggerType: req.triggerType ?? 'CLOCK',
    everyMinutes: req.everyMinutes,
  });
  if ('success' in createResult) {
    return createResult;
  }

  return access.success('update_trigger', {
    scriptId: req.scriptId,
    deleted: deleteResult.deleted ?? false,
    previousTrigger: deleteResult.trigger,
    trigger: createResult,
  });
}
