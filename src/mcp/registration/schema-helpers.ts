/**
 * ServalSheets - Schema Helpers
 *
 * Schema preparation and validation utilities.
 *
 * @module mcp/registration/schema-helpers
 */

import type { AnySchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { z, type ZodTypeAny } from "zod";
import {
  verifyJsonSchema,
  zodSchemaToJsonSchema,
  isZodObject,
} from "../../utils/schema-compat.js";

// ============================================================================
// SCHEMA PREPARATION
// ============================================================================

/**
 * Prepares a schema for MCP SDK registration
 *
 * CRITICAL: MCP SDK v1.25.1 uses zod-to-json-schema@3.25.0 which is NOT compatible
 * with Zod v4's discriminated unions. It returns empty schemas for them.
 *
 * Solution: We pre-convert Zod v4 schemas to JSON Schema using Zod v4's native
 * .toJSONSchema() method before passing to the SDK.
 *
 * @param schema - Zod schema to prepare
 * @returns JSON Schema object ready for MCP SDK
 */
export function prepareSchemaForRegistration(
  schema: ZodTypeAny,
): AnySchema | Record<string, unknown> {
  // For z.object() schemas, the SDK can handle them natively
  // For everything else (discriminated unions, regular unions, etc.),
  // we need to convert to JSON Schema first
  if (isZodObject(schema)) {
    return schema as unknown as AnySchema;
  }

  // Convert to JSON Schema using Zod v4's native method
  // This ensures discriminated unions are properly converted
  return zodSchemaToJsonSchema(schema);
}

/**
 * Wrap input schema to accept legacy request envelopes.
 *
 * Supports:
 * - direct inputs (current format)
 * - { request: <input> } (legacy wrapper)
 * - { request: { action, params } } (legacy params wrapper)
 */
export function wrapInputSchemaForLegacyRequest(
  schema: ZodTypeAny,
): ZodTypeAny {
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
  if (process.env["NODE_ENV"] !== "production") {
    const isZodSchema = (s: unknown): boolean =>
      Boolean(
        s &&
        typeof s === "object" &&
        "_def" in (s as Record<string, unknown>),
      );

    if (!isZodSchema(schema)) {
      verifyJsonSchema(schema);
    }
  }
}
