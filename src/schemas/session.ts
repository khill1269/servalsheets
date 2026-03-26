/**
 * Tool: sheets_session
 * Session state: active spreadsheet, preferences, context tracking, operation recording
 *
 * Actions (31):
 * - set_active: Set active spreadsheet for context
 * - get_active: Get active spreadsheet
 * - get_context: Get session context
 * - record_operation: Record operation in session history
 * - get_last_operation: Get most recent operation
 * - get_history: Get operation history
 * - find_by_reference: Find spreadsheet by reference
 * - get_preferences: Get user preferences
 * - update_preferences: Update preferences
 * - set_pending: Set pending task
 * - get_pending: Get pending tasks
 * - clear_pending: Clear pending tasks
 * - get_alerts: Get active alerts
 * - acknowledge_alert: Acknowledge alert
 * - clear_alerts: Clear all alerts
 * - get_profile: Get user profile
 * - update_profile_preferences: Update profile preferences
 * - get_top_formulas: Get most-used formulas
 * - record_successful_formula: Record successful formula
 * - reject_suggestion: Reject suggestion
 * - save_checkpoint: Save named checkpoint
 * - load_checkpoint: Load checkpoint
 * - delete_checkpoint: Delete checkpoint
 * - list_checkpoints: List saved checkpoints
 * - schedule_create: Create scheduled task
 * - schedule_list: List scheduled tasks
 * - schedule_cancel: Cancel scheduled task
 * - schedule_run_now: Run scheduled task immediately
 * - execute_pipeline: Execute analysis pipeline
 * - reset: Reset session state
 */

import { z } from 'zod';

// Placeholder for actual session schema
// Full implementation in src/handlers/session.ts

export const SessionPlaceholder = z.object({});
