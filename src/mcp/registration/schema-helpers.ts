/**
 * ServalSheets - Schema Helpers
 *
 * Schema preparation and validation utilities.
 *
 * @module mcp/registration/schema-helpers
 */

import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { z } from 'zod';
import {
  verifyJsonSchema,
  USE_SCHEMA_REFS,
  zodSchemaToJsonSchema,
} from '../../utils/schema-compat.js';
import { DEFER_SCHEMAS, STRIP_SCHEMA_DESCRIPTIONS } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';

// Use z.ZodType instead of deprecated ZodTypeAny
type ZodSchema = z.ZodType;

// ============================================================================
// SCHEMA CACHE (P0-2 Optimization)
// ============================================================================

/**
 * Module-level cache for prepared schemas.
 *
 * Schema transformations via zodSchemaToJsonSchema() are CPU-intensive (~1-2ms each).
 * With 21 tools × 2 schemas = 42 transformations at startup, caching saves 8-40ms.
 *
 * Cache is keyed by: toolName + schemaType (input/output)
 * Cache is populated on first access and never invalidated (schemas are immutable).
 */
const PREPARED_SCHEMA_CACHE = new Map<string, AnySchema>();

/**
 * Get or compute a cached prepared schema.
 *
 * @param cacheKey - Unique key for this schema (e.g., "sheets_data:input")
 * @param computeFn - Function to compute the schema if not cached
 * @returns Cached or freshly computed schema
 */
export function getCachedPreparedSchema(cacheKey: string, computeFn: () => AnySchema): AnySchema {
  const cached = PREPARED_SCHEMA_CACHE.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const computed = computeFn();
  PREPARED_SCHEMA_CACHE.set(cacheKey, computed);
  return computed;
}

/**
 * Get the current cache size (for diagnostics)
 */
export function getPreparedSchemaCacheSize(): number {
  return PREPARED_SCHEMA_CACHE.size;
}

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
/**
 * Extracts all property names from a JSON Schema, recursing into oneOf/anyOf/allOf.
 * Used to build flat deferred schemas that list all possible properties.
 */
function extractPropertyNames(jsonSchema: unknown): Set<string> {
  const props = new Set<string>();
  if (!jsonSchema || typeof jsonSchema !== 'object') return props;
  const schema = jsonSchema as Record<string, unknown>;

  if (schema['properties'] && typeof schema['properties'] === 'object') {
    for (const key of Object.keys(schema['properties'] as object)) {
      props.add(key);
    }
  }
  for (const key of ['oneOf', 'anyOf', 'allOf']) {
    if (Array.isArray(schema[key])) {
      for (const sub of schema[key] as unknown[]) {
        for (const p of extractPropertyNames(sub)) props.add(p);
      }
    }
  }
  return props;
}

/**
 * Extracts action enum values from a tool's JSON Schema.
 * Handles two patterns:
 * 1. Discriminated union: oneOf with { properties: { action: { const: "value" } } }
 * 2. Direct enum: { properties: { action: { enum: ["a", "b", ...] } } }
 */
function extractActionEnum(innerSchema: Record<string, unknown>): string[] {
  const actions: string[] = [];

  // Pattern 1: Discriminated union with oneOf
  const variants = innerSchema['oneOf'] as unknown[] | undefined;
  if (Array.isArray(variants)) {
    for (const variant of variants) {
      if (!variant || typeof variant !== 'object') continue;
      const v = variant as Record<string, unknown>;
      const props = v['properties'] as Record<string, unknown> | undefined;
      const actionProp = props?.['action'] as Record<string, unknown> | undefined;
      if (actionProp?.['const'] && typeof actionProp['const'] === 'string') {
        actions.push(actionProp['const'] as string);
      }
    }
  }

  // Pattern 2: Direct enum on action property
  if (actions.length === 0) {
    const props = innerSchema['properties'] as Record<string, unknown> | undefined;
    const actionProp = props?.['action'] as Record<string, unknown> | undefined;
    if (actionProp && Array.isArray(actionProp['enum'])) {
      for (const val of actionProp['enum'] as unknown[]) {
        if (typeof val === 'string') actions.push(val);
      }
    }
  }

  return actions.sort();
}

/**
 * Brief descriptions for commonly-used properties across tools.
 * These help the MCP client/LLM understand what each parameter does
 * without needing the full schema.
 */
const COMMON_PROPERTY_DESCRIPTIONS: Record<string, string> = {
  spreadsheetId: 'Google Sheets spreadsheet ID',
  sheetId: 'Numeric sheet/tab ID within the spreadsheet',
  sheetName: 'Sheet/tab name within the spreadsheet',
  range: 'A1 notation range (e.g. "Sheet1!A1:D10")',
  ranges: 'Array of A1 notation ranges',
  values: 'Array of row arrays to write',
  verbosity: 'Response detail: minimal, standard, or detailed',
  safety: 'Safety options for destructive operations',
  cursor: 'Pagination cursor from previous response',
};

/**
 * Builds a flat deferred schema for a tool from its full schema.
 *
 * Instead of using z.looseObject() (which the MCP client ignores for property discovery),
 * this extracts ALL property names from ALL action variants in the full schema
 * and creates a flat z.object() with z.any().optional() for each property.
 *
 * Result: ~300-800 bytes per tool (vs 2-90KB for full schemas) while still
 * listing every possible parameter so the MCP client sends them correctly.
 *
 * Total across 21 tools: ~12KB / ~3K tokens (vs 385KB / ~99K tokens for full).
 */
function buildFlatDeferredSchema(fullSchema: ZodSchema, schemaType: SchemaType): ZodSchema {
  try {
    const jsonSchema = z.toJSONSchema(fullSchema, { io: 'input' }) as Record<string, unknown>;
    const wrapperKey = schemaType === 'output' ? 'response' : 'request';

    // Extract request/response sub-schema
    const properties = jsonSchema['properties'] as Record<string, unknown> | undefined;
    const innerSchema = properties?.[wrapperKey] as Record<string, unknown> | undefined;

    if (!innerSchema) {
      // Fallback to generic passthrough
      return schemaType === 'output'
        ? z.object({ response: z.looseObject({ success: z.boolean() }) })
        : z.object({ request: z.looseObject({ action: z.string() }) });
    }

    // Extract all property names from all action variants
    const allProps = extractPropertyNames(innerSchema);
    const requiredKey = schemaType === 'output' ? 'success' : 'action';
    allProps.delete(requiredKey);

    // Build flat shape: required key + all other props as z.any().optional()
    const shape: Record<string, z.ZodType> = {};
    if (schemaType === 'output') {
      shape['success'] = z.boolean();
    } else {
      // Extract action enum for this tool's valid actions
      const actionValues = extractActionEnum(innerSchema);
      if (actionValues.length > 0) {
        // Use z.enum so the client knows valid action values
        shape['action'] = z.enum(actionValues as [string, ...string[]]).describe(
          'IMPORTANT: Read schema://tools/{toolName} first to see available actions and required parameters'
        );
      } else {
        shape['action'] = z.string().describe(
          'IMPORTANT: Read schema://tools/{toolName} first to see available actions and required parameters'
        );
      }
    }
    for (const prop of allProps) {
      // Add descriptions for common properties to aid the LLM
      const desc = COMMON_PROPERTY_DESCRIPTIONS[prop];
      shape[prop] = desc ? z.any().optional().describe(desc) : z.any().optional();
    }

    const innerObj = z.object(shape).catchall(z.any());
    return z.object({ [wrapperKey]: innerObj });
  } catch {
    // Fallback to generic passthrough on any error
    return schemaType === 'output'
      ? z.object({ response: z.looseObject({ success: z.boolean() }) })
      : z.object({ request: z.looseObject({ action: z.string() }) });
  }
}

/**
 * Minimal passthrough schema for OUTPUT schemas in deferred loading mode
 * (used as fallback when full schema is not available)
 */
const MinimalOutputPassthroughSchema = z
  .object({
    response: z
      .looseObject({
        success: z.boolean().describe('Whether the operation succeeded'),
      })
      .describe('Response object - see schema://tools/{toolName} for full response structure'),
  })
  .describe(
    'Schema deferred for token efficiency. Read schema://tools/{toolName} resource for full schema.'
  );

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
 * - All 21 tools available with dynamic schema loading
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
  // Deferred schema mode - return flat property-list schema
  // Full schemas accessible via schema://tools/{toolName} resources
  if (DEFER_SCHEMAS) {
    if (schemaType === 'output') {
      return MinimalOutputPassthroughSchema as unknown as AnySchema;
    }
    // Build flat schema listing ALL property names from the full schema
    // This ensures the MCP client sends all parameters (not just 'action')
    // Size: ~300-800 bytes per tool vs 2-90KB for full schemas
    return buildFlatDeferredSchema(schema, schemaType) as unknown as AnySchema;
  }

  if (USE_SCHEMA_REFS || STRIP_SCHEMA_DESCRIPTIONS) {
    // Pre-convert to JSON Schema with safe error handling
    // USE_SCHEMA_REFS: Uses $ref optimization reducing payload by ~60%
    // STRIP_SCHEMA_DESCRIPTIONS: Removes inline descriptions saving ~14K tokens
    try {
      let processed = zodSchemaToJsonSchema(schema);

      // Strip descriptions if enabled (saves ~14K tokens)
      if (STRIP_SCHEMA_DESCRIPTIONS) {
        processed = stripSchemaDescriptions(processed) as Record<string, unknown>;
      }

      // IMPORTANT: SDK expects Zod schemas, not JSON Schema objects
      // We need to wrap the JSON Schema in a minimal Zod schema for SDK compatibility
      // The SDK will use the JSON Schema for tools/list but validate with Zod
      return processed as unknown as AnySchema;
    } catch (error) {
      logger.warn('Schema conversion failed, returning original Zod schema', {
        component: 'schema-helpers',
        error: error instanceof Error ? error.message : String(error),
      });
      // Fall through to return original schema
    }
  }

  // Default: return Zod schema for SDK to handle
  // The SDK will convert to JSON Schema internally
  return schema as unknown as AnySchema;
}

/**
 * Prepares a schema for MCP SDK registration with caching (P0-2 optimization).
 *
 * This is the preferred function for tool registration loops where the tool name
 * is available. It caches the result of prepareSchemaForRegistration to avoid
 * redundant CPU-intensive schema transformations.
 *
 * @param toolName - Name of the tool (used as cache key)
 * @param schema - Zod schema to prepare
 * @param schemaType - Type of schema ('input' or 'output')
 * @returns Cached or freshly prepared schema
 */
export function prepareSchemaForRegistrationCached(
  toolName: string,
  schema: ZodSchema,
  schemaType: SchemaType
): AnySchema {
  const cacheKey = `${toolName}:${schemaType}`;
  return getCachedPreparedSchema(cacheKey, () => prepareSchemaForRegistration(schema, schemaType));
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
    params: z.record(z.string(), z.unknown()),
  }).strict();

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
