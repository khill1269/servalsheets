#!/usr/bin/env tsx
/**
 * Validate TOOL_REGISTRY actions match schema definitions
 */

import { readFileSync } from "fs";
import { join } from "path";

// Read TOOL_REGISTRY from index.ts
const indexPath = join(process.cwd(), "src/schemas/index.ts");
const indexContent = readFileSync(indexPath, "utf-8");

// Extract TOOL_REGISTRY
const registryMatch = indexContent.match(
  /export const TOOL_REGISTRY = \{([\s\S]*?)\} as const;/
);
if (!registryMatch) {
  console.error("❌ Could not find TOOL_REGISTRY");
  process.exit(1);
}

// Parse actions from registry
const registry: Record<string, string[]> = {};
const toolMatches = registryMatch[1].matchAll(
  /(\w+): \{[\s\S]*?actions: \[([\s\S]*?)\]/g
);

for (const match of toolMatches) {
  const toolName = match[1];
  const actionsStr = match[2];
  const actions = actionsStr
    .split(",")
    .map((a) => a.trim().replace(/['"]/g, ""))
    .filter((a) => a.length > 0);
  registry[toolName] = actions;
}

console.log("📊 Found tools in TOOL_REGISTRY:", Object.keys(registry).length);

// Now extract actions from each schema file
const schemaFiles = [
  "auth.ts",
  "spreadsheet.ts",
  "sheet.ts",
  "values.ts",
  "cells.ts",
  "format.ts",
  "dimensions.ts",
  "rules.ts",
  "charts.ts",
  "pivot.ts",
  "filter-sort.ts",
  "sharing.ts",
  "comments.ts",
  "versions.ts",
  "analysis.ts",
  "advanced.ts",
  "transaction.ts",
  "validation.ts",
  "conflict.ts",
  "impact.ts",
  "history.ts",
  "confirm.ts",
  "analyze.ts",
  "fix.ts",
  "macros.ts",
  "custom-functions.ts",
];

const schemaActions: Record<string, string[]> = {};

for (const file of schemaFiles) {
  const schemaPath = join(process.cwd(), "src/schemas", file);
  try {
    const content = readFileSync(schemaPath, "utf-8");

    // Extract actions from z.literal("action_name") - handles multi-line
    // Pattern matches various formats:
    // - action: z.literal("name")
    // - action: z\n      .literal("name")
    // - action:\n    z.literal("name")
    const actionMatches = content.matchAll(
      /action:\s*z(?:\s*\n\s*)?\.literal\("(\w+)"\)/g
    );
    const actions = Array.from(actionMatches, (m) => m[1]);

    // Infer tool name from file
    const toolName = `sheets_${file.replace(".ts", "").replace(/-/g, "_")}`;
    schemaActions[toolName] = [...new Set(actions)].sort();
  } catch (_error) {
    // File might not exist or might be a different structure
  }
}

console.log("📊 Found schemas with actions:", Object.keys(schemaActions).length);
console.log("");

// Compare
let hasErrors = false;
const allTools = new Set([
  ...Object.keys(registry),
  ...Object.keys(schemaActions),
]);

for (const tool of Array.from(allTools).sort()) {
  const registryActions = registry[tool] || [];
  const schemaActionsList = schemaActions[tool] || [];

  // Check for mismatches
  const missing = schemaActionsList.filter(
    (a) => !registryActions.includes(a)
  );
  const extra = registryActions.filter((a) => !schemaActionsList.includes(a));

  if (missing.length > 0 || extra.length > 0) {
    console.log(`❌ ${tool}:`);
    if (missing.length > 0) {
      console.log(
        `   Missing in TOOL_REGISTRY: ${missing.join(", ")}`
      );
    }
    if (extra.length > 0) {
      console.log(
        `   Extra in TOOL_REGISTRY (not in schema): ${extra.join(", ")}`
      );
    }
    hasErrors = true;
  } else if (registryActions.length > 0) {
    console.log(`✅ ${tool} (${registryActions.length} actions)`);
  }
}

if (hasErrors) {
  console.log("");
  console.log("❌ TOOL_REGISTRY validation FAILED");
  process.exit(1);
} else {
  console.log("");
  console.log("✅ All tools have correct actions in TOOL_REGISTRY");
  process.exit(0);
}
