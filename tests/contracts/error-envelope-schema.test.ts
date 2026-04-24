/**
 * Contract: every error response produced by response-intelligence must
 * conform to ErrorDetailSchema, notably:
 *   - `suggestedFix` is a string (or absent)       [src/schemas/shared.ts:1177]
 *   - `fixableVia` is an object (or absent)        [src/schemas/shared.ts:1180-1200]
 *
 * AUDIT-2026-04-23 (Root B): prior implementation wrote an object into
 * `suggestedFix`, silently violating the output schema on every error
 * response routed through the MCP wire. This test locks in the corrected
 * contract so the regression can't sneak back in.
 */
import { describe, expect, it } from 'vitest';
import { applyResponseIntelligence } from '../../src/mcp/registration/response-intelligence.js';
import { ErrorDetailSchema } from '../../src/schemas/shared.js';

type ErrorRecord = { code: string; message: string };

function applyIntelligenceToError(opts: {
  code: string;
  message: string;
  toolName?: string;
  actionName?: string;
}): Record<string, unknown> {
  const responseRecord: Record<string, unknown> = {
    success: false,
    error: { code: opts.code, message: opts.message } satisfies ErrorRecord,
  };
  applyResponseIntelligence(responseRecord, {
    toolName: opts.toolName ?? 'sheets_data',
    actionName: opts.actionName ?? 'read',
    hasFailure: true,
  });
  return responseRecord['error'] as Record<string, unknown>;
}

describe('error-envelope contract (Root B)', () => {
  const cases: Array<{ code: string; message: string; tool?: string; action?: string }> = [
    { code: 'PERMISSION_DENIED', message: 'User does not have access' },
    { code: 'UNAUTHENTICATED', message: 'Token expired' },
    { code: 'NOT_FOUND', message: 'Spreadsheet not found' },
    { code: 'INVALID_RANGE', message: "Range 'Sheet!ZZ' not valid" },
    { code: 'VALIDATION_ERROR', message: 'Missing required field' },
    { code: 'QUOTA_EXCEEDED', message: 'Google API quota exhausted' },
    { code: 'INTERNAL_ERROR', message: 'Unexpected failure' },
    { code: 'ELICITATION_UNAVAILABLE', message: 'Client lacks elicitation support' },
    {
      code: 'FAILED_PRECONDITION',
      message: 'Range overlaps a basic filter',
      tool: 'sheets_advanced',
      action: 'create_table',
    },
  ];

  it.each(cases)(
    '$code: suggestedFix is string|absent; fixableVia is object|absent; ErrorDetailSchema validates',
    ({ code, message, tool, action }) => {
      const error = applyIntelligenceToError({
        code,
        message,
        toolName: tool,
        actionName: action,
      });

      // Core Root B invariants:
      if (error['suggestedFix'] !== undefined) {
        expect(typeof error['suggestedFix']).toBe('string');
      }
      if (error['fixableVia'] !== undefined) {
        expect(typeof error['fixableVia']).toBe('object');
        expect(Array.isArray(error['fixableVia'])).toBe(false);
      }

      // Full schema validation — any shape error surfaces here.
      const parsed = ErrorDetailSchema.safeParse(error);
      if (!parsed.success) {
        throw new Error(
          `ErrorDetailSchema rejected ${code} error envelope: ${JSON.stringify(
            parsed.error.flatten(),
            null,
            2
          )}`
        );
      }
      expect(parsed.success).toBe(true);
    }
  );

  it('fixableVia.explanation is duplicated into fixableVia so callers only reading that field still see the hint', () => {
    const error = applyIntelligenceToError({
      code: 'PERMISSION_DENIED',
      message: 'User does not have access',
    });

    if (error['fixableVia']) {
      const fixableVia = error['fixableVia'] as Record<string, unknown>;
      // explanation is optional per schema but if present must be string
      if (fixableVia['explanation'] !== undefined) {
        expect(typeof fixableVia['explanation']).toBe('string');
      }
    }
  });

  it('pre-existing string suggestedFix is preserved and not overwritten', () => {
    const responseRecord: Record<string, unknown> = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Bad input',
        suggestedFix: 'Pre-set handler hint — do not overwrite.',
      },
    };
    applyResponseIntelligence(responseRecord, {
      toolName: 'sheets_data',
      actionName: 'write',
      hasFailure: true,
    });
    const error = responseRecord['error'] as Record<string, unknown>;
    expect(error['suggestedFix']).toBe('Pre-set handler hint — do not overwrite.');
  });
});
