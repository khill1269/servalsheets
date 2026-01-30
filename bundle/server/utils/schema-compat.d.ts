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
/**
 * Detects if a Zod schema is a discriminated union
 *
 * Uses stable instanceof check instead of internal _def property.
 * This is future-proof and works with minification/bundling.
 *
 * @param schema - Any Zod schema
 * @returns true if the schema is a discriminated union
 */
export declare function isZodDiscriminatedUnion(schema: unknown): schema is z.ZodDiscriminatedUnion<any, any>;
/**
 * Detects if a Zod schema is a regular union (z.union())
 *
 * Uses stable instanceof check instead of internal _def property.
 *
 * @param schema - Any Zod schema
 * @returns true if the schema is a z.union()
 */
export declare function isZodUnion(schema: unknown): schema is z.ZodUnion<any>;
/**
 * Detects if a Zod schema is an object type (z.object())
 *
 * Uses stable instanceof check instead of internal _def property.
 *
 * @param schema - Any Zod schema
 * @returns true if the schema is a z.object()
 */
export declare function isZodObject(schema: unknown): schema is z.ZodObject<z.ZodRawShape>;
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
 * Whether to use $ref optimization in JSON Schema output
 *
 * When enabled, Zod schemas are converted with `reused: 'ref'` option,
 * which creates `$defs` for shared types and references them with `$ref`.
 * This reduces payload size by ~60% (527KB → 209KB for full mode).
 *
 * WARNING: Not all MCP clients handle `$refs` correctly. Test thoroughly.
 *
 * Set via SERVAL_SCHEMA_REFS=true environment variable.
 */
export declare const USE_SCHEMA_REFS: boolean;
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
export declare function zodSchemaToJsonSchema(schema: ZodTypeAny, _options?: JsonSchemaOptions): Record<string, unknown>;
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
export declare function validateMcpSchema(schema: unknown, name: string): void;
/**
 * @deprecated Use isZodDiscriminatedUnion instead
 */
export declare const isDiscriminatedUnion: typeof isZodDiscriminatedUnion;
/**
 * @deprecated Use zodSchemaToJsonSchema instead
 */
export declare const zodToJsonSchemaCompat: typeof zodSchemaToJsonSchema;
/**
 * Verifies that a schema has been properly converted to JSON Schema
 *
 * Checks for Zod-specific properties that shouldn't exist in JSON Schema.
 * This catches cases where schema transformation failed.
 *
 * @param schema - Schema to verify
 * @throws Error if the schema contains Zod-specific properties
 */
export declare function verifyJsonSchema(schema: unknown): void;
//# sourceMappingURL=schema-compat.d.ts.map