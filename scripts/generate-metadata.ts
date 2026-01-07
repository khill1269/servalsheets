#!/usr/bin/env tsx
/**
 * Generate metadata from schema files using AST parsing
 *
 * Single source of truth: src/schemas/*.ts discriminated unions
 * Derived outputs:
 * - Tool/action counts
 * - package.json description
 * - src/schemas/index.ts exports
 * - src/schemas/annotations.ts ACTION_COUNTS
 * - src/mcp/completions.ts TOOL_ACTIONS
 * - server.json metadata
 *
 * Uses TypeScript Compiler API for robust AST parsing instead of regex.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ============================================================================
// SPECIAL CASE TOOLS (don't follow standard discriminated union pattern)
// ============================================================================

const SPECIAL_CASE_TOOLS: Record<string, { count: number; actions: string[] }> = {
  'fix': { count: 0, actions: [] },  // Single request mode, no actions
  'validation': { count: 1, actions: ['validate'] },
  'impact': { count: 1, actions: ['analyze'] },
  'analyze': { count: 4, actions: ['analyze', 'generate_formula', 'suggest_chart', 'get_stats'] },
  'confirm': { count: 2, actions: ['request', 'get_stats'] },
};

// ============================================================================
// AST-BASED ACTION EXTRACTION
// ============================================================================

interface SchemaAnalysis {
  toolName: string;
  fileName: string;
  actionCount: number;
  actions: string[];
  hasDiscriminatedUnion: boolean;
}

/**
 * Extract action literal from z.literal('action_name') AST node
 */
function extractActionLiteral(node: ts.Node): string | null {
  // Looking for: action: z.literal('some_action')
  if (ts.isPropertyAssignment(node)) {
    const name = node.name;
    if (ts.isIdentifier(name) && name.text === 'action') {
      const initializer = node.initializer;
      // Handle z.literal('action')
      if (ts.isCallExpression(initializer)) {
        // Check if it's specifically z.literal() call
        const expression = initializer.expression;
        if (ts.isPropertyAccessExpression(expression)) {
          const property = expression.name;
          if (ts.isIdentifier(property) && property.text === 'literal') {
            const args = initializer.arguments;
            if (args.length > 0 && ts.isStringLiteral(args[0])) {
              return args[0].text;
            }
          }
        }
      }
    }
  }
  return null;
}

/**
 * Recursively visit AST nodes to find action literals
 */
function visitNode(node: ts.Node, actions: string[]): void {
  const actionLiteral = extractActionLiteral(node);
  if (actionLiteral) {
    actions.push(actionLiteral);
  }

  ts.forEachChild(node, (child) => visitNode(child, actions));
}

/**
 * Analyze a schema file using TypeScript AST parsing
 */
function analyzeSchemaFile(filePath: string): SchemaAnalysis {
  const fileName = filePath.split('/').pop() || '';
  const toolName = fileName.replace('.ts', '');

  // Check for special cases first
  if (SPECIAL_CASE_TOOLS[toolName]) {
    const special = SPECIAL_CASE_TOOLS[toolName];
    return {
      toolName,
      fileName,
      actionCount: special.count,
      actions: special.actions,
      hasDiscriminatedUnion: false,
    };
  }

  try {
    const content = readFileSync(filePath, 'utf-8');

    // Create a source file (no type checking needed, just parsing)
    const sourceFile = ts.createSourceFile(
      fileName,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const actions: string[] = [];

    // Walk the AST to find all action literals
    visitNode(sourceFile, actions);

    // Remove duplicates (shouldn't happen, but be safe)
    const uniqueActions = Array.from(new Set(actions));

    return {
      toolName,
      fileName,
      actionCount: uniqueActions.length,
      actions: uniqueActions,
      hasDiscriminatedUnion: uniqueActions.length > 0,
    };
  } catch (error) {
    console.error(`⚠️  Error parsing ${fileName}:`, error);
    return {
      toolName,
      fileName,
      actionCount: 0,
      actions: [],
      hasDiscriminatedUnion: false,
    };
  }
}

// ============================================================================
// SCAN SCHEMA FILES
// ============================================================================

const schemaFiles = readdirSync(join(ROOT, 'src/schemas'))
  .filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'shared.ts' && f !== 'annotations.ts' && f !== 'descriptions.ts' && f !== 'prompts.ts' && f !== 'logging.ts');

console.log(`\n📊 Analyzing ${schemaFiles.length} schema files...\n`);

const analyses: SchemaAnalysis[] = [];
let totalActions = 0;

for (const file of schemaFiles) {
  const path = join(ROOT, 'src/schemas', file);
  const analysis = analyzeSchemaFile(path);
  analyses.push(analysis);
  totalActions += analysis.actionCount;

  if (analysis.actionCount > 0) {
    const actionList = analysis.actions.length <= 5
      ? `[${analysis.actions.join(', ')}]`
      : `[${analysis.actions.slice(0, 3).join(', ')}, ... +${analysis.actions.length - 3} more]`;
    console.log(`  📝 ${file.padEnd(20)} → ${String(analysis.actionCount).padStart(2)} actions ${actionList}`);
  }
}

const TOOL_COUNT = analyses.length;
const ACTION_COUNT = totalActions;

console.log(`\n✅ Total: ${TOOL_COUNT} tools, ${ACTION_COUNT} actions\n`);

// ============================================================================
// UPDATE PACKAGE.JSON
// ============================================================================

const pkgPath = join(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

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

// Update TOOL_COUNT and ACTION_COUNT in TOOL_REGISTRY calculation
schemasIndex = schemasIndex.replace(
  /\/\/ Tool count\nexport const TOOL_COUNT = Object\.keys\(TOOL_REGISTRY\)\.length;/,
  `// Tool count\nexport const TOOL_COUNT = ${TOOL_COUNT};`
);

schemasIndex = schemasIndex.replace(
  /\/\/ Action count\nexport const ACTION_COUNT = Object\.values\(TOOL_REGISTRY\)\.reduce\(\s*\(sum, tool\) => sum \+ tool\.actions\.length,\s*0\s*\);/,
  `// Action count\nexport const ACTION_COUNT = ${ACTION_COUNT};`
);

writeFileSync(schemasIndexPath, schemasIndex);
console.log('✅ Updated src/schemas/index.ts constants');

// ============================================================================
// UPDATE SRC/SCHEMAS/ANNOTATIONS.TS - ACTION_COUNTS
// ============================================================================

const annotationsPath = join(ROOT, 'src/schemas/annotations.ts');
let annotationsContent = readFileSync(annotationsPath, 'utf-8');

// Build ACTION_COUNTS map
const actionCountsMap = analyses
  .filter(a => a.actionCount > 0)
  .map(a => `  sheets_${a.toolName}: ${a.actionCount},`)
  .join('\n');

const actionCountsBlock = `export const ACTION_COUNTS = {\n${actionCountsMap}\n} as const;`;

// Replace existing ACTION_COUNTS or add it
if (annotationsContent.includes('export const ACTION_COUNTS')) {
  annotationsContent = annotationsContent.replace(
    /export const ACTION_COUNTS = \{[\s\S]*?\} as const;/,
    actionCountsBlock
  );
} else {
  annotationsContent += `\n\n// ============================================================================\n// ACTION COUNTS (Auto-generated)\n// ============================================================================\n\n${actionCountsBlock}\n`;
}

writeFileSync(annotationsPath, annotationsContent);
console.log('✅ Updated src/schemas/annotations.ts ACTION_COUNTS');

// ============================================================================
// UPDATE SRC/MCP/COMPLETIONS.TS - TOOL_ACTIONS
// ============================================================================

const completionsPath = join(ROOT, 'src/mcp/completions.ts');
let completionsContent = readFileSync(completionsPath, 'utf-8');

// Build TOOL_ACTIONS map
const toolActionsMap = analyses
  .filter(a => a.actionCount > 0)
  .map(a => `  sheets_${a.toolName}: [${a.actions.map(act => `'${act}'`).join(', ')}],`)
  .join('\n');

const toolActionsBlock = `const TOOL_ACTIONS: Record<string, string[]> = {\n${toolActionsMap}\n};`;

// Replace existing TOOL_ACTIONS
if (completionsContent.includes('const TOOL_ACTIONS')) {
  completionsContent = completionsContent.replace(
    /const TOOL_ACTIONS: Record<string, string\[\]> = \{[\s\S]*?\};/,
    toolActionsBlock
  );
} else {
  // Add after imports
  const importEndIndex = completionsContent.lastIndexOf('import ');
  const nextLineIndex = completionsContent.indexOf('\n', importEndIndex) + 1;
  completionsContent =
    completionsContent.slice(0, nextLineIndex) +
    `\n// ============================================================================\n// TOOL ACTIONS (Auto-generated)\n// ============================================================================\n\n${toolActionsBlock}\n\n` +
    completionsContent.slice(nextLineIndex);
}

writeFileSync(completionsPath, completionsContent);
console.log('✅ Updated src/mcp/completions.ts TOOL_ACTIONS');

// ============================================================================
// GENERATE SERVER.JSON
// ============================================================================

const serverJson = {
  name: pkg.mcpName || pkg.name,
  version: pkg.version,
  description: `Production-grade Google Sheets MCP server with ${TOOL_COUNT} tools and ${ACTION_COUNT} actions`,
  mcpProtocol: "2025-11-25",
  packages: [],
  tools: [],
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
      "MCP-Native (3 tools): confirm (Elicitation), analyze (Sampling), fix (Automated)"
    ]
  },
  author: {
    name: "Thomas Lee Cahill",
    url: "https://github.com/khill1269"
  },
  repository: {
    type: "git",
    url: "https://github.com/khill1269/servalsheets",
    source: "https://github.com/khill1269/servalsheets"
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
║  ✓ src/schemas/annotations.ts          ║
║  ✓ src/mcp/completions.ts              ║
║  ✓ server.json                         ║
╚════════════════════════════════════════╝
`);

process.exit(0);
