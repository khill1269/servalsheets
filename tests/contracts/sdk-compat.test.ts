/**
 * SDK Zod compatibility contracts.
 *
 * These tests lock in the current SDK behavior so upgrades surface drift.
 */

import { describe, it, expect } from "vitest";
import { normalizeObjectSchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import {
  SheetSpreadsheetInputSchema,
  SheetsValuesInputSchema,
} from "../../src/schemas/index.js";

describe("SDK Zod compatibility", () => {
  it("normalizeObjectSchema recognizes z.object schemas", () => {
    const normalized = normalizeObjectSchema(SheetSpreadsheetInputSchema);
    expect(normalized).toBeTruthy();
  });

  it("normalizeObjectSchema skips discriminated unions (current SDK limitation)", () => {
    const normalized = normalizeObjectSchema(SheetsValuesInputSchema);
    expect(normalized).toBeUndefined();
  });

  it("toJsonSchemaCompat emits oneOf for discriminated unions", () => {
    const jsonSchema = toJsonSchemaCompat(SheetsValuesInputSchema, {
      target: "jsonSchema7",
      pipeStrategy: "input",
      strictUnions: true,
    });

    expect(Array.isArray(jsonSchema.oneOf)).toBe(true);
    expect(jsonSchema.oneOf.length).toBeGreaterThan(0);
  });
});
