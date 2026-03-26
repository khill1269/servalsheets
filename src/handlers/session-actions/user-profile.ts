/**
 * Session user profile action handlers.
 * Covers: set_user_id, get_profile, record_successful_formula, reject_suggestion, get_top_formulas
 */

import type { SheetsSessionOutput } from '../../schemas/session.js';
import type { SessionContextManager } from '../../services/session-context.js';

export async function handleSetUserId(
  session: SessionContextManager,
  req: { action: 'set_user_id'; userId?: string }
): Promise<SheetsSessionOutput> {
  const { userId } = req as { userId: string };
  await session.setUserId(userId);
  return {
    response: {
      success: true,
      action: 'set_user_id' as const,
      userId,
      message: 'User profile loaded',
    },
  };
}

export async function handleGetProfile(
  session: SessionContextManager
): Promise<SheetsSessionOutput> {
  const profile = await session.getUserProfile();
  return {
    response: {
      success: true,
      action: 'get_profile' as const,
      profile,
    },
  };
}

export async function handleRecordSuccessfulFormula(
  session: SessionContextManager,
  req: { action: 'record_successful_formula'; formula?: string; useCase?: string }
): Promise<SheetsSessionOutput> {
  const { formula, useCase } = req as { formula: string; useCase: string };
  await session.recordSuccessfulFormula(formula, useCase);
  return {
    response: {
      success: true,
      action: 'record_successful_formula' as const,
      message: 'Formula recorded',
    },
  };
}

export async function handleRejectSuggestion(
  session: SessionContextManager,
  req: { action: 'reject_suggestion'; suggestion?: string }
): Promise<SheetsSessionOutput> {
  const { suggestion } = req as { suggestion: string };
  await session.rejectSuggestion(suggestion);
  return {
    response: {
      success: true,
      action: 'reject_suggestion' as const,
      message: 'Suggestion rejected and recorded',
    },
  };
}

export async function handleGetTopFormulas(
  session: SessionContextManager,
  req: { action: 'get_top_formulas'; limit?: number }
): Promise<SheetsSessionOutput> {
  const { limit } = req as { limit?: number };
  const formulas = await session.getTopFormulas(limit);
  return {
    response: {
      success: true,
      action: 'get_top_formulas' as const,
      formulas,
    },
  };
}
