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
import { z } from 'zod';
import {
  isDiscriminatedUnion,
  isZodObject,
  isZodUnion,
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
      it(`${tool.name}: input schema should be action-based (discriminated union or flattened with enum)`, () => {
        // Schemas can be:
        // 1. Discriminated union (old approach, most tools still use this)
        // 2. Flattened object with action enum (MCP SDK workaround for sheets_auth and sheets_spreadsheet)
        const isDiscUnion = isDiscriminatedUnion(tool.inputSchema);

        // Check if it's a flattened schema with action enum
        // ✅ FIXED: Using stable instanceof checks instead of brittle ._zod.constr.name
        const shape = getZodShape(tool.inputSchema);
        const actionField = shape?.['action'] as any;
        // Note: In Zod v4, both z.enum() and z.nativeEnum() use ZodEnum class
        const isFlattened = actionField && actionField instanceof z.ZodEnum;

        expect(isDiscUnion || isFlattened).toBe(true);
      });

      it(`${tool.name}: output schema should be a Zod object with response union`, () => {
        expect(isZodObject(tool.outputSchema)).toBe(true);
        const shape = getZodShape(tool.outputSchema);
        expect(shape?.['response']).toBeDefined();
        // Special case: sheets_composite and sheets_session use z.union instead of z.discriminatedUnion
        // because they contain multiple success types with different action fields
        if (tool.name === 'sheets_composite' || tool.name === 'sheets_session') {
          expect(isZodUnion(shape?.['response'])).toBe(true);
        } else {
          expect(isDiscriminatedUnion(shape?.['response'])).toBe(true);
        }
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

        it('should represent discriminated union (anyOf, oneOf, array, or flattened with enum action)', () => {
          jsonSchema = zodToJsonSchemaCompat(tool.inputSchema);

          // JSON Schema may be represented as:
          // 1. Object with anyOf property (old discriminated union)
          // 2. Object with oneOf property (old discriminated union)
          // 3. Array of schema objects (direct union branches)
          // 4. Flattened object with enum action field (MCP SDK workaround for discriminated unions)
          const isArray = Array.isArray(jsonSchema) && jsonSchema.length > 0;
          const anyOf = jsonSchema['anyOf'];
          const hasAnyOf = Array.isArray(anyOf) && anyOf.length > 0;
          const oneOf = jsonSchema['oneOf'];
          const hasOneOf = Array.isArray(oneOf) && oneOf.length > 0;

          // Flattened schema: object with properties.action.enum
          const properties = jsonSchema['properties'] as Record<string, unknown> | undefined;
          const actionField = properties?.['action'] as Record<string, unknown> | undefined;
          const actionEnum = actionField?.['enum'];
          const isFlattenedWithEnum = Array.isArray(actionEnum) && actionEnum.length > 0;

          expect(isArray || hasAnyOf || hasOneOf || isFlattenedWithEnum).toBe(true);
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
