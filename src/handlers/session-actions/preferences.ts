/**
 * Session preference action handlers.
 * Covers: update_preferences, get_preferences, update_profile_preferences
 */

import type { SheetsSessionOutput } from '../../schemas/session.js';
import type { SessionContextManager, UserPreferences } from '../../services/session-context.js';

export function handleUpdatePreferences(
  session: SessionContextManager,
  req: {
    action: 'update_preferences';
    confirmationLevel?: string;
    dryRunDefault?: boolean;
    snapshotDefault?: boolean;
    autoRecord?: boolean;
  }
): SheetsSessionOutput {
  const { confirmationLevel, dryRunDefault, snapshotDefault, autoRecord } = req;
  const updates: Partial<UserPreferences> = {};

  if (confirmationLevel) {
    const validLevels: UserPreferences['confirmationLevel'][] = [
      'always',
      'destructive',
      'never',
    ];
    if (validLevels.includes(confirmationLevel as UserPreferences['confirmationLevel'])) {
      updates.confirmationLevel = confirmationLevel as UserPreferences['confirmationLevel'];
    }
  }
  if (dryRunDefault !== undefined || snapshotDefault !== undefined) {
    updates.defaultSafety = {
      dryRun: dryRunDefault ?? session.getPreferences().defaultSafety.dryRun,
      createSnapshot:
        snapshotDefault ?? session.getPreferences().defaultSafety.createSnapshot,
    };
  }
  if (autoRecord !== undefined) {
    updates.autoRecord = autoRecord;
  }

  session.updatePreferences(updates);

  return {
    response: {
      success: true,
      action: 'update_preferences',
      preferences: session.getPreferences(),
      scope: 'session',
      message:
        'Preferences updated for this session. Use update_profile_preferences to persist user-level defaults.',
    },
  };
}

export function handleGetPreferences(session: SessionContextManager): SheetsSessionOutput {
  return {
    response: {
      success: true,
      action: 'get_preferences',
      preferences: session.getPreferences(),
    },
  };
}

export async function handleUpdateProfilePreferences(
  session: SessionContextManager,
  req: { action: 'update_profile_preferences'; preferences?: Record<string, unknown> }
): Promise<SheetsSessionOutput> {
  const { preferences } = req as { preferences: Record<string, unknown> };
  await session.updateUserPreferences(preferences);
  return {
    response: {
      success: true,
      action: 'update_profile_preferences' as const,
      message: 'Preferences updated',
    },
  };
}
