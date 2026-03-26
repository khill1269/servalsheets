/**
 * Session pending operation action handlers.
 * Covers: set_pending, get_pending, clear_pending
 */

import type { SheetsSessionOutput } from '../../schemas/session.js';
import type { SessionContextManager } from '../../services/session-context.js';

export function handleSetPending(
  session: SessionContextManager,
  req: {
    action: 'set_pending';
    type?: string;
    step?: number;
    totalSteps?: number;
    context?: unknown;
  }
): SheetsSessionOutput {
  const { type, step, totalSteps, context } = req;
  // Type assertion: refine() validates these are defined for set_pending action
  session.setPendingOperation({
    type: type!,
    step: step!,
    totalSteps: totalSteps!,
    context: context! as Record<
      string,
      string | number | boolean | unknown[] | Record<string, unknown> | null
    >,
  });
  // getPendingOperation() context field is `Record<string, unknown>`, which
  // the output schema narrows further. Cast the return as the output type.
  return {
    response: {
      success: true,
      action: 'set_pending',
      pending: session.getPendingOperation(),
    },
  } as SheetsSessionOutput;
}

export function handleGetPending(session: SessionContextManager): SheetsSessionOutput {
  return {
    response: {
      success: true,
      action: 'get_pending',
      pending: session.getPendingOperation(),
    },
  } as SheetsSessionOutput;
}

export function handleClearPending(session: SessionContextManager): SheetsSessionOutput {
  session.clearPendingOperation();
  return {
    response: {
      success: true,
      action: 'clear_pending',
      pending: null,
    },
  };
}
