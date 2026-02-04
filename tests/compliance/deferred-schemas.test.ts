/**
 * Deferred Schema Loading Tests
 *
 * Tests the DEFER_SCHEMAS and DEFER_DESCRIPTIONS optimization modes
 * that reduce initial payload from ~231KB to ~5KB for Claude Desktop.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  prepareSchemaForRegistration,
} from '../../src/mcp/registration/schema-helpers.js';
import { TOOL_DEFINITIONS } from '../../src/mcp/registration/tool-definitions.js';
import { DEFER_SCHEMAS, DEFER_DESCRIPTIONS } from '../../src/config/constants.js';
import { zodSchemaToJsonSchema } from '../../src/utils/schema-compat.js';

describe('Deferred Schema Mode', () => {
  describe('Schema preparation', () => {
    it('should return minimal schema when DEFER_SCHEMAS is enabled', () => {
      if (!DEFER_SCHEMAS) return;

      const testSchema = z.object({
        request: z.object({
          action: z.enum(['read', 'write']),
          spreadsheetId: z.string(),
        }),
      });

      const prepared = prepareSchemaForRegistration(testSchema, 'input');
      const json = zodSchemaToJsonSchema(prepared as z.ZodType);

      // Deferred schemas are small passthrough objects (~200-700 bytes)
      expect(JSON.stringify(json).length).toBeLessThan(1000);
    });

    it('should return minimal output schema when DEFER_SCHEMAS is enabled', () => {
      if (!DEFER_SCHEMAS) return;

      const testSchema = z.object({
        response: z.object({
          success: z.boolean(),
          data: z.array(z.string()),
        }),
      });

      const prepared = prepareSchemaForRegistration(testSchema, 'output');
      const json = zodSchemaToJsonSchema(prepared as z.ZodType);

      expect(JSON.stringify(json).length).toBeLessThan(1000);
    });

    it('should include schema resource hint in description', () => {
      if (!DEFER_SCHEMAS) return;

      const testSchema = z.object({
        request: z.object({
          action: z.string(),
        }),
      });

      const prepared = prepareSchemaForRegistration(testSchema, 'input');
      const json = zodSchemaToJsonSchema(prepared as z.ZodType);
      const jsonStr = JSON.stringify(json);

      expect(jsonStr).toContain('schema://tools/');
    });
  });

  describe('DEFER_SCHEMAS auto-detection', () => {
    it('should be a boolean', () => {
      expect(typeof DEFER_SCHEMAS).toBe('boolean');
    });

    it('should default to true for STDIO (no --http flag)', () => {
      const envVal = process.env['SERVAL_DEFER_SCHEMAS'];
      if (!envVal) {
        expect(DEFER_SCHEMAS).toBe(true);
      }
    });
  });

  describe('DEFER_DESCRIPTIONS', () => {
    it('should be a boolean', () => {
      expect(typeof DEFER_DESCRIPTIONS).toBe('boolean');
    });
  });

  describe('Tool definitions integrity', () => {
    it('should have 21 tools regardless of deferred mode', () => {
      expect(TOOL_DEFINITIONS.length).toBe(21);
    });

    it('should have non-empty descriptions regardless of deferred mode', () => {
      for (const tool of TOOL_DEFINITIONS) {
        expect(tool.description.length).toBeGreaterThan(10);
      }
    });

    it('should have prepared input schemas that accept request objects in deferred mode', () => {
      if (!DEFER_SCHEMAS) return;

      // In deferred mode, prepareSchemaForRegistration returns a passthrough
      // that accepts any action string
      const testSchema = z.object({
        request: z.object({
          action: z.enum(['read', 'write']),
        }),
      });

      const prepared = prepareSchemaForRegistration(testSchema, 'input') as z.ZodType;
      const result = prepared.safeParse({ request: { action: 'test_action_xyz' } });
      expect(result.success).toBe(true);
    });

    it('should have prepared output schemas that accept response objects in deferred mode', () => {
      if (!DEFER_SCHEMAS) return;

      const testSchema = z.object({
        response: z.object({
          success: z.boolean(),
          data: z.array(z.string()),
        }),
      });

      const prepared = prepareSchemaForRegistration(testSchema, 'output') as z.ZodType;
      const result = prepared.safeParse({ response: { success: true } });
      expect(result.success).toBe(true);
    });
  });

  describe('Schema size optimization', () => {
    it('total deferred schema payload should be under 30KB', () => {
      if (!DEFER_SCHEMAS) return;

      let totalSize = 0;
      for (const tool of TOOL_DEFINITIONS) {
        // Measure the PREPARED (deferred) schemas, not raw definitions
        const preparedInput = prepareSchemaForRegistration(
          tool.inputSchema as z.ZodType, 'input'
        );
        const preparedOutput = prepareSchemaForRegistration(
          tool.outputSchema as z.ZodType, 'output'
        );
        const inputJson = zodSchemaToJsonSchema(preparedInput as z.ZodType);
        const outputJson = zodSchemaToJsonSchema(preparedOutput as z.ZodType);
        totalSize += JSON.stringify(inputJson).length;
        totalSize += JSON.stringify(outputJson).length;
      }

      // 21 tools × 2 schemas × ~500-700 bytes each ≈ ~21-30KB
      expect(totalSize).toBeLessThan(30_000);
    });
  });
});
