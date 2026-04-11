/**
 * Schema Contract Tests
 *
 * Validates that every tool schema correctly implements the discriminated union
 * pattern with 'action' as the discriminator field.
 *
 * Design principles:
 *   - Imports schemas directly from source files (not index.js) to avoid the
 *     env-loading chain triggered by the TOOL_ACTIONS re-export.
 *   - Tests are functional (safeParse) not structural (schema._def introspection),
 *     because several schemas use ZodPipe+ZodTransform which is opaque to introspection.
 *   - Each test verifies a real schema contract: invalid action rejection and
 *     valid action acceptance.
 */
import { describe, it, expect } from 'vitest';
import { SheetsAuthInputSchema } from '../../src/schemas/auth.js';
import { SheetsCoreInputSchema } from '../../src/schemas/core.js';
import { SheetsDataInputSchema } from '../../src/schemas/data.js';
import { SheetsFormatInputSchema } from '../../src/schemas/format.js';
import { SheetsDimensionsInputSchema } from '../../src/schemas/dimensions.js';
import { SheetsVisualizeInputSchema } from '../../src/schemas/visualize.js';
import { SheetsCollaborateInputSchema } from '../../src/schemas/collaborate.js';
import { SheetsAnalyzeInputSchema } from '../../src/schemas/analyze.js';
import { SheetsAdvancedInputSchema } from '../../src/schemas/advanced.js';
import { SheetsTransactionInputSchema } from '../../src/schemas/transaction.js';
import { SheetsQualityInputSchema } from '../../src/schemas/quality.js';
import { SheetsHistoryInputSchema } from '../../src/schemas/history.js';
import { SheetsConfirmInputSchema } from '../../src/schemas/confirm.js';
import { SheetsFixInputSchema } from '../../src/schemas/fix.js';
import { CompositeInputSchema } from '../../src/schemas/composite.js';
import { SheetsSessionInputSchema } from '../../src/schemas/session.js';
import { SheetsTemplatesInputSchema } from '../../src/schemas/templates.js';
import { SheetsBigQueryInputSchema } from '../../src/schemas/bigquery.js';
import { SheetsAppsScriptInputSchema } from '../../src/schemas/appsscript.js';
import { SheetsWebhookInputSchema } from '../../src/schemas/webhook.js';
import { SheetsDependenciesInputSchema } from '../../src/schemas/dependencies.js';
import { SheetsFederationInputSchema } from '../../src/schemas/federation.js';
import { SheetsComputeInputSchema } from '../../src/schemas/compute.js';
import { SheetsAgentInputSchema } from '../../src/schemas/agent.js';
import { SheetsConnectorsInputSchema } from '../../src/schemas/connectors.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type AnyZodSchema = {
  safeParse: (input: unknown) => {
    success: boolean;
    error?: { issues?: unknown[]; errors?: unknown[] };
  };
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the discriminator error info from a failed safeParse.
 * Returns { discriminator, path } when the schema uses a discriminated union.
 */
function getDiscriminatorError(
  schema: AnyZodSchema,
  input: unknown
): { discriminator?: string; path?: string[] } | null {
  const result = schema.safeParse(input);
  if (result.success) return null;
  const issues = ((result.error?.issues ?? result.error?.errors) ?? []) as Array<
    Record<string, unknown>
  >;
  for (const issue of issues) {
    if (issue['discriminator'] && issue['path']) {
      return {
        discriminator: issue['discriminator'] as string,
        path: issue['path'] as string[],
      };
    }
  }
  return null;
}

// ─── All 25 tool schemas ─────────────────────────────────────────────────────

const ALL_TOOL_SCHEMAS: Array<{ tool: string; schema: AnyZodSchema }> = [
  { tool: 'sheets_auth', schema: SheetsAuthInputSchema },
  { tool: 'sheets_core', schema: SheetsCoreInputSchema },
  { tool: 'sheets_data', schema: SheetsDataInputSchema },
  { tool: 'sheets_format', schema: SheetsFormatInputSchema },
  { tool: 'sheets_dimensions', schema: SheetsDimensionsInputSchema },
  { tool: 'sheets_visualize', schema: SheetsVisualizeInputSchema },
  { tool: 'sheets_collaborate', schema: SheetsCollaborateInputSchema },
  { tool: 'sheets_analyze', schema: SheetsAnalyzeInputSchema },
  { tool: 'sheets_advanced', schema: SheetsAdvancedInputSchema },
  { tool: 'sheets_transaction', schema: SheetsTransactionInputSchema },
  { tool: 'sheets_quality', schema: SheetsQualityInputSchema },
  { tool: 'sheets_history', schema: SheetsHistoryInputSchema },
  { tool: 'sheets_confirm', schema: SheetsConfirmInputSchema },
  { tool: 'sheets_fix', schema: SheetsFixInputSchema },
  { tool: 'sheets_composite', schema: CompositeInputSchema },
  { tool: 'sheets_session', schema: SheetsSessionInputSchema },
  { tool: 'sheets_templates', schema: SheetsTemplatesInputSchema },
  { tool: 'sheets_bigquery', schema: SheetsBigQueryInputSchema },
  { tool: 'sheets_appsscript', schema: SheetsAppsScriptInputSchema },
  { tool: 'sheets_webhook', schema: SheetsWebhookInputSchema },
  { tool: 'sheets_dependencies', schema: SheetsDependenciesInputSchema },
  { tool: 'sheets_federation', schema: SheetsFederationInputSchema },
  { tool: 'sheets_compute', schema: SheetsComputeInputSchema },
  { tool: 'sheets_agent', schema: SheetsAgentInputSchema },
  { tool: 'sheets_connectors', schema: SheetsConnectorsInputSchema },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Schema Contracts', () => {
  describe('Discriminated Unions — all 25 schemas', () => {
    it('all 25 tool schemas are defined and parse-capable', () => {
      expect(ALL_TOOL_SCHEMAS).toHaveLength(25);
      for (const { tool, schema } of ALL_TOOL_SCHEMAS) {
        expect(schema, `${tool} schema must be exported`).toBeDefined();
        expect(typeof schema.safeParse, `${tool} schema must be a Zod schema`).toBe('function');
      }
    });

    it('all 25 schemas reject invalid action names', () => {
      // This is the core contract: a discriminated union on 'action' means
      // any unrecognized action name must be rejected — not silently accepted.
      for (const { tool, schema } of ALL_TOOL_SCHEMAS) {
        const result = schema.safeParse({ request: { action: '__invalid_action_xyz__' } });
        expect(result.success, `${tool}: must reject unknown action '__invalid_action_xyz__'`).toBe(
          false
        );
      }
    });

    it('all 25 schemas reject empty request objects (missing action field)', () => {
      // Proves the 'action' discriminator is required — passing {} is never valid.
      for (const { tool, schema } of ALL_TOOL_SCHEMAS) {
        const result = schema.safeParse({ request: {} });
        expect(result.success, `${tool}: must reject request with no action field`).toBe(false);
      }
    });

    it('schemas do NOT discriminate on "type" — only on "action"', () => {
      // Regression guard: ensures the discriminator was not accidentally renamed
      // from 'action' to 'type' or 'name'. Providing { type: '...' } without
      // 'action' must always fail.
      for (const { tool, schema } of ALL_TOOL_SCHEMAS) {
        const result = schema.safeParse({ request: { type: 'status' } });
        expect(
          result.success,
          `${tool}: { type: 'status' } must be rejected — discriminator is 'action', not 'type'`
        ).toBe(false);
      }
    });

    it('discriminator field is named "action" — verified via error metadata on introspectable schemas', () => {
      // Schemas with a top-level ZodDiscriminatedUnion emit discriminator metadata
      // in the parse error. This test verifies those schemas explicitly use 'action'.
      // Schemas using ZodPipe are functionally tested above but cannot be introspected.
      const introspectableSchemas = [
        { tool: 'sheets_auth', schema: SheetsAuthInputSchema },
        { tool: 'sheets_analyze', schema: SheetsAnalyzeInputSchema },
        { tool: 'sheets_quality', schema: SheetsQualityInputSchema },
        { tool: 'sheets_history', schema: SheetsHistoryInputSchema },
        { tool: 'sheets_session', schema: SheetsSessionInputSchema },
        { tool: 'sheets_templates', schema: SheetsTemplatesInputSchema },
        { tool: 'sheets_dependencies', schema: SheetsDependenciesInputSchema },
        { tool: 'sheets_connectors', schema: SheetsConnectorsInputSchema },
        { tool: 'sheets_transaction', schema: SheetsTransactionInputSchema },
      ];

      for (const { tool, schema } of introspectableSchemas) {
        const errInfo = getDiscriminatorError(schema, { request: {} });
        if (errInfo !== null) {
          expect(
            errInfo.discriminator,
            `${tool}: discriminator field must be 'action'`
          ).toBe('action');
          expect(
            errInfo.path,
            `${tool}: error path must include 'action' at the request level`
          ).toContain('action');
        }
      }
    });
  });

  describe('Discriminated Unions — valid action parsing', () => {
    // For each sampled tool, verify that at least one minimal valid input
    // is accepted. Actions are chosen to have no required fields beyond
    // the discriminator itself (or minimal required fields).
    const validInputSamples: Array<{
      tool: string;
      schema: AnyZodSchema;
      input: Record<string, unknown>;
    }> = [
      {
        tool: 'sheets_auth',
        schema: SheetsAuthInputSchema,
        input: { request: { action: 'status' } },
      },
      {
        tool: 'sheets_core',
        schema: SheetsCoreInputSchema,
        input: { request: { action: 'list' } },
      },
      {
        tool: 'sheets_data',
        schema: SheetsDataInputSchema,
        input: { request: { action: 'read', spreadsheetId: 'test-id', range: 'Sheet1!A1:Z100' } },
      },
      {
        tool: 'sheets_analyze',
        schema: SheetsAnalyzeInputSchema,
        input: { request: { action: 'comprehensive', spreadsheetId: 'test-id' } },
      },
      {
        tool: 'sheets_transaction',
        schema: SheetsTransactionInputSchema,
        input: { request: { action: 'list' } },
      },
      {
        tool: 'sheets_quality',
        schema: SheetsQualityInputSchema,
        input: { request: { action: 'validate', spreadsheetId: 'test-id' } },
      },
      {
        tool: 'sheets_history',
        schema: SheetsHistoryInputSchema,
        input: { request: { action: 'undo', spreadsheetId: 'test-id' } },
      },
      {
        tool: 'sheets_session',
        schema: SheetsSessionInputSchema,
        input: { request: { action: 'get_context' } },
      },
      {
        tool: 'sheets_templates',
        schema: SheetsTemplatesInputSchema,
        input: { request: { action: 'list' } },
      },
      {
        tool: 'sheets_dependencies',
        schema: SheetsDependenciesInputSchema,
        input: { request: { action: 'build', spreadsheetId: 'test-id' } },
      },
      {
        tool: 'sheets_connectors',
        schema: SheetsConnectorsInputSchema,
        input: { request: { action: 'list_connectors' } },
      },
      {
        tool: 'sheets_fix',
        schema: SheetsFixInputSchema,
        input: {
          request: { action: 'clean', spreadsheetId: 'test-id', range: 'Sheet1!A1:Z100' },
        },
      },
      {
        tool: 'sheets_compute',
        schema: SheetsComputeInputSchema,
        input: {
          request: { action: 'statistical', spreadsheetId: 'test-id', range: 'Sheet1!A1:Z100' },
        },
      },
    ];

    for (const { tool, schema, input } of validInputSamples) {
      it(`${tool}: minimal valid action input parses successfully`, () => {
        const result = schema.safeParse(input);
        expect(
          result.success,
          `${tool}: input ${JSON.stringify(input['request'])} should parse without error`
        ).toBe(true);
      });
    }
  });

  describe('Required Fields', () => {
    it('enforces required fields in sheets_auth schema', () => {
      // Top-level object must contain 'request'
      expect(() => SheetsAuthInputSchema.parse({})).toThrow();
    });

    it('enforces required fields in sheets_core schema', () => {
      expect(() => SheetsCoreInputSchema.parse({})).toThrow();
    });

    it('enforces action field in sheets_data — invalid action is rejected', () => {
      const result = SheetsDataInputSchema.safeParse({
        request: { action: 'invalid_action' },
      });
      expect(result.success).toBe(false);
    });

    it('enforces action field in sheets_data — omitted action is rejected', () => {
      const result = SheetsDataInputSchema.safeParse({
        request: { spreadsheetId: 'test-id' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Action-Specific Validation', () => {
    it('data.read: valid input with spreadsheetId and range', () => {
      const result = SheetsDataInputSchema.safeParse({
        request: { action: 'read', spreadsheetId: '123', range: 'A1:B10' },
      });
      expect(result.success).toBe(true);
    });

    it('data.write: valid input with spreadsheetId, range, and values', () => {
      const result = SheetsDataInputSchema.safeParse({
        request: {
          action: 'write',
          spreadsheetId: '123',
          range: 'A1',
          values: [['test']],
        },
      });
      expect(result.success).toBe(true);
    });

    it('data.write: rejected when range and values are missing', () => {
      const result = SheetsDataInputSchema.safeParse({
        request: { action: 'write', spreadsheetId: '123' },
      });
      expect(result.success).toBe(false);
    });

    it('auth.status: no extra fields required beyond action', () => {
      const result = SheetsAuthInputSchema.safeParse({ request: { action: 'status' } });
      expect(result.success).toBe(true);
    });

    it('auth: action "authenticate" is not a valid action name', () => {
      // Verifies that only the exact declared literal values are accepted.
      // 'authenticate' sounds plausible but is not in the schema.
      const result = SheetsAuthInputSchema.safeParse({ request: { action: 'authenticate' } });
      expect(result.success).toBe(false);
    });
  });
});
