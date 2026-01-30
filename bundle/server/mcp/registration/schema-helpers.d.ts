/**
 * ServalSheets - Schema Helpers
 *
 * Schema preparation and validation utilities.
 *
 * @module mcp/registration/schema-helpers
 */
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { z } from 'zod';
type ZodSchema = z.ZodType;
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
export declare function prepareSchemaForRegistration(schema: ZodSchema): AnySchema;
/**
 * Wrap input schema to accept legacy request envelopes.
 *
 * Supports:
 * - direct inputs (current format)
 * - { request: <input> } (legacy wrapper)
 * - { request: { action, params } } (legacy params wrapper)
 */
export declare function wrapInputSchemaForLegacyRequest(schema: ZodSchema): ZodSchema;
/**
 * Verifies a JSON Schema object is valid (development only)
 *
 * @param schema - Schema to verify
 */
export declare function verifySchemaIfNeeded(schema: unknown): void;
export {};
//# sourceMappingURL=schema-helpers.d.ts.map