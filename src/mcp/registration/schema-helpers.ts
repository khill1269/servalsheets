/**
 * ServalSheets - Schema Helpers
 *
 * Schema preparation and validation utilities.
 *
 * @module mcp/registration/schema-helpers
 */

import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { z, type ZodTypeAny } from 'zod';
import { verifyJsonSchema } from '../../utils/schema-compat.js';

// ============================================================================
// SCHEMA PREPARATION
// ============================================================================

/**
 * Prepares a schema for MCP SDK registration
 *
 * CRITICAL FIX (2025-01-10): The MCP SDK v1.25.x requires Zod schemas for runtime
 * validation (safeParseAsync). Converting to JSON Schema breaks validation because
 * JSON Schema objects don't have .safeParseAsync() method.
 *
 * The SDK handles JSON Schema conversion internally:
 * - For tools/list: Uses toJsonSchemaCompat() to convert Zod → JSON Schema
 * - For CallTool: Uses safeParseAsync() directly on Zod schema
 *
 * Previous code was converting discriminated unions to JSON Schema, which caused:
 * "v3Schema.safeParseAsync is not a function" error
 *
 * @param schema - Zod schema to prepare
 * @returns The same Zod schema (SDK handles conversion internally)
 */
export function prepareSchemaForRegistration(schema: ZodTypeAny): AnySchema {
  // ALWAYS return the Zod schema as-is
  // The SDK needs Zod schemas for runtime validation via safeParseAsync()
  // JSON Schema conversion happens internally in the SDK for tools/list
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
export function wrapInputSchemaForLegacyRequest(schema: ZodTypeAny): ZodTypeAny {
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
