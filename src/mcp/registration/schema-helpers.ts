/**
 * ServalSheets - Schema Helpers
 *
 * Schema preparation and validation utilities.
 *
 * @module mcp/registration/schema-helpers
 */

import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { z } from 'zod';
import { verifyJsonSchema, USE_SCHEMA_REFS } from '../../utils/schema-compat.js';
import { DEFER_SCHEMAS, STRIP_SCHEMA_DESCRIPTIONS } from '../../config/constants.js';

// Use z.ZodType instead of deprecated ZodTypeAny
type ZodSchema = z.ZodType;

/**
 * Recursively strips "description" fields from JSON Schema
 *
 * When STRIP_SCHEMA_DESCRIPTIONS is enabled, this removes inline descriptions
 * from converted schemas to save ~14,000 tokens. Validation still works since
 * descriptions are purely documentation.
 *
 * @param schema - JSON Schema object to strip descriptions from
 * @returns Schema with description fields removed
 */
function stripSchemaDescriptions(schema: unknown): unknown {
  if (schema === null || typeof schema !== 'object') {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(stripSchemaDescriptions);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    // Skip description fields (but keep them at the top level for tool routing)
    if (key === 'description') {
      continue;
    }
    result[key] = stripSchemaDescriptions(value);
  }
  return result;
}

// ============================================================================
// SCHEMA PREPARATION
// ============================================================================

/**
 * Minimal passthrough schema for deferred loading mode
 *
 * This schema accepts any object input. When DEFER_SCHEMAS is enabled,
 * tools are registered with this minimal schema instead of full schemas.
 * Claude reads full schemas from schema://tools/{toolName} resources.
 *
 * The actual validation happens in handlers using the original Zod schemas.
 *
 * IMPORTANT: Must match the actual schema structure: { request: { action, ... } }
 * All tool schemas use this wrapper pattern for the discriminated union.
 */
// Use z.looseObject() instead of deprecated .passthrough()
const MinimalInputPassthroughSchema = z
  .object({
    request: z
      .looseObject({
        action: z
          .string()
          .describe('Action name - read schema://tools/{toolName} for available actions'),
      })
      .describe('Request object containing action and parameters'),
  })
  .describe('Deferred schema - read schema://tools/{toolName} for full schema');

/**
 * Minimal passthrough schema for OUTPUT schemas in deferred loading mode
 *
 * Output schemas use `response` instead of `request` and are discriminated by `success`.
 */
const MinimalOutputPassthroughSchema = z
  .object({
    response: z
      .looseObject({
        success: z.boolean().describe('Whether the operation succeeded'),
      })
      .describe('Response object containing result or error'),
  })
  .describe('Deferred schema - read schema://tools/{toolName} for full schema');

/**
 * Schema type for registration preparation
 */
export type SchemaType = 'input' | 'output';

/**
 * Prepares a schema for MCP SDK registration
 *
 * When SERVAL_DEFER_SCHEMAS=true (recommended for Claude Desktop):
 * - Returns a minimal passthrough schema (~200 bytes per tool)
 * - Full schemas available via schema://tools/{toolName} resources
 * - Reduces initial payload from ~231KB to ~5KB
 * - All 19 tools available with dynamic schema loading
 *
 * When SERVAL_SCHEMA_REFS=true:
 * - Pre-converts Zod schemas to JSON Schema with `reused: 'ref'` option
 * - Creates `$defs` for shared types, reducing payload by ~60%
 * - Useful for full mode to avoid overwhelming MCP clients
 *
 * When both are false (default):
 * - Returns Zod schema as-is for SDK to handle
 * - SDK converts using its own JSON Schema converter
 *
 * Note: Runtime validation in handlers uses original Zod schemas directly,
 * not the registration schema. This ensures validation works regardless of
 * whether we pre-convert or defer.
 *
 * @param schema - Zod schema to prepare
 * @param schemaType - Type of schema ('input' or 'output'), defaults to 'input'
 * @returns Minimal schema (deferred), optimized JSON Schema, or original Zod schema
 */
export function prepareSchemaForRegistration(
  schema: ZodSchema,
  schemaType: SchemaType = 'input'
): AnySchema {
  // Deferred schema mode - return minimal passthrough schema
  // Full schemas accessible via schema://tools/{toolName} resources
  if (DEFER_SCHEMAS) {
    // Use the appropriate minimal schema based on type
    const minimalSchema =
      schemaType === 'output' ? MinimalOutputPassthroughSchema : MinimalInputPassthroughSchema;
    return minimalSchema as unknown as AnySchema;
  }

  if (USE_SCHEMA_REFS || STRIP_SCHEMA_DESCRIPTIONS) {
    // Pre-convert to JSON Schema
    // USE_SCHEMA_REFS: Uses $ref optimization reducing payload by ~60%
    // STRIP_SCHEMA_DESCRIPTIONS: Removes inline descriptions saving ~14K tokens
    const jsonSchemaOptions = USE_SCHEMA_REFS ? { reused: 'ref' as const } : undefined;
    const rawJsonSchema = z.toJSONSchema(schema, jsonSchemaOptions);

    // Process the schema as a plain object
    let processed: Record<string, unknown> =
      typeof rawJsonSchema === 'object' && rawJsonSchema !== null
        ? { ...(rawJsonSchema as Record<string, unknown>) }
        : {};

    // Remove $schema property (MCP doesn't need it)
    delete processed['$schema'];

    // Strip descriptions if enabled (saves ~14K tokens)
    if (STRIP_SCHEMA_DESCRIPTIONS) {
      processed = stripSchemaDescriptions(processed) as Record<string, unknown>;
    }

    return processed as unknown as AnySchema;
  }

  // Default: return Zod schema for SDK to handle
  return schema as unknown as AnySchema;
}

/**
 * Wrap input schema to accept legacy request envelopes.
 *
 * Supports:
 * - direct inputs (current format)
 * - { request: <input> } (legacy wrapper)
 * - { request: { action, params } } (legacy params wrapper)
 */
export function wrapInputSchemaForLegacyRequest(schema: ZodSchema): ZodSchema {
  const legacyParamsSchema = z.object({
    action: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
  });

  const legacyRequestSchema = z.object({
    request: z.union([schema, legacyParamsSchema]),
  });

  return z.union([schema, legacyRequestSchema]);
}

/**
 * Verifies a JSON Schema object is valid (development only)
 *
 * @param schema - Schema to verify
 */
export function verifySchemaIfNeeded(schema: unknown): void {
  if (process.env['NODE_ENV'] !== 'production') {
    const isZodSchema = (s: unknown): boolean =>
      Boolean(s && typeof s === 'object' && '_def' in (s as Record<string, unknown>));

    if (!isZodSchema(schema)) {
      verifyJsonSchema(schema);
    }
  }
}
