/**
 * ServalSheets - Optimization Benchmark
 *
 * Measures performance improvements from:
 * 1. Fast validators vs full Zod parsing
 * 2. Hot cache vs cold cache
 */

import { performance } from "perf_hooks";

// Import fast validators
import {
  fastValidateValues,
  fastValidateSpreadsheet,
  fastValidateSheet,
  FastValidationError,
} from "../dist/schemas/fast-validators.js";

// Import Zod schemas
import {
  SheetsValuesInputSchema,
  SheetSpreadsheetInputSchema,
  SheetsSheetInputSchema,
} from "../dist/schemas/index.js";

// Import cache
import { getHotCache } from "../dist/utils/hot-cache.js";

// ============================================================================
// TEST DATA
// ============================================================================

const validValuesInput = {
  action: "read",
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  range: "Sheet1!A1:D100",
};

const validSpreadsheetInput = {
  action: "get",
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
};

const validSheetInput = {
  action: "add",
  spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  title: "New Sheet",
};

const invalidInput = {
  action: "invalid_action",
  spreadsheetId: "bad",
};

// ============================================================================
// BENCHMARK HELPERS
// ============================================================================

function benchmark(name: string, fn: () => void, iterations: number = 10000): { name: string; avgNs: number; totalMs: number } {
  // Warmup
  for (let i = 0; i < 100; i++) {
    try { fn(); } catch {}
  }

  // Measure
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    try { fn(); } catch {}
  }
  const end = performance.now();

  const totalMs = end - start;
  const avgNs = (totalMs * 1_000_000) / iterations;

  return { name, avgNs, totalMs };
}

function formatResult(result: { name: string; avgNs: number; totalMs: number }): string {
  const avgStr = result.avgNs < 1000 
    ? `${result.avgNs.toFixed(0)}ns` 
    : result.avgNs < 1_000_000
      ? `${(result.avgNs / 1000).toFixed(2)}μs`
      : `${(result.avgNs / 1_000_000).toFixed(2)}ms`;
  return `${result.name.padEnd(40)} ${avgStr.padStart(10)} (${result.totalMs.toFixed(2)}ms total)`;
}

// ============================================================================
// BENCHMARKS
// ============================================================================

console.log("\n🔬 ServalSheets Optimization Benchmark\n");
console.log("=".repeat(70));

// Validation Benchmarks
console.log("\n📋 VALIDATION BENCHMARKS (10,000 iterations)\n");

const results: Array<{ name: string; avgNs: number; totalMs: number }> = [];

// Fast validators
results.push(benchmark("Fast: validateValues (valid)", () => {
  fastValidateValues(validValuesInput);
}));

results.push(benchmark("Fast: validateSpreadsheet (valid)", () => {
  fastValidateSpreadsheet(validSpreadsheetInput);
}));

results.push(benchmark("Fast: validateSheet (valid)", () => {
  fastValidateSheet(validSheetInput);
}));

results.push(benchmark("Fast: validateValues (invalid)", () => {
  fastValidateValues(invalidInput);
}));

// Zod schemas
results.push(benchmark("Zod: SheetsValuesInputSchema (valid)", () => {
  SheetsValuesInputSchema.parse(validValuesInput);
}));

results.push(benchmark("Zod: SheetSpreadsheetInputSchema (valid)", () => {
  SheetSpreadsheetInputSchema.parse(validSpreadsheetInput);
}));

results.push(benchmark("Zod: SheetsSheetInputSchema (valid)", () => {
  SheetsSheetInputSchema.parse(validSheetInput);
}));

results.push(benchmark("Zod: SheetsValuesInputSchema (invalid)", () => {
  SheetsValuesInputSchema.parse(invalidInput);
}));

// Print validation results
for (const result of results) {
  console.log(formatResult(result));
}

// Calculate improvement
const fastValid = results.find(r => r.name.includes("Fast: validateValues (valid)"));
const zodValid = results.find(r => r.name.includes("Zod: SheetsValuesInputSchema (valid)"));

if (fastValid && zodValid) {
  const improvement = zodValid.avgNs / fastValid.avgNs;
  console.log(`\n⚡ Fast validators are ${improvement.toFixed(1)}x faster than Zod for valid inputs`);
}

// Cache Benchmarks
console.log("\n\n📦 CACHE BENCHMARKS (100,000 iterations)\n");

const hotCache = getHotCache();

// Populate cache
for (let i = 0; i < 100; i++) {
  hotCache.set(`key-${i}`, { data: `value-${i}`, nested: { a: 1, b: 2 } });
}

const cacheResults: Array<{ name: string; avgNs: number; totalMs: number }> = [];

cacheResults.push(benchmark("Hot cache: get (hit)", () => {
  hotCache.get("key-50");
}, 100000));

cacheResults.push(benchmark("Hot cache: get (miss)", () => {
  hotCache.get("nonexistent-key");
}, 100000));

cacheResults.push(benchmark("Hot cache: set (update)", () => {
  hotCache.set("key-50", { data: "updated" });
}, 100000));

cacheResults.push(benchmark("Hot cache: set (new)", () => {
  hotCache.set(`new-key-${Math.random()}`, { data: "new" });
}, 100000));

for (const result of cacheResults) {
  console.log(formatResult(result));
}

// Stats
console.log("\n\n📊 HOT CACHE STATS\n");
const stats = hotCache.getStats();
console.log(`Hot tier size:    ${stats.hotTierSize}`);
console.log(`Warm tier size:   ${stats.warmTierSize}`);
console.log(`Hot hits:         ${stats.hotHits}`);
console.log(`Warm hits:        ${stats.warmHits}`);
console.log(`Misses:           ${stats.misses}`);
console.log(`Hit rate:         ${(stats.hitRate * 100).toFixed(1)}%`);
console.log(`Promotions:       ${stats.promotions}`);
console.log(`Demotions:        ${stats.demotions}`);
console.log(`Memory:           ${(stats.totalMemoryBytes / 1024).toFixed(1)} KB`);

console.log("\n" + "=".repeat(70));
console.log("✅ Benchmark complete\n");
