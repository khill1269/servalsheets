/**
 * ServalSheets - MCP SDK Compatibility Layer
 *
 * PRODUCTION-GRADE | MCP 2025-11-25 COMPLIANT
 *
 * This module provides compatibility between Zod discriminated unions
 * and the MCP SDK's schema handling for the tools/list response.
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
 * We convert Zod discriminated unions to JSON Schema objects BEFORE
 * registration. This uses the same `zod-to-json-schema` library that
 * the SDK uses internally, ensuring consistent output.
 *
 * ## Request/Response Envelopes
 *
 * ServalSheets now wraps tool inputs/outputs in `{ request: ... }` and `{ response: ... }`
 * for strict MCP compliance. The compatibility layer remains for any non-object schemas
 * that still need conversion to JSON Schema (e.g., prompts or legacy shapes).
 *
 * @module utils/schema-compat
 */

import type { ZodTypeAny } from "zod";

/**
 * Detects if a Zod schema is a discriminated union
 *
 * Supports:
 * - Zod v3: `_def.typeName === 'ZodDiscriminatedUnion'`
 * - Zod v3.25+/v4: `_def.type === 'union'` with discriminator
 *
 * @param schema - Any Zod schema
 * @returns true if the schema is a discriminated union
 */
export function isZodDiscriminatedUnion(schema: unknown): boolean {
  if (!schema || typeof schema !== "object") return false;

  const zodSchema = schema as { _def?: Record<string, unknown> };
  const def = zodSchema._def;

  if (!def) return false;

  // Zod v3 style
  if (def["typeName"] === "ZodDiscriminatedUnion") return true;

  // Zod v3.25+ / v4 style
  if (def["type"] === "union" && def["discriminator"]) return true;

  // Alternative check for discriminator with options
  if (def["discriminator"] && Array.isArray(def["options"])) return true;

  return false;
}

/**
 * Detects if a Zod schema is a regular union (z.union())
 *
 * @param schema - Any Zod schema
 * @returns true if the schema is a z.union()
 */
export function isZodUnion(schema: unknown): boolean {
  if (!schema || typeof schema !== "object") return false;

  const zodSchema = schema as { _def?: Record<string, unknown> };
  const def = zodSchema._def;

  if (!def) return false;

  // Zod v3 and v4: Check for ZodUnion typeName
  if (def["typeName"] === "ZodUnion") return true;

  // Alternative check: union without discriminator (regular union)
  if (def["type"] === "union" && !def["discriminator"]) return true;

  return false;
}

/**
 * Detects if a Zod schema is an object type (z.object())
 *
 * @param schema - Any Zod schema
 * @returns true if the schema is a z.object()
 */
export function isZodObject(schema: unknown): boolean {
  if (!schema || typeof schema !== "object") return false;

  const zodSchema = schema as {
    _def?: Record<string, unknown>;
    shape?: unknown;
  };

  // Check for ZodObject typeName
  if (zodSchema._def?.["typeName"] === "ZodObject") return true;

  // Check for shape property (ZodObject has this)
  if (
    typeof zodSchema.shape === "function" ||
    typeof zodSchema.shape === "object"
  )
    return true;

  return false;
}

/**
 * Options for JSON Schema conversion
 */
export interface JsonSchemaOptions {
  /** Strategy for handling $refs (default: 'none') */
  refStrategy?: "none" | "root" | "relative";
  /** Target JSON Schema version (default: 'jsonSchema7') */
  target?: "jsonSchema7" | "jsonSchema2019-09" | "openApi3";
  /** Enable strict union handling (default: true) */
  strictUnions?: boolean;
}

/**
 * Converts a Zod schema to JSON Schema format
 *
 * This is the core compatibility function. It handles:
 * - z.discriminatedUnion() → JSON Schema with oneOf/anyOf
 * - z.object() → JSON Schema object
 * - Other Zod types → Appropriate JSON Schema
 *
 * @param schema - Any Zod schema
 * @param options - Conversion options
 * @returns JSON Schema object (without $schema property)
 */
export function zodSchemaToJsonSchema(
  schema: ZodTypeAny,
  options: JsonSchemaOptions = {},
): Record<string, unknown> {
  const { target = "jsonSchema7" } = options;

  try {
    // Zod v4 native JSON schema support
    // Using `.toJSONSchema()` method available in Zod v4
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toJSONSchema = (schema as any).toJSONSchema;

    if (typeof toJSONSchema === "function") {
      const jsonSchema = toJSONSchema.call(schema, {
        target: target,
        // Zod v4 native options
      }) as Record<string, unknown>;

      if (typeof jsonSchema === "object" && jsonSchema !== null) {
        // Remove $schema property (MCP doesn't need it)
        const { $schema: _$schema, ...rest } = jsonSchema;
        return rest;
      }
    }

    // Fallback: If toJSONSchema not available, return basic object schema
    console.warn("[schema-compat] toJSONSchema not available on schema, using fallback");
  } catch (error) {
    console.error("[schema-compat] JSON Schema conversion failed:", error);
  }

  // Fallback for conversion failures
  return { type: "object", properties: {} };
}

/**
 * Prepares a Zod schema for MCP SDK registration
 *
 * If the schema is a discriminated union or other non-object type,
 * converts it to JSON Schema format. Otherwise, returns as-is for
 * the SDK's native handling.
 *
 * @param schema - Zod schema to prepare
 * @returns Schema ready for registerTool()
 */
export function prepareSchemaForMcp(
  schema: ZodTypeAny,
): ZodTypeAny | Record<string, unknown> {
  // z.object() schemas work natively with the SDK
  if (isZodObject(schema)) {
    return schema;
  }

  // Discriminated unions and other types need conversion
  if (isZodDiscriminatedUnion(schema)) {
    return zodSchemaToJsonSchema(schema);
  }

  // For any other schema type, convert to JSON Schema
  // This handles z.union(), z.intersection(), etc.
  return zodSchemaToJsonSchema(schema);
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
  if (!schema || typeof schema !== "object") {
    throw new Error(`[${name}] Schema must be an object`);
  }

  const obj = schema as Record<string, unknown>;

  // Check if it's a Zod schema (has _def)
  if ("_def" in obj) {
    // Zod schema - should be z.object() for optimal SDK handling
    // Discriminated unions will be converted by prepareSchemaForMcp
    return;
  }

  // Check if it's a JSON Schema (has type: 'object')
  if (obj["type"] !== "object" && !obj["oneOf"] && !obj["anyOf"]) {
    throw new Error(
      `[${name}] JSON Schema must have type: 'object' or oneOf/anyOf at root`,
    );
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
  if (!schema || typeof schema !== "object") {
    return;
  }

  const obj = schema as Record<string, unknown>;

  // Check for Zod-specific properties that shouldn't be in JSON Schema
  const zodProperties = [
    "_def",
    "_type",
    "parse",
    "safeParse",
    "parseAsync",
    "safeParseAsync",
  ];
  const foundZodProps = zodProperties.filter((prop) => prop in obj);

  if (foundZodProps.length > 0) {
    throw new Error(
      `Schema transformation failed: JSON Schema contains Zod properties: ${foundZodProps.join(", ")}\n` +
        `This means a Zod schema was not properly converted before registration.`,
    );
  }
}
