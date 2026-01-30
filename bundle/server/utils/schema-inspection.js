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
import { z } from 'zod';
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
export function unwrapSchema(schema) {
    let current = schema;
    // Loop until no more wrappers found
    while (true) {
        // Unwrap optional/nullable
        if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
            current = current.unwrap();
            continue;
        }
        // Unwrap default
        if (current instanceof z.ZodDefault) {
            current = current.removeDefault();
            continue;
        }
        // Unwrap pipes (transform in Zod v4)
        if (current instanceof z.ZodPipe) {
            current = current.in;
            continue;
        }
        // Unwrap readonly
        if (current instanceof z.ZodReadonly) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- No public API for readonly innerType
            current = current._def.innerType;
            continue;
        }
        // Unwrap catch
        if (current instanceof z.ZodCatch) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- No public API for catch innerType
            current = current._def.innerType;
            continue;
        }
        // No more wrappers found
        break;
    }
    return current;
}
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
export function isEnumLike(schema) {
    const unwrapped = unwrapSchema(schema);
    return unwrapped instanceof z.ZodEnum;
}
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
export function getObjectShape(schema) {
    const unwrapped = unwrapSchema(schema);
    if (!(unwrapped instanceof z.ZodObject)) {
        return null;
    }
    // In Zod v4, .shape is a stable property
    return unwrapped.shape;
}
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
export function isActionBasedSchema(schema) {
    const unwrapped = unwrapSchema(schema);
    // Pattern 1: Discriminated union
    if (unwrapped instanceof z.ZodDiscriminatedUnion) {
        return true;
    }
    // Pattern 2: Flat object with action enum field
    if (unwrapped instanceof z.ZodObject) {
        const shape = unwrapped.shape;
        const actionField = shape?.['action'];
        return actionField ? isEnumLike(actionField) : false;
    }
    return false;
}
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
export function getDiscriminator(schema) {
    const unwrapped = unwrapSchema(schema);
    if (unwrapped instanceof z.ZodDiscriminatedUnion) {
        // Minimal _def access (unavoidable - no public API)
        // This is safe because the discriminator is a core stable property
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- No public API for discriminator field
        return unwrapped._def.discriminator;
    }
    return null;
}
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
export function getDiscriminatedUnionOptions(schema) {
    const unwrapped = unwrapSchema(schema);
    if (unwrapped instanceof z.ZodDiscriminatedUnion) {
        // Minimal _def access (unavoidable - no public API)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- No public API for union options
        return unwrapped._def.options;
    }
    return null;
}
/**
 * Check if a schema is a union type (z.union())
 *
 * Note: In Zod v4, ZodDiscriminatedUnion extends ZodUnion, so we explicitly
 * exclude discriminated unions to return true only for regular unions.
 *
 * @param schema - Any Zod schema
 * @returns true if the unwrapped schema is a ZodUnion (but NOT ZodDiscriminatedUnion)
 */
export function isUnion(schema) {
    const unwrapped = unwrapSchema(schema);
    // Exclude discriminated unions (which also inherit from ZodUnion in v4)
    if (unwrapped instanceof z.ZodDiscriminatedUnion) {
        return false;
    }
    return unwrapped instanceof z.ZodUnion;
}
/**
 * Check if a schema is a discriminated union (z.discriminatedUnion())
 *
 * @param schema - Any Zod schema
 * @returns true if the unwrapped schema is a ZodDiscriminatedUnion
 */
export function isDiscriminatedUnion(schema) {
    const unwrapped = unwrapSchema(schema);
    return unwrapped instanceof z.ZodDiscriminatedUnion;
}
/**
 * Check if a schema is an object type (z.object())
 *
 * @param schema - Any Zod schema
 * @returns true if the unwrapped schema is a ZodObject
 */
export function isObject(schema) {
    const unwrapped = unwrapSchema(schema);
    return unwrapped instanceof z.ZodObject;
}
/**
 * Check if a schema is an array type (z.array())
 *
 * @param schema - Any Zod schema
 * @returns true if the unwrapped schema is a ZodArray
 */
export function isArray(schema) {
    const unwrapped = unwrapSchema(schema);
    return unwrapped instanceof z.ZodArray;
}
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
export function getArrayElement(schema) {
    const unwrapped = unwrapSchema(schema);
    if (unwrapped instanceof z.ZodArray) {
        return unwrapped.element;
    }
    return null;
}
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
export function hasField(schema, fieldName) {
    const shape = getObjectShape(schema);
    return shape !== null && fieldName in shape;
}
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
export function getField(schema, fieldName) {
    const shape = getObjectShape(schema);
    if (!shape || !(fieldName in shape)) {
        return null;
    }
    return shape[fieldName];
}
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
export function getFieldNames(schema) {
    const shape = getObjectShape(schema);
    return shape ? Object.keys(shape) : [];
}
//# sourceMappingURL=schema-inspection.js.map