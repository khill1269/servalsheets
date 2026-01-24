/**
 * ServalSheets - Schema Inspection Utilities
 *
 * Production-grade utilities for unwrapping and inspecting Zod v4 schemas
 * using only stable APIs. These utilities work with wrapped schemas
 * (optional, default, effects, etc.) to extract the underlying type.
 *
 * ## Why This Module Exists
 *
 * Zod schemas can be wrapped in multiple layers:
 * - z.optional() - Makes a schema optional
 * - z.default() - Provides default value
 * - z.transform() / z.refine() - Adds runtime transformations/validation
 * - z.nullable() - Allows null values
 * - z.branded() - Adds type branding
 *
 * To inspect the actual base type, we need to unwrap these layers.
 *
 * ## Stable API Guarantee
 *
 * This module uses ONLY stable Zod v4 APIs:
 * - `instanceof` type checks (stable)
 * - `.unwrap()` method (stable)
 * - `.removeDefault()` method (stable)
 * - `.innerType()` method (stable)
 * - `.shape` property (stable)
 *
 * The only exception is minimal `_def` access for discriminator extraction,
 * which is unavoidable but centralized to a single function.
 *
 * @module utils/schema-inspection
 */
import { type ZodTypeAny } from 'zod';
/**
 * Recursively unwraps wrapper schemas to get the base type
 *
 * Handles the following Zod wrappers in order:
 * 1. ZodOptional / ZodNullable → unwrap()
 * 2. ZodDefault → removeDefault()
 * 3. ZodEffects (transform/refine) → innerType()
 * 4. ZodBranded → inner type
 * 5. ZodReadonly → inner type
 * 6. ZodCatch → inner type
 *
 * @param schema - Any Zod schema (potentially wrapped)
 * @returns The unwrapped base schema
 *
 * @example
 * const wrapped = z.number().optional().default(10);
 * const base = unwrapSchema(wrapped);
 * // base is z.number()
 */
export declare function unwrapSchema(schema: ZodTypeAny): ZodTypeAny;
/**
 * Check if a schema is an enum-like type (ZodEnum)
 *
 * Note: In Zod v4, both z.enum() and z.nativeEnum() use the same ZodEnum class.
 *
 * @param schema - Any Zod schema
 * @returns true if the unwrapped schema is a ZodEnum
 *
 * @example
 * const schema = z.enum(["read", "write"]).optional();
 * isEnumLike(schema); // true
 */
export declare function isEnumLike(schema: ZodTypeAny): boolean;
/**
 * Extract object shape from ZodObject
 *
 * Returns the shape (field definitions) from a ZodObject schema.
 * Returns null if the schema is not a ZodObject.
 *
 * @param schema - Any Zod schema
 * @returns Object shape or null
 *
 * @example
 * const schema = z.object({ name: z.string(), age: z.number() });
 * const shape = getObjectShape(schema);
 * // shape = { name: ZodString, age: ZodNumber }
 */
export declare function getObjectShape(schema: ZodTypeAny): Record<string, ZodTypeAny> | null;
/**
 * Check if schema is action-based (discriminated union or flat object with action enum)
 *
 * ServalSheets uses two patterns for tool input schemas:
 * 1. Discriminated union with "action" discriminator (most tools)
 * 2. Flat object with "action" enum field (MCP SDK workaround for auth/spreadsheet)
 *
 * @param schema - Any Zod schema
 * @returns true if schema follows action-based pattern
 *
 * @example
 * // Pattern 1: Discriminated union
 * const schema1 = z.discriminatedUnion("action", [
 *   z.object({ action: z.literal("read"), ... }),
 *   z.object({ action: z.literal("write"), ... }),
 * ]);
 * isActionBasedSchema(schema1); // true
 *
 * // Pattern 2: Flat object with action enum
 * const schema2 = z.object({
 *   action: z.enum(["read", "write"]),
 *   // ... other fields
 * });
 * isActionBasedSchema(schema2); // true
 */
export declare function isActionBasedSchema(schema: ZodTypeAny): boolean;
/**
 * Extract discriminator key from discriminated union
 *
 * Returns the discriminator field name (e.g., "action", "type", "kind").
 * Returns null if the schema is not a discriminated union.
 *
 * Note: This is one of the few places where _def access is necessary,
 * as Zod v4 doesn't provide a public API for extracting the discriminator.
 *
 * @param schema - Any Zod schema
 * @returns Discriminator key or null
 *
 * @example
 * const schema = z.discriminatedUnion("action", [...]);
 * getDiscriminator(schema); // "action"
 */
export declare function getDiscriminator(schema: ZodTypeAny): string | null;
/**
 * Get all options/variants from a discriminated union
 *
 * Returns the array of schemas that make up the union variants.
 * Returns null if the schema is not a discriminated union.
 *
 * @param schema - Any Zod schema
 * @returns Array of variant schemas or null
 *
 * @example
 * const schema = z.discriminatedUnion("action", [
 *   z.object({ action: z.literal("read"), ... }),
 *   z.object({ action: z.literal("write"), ... }),
 * ]);
 * const options = getDiscriminatedUnionOptions(schema);
 * // options = [ZodObject, ZodObject]
 */
export declare function getDiscriminatedUnionOptions(schema: ZodTypeAny): ZodTypeAny[] | null;
/**
 * Check if a schema is a union type (z.union())
 *
 * Note: In Zod v4, ZodDiscriminatedUnion extends ZodUnion, so we explicitly
 * exclude discriminated unions to return true only for regular unions.
 *
 * @param schema - Any Zod schema
 * @returns true if the unwrapped schema is a ZodUnion (but NOT ZodDiscriminatedUnion)
 */
export declare function isUnion(schema: ZodTypeAny): boolean;
/**
 * Check if a schema is a discriminated union (z.discriminatedUnion())
 *
 * @param schema - Any Zod schema
 * @returns true if the unwrapped schema is a ZodDiscriminatedUnion
 */
export declare function isDiscriminatedUnion(schema: ZodTypeAny): boolean;
/**
 * Check if a schema is an object type (z.object())
 *
 * @param schema - Any Zod schema
 * @returns true if the unwrapped schema is a ZodObject
 */
export declare function isObject(schema: ZodTypeAny): boolean;
/**
 * Check if a schema is an array type (z.array())
 *
 * @param schema - Any Zod schema
 * @returns true if the unwrapped schema is a ZodArray
 */
export declare function isArray(schema: ZodTypeAny): boolean;
/**
 * Get element type from array schema
 *
 * @param schema - Any Zod schema
 * @returns Element schema or null if not an array
 *
 * @example
 * const schema = z.array(z.string()).optional();
 * const element = getArrayElement(schema);
 * // element = z.string()
 */
export declare function getArrayElement(schema: ZodTypeAny): ZodTypeAny | null;
/**
 * Check if a schema has a specific field
 *
 * @param schema - Any Zod schema
 * @param fieldName - Field name to check
 * @returns true if the schema is an object with the specified field
 *
 * @example
 * const schema = z.object({ name: z.string(), age: z.number() });
 * hasField(schema, "name"); // true
 * hasField(schema, "email"); // false
 */
export declare function hasField(schema: ZodTypeAny, fieldName: string): boolean;
/**
 * Get a specific field schema from an object
 *
 * @param schema - Any Zod schema
 * @param fieldName - Field name to extract
 * @returns Field schema or null if not found
 *
 * @example
 * const schema = z.object({ name: z.string(), age: z.number() });
 * const nameSchema = getField(schema, "name");
 * // nameSchema = z.string()
 */
export declare function getField(schema: ZodTypeAny, fieldName: string): ZodTypeAny | null;
/**
 * Get all field names from an object schema
 *
 * @param schema - Any Zod schema
 * @returns Array of field names or empty array
 *
 * @example
 * const schema = z.object({ name: z.string(), age: z.number() });
 * getFieldNames(schema); // ["name", "age"]
 */
export declare function getFieldNames(schema: ZodTypeAny): string[];
//# sourceMappingURL=schema-inspection.d.ts.map