/**
 * Schema Transformation Tests
 *
 * Verifies that all tool schemas are properly detected as discriminated unions
 * and correctly transformed to valid JSON Schema format without Zod artifacts.
 *
 * These tests ensure that the schema transformation in schema-compat.ts
 * properly converts Zod discriminated unions to JSON Schema, preventing the
 * "v3Schema.safeParseAsync is not a function" error.
 */

import { describe, it, expect } from 'vitest';
import {
  isDiscriminatedUnion,
  isZodObject,
  zodToJsonSchemaCompat,
  verifyJsonSchema,
} from '../../src/utils/schema-compat.js';
import { TOOL_DEFINITIONS } from '../../src/mcp/registration.js';

const getZodShape = (schema: any): Record<string, unknown> | undefined => {
  const shape = schema?.shape ?? schema?._def?.shape;
  if (typeof shape === 'function') {
    return shape();
  }
  return shape;
};

const hasField = (shape: Record<string, unknown> | undefined, field: string): boolean => {
  if (!shape) return false;
  const fieldSchema = shape[field] as any;
  if (!fieldSchema) return false;
  // Field exists - may be wrapped in ZodDefault, ZodOptional, etc.
  return true;
};

describe('Schema Transformation', () => {
  describe('Schema Structure (Refactored)', () => {
    for (const tool of TOOL_DEFINITIONS) {
      it(`${tool.name}: input schema should be a discriminated union (action-based router)`, () => {
        // NEW: All input schemas are now direct discriminated unions
        // No wrapper object with 'request' field
        expect(isDiscriminatedUnion(tool.inputSchema)).toBe(true);
      });

      it(`${tool.name}: output schema should be a Zod object with response union`, () => {
        expect(isZodObject(tool.outputSchema)).toBe(true);
        const shape = getZodShape(tool.outputSchema);
        expect(shape?.['response']).toBeDefined();
        expect(isDiscriminatedUnion(shape?.['response'])).toBe(true);
      });
    }
  });

  describe('Input Schema Transformation', () => {
    for (const tool of TOOL_DEFINITIONS) {
      describe(tool.name, () => {
        let jsonSchema: Record<string, unknown>;

        it('should transform to valid JSON Schema object', () => {
          jsonSchema = zodToJsonSchemaCompat(tool.inputSchema);

          // Must be an object
          expect(jsonSchema).toBeTypeOf('object');
          expect(jsonSchema).toBeDefined();
        });

        it('should be valid JSON Schema (object, union, or array of schemas)', () => {
          jsonSchema = zodToJsonSchemaCompat(tool.inputSchema);
          // After refactoring, discriminated unions may return:
          // 1. An object with type: "object"
          // 2. An object with anyOf/oneOf
          // 3. An array of schema objects (union branches)
          const isArray = Array.isArray(jsonSchema);
          const hasType = jsonSchema['type'] === 'object';
          const hasUnion = !!(jsonSchema['anyOf'] || jsonSchema['oneOf']);
          expect(isArray || hasType || hasUnion).toBe(true);
        });

        it('should NOT contain Zod-specific properties', () => {
          jsonSchema = zodToJsonSchemaCompat(tool.inputSchema);

          // Must NOT have Zod methods or internal properties
          expect(jsonSchema).not.toHaveProperty('_def');
          expect(jsonSchema).not.toHaveProperty('_type');
          expect(jsonSchema).not.toHaveProperty('parse');
          expect(jsonSchema).not.toHaveProperty('safeParse');
          expect(jsonSchema).not.toHaveProperty('parseAsync');
          expect(jsonSchema).not.toHaveProperty('safeParseAsync');
        });

        it('should represent discriminated union (anyOf, oneOf, or array)', () => {
          jsonSchema = zodToJsonSchemaCompat(tool.inputSchema);

          // NEW: All tools now use direct discriminated unions
          // JSON Schema may be represented as:
          // 1. Object with anyOf property
          // 2. Object with oneOf property
          // 3. Array of schema objects (direct union branches)
          const isArray = Array.isArray(jsonSchema) && jsonSchema.length > 0;
          const anyOf = jsonSchema['anyOf'];
          const hasAnyOf = Array.isArray(anyOf) && anyOf.length > 0;
          const oneOf = jsonSchema['oneOf'];
          const hasOneOf = Array.isArray(oneOf) && oneOf.length > 0;

          expect(isArray || hasAnyOf || hasOneOf).toBe(true);
        });

        it('should pass verifyJsonSchema safety check', () => {
          jsonSchema = zodToJsonSchemaCompat(tool.inputSchema);

          // This should not throw
          expect(() => verifyJsonSchema(jsonSchema)).not.toThrow();
        });
      });
    }
  });

  describe('Output Schema Transformation', () => {
    for (const tool of TOOL_DEFINITIONS) {
      describe(tool.name, () => {
        let jsonSchema: Record<string, unknown>;

        it('should transform to valid JSON Schema object', () => {
          jsonSchema = zodToJsonSchemaCompat(tool.outputSchema);

          expect(jsonSchema).toBeTypeOf('object');
          expect(jsonSchema).toBeDefined();
        });

        it('should have type: "object"', () => {
          jsonSchema = zodToJsonSchemaCompat(tool.outputSchema);
          expect(jsonSchema['type']).toBe('object');
        });

        it('should NOT contain Zod-specific properties', () => {
          jsonSchema = zodToJsonSchemaCompat(tool.outputSchema);

          expect(jsonSchema).not.toHaveProperty('_def');
          expect(jsonSchema).not.toHaveProperty('_type');
          expect(jsonSchema).not.toHaveProperty('parse');
          expect(jsonSchema).not.toHaveProperty('safeParse');
          expect(jsonSchema).not.toHaveProperty('parseAsync');
          expect(jsonSchema).not.toHaveProperty('safeParseAsync');
        });

        it('should pass verifyJsonSchema safety check', () => {
          jsonSchema = zodToJsonSchemaCompat(tool.outputSchema);

          // This should not throw
          expect(() => verifyJsonSchema(jsonSchema)).not.toThrow();
        });
      });
    }
  });

  describe('verifyJsonSchema Function', () => {
    it('should accept valid JSON Schema', () => {
      const validSchema = {
        type: 'object',
        properties: {
          foo: { type: 'string' },
        },
      };

      expect(() => verifyJsonSchema(validSchema)).not.toThrow();
    });

    it('should reject schemas with Zod _def property', () => {
      const invalidSchema = {
        type: 'object',
        _def: { typeName: 'ZodObject' },
      };

      expect(() => verifyJsonSchema(invalidSchema)).toThrow('Schema transformation failed');
      expect(() => verifyJsonSchema(invalidSchema)).toThrow('_def');
    });

    it('should reject schemas with Zod parse method', () => {
      const invalidSchema = {
        type: 'object',
        parse: () => {},
      };

      expect(() => verifyJsonSchema(invalidSchema)).toThrow('Schema transformation failed');
      expect(() => verifyJsonSchema(invalidSchema)).toThrow('parse');
    });

    it('should reject schemas with safeParseAsync method', () => {
      const invalidSchema = {
        type: 'object',
        safeParseAsync: () => {},
      };

      expect(() => verifyJsonSchema(invalidSchema)).toThrow('Schema transformation failed');
      expect(() => verifyJsonSchema(invalidSchema)).toThrow('safeParseAsync');
      expect(() => verifyJsonSchema(invalidSchema)).toThrow('JSON Schema contains Zod properties');
    });

    it('should handle null and undefined gracefully', () => {
      expect(() => verifyJsonSchema(null)).not.toThrow();
      expect(() => verifyJsonSchema(undefined)).not.toThrow();
    });

    it('should handle non-object primitives gracefully', () => {
      expect(() => verifyJsonSchema('string')).not.toThrow();
      expect(() => verifyJsonSchema(123)).not.toThrow();
      expect(() => verifyJsonSchema(true)).not.toThrow();
    });
  });
});
