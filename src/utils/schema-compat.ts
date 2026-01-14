/**
 * ServalSheets - MCP SDK Compatibility Layer
 *
 * PRODUCTION-GRADE | MCP 2025-11-25 COMPLIANT | ZOD v4.3.5 COMPATIBLE
 *
 * This module provides compatibility between Zod schemas and JSON Schema
 * for the MCP SDK's tools/list response.
 *
 * ## Background
 *
 * The MCP SDK v1.25.x has a limitation in how it handles Zod schemas
 * for the `tools/list` response:
 *
 * 1. `normalizeObjectSchema()` only recognizes z.object() schemas
 * 2. z.discriminatedUnion() schemas return `undefined` from normalization
 * 3. tools/list returns empty `{ type: "object", properties: {} }` for such tools
 *
 * This prevents LLMs from understanding the tool's input structure, causing
 * them to guess at parameters or fail to use the tools correctly.
 *
 * ## Solution
 *
 * We use Zod v4's native JSON Schema conversion (z.toJSONSchema()) to convert
 * Zod schemas to JSON Schema format. Zod v4.0+ has first-party JSON Schema
 * support that handles discriminated unions, objects, unions, and other types correctly.
 *
 * ## Request/Response Envelopes
 *
 * ServalSheets wraps tool inputs/outputs in `{ request: ... }` and `{ response: ... }`
 * for strict MCP compliance. The compatibility layer provides JSON Schema conversion
 * for tools/list while preserving Zod schemas for runtime validation.
 *
 * @module utils/schema-compat
 */

import { z, type ZodTypeAny } from 'zod';
import { logger } from './logger.js';

/**
 * Detects if a Zod schema is a discriminated union
 *
 * Uses stable instanceof check instead of internal _def property.
 * This is future-proof and works with minification/bundling.
 *
 * @param schema - Any Zod schema
 * @returns true if the schema is a discriminated union
 */
export function isZodDiscriminatedUnion(
  schema: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic Zod type parameter required by library
): schema is z.ZodDiscriminatedUnion<any, any> {
  // ✅ STABLE API: instanceof check instead of _def property access
  return schema instanceof z.ZodDiscriminatedUnion;
}

/**
 * Detects if a Zod schema is a regular union (z.union())
 *
 * Uses stable instanceof check instead of internal _def property.
 *
 * @param schema - Any Zod schema
 * @returns true if the schema is a z.union()
 */
export function isZodUnion(
  schema: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic Zod type parameter required by library
): schema is z.ZodUnion<any> {
  // ✅ STABLE API: instanceof check instead of _def property access
  return schema instanceof z.ZodUnion;
}

/**
 * Detects if a Zod schema is an object type (z.object())
 *
 * Uses stable instanceof check instead of internal _def property.
 *
 * @param schema - Any Zod schema
 * @returns true if the schema is a z.object()
 */
export function isZodObject(schema: unknown): schema is z.ZodObject<z.ZodRawShape> {
  // ✅ STABLE API: instanceof check instead of _def property access
  return schema instanceof z.ZodObject;
}

/**
 * Options for JSON Schema conversion
 */
export interface JsonSchemaOptions {
  /** Strategy for handling $refs (default: 'none') */
  refStrategy?: 'none' | 'root' | 'relative';
  /** Target JSON Schema version (default: 'jsonSchema7') */
  target?: 'jsonSchema7' | 'jsonSchema2019-09' | 'openApi3';
  /** Enable strict union handling (default: true) */
  strictUnions?: boolean;
}

/**
 * Converts a Zod schema to JSON Schema format
 *
 * Uses Zod v4's native toJSONSchema() method for conversion.
 * Zod v4.0+ has first-party JSON Schema support via z.toJSONSchema().
 *
 * Handles:
 * - z.discriminatedUnion() → JSON Schema with oneOf
 * - z.object() → JSON Schema object
 * - z.union() → JSON Schema with oneOf
 * - Other Zod types → Appropriate JSON Schema
 *
 * @param schema - Any Zod schema
 * @param options - Conversion options (currently unused, kept for API compatibility)
 * @returns JSON Schema object (without $schema property)
 */
export function zodSchemaToJsonSchema(
  schema: ZodTypeAny,
  _options: JsonSchemaOptions = {}
): Record<string, unknown> {
  try {
    // ✅ Use Zod v4's native JSON Schema conversion
    // This works correctly with discriminated unions, objects, unions, etc.
    const jsonSchema = z.toJSONSchema(schema);

    // Remove $schema property (MCP doesn't need it)
    if (typeof jsonSchema === 'object' && jsonSchema !== null) {
      const { $schema: _$schema, ...rest } = jsonSchema as Record<string, unknown>;
      return rest;
    }

    // Unexpected format from Zod
    logger.warn('Unexpected JSON Schema format from z.toJSONSchema', {
      component: 'schema-compat',
      schemaType: typeof jsonSchema,
    });
    return { type: 'object', properties: {} };
  } catch (error) {
    logger.error('JSON Schema conversion failed', {
      component: 'schema-compat',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Fallback for conversion failures
    return { type: 'object', properties: {} };
  }
}

/**
 * Validates that a schema is properly formatted for MCP
 *
 * Checks that the schema is either:
 * 1. A z.object() Zod schema
 * 2. A JSON Schema object with type: 'object'
 *
 * @param schema - Schema to validate
 * @param name - Schema name for error messages
 * @throws Error if schema is invalid
 */
export function validateMcpSchema(schema: unknown, name: string): void {
  if (!schema || typeof schema !== 'object') {
    throw new Error(`[${name}] Schema must be an object`);
  }

  const obj = schema as Record<string, unknown>;

  // Check if it's a Zod schema (has _def)
  if ('_def' in obj) {
    // Zod schema - acceptable for MCP SDK registration
    // The SDK handles both runtime validation and JSON Schema conversion
    return;
  }

  // Check if it's a JSON Schema (has type: 'object')
  if (obj['type'] !== 'object' && !obj['oneOf'] && !obj['anyOf']) {
    throw new Error(`[${name}] JSON Schema must have type: 'object' or oneOf/anyOf at root`);
  }
}

// ============================================================================
// LEGACY ALIASES (for migration from sdk-patch.ts)
// ============================================================================

/**
 * @deprecated Use isZodDiscriminatedUnion instead
 */
export const isDiscriminatedUnion = isZodDiscriminatedUnion;

/**
 * @deprecated Use zodSchemaToJsonSchema instead
 */
export const zodToJsonSchemaCompat = zodSchemaToJsonSchema;

/**
 * Verifies that a schema has been properly converted to JSON Schema
 *
 * Checks for Zod-specific properties that shouldn't exist in JSON Schema.
 * This catches cases where schema transformation failed.
 *
 * @param schema - Schema to verify
 * @throws Error if the schema contains Zod-specific properties
 */
export function verifyJsonSchema(schema: unknown): void {
  if (!schema || typeof schema !== 'object') {
    return;
  }

  const obj = schema as Record<string, unknown>;

  // Check for Zod-specific properties that shouldn't be in JSON Schema
  const zodProperties = ['_def', '_type', 'parse', 'safeParse', 'parseAsync', 'safeParseAsync'];
  const foundZodProps = zodProperties.filter((prop) => prop in obj);

  if (foundZodProps.length > 0) {
    throw new Error(
      `Schema transformation failed: JSON Schema contains Zod properties: ${foundZodProps.join(', ')}\n` +
        `This means a Zod schema was not properly converted before registration.`
    );
  }
}
