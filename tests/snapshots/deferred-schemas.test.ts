/**
 * Deferred Schema Equivalence Tests
 *
 * Verifies that DEFER_SCHEMAS mode produces schemas that contain all action names
 * from the full schema. The deferred schema is a ~300-800 byte summary used when
 * schema payload size needs to be minimized (HTTP transport).
 *
 * If this test fails, it means a tool's action enum was truncated or dropped
 * in deferred mode. Fix: check DEFERRED_SCHEMA_MAX_ENUM_VALUES (cap 24) in
 * src/mcp/registration/schema-helpers.ts and the action count for that tool.
 */

import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS } from '../../src/mcp/registration/tool-definitions.js';
import {
  buildDeferredFallbackSchema,
  prepareSchemaForRegistration,
} from '../../src/mcp/registration/schema-helpers.js';
import { zodSchemaToJsonSchema } from '../../src/utils/schema-compat.js';
import { unwrapZodSchema } from '../../src/utils/schema-compat.js';
import { z } from '../../src/lib/schema.js';

function extractActionsFromFullSchema(schema: unknown): string[] {
  const json = zodSchemaToJsonSchema(schema as z.ZodTypeAny);
  // Full schema: { type: 'object', properties: { request: { oneOf: [...] } } }
  const request = (json as Record<string, unknown>)?.properties as Record<string, unknown> | undefined;
  if (!request?.request) return [];
  const reqSchema = request.request as Record<string, unknown>;

  // discriminatedUnion produces oneOf array
  const oneOf = reqSchema.oneOf as Array<Record<string, unknown>> | undefined;
  if (!oneOf) return [];

  return oneOf
    .map((variant) => {
      const props = variant.properties as Record<string, Record<string, unknown>> | undefined;
      return props?.action?.const as string | undefined;
    })
    .filter((a): a is string => typeof a === 'string');
}

function extractActionsFromDeferredSchema(deferred: Record<string, unknown>): string[] {
  const props = deferred?.properties as Record<string, unknown> | undefined;
  const request = props?.request as Record<string, unknown> | undefined;
  const requestProps = request?.properties as Record<string, unknown> | undefined;
  const action = requestProps?.action as Record<string, unknown> | undefined;
  const enumValues = action?.enum as string[] | undefined;
  return enumValues ?? [];
}

describe('Deferred Schema Equivalence', () => {
  for (const toolDef of TOOL_DEFINITIONS) {
    it(`${toolDef.name}: deferred schema contains all actions from full schema`, () => {
      const deferred = buildDeferredFallbackSchema(toolDef.inputSchema as z.ZodTypeAny, 'input');
      const fullActions = extractActionsFromFullSchema(toolDef.inputSchema);
      const deferredActions = extractActionsFromDeferredSchema(deferred);

      // Skip tools where full schema extraction returns no actions (non-standard shape)
      if (fullActions.length === 0) return;

      expect(deferredActions.length).toBeGreaterThan(0);
      // All full actions must appear in deferred enum
      for (const action of fullActions) {
        expect(deferredActions).toContain(action);
      }
    });
  }
});
