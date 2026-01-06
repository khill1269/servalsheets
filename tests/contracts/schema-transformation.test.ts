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

describe('Schema Transformation', () => {
  describe('Envelope Detection', () => {
    for (const tool of TOOL_DEFINITIONS) {
      it(`${tool.name}: input schema should be a Zod object with request union`, () => {
        expect(isZodObject(tool.inputSchema)).toBe(true);
        const shape = getZodShape(tool.inputSchema);
        expect(shape?.request).toBeDefined();
        // Tools with single actions (like sheets_impact) may use simple objects instead of discriminated unions
        const isUnion = isDiscriminatedUnion(shape?.request);
        const isSingleAction = isZodObject(shape?.request) && getZodShape(shape?.request)?.action;
        expect(isUnion || isSingleAction).toBe(true);
      });

      it(`${tool.name}: output schema should be a Zod object with response union`, () => {
        expect(isZodObject(tool.outputSchema)).toBe(true);
        const shape = getZodShape(tool.outputSchema);
        expect(shape?.response).toBeDefined();
        expect(isDiscriminatedUnion(shape?.response)).toBe(true);
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

        it('should have type: "object"', () => {
          jsonSchema = zodToJsonSchemaCompat(tool.inputSchema);
          expect(jsonSchema.type).toBe('object');
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

        it('should have oneOf or properties structure', () => {
          jsonSchema = zodToJsonSchemaCompat(tool.inputSchema);

          // Should have either oneOf (discriminated union) or properties (regular object)
          const hasOneOf = 'oneOf' in jsonSchema && Array.isArray(jsonSchema.oneOf) && jsonSchema.oneOf.length > 0;
          const hasProperties = 'properties' in jsonSchema &&
                               typeof jsonSchema.properties === 'object' &&
                               jsonSchema.properties !== null &&
                               Object.keys(jsonSchema.properties).length > 0;

          expect(hasOneOf || hasProperties).toBe(true);
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
          expect(jsonSchema.type).toBe('object');
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
