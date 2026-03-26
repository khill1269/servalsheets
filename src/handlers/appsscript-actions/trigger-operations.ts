/**
 * Trigger Operations — create_trigger, list_triggers, delete_trigger, update_trigger
 *
 * NOTE: These return NOT_IMPLEMENTED because the Apps Script API
 * projects.triggers endpoint is not available for external clients. Triggers
 * must be managed in-script via ScriptApp APIs.
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

export function handleCreateTrigger(
  access: AppsScriptHandlerAccess,
  _req: AppsScriptCreateTriggerInput
): AppsScriptResponse {
  return access.error({
    code: ErrorCodes.NOT_IMPLEMENTED,
    message:
      'Trigger management requires in-script ScriptApp.newTrigger(). ' +
      'The Apps Script API projects.triggers endpoint is not available for external clients. ' +
      'Use update_content to add trigger code to your script, then deploy it.',
    retryable: false,
  });
}

export function handleListTriggers(
  access: AppsScriptHandlerAccess,
  _req: AppsScriptListTriggersInput
): AppsScriptResponse {
  return access.error({
    code: ErrorCodes.NOT_IMPLEMENTED,
    message:
      'Trigger management requires in-script ScriptApp APIs. ' +
      'The Apps Script API projects.triggers endpoint is not available for external clients. ' +
      'Use get_content to inspect trigger setup code in the script project.',
    retryable: false,
  });
}

export function handleDeleteTrigger(
  access: AppsScriptHandlerAccess,
  _req: AppsScriptDeleteTriggerInput
): AppsScriptResponse {
  return access.error({
    code: ErrorCodes.NOT_IMPLEMENTED,
    message:
      'Trigger management requires in-script ScriptApp APIs. ' +
      'The Apps Script API projects.triggers endpoint is not available for external clients. ' +
      'Use update_content to modify trigger code in the script project.',
    retryable: false,
  });
}

export function handleUpdateTrigger(
  access: AppsScriptHandlerAccess,
  _req: AppsScriptUpdateTriggerInput
): AppsScriptResponse {
  return access.error({
    code: ErrorCodes.NOT_IMPLEMENTED,
    message:
      'Trigger management requires in-script ScriptApp APIs. ' +
      'The Apps Script API projects.triggers endpoint is not available for external clients. ' +
      'Use update_content to modify trigger code in the script project.',
    retryable: false,
  });
}
