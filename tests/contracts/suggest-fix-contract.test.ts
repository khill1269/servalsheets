/**
 * suggestFix Output Contract Tests
 *
 * Guarantees every branch of `suggestFix()` returns a value that validates
 * against the `fixableVia` sub-schema of `ErrorDetailSchema`. Without this
 * contract, a handler can return an error response whose `fixableVia` field
 * then fails output validation — which is exactly what happened in
 * BUG #4 (sheets_advanced.list_named_functions): one branch returned
 * `params: { spreadsheetId: undefined }` and the error response was
 * silently mangled into "ResponseValidationError" at the tool layer.
 *
 * The fix introduced `sanitizeSuggestedParams()` (error-fix-suggester.ts:30)
 * which strips `undefined` values once at the return boundary. This test
 * locks that invariant in place and extends it: every branch, adversarial
 * inputs (missing optional context), every error code in ErrorCodeSchema —
 * all must produce a schema-valid `fixableVia` or `null`.
 *
 * Assertions
 * ----------
 *   1. For every error code branch identified via static probe, firing
 *      `suggestFix(code, message, tool?, action?, params?)` returns either
 *      `null` or an object that passes `fixableVia` validation.
 *
 *   2. Adversarial: when `params` omits `spreadsheetId`, any returned
 *      `params` object MUST NOT contain an `undefined` value (the BUG #4
 *      regression test). If no fix is applicable, returning `null` is fine.
 *
 *   3. For every value in `ErrorCodeSchema.enum`, `suggestFix(code, '...', ...)`
 *      either returns null or schema-valid output. This makes the contract
 *      forward-compatible with new error codes.
 *
 *   4. Integration smoke: `sanitizeSuggestedParams` is invoked on every
 *      return path — verified structurally by ensuring no returned `params`
 *      value is `undefined` across the full code-matrix sweep.
 *
 * @module tests/contracts/suggest-fix-contract
 */

import { describe, it, expect } from 'vitest';
import { z } from '../../src/lib/schema.js';

import { suggestFix, type SuggestedFix } from '../../src/services/error-fix-suggester.js';
import { ErrorCodeSchema } from '../../src/schemas/shared.js';

// --------------------------------------------------------------------------
// The `fixableVia` sub-schema mirrors the one in shared.ts:1180–1200.
// We re-define it locally rather than importing because it is currently
// inlined into ErrorDetailSchema — a future refactor that exports the
// sub-schema should update this block to import it.
// --------------------------------------------------------------------------
const FixableViaSchema = z.object({
  tool: z.string(),
  action: z.string(),
  params: z
    .record(
      z.string(),
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.any()),
        z.record(z.string(), z.any()),
        z.null(),
      ])
    )
    .optional(),
});

// The full shape returned by suggestFix adds `explanation` (string).
const SuggestedFixSchema = FixableViaSchema.extend({
  explanation: z.string(),
});

// --------------------------------------------------------------------------
// Fixture — one triggering invocation per known branch of suggestFixInternal.
// Keep this list in sync with error-fix-suggester.ts (see `// N. <code>` comments).
// New branches should add a case here with a representative message/params.
// --------------------------------------------------------------------------
type Probe = {
  label: string;
  code: string;
  message: string;
  tool?: string;
  action?: string;
  params?: Record<string, unknown>;
};

const BRANCH_PROBES: Probe[] = [
  // 1. Unbounded range rewrite
  {
    label: '1-invalid-range-unbounded',
    code: 'INVALID_RANGE',
    message: 'unbounded range A:Z',
    params: { range: 'Sheet1!A:Z', spreadsheetId: 'xyz' },
  },
  // 2. SHEET_NOT_FOUND (with quoted name)
  {
    label: '2-sheet-not-found',
    code: 'SHEET_NOT_FOUND',
    message: "Sheet 'Sales Data' not found",
    params: { spreadsheetId: 'xyz' },
  },
  // 2b. SHEET_NOT_FOUND adversarial — no spreadsheetId context
  {
    label: '2b-sheet-not-found-no-spreadsheetId',
    code: 'SHEET_NOT_FOUND',
    message: "Sheet 'Q1' not found",
    params: {},
  },
  // 3. SPREADSHEET_NOT_FOUND
  {
    label: '3-spreadsheet-not-found',
    code: 'SPREADSHEET_NOT_FOUND',
    message: 'spreadsheet not found',
  },
  // 4. INVALID_ACTION
  {
    label: '4-invalid-action',
    code: 'INVALID_ACTION',
    message: "Invalid action 'reed'",
    tool: 'sheets_data',
    params: { spreadsheetId: 'xyz' },
  },
  // 5. PERMISSION_DENIED
  {
    label: '5-permission-denied',
    code: 'PERMISSION_DENIED',
    message: 'forbidden',
  },
  // 6. QUOTA_EXCEEDED
  {
    label: '6-quota-exceeded',
    code: 'QUOTA_EXCEEDED',
    message: 'rate limited',
    tool: 'sheets_data',
    action: 'read',
    params: { spreadsheetId: 'xyz', range: 'A1' },
  },
  // 7. VALIDATION_ERROR / required
  {
    label: '7-validation-required',
    code: 'VALIDATION_ERROR',
    message: 'field is required',
    tool: 'sheets_data',
    action: 'read',
  },
  // 8. DUPLICATE_SHEET_NAME
  {
    label: '8-duplicate-sheet',
    code: 'DUPLICATE_SHEET_NAME',
    message: "sheet 'Q1' already exists",
    tool: 'sheets_core',
    action: 'add_sheet',
    params: { title: 'Q1' },
  },
  // 9. INVALID_CHART_TYPE
  {
    label: '9-invalid-chart-type',
    code: 'INVALID_CHART_TYPE',
    message: 'chart type not supported',
    params: { spreadsheetId: 'xyz' },
  },
  // 10. RANGE_OVERLAP
  {
    label: '10-range-overlap',
    code: 'RANGE_OVERLAP',
    message: 'range overlaps merge',
    params: { spreadsheetId: 'xyz' },
  },
  // 11a. VALIDATION_ERROR / range object
  {
    label: '11a-zod-range-object',
    code: 'VALIDATION_ERROR',
    message: "range: Expected object, received string",
    tool: 'sheets_data',
    action: 'read',
    params: {},
  },
  // 11b. VALIDATION_ERROR / missing spreadsheetId
  {
    label: '11b-zod-missing-spreadsheetId',
    code: 'VALIDATION_ERROR',
    message: 'spreadsheetId: Required',
    params: {},
  },
  // 11c. VALIDATION_ERROR / invalid discriminator
  {
    label: '11c-zod-invalid-discriminator',
    code: 'VALIDATION_ERROR',
    message: "action: Invalid discriminator value",
    tool: 'sheets_core',
    params: {}, // adversarial: no spreadsheetId → BUG #4 scenario
  },
  // 11c-adversarial: forces the exact BUG #4 shape where spreadsheetId is
  // absent and branch would inject `undefined` without sanitization.
  {
    label: '11c-zod-invalid-discriminator-no-ssid',
    code: 'VALIDATION_ERROR',
    message: "action: Invalid discriminator value",
    tool: 'sheets_core',
    params: undefined,
  },
  // 12. TIMEOUT
  {
    label: '12-timeout',
    code: 'TIMEOUT',
    message: 'deadline exceeded',
    tool: 'sheets_data',
    action: 'read',
    params: { spreadsheetId: 'xyz', range: 'A1:B10' },
  },
  // 13. CIRCULAR_REFERENCE — adversarial: missing spreadsheetId
  {
    label: '13-circular-reference-no-ssid',
    code: 'CIRCULAR_REFERENCE',
    message: 'circular detected',
    params: {},
  },
  // 14. FORMULA_ERROR — adversarial: missing spreadsheetId
  {
    label: '14-formula-error-no-ssid',
    code: 'FORMULA_ERROR',
    message: 'invalid formula parse',
    params: {},
  },
  // 15. EDIT_CONFLICT — adversarial: missing spreadsheetId
  {
    label: '15-edit-conflict-no-ssid',
    code: 'EDIT_CONFLICT',
    message: 'concurrent modification',
    params: {},
  },
  // 16. UNSUPPORTED_OPERATION — adversarial: missing spreadsheetId
  {
    label: '16-unsupported-operation-no-ssid',
    code: 'UNSUPPORTED_OPERATION',
    message: 'operation not supported',
    params: {},
  },
  // 17. SERVICE_UNAVAILABLE
  {
    label: '17-service-unavailable',
    code: 'SERVICE_UNAVAILABLE',
    message: 'HTTP 503 service unavailable',
    tool: 'sheets_data',
    action: 'read',
    params: { spreadsheetId: 'xyz', range: 'A1' },
  },
  // 18. PROTECTED_RANGE — adversarial: missing spreadsheetId
  {
    label: '18-protected-range-no-ssid',
    code: 'PROTECTED_RANGE',
    message: 'range is protected',
    params: {},
  },
  // 19. BATCH_UPDATE_ERROR — adversarial: missing spreadsheetId
  {
    label: '19-batch-update-error-no-ssid',
    code: 'BATCH_UPDATE_ERROR',
    message: 'batch error during update',
    params: {},
  },
  // 20. FORMULA_INJECTION_BLOCKED
  {
    label: '20-formula-injection-blocked',
    code: 'FORMULA_INJECTION_BLOCKED',
    message: 'formula injection blocked by security policy',
    tool: 'sheets_data',
    action: 'write',
    params: { spreadsheetId: 'xyz', value: '=SUM(A1:A10)' },
  },
  // 21. AMBIGUOUS_RANGE — adversarial: missing spreadsheetId
  {
    label: '21-ambiguous-range-no-ssid',
    code: 'AMBIGUOUS_RANGE',
    message: 'ambiguous range reference',
    params: {},
  },
  // 22. EXPLICIT_RANGE_REQUIRED
  {
    label: '22-explicit-range-required',
    code: 'EXPLICIT_RANGE_REQUIRED',
    message: 'explicit range required',
    tool: 'sheets_data',
    action: 'read',
    params: { spreadsheetId: 'xyz', range: 'A1:B10' },
  },
  // 23. PAYLOAD_TOO_LARGE — adversarial: missing spreadsheetId
  {
    label: '23-payload-too-large-no-ssid',
    code: 'PAYLOAD_TOO_LARGE',
    message: 'payload too large',
    params: {},
  },
  // 24. TRANSACTION_CONFLICT — adversarial: missing spreadsheetId
  {
    label: '24-transaction-conflict-no-ssid',
    code: 'TRANSACTION_CONFLICT',
    message: 'transaction conflict detected',
    params: {},
  },
  // 25. ELICITATION_UNAVAILABLE
  {
    label: '25-elicitation-unavailable',
    code: 'ELICITATION_UNAVAILABLE',
    message: 'elicitation unavailable',
  },
  // 26. CONNECTOR_ERROR
  {
    label: '26-connector-error',
    code: 'CONNECTOR_ERROR',
    message: 'connector error during fetch',
  },
  // 27. SNAPSHOT_CREATION_FAILED — adversarial: missing spreadsheetId
  {
    label: '27-snapshot-failed-no-ssid',
    code: 'SNAPSHOT_CREATION_FAILED',
    message: 'snapshot failed',
    params: {},
  },
];

// --------------------------------------------------------------------------

describe('suggestFix Output Contract (no undefined, always schema-valid)', () => {
  // ------------------------------------------------------------------------
  // Assertion 1 + 2 + 4: every branch produces schema-valid output
  // and contains no `undefined` values
  // ------------------------------------------------------------------------
  describe('Assertion 1-2-4: branch probes pass schema + no undefined', () => {
    for (const probe of BRANCH_PROBES) {
      it(`branch ${probe.label}: valid or null`, () => {
        const fix: SuggestedFix | null = suggestFix(
          probe.code,
          probe.message,
          probe.tool,
          probe.action,
          probe.params
        );

        if (fix === null) {
          // Null is always valid — no fix available is an acceptable outcome.
          return;
        }

        // (A) Schema validation.
        const result = SuggestedFixSchema.safeParse(fix);
        expect(
          result.success,
          `Schema failure for ${probe.label}:\n${JSON.stringify(fix, null, 2)}\n${
            result.success ? '' : JSON.stringify(result.error.issues, null, 2)
          }`
        ).toBe(true);

        // (B) No `undefined` values in params. The BUG #4 regression invariant.
        for (const [k, v] of Object.entries(fix.params)) {
          expect(
            v,
            `Branch ${probe.label} leaked undefined at params.${k} — sanitizeSuggestedParams did not strip it`
          ).not.toBeUndefined();
        }

        // (C) Required top-level strings.
        expect(typeof fix.tool).toBe('string');
        expect(fix.tool.length).toBeGreaterThan(0);
        expect(typeof fix.action).toBe('string');
        expect(fix.action.length).toBeGreaterThan(0);
        expect(typeof fix.explanation).toBe('string');
        expect(fix.explanation.length).toBeGreaterThan(0);
      });
    }
  });

  // ------------------------------------------------------------------------
  // Assertion 3: forward-compat — every ErrorCodeSchema value sweeps clean
  // ------------------------------------------------------------------------
  describe('Assertion 3: full ErrorCodeSchema sweep (no branch returns invalid output)', () => {
    it('every known error code yields null or schema-valid output', () => {
      const enumValues = Object.values(ErrorCodeSchema.enum) as string[];
      expect(enumValues.length).toBeGreaterThan(20);

      const failures: string[] = [];
      for (const code of enumValues) {
        // Fire each code with two adversarial shapes:
        //   (i)  No context whatsoever (tool/action/params all undefined)
        //   (ii) Empty params object
        // — these are the shapes that produce BUG #4 in real life.
        const probes: Array<[string, Probe['params']]> = [
          ['no-context', undefined],
          ['empty-params', {}],
        ];
        for (const [tag, params] of probes) {
          const fix = suggestFix(code, `${code}: simulated failure`, undefined, undefined, params);
          if (fix === null) continue;

          const check = SuggestedFixSchema.safeParse(fix);
          if (!check.success) {
            failures.push(
              `  - ${code} (${tag}): schema invalid → ${check.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; ')}`
            );
            continue;
          }
          for (const [k, v] of Object.entries(fix.params)) {
            if (v === undefined) {
              failures.push(`  - ${code} (${tag}): params.${k} is undefined`);
            }
          }
        }
      }

      expect(
        failures.length,
        `\n${failures.length} branches of suggestFix produced invalid output across the ErrorCodeSchema sweep:\n${failures.join(
          '\n'
        )}\n\n` +
          `This is the BUG #4 regression class. Every branch must return schema-valid output.\n` +
          `Typical fix: ensure params do not propagate \`undefined\` values — sanitizeSuggestedParams\n` +
          `at the return boundary handles this for the common case.`
      ).toBe(0);
    });
  });
});
