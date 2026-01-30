/**
 * ServalSheets - Schema Helpers
 *
 * Schema preparation and validation utilities.
 *
 * @module mcp/registration/schema-helpers
 */
import { z } from 'zod';
import { verifyJsonSchema, USE_SCHEMA_REFS } from '../../utils/schema-compat.js';
import { DEFER_SCHEMAS } from '../../config/constants.js';
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
const MinimalPassthroughSchema = z
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
 * @returns Minimal schema (deferred), optimized JSON Schema, or original Zod schema
 */
export function prepareSchemaForRegistration(schema) {
    // Deferred schema mode - return minimal passthrough schema
    // Full schemas accessible via schema://tools/{toolName} resources
    if (DEFER_SCHEMAS) {
        return MinimalPassthroughSchema;
    }
    if (USE_SCHEMA_REFS) {
        // Pre-convert to JSON Schema with $ref optimization
        // This reduces payload by ~60% by using $defs for shared types
        const jsonSchema = z.toJSONSchema(schema, { reused: 'ref' });
        // Remove $schema property (MCP doesn't need it)
        if (typeof jsonSchema === 'object' && jsonSchema !== null) {
            const { $schema: _$schema, ...rest } = jsonSchema;
            return rest;
        }
        return jsonSchema;
    }
    // Default: return Zod schema for SDK to handle
    return schema;
}
/**
 * Wrap input schema to accept legacy request envelopes.
 *
 * Supports:
 * - direct inputs (current format)
 * - { request: <input> } (legacy wrapper)
 * - { request: { action, params } } (legacy params wrapper)
 */
export function wrapInputSchemaForLegacyRequest(schema) {
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
export function verifySchemaIfNeeded(schema) {
    if (process.env['NODE_ENV'] !== 'production') {
        const isZodSchema = (s) => Boolean(s && typeof s === 'object' && '_def' in s);
        if (!isZodSchema(schema)) {
            verifyJsonSchema(schema);
        }
    }
}
//# sourceMappingURL=schema-helpers.js.map