/**
 * ServalSheets - Validator Performance Benchmark
 *
 * Compares Zod validation vs Fast validators
 * Run: npx tsx scripts/benchmark-validators.ts
 * 
 * Note: Fast validators use simplified input format (string range)
 * while Zod schemas use full union types. In production, input is
 * normalized before reaching fast validators.
 */

import { performance } from "perf_hooks";

// Import Zod schemas
import {
  SheetsValuesInputSchema,
  SheetSpreadsheetInputSchema,
  SheetsSheetInputSchema,
} from "../src/schemas/index.js";

// Import fast validators
import {
  fastValidateValues,
  fastValidateSpreadsheet,
  fastValidateSheet,
} from "../src/schemas/fast-validators.js";

const ITERATIONS = 10000;

// Test data for Zod (uses full schema with object range)
const zodValuesReadInput = {
  action: "read",
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  range: { a1: "Sheet1!A1:D10" },
};

const zodValuesWriteInput = {
  action: "write",
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  range: { a1: "Sheet1!A1:B2" },
  values: [["A", "B"], [1, 2]],
};

// Test data for Fast validators (uses normalized string range)
const fastValuesReadInput = {
  action: "read",
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  range: "Sheet1!A1:D10",
};

const fastValuesWriteInput = {
  action: "write",
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  range: "Sheet1!A1:B2",
  values: [["A", "B"], [1, 2]],
};

// Common test data (same format for both)
const spreadsheetGetInput = {
  action: "get",
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
};

const sheetListInput = {
  action: "list",
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
};

function benchmark(name: string, fn: () => void): number {
  // Warmup
  for (let i = 0; i < 100; i++) fn();

  // Benchmark
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) fn();
  const end = performance.now();

  const totalMs = end - start;
  const avgUs = (totalMs / ITERATIONS) * 1000;
  return avgUs;
}

console.log("ServalSheets Validator Performance Benchmark");
console.log("============================================");
console.log(`Iterations: ${ITERATIONS.toLocaleString()}\n`);

// Values schema benchmarks
console.log("📊 sheets_values (read):");
const zodValuesRead = benchmark("Zod", () => SheetsValuesInputSchema.parse(zodValuesReadInput));
const fastValuesRead = benchmark("Fast", () => fastValidateValues(fastValuesReadInput));
console.log(`  Zod:  ${zodValuesRead.toFixed(2)} μs/op`);
console.log(`  Fast: ${fastValuesRead.toFixed(2)} μs/op`);
console.log(`  Speedup: ${(zodValuesRead / fastValuesRead).toFixed(1)}x\n`);

console.log("📊 sheets_values (write):");
const zodValuesWrite = benchmark("Zod", () => SheetsValuesInputSchema.parse(zodValuesWriteInput));
const fastValuesWrite = benchmark("Fast", () => fastValidateValues(fastValuesWriteInput));
console.log(`  Zod:  ${zodValuesWrite.toFixed(2)} μs/op`);
console.log(`  Fast: ${fastValuesWrite.toFixed(2)} μs/op`);
console.log(`  Speedup: ${(zodValuesWrite / fastValuesWrite).toFixed(1)}x\n`);

// Spreadsheet schema benchmarks
console.log("📊 sheets_spreadsheet (get):");
const zodSpreadsheet = benchmark("Zod", () => SheetSpreadsheetInputSchema.parse(spreadsheetGetInput));
const fastSpreadsheet = benchmark("Fast", () => fastValidateSpreadsheet(spreadsheetGetInput));
console.log(`  Zod:  ${zodSpreadsheet.toFixed(2)} μs/op`);
console.log(`  Fast: ${fastSpreadsheet.toFixed(2)} μs/op`);
console.log(`  Speedup: ${(zodSpreadsheet / fastSpreadsheet).toFixed(1)}x\n`);

// Sheet schema benchmarks
console.log("📊 sheets_sheet (list):");
const zodSheet = benchmark("Zod", () => SheetsSheetInputSchema.parse(sheetListInput));
const fastSheet = benchmark("Fast", () => fastValidateSheet(sheetListInput));
console.log(`  Zod:  ${zodSheet.toFixed(2)} μs/op`);
console.log(`  Fast: ${fastSheet.toFixed(2)} μs/op`);
console.log(`  Speedup: ${(zodSheet / fastSheet).toFixed(1)}x\n`);

// Summary
const avgZod = (zodValuesRead + zodValuesWrite + zodSpreadsheet + zodSheet) / 4;
const avgFast = (fastValuesRead + fastValuesWrite + fastSpreadsheet + fastSheet) / 4;
console.log("============================================");
console.log("Summary:");
console.log(`  Average Zod:  ${avgZod.toFixed(2)} μs/op`);
console.log(`  Average Fast: ${avgFast.toFixed(2)} μs/op`);
console.log(`  Overall Speedup: ${(avgZod / avgFast).toFixed(1)}x`);
console.log(`  Time saved per 1000 calls: ${((avgZod - avgFast)).toFixed(1)} ms`);
console.log("\nNote: Fast validators use simplified/normalized input format.");
console.log("In production, input is normalized before fast validation.");
