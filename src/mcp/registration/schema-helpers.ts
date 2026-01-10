/**
 * ServalSheets - Schema Helpers
 *
 * Schema preparation and validation utilities.
 *
 * @module mcp/registration/schema-helpers
 */

import type { AnySchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { z, type ZodTypeAny } from "zod";
import { verifyJsonSchema } from "../../utils/schema-compat.js";

// ============================================================================
// SCHEMA PREPARATION
// ============================================================================

/**
 * Prepares a schema for MCP SDK registration
 *
 * MCP SDK v1.25+ properly handles all Zod schema types, including discriminated unions.
 * We pass Zod schemas directly to the SDK - it will convert them to JSON Schema internally.
 *
 * This ensures the MCP Inspector can validate inputs using Zod's validation methods
 * (safeParse, safeParseAsync, etc.) which expect actual Zod schema objects.
 *
 * @param schema - Zod schema to prepare
 * @returns Original Zod schema (SDK handles conversion internally)
 */
export function prepareSchemaForRegistration(
  schema: ZodTypeAny,
): AnySchema | Record<string, unknown> {
  // Pass Zod schema as-is - SDK v1.25+ handles all schema types correctly
  // Including: z.object(), z.discriminatedUnion(), z.union(), z.intersection()
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
