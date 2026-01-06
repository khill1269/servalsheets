#!/usr/bin/env tsx
/**
 * Generate metadata from canonical TOOL_DEFINITIONS
 *
 * Single source of truth: src/mcp/registration.ts TOOL_DEFINITIONS
 * Derived outputs:
 * - Tool/action counts
 * - package.json description
 * - src/schemas/index.ts exports
 * - server.json metadata
 *
 * This prevents drift between source code and metadata.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ============================================================================
// IMPORT TOOL DEFINITIONS (Source of Truth)
// ============================================================================

// We'll parse the TypeScript file directly to avoid circular dependencies
// and to work before the build step
const registrationContent = readFileSync(
  join(ROOT, 'src/mcp/registration.ts'),
  'utf-8'
);

// Extract tool count from the export const TOOL_DEFINITIONS array
const toolMatch = registrationContent.match(/export const TOOL_DEFINITIONS.*?\[([\s\S]*?)\] as const;/);
if (!toolMatch) {
  console.error('❌ Could not find TOOL_DEFINITIONS in registration.ts');
  process.exit(1);
}

// Count tool definitions by counting opening braces at the start of tool objects
// Each tool starts with "  {\n    name:"
const toolDefSection = toolMatch[1];
const toolDefinitions = toolDefSection.match(/\{\s*name:\s*['"][\w_]+['"]/g) || [];
const TOOL_COUNT = toolDefinitions.length;

console.log(`📊 Found ${TOOL_COUNT} tool definitions`);

// ============================================================================
// COUNT ACTIONS
// ============================================================================

/**
 * Count actions by analyzing schema files
 * Each discriminated union option = 1 action
 */
function countActionsInSchema(schemaPath: string): number {
  try {
    const content = readFileSync(schemaPath, 'utf-8');

    // Match discriminated union definitions
    // Pattern: z.discriminatedUnion('action', [...])
    const unionMatches = content.match(/z\.discriminatedUnion\(['"]action['"],\s*\[([\s\S]*?)\]\)/g);

    if (!unionMatches) {
      return 0;
    }

    let actionCount = 0;
    for (const match of unionMatches) {
      // Count z.object({ action: z.literal('...') }) patterns
      const literals = match.match(/action:\s*z\.literal\(['"][\w_]+['"]\)/g);
      if (literals) {
        actionCount += literals.length;
      }
    }

    return actionCount;
  } catch {
    return 0;
  }
}

// Scan all schema files
const schemaFiles = [
  'auth.ts', 'spreadsheet.ts', 'sheet.ts', 'values.ts', 'cells.ts',
  'format.ts', 'dimensions.ts', 'rules.ts', 'charts.ts', 'pivot.ts',
  'filter-sort.ts', 'sharing.ts', 'comments.ts', 'versions.ts',
  'analysis.ts', 'advanced.ts', 'transaction.ts', 'validation.ts',
  'conflict.ts', 'impact.ts', 'history.ts', 'confirm.ts', 'analyze.ts'
];

let ACTION_COUNT = 0;
for (const file of schemaFiles) {
  const path = join(ROOT, 'src/schemas', file);
  const count = countActionsInSchema(path);
  if (count > 0) {
    console.log(`  📝 ${file.padEnd(20)} → ${count} actions`);
    ACTION_COUNT += count;
  }
}

console.log(`\n✅ Total: ${TOOL_COUNT} tools, ${ACTION_COUNT} actions\n`);

// ============================================================================
// UPDATE PACKAGE.JSON
// ============================================================================

const pkgPath = join(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

// Update description with correct counts
const oldDescription = pkg.description;
pkg.description = oldDescription.replace(
  /\d+ tools, \d+ actions/,
  `${TOOL_COUNT} tools, ${ACTION_COUNT} actions`
);

if (oldDescription !== pkg.description) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('✅ Updated package.json description');
} else {
  console.log('✓  package.json already up to date');
}

// ============================================================================
// UPDATE SRC/SCHEMAS/INDEX.TS
// ============================================================================

const schemasIndexPath = join(ROOT, 'src/schemas/index.ts');
let schemasIndex = readFileSync(schemasIndexPath, 'utf-8');

// Check if constants already exist
if (schemasIndex.includes('export const TOOL_COUNT')) {
  // Replace existing values
  schemasIndex = schemasIndex.replace(
    /export const TOOL_COUNT = \d+;/,
    `export const TOOL_COUNT = ${TOOL_COUNT};`
  );
  schemasIndex = schemasIndex.replace(
    /export const ACTION_COUNT = \d+;/,
    `export const ACTION_COUNT = ${ACTION_COUNT};`
  );
  console.log('✅ Updated src/schemas/index.ts constants');
} else {
  // Append constants at the end
  schemasIndex += `\n// ============================================================================
// METADATA (Auto-generated - do not edit manually)
// ============================================================================

/**
 * Total number of tools in ServalSheets
 * Generated from TOOL_DEFINITIONS in src/mcp/registration.ts
 */
export const TOOL_COUNT = ${TOOL_COUNT};

/**
 * Total number of actions across all tools
 * Generated by counting discriminated union options in schemas
 */
export const ACTION_COUNT = ${ACTION_COUNT};
`;
  console.log('✅ Added constants to src/schemas/index.ts');
}

writeFileSync(schemasIndexPath, schemasIndex);

// ============================================================================
// GENERATE SERVER.JSON
// ============================================================================

const serverJson = {
  name: "servalsheets",
  version: pkg.version,
  description: `Production-grade Google Sheets MCP server with ${TOOL_COUNT} tools and ${ACTION_COUNT} actions`,
  mcpProtocol: "2025-11-25",
  capabilities: [
    "tools",
    "resources",
    "prompts",
    "logging",
    "completions",
    "tasks",
    "elicitation",
    "sampling"
  ],
  metadata: {
    toolCount: TOOL_COUNT,
    actionCount: ACTION_COUNT,
    categories: [
      "Core Operations (8 tools): spreadsheet, sheet, values, cells, format, dimensions, rules, charts",
      "Advanced Features (5 tools): pivot, filter_sort, sharing, comments, versions",
      "Analytics (2 tools): analysis, advanced",
      "Enterprise (5 tools): transaction, validation, conflict, impact, history",
      "MCP-Native (2 tools): confirm (Elicitation), analyze (Sampling)"
    ]
  },
  author: {
    name: "Thomas Lee Cahill",
    url: "https://github.com/khill1269"
  },
  repository: {
    type: "git",
    url: "https://github.com/khill1269/servalsheets"
  },
  homepage: "https://github.com/khill1269/servalsheets#readme"
};

const serverJsonPath = join(ROOT, 'server.json');
writeFileSync(serverJsonPath, JSON.stringify(serverJson, null, 2) + '\n');
console.log('✅ Generated server.json');

// ============================================================================
// SUMMARY
// ============================================================================

console.log(`
╔════════════════════════════════════════╗
║  Metadata Generation Complete          ║
╠════════════════════════════════════════╣
║  Tools:   ${String(TOOL_COUNT).padStart(3)}                         ║
║  Actions: ${String(ACTION_COUNT).padStart(3)}                         ║
║                                        ║
║  Updated:                              ║
║  ✓ package.json                        ║
║  ✓ src/schemas/index.ts                ║
║  ✓ server.json                         ║
╚════════════════════════════════════════╝
`);

process.exit(0);
