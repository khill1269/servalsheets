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
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ============================================================================
// SPECIAL CASE TOOLS (don't follow standard discriminated union pattern)
// ============================================================================

const SPECIAL_CASE_TOOLS: Record<string, { count: number; actions: string[] }> = {
  fix: { count: 1, actions: ['fix'] }, // Single fix action
  validation: { count: 1, actions: ['validate'] },
  impact: { count: 1, actions: ['analyze'] },
  analyze: {
    count: 11,
    actions: [
      'comprehensive',
      'analyze_data',
      'suggest_visualization',
      'generate_formula',
      'detect_patterns',
      'analyze_structure',
      'analyze_quality',
      'analyze_performance',
      'analyze_formulas',
      'query_natural_language',
      'explain_analysis',
    ],
  },
  confirm: {
    count: 5,
    actions: ['request', 'get_stats', 'wizard_start', 'wizard_step', 'wizard_complete'],
  },
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
 * Extract action values from z.enum(['action1', 'action2', ...]) AST node
 * Handles flattened schema pattern with z.object({ action: z.enum([...]) })
 */
function extractActionEnum(node: ts.Node): string[] | null {
  if (ts.isPropertyAssignment(node)) {
    const name = node.name;
    if (ts.isIdentifier(name) && name.text === 'action') {
      // Look for z.enum([...]) pattern
      return findEnumInChain(node.initializer);
    }
  }
  return null;
}

/**
 * Find z.enum(['action1', 'action2']) in a chain of method calls
 */
function findEnumInChain(node: ts.Node): string[] | null {
  if (ts.isCallExpression(node)) {
    const expression = node.expression;

    // Check if this is z.enum(...)
    if (ts.isPropertyAccessExpression(expression)) {
      const property = expression.name;
      if (ts.isIdentifier(property) && property.text === 'enum') {
        const args = node.arguments;
        const firstArg = args[0];
        if (firstArg && ts.isArrayLiteralExpression(firstArg)) {
          // Extract all string literals from the array
          const actions: string[] = [];
          for (const element of firstArg.elements) {
            if (ts.isStringLiteral(element)) {
              actions.push(element.text);
            }
          }
          return actions.length > 0 ? actions : null;
        }
      }

      // Not z.enum, but might be a chained call like .describe()
      const objectPart = expression.expression;
      if (ts.isCallExpression(objectPart)) {
        return findEnumInChain(objectPart);
      }
    }
  }
  return null;
}

/**
 * Extract action literal from z.literal('action_name') AST node
 * Handles chained calls like z.literal('action').describe('...')
 */
function extractActionLiteral(node: ts.Node): string | null {
  // Looking for: action: z.literal('some_action') or action: z.literal('some_action').describe('...')
  if (ts.isPropertyAssignment(node)) {
    const name = node.name;
    if (ts.isIdentifier(name) && name.text === 'action') {
      // Recursively find z.literal() in the initializer chain
      return findLiteralInChain(node.initializer);
    }
  }
  return null;
}

/**
 * Recursively find z.literal('value') in a chain of method calls
 * Handles: z.literal('x'), z.literal('x').describe('y'), z.literal('x').default('y').describe('z'), etc.
 */
function findLiteralInChain(node: ts.Node): string | null {
  if (ts.isCallExpression(node)) {
    const expression = node.expression;

    // Check if this is directly z.literal(...)
    if (ts.isPropertyAccessExpression(expression)) {
      const property = expression.name;
      if (ts.isIdentifier(property) && property.text === 'literal') {
        const args = node.arguments;
        const firstArg = args[0];
        if (firstArg && ts.isStringLiteral(firstArg)) {
          return firstArg.text;
        }
      }

      // Not z.literal, but might be a chained call like .describe()
      // Check the object part of the property access (e.g., z.literal('x') in z.literal('x').describe())
      const objectPart = expression.expression;
      if (ts.isCallExpression(objectPart)) {
        return findLiteralInChain(objectPart);
      }
    }
  }
  return null;
}

/**
 * Recursively visit AST nodes to find action literals or enums
 */
function visitNode(node: ts.Node, actions: string[]): void {
  // Try to extract z.enum() pattern first (flattened schemas)
  const actionEnum = extractActionEnum(node);
  if (actionEnum) {
    actions.push(...actionEnum);
    return; // Found enum, don't look for literals in this subtree
  }

  // Fall back to z.literal() pattern (discriminated unions)
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
  const toolName = fileName.replace('.ts', '').replace(/-/g, '_');

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
    const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);

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

const schemaFiles = readdirSync(join(ROOT, 'src/schemas')).filter(
  (f) =>
    f.endsWith('.ts') &&
    f !== 'index.ts' &&
    f !== 'shared.ts' &&
    f !== 'annotations.ts' &&
    f !== 'descriptions.ts' &&
    f !== 'descriptions-minimal.ts' && // Minimal descriptions, not a tool
    f !== 'prompts.ts' &&
    f !== 'logging.ts' &&
    f !== 'fast-validators.ts' &&
    f !== 'action-metadata.ts' && // Not a tool, just metadata definitions
    f !== 'formulas.ts' && // Merged into sheets_advanced (Wave 5)
    f !== 'analysis.ts' // DEPRECATED: sheets_analyze replaced by sheets_analyze (Phase 1)
);

console.log(`\n📊 Analyzing ${schemaFiles.length} schema files...\n`);

const analyses: SchemaAnalysis[] = [];
let totalActions = 0;

for (const file of schemaFiles) {
  const path = join(ROOT, 'src/schemas', file);
  const analysis = analyzeSchemaFile(path);
  analyses.push(analysis);
  totalActions += analysis.actionCount;

  if (analysis.actionCount > 0) {
    const actionList =
      analysis.actions.length <= 5
        ? `[${analysis.actions.join(', ')}]`
        : `[${analysis.actions.slice(0, 3).join(', ')}, ... +${analysis.actions.length - 3} more]`;
    console.log(
      `  📝 ${file.padEnd(20)} → ${String(analysis.actionCount).padStart(2)} actions ${actionList}`
    );
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

// Update TOOL_COUNT and ACTION_COUNT (matches either static number or dynamic expression)
schemasIndex = schemasIndex.replace(
  /\/\/ Tool count\nexport const TOOL_COUNT = (?:Object\.keys\(TOOL_REGISTRY\)\.length|\d+);/,
  `// Tool count\nexport const TOOL_COUNT = ${TOOL_COUNT};`
);

schemasIndex = schemasIndex.replace(
  /\/\/ Action count\nexport const ACTION_COUNT = (?:Object\.values\(TOOL_REGISTRY\)\.reduce\(\s*\(sum, tool\) => sum \+ tool\.actions\.length,\s*0\s*\)|\d+);/,
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
  .filter((a) => a.actionCount > 0)
  .map((a) => `  sheets_${a.toolName}: ${a.actionCount},`)
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

// Build TOOL_ACTIONS map - always use multi-line for consistency
const toolActionsMap = analyses
  .filter((a) => a.actionCount > 0)
  .map((a) => {
    const actionLines = a.actions.map((act) => `    '${act}',`).join('\n');
    return `  sheets_${a.toolName}: [\n${actionLines}\n  ],`;
  })
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
// Format with Prettier to match codebase style
execSync(`npx prettier --write ${completionsPath}`, { cwd: ROOT, stdio: 'ignore' });
console.log('✅ Updated src/mcp/completions.ts TOOL_ACTIONS');

// ============================================================================
// GENERATE SERVER.JSON
// ============================================================================

const serverJson = {
  name: pkg.mcpName || pkg.name,
  version: pkg.version,
  description: `Production-grade Google Sheets MCP server with ${TOOL_COUNT} tools and ${ACTION_COUNT} actions`,
  icons: [
    {
      src: 'https://raw.githubusercontent.com/khill1269/servalsheets/main/assets/serval-icon.png',
      mimeType: 'image/png',
      sizes: ['1536x1024'],
    },
  ],
  mcpProtocol: '2025-11-25',
  packages: [],
  tools: [],
  capabilities: [
    'tools',
    'resources',
    'prompts',
    'logging',
    'completions',
    'tasks',
    'elicitation',
    'sampling',
  ],
  metadata: {
    toolCount: TOOL_COUNT,
    actionCount: ACTION_COUNT,
    categories: [
      'Core Operations (5 tools): auth, core, data, format, dimensions',
      'Visualizations (1 tool): visualize',
      'Collaboration (1 tool): collaborate',
      'Advanced Features (1 tool): advanced',
      'Workflow & Safety (3 tools): transaction, quality, history',
      'MCP-Native Intelligence (3 tools): confirm (Elicitation), analyze (Sampling), fix (Automated)',
      'Productivity (2 tools): composite, session',
      'Enterprise (3 tools): templates, bigquery, appsscript',
    ],
  },
  author: {
    name: 'Thomas Lee Cahill',
    url: 'https://github.com/khill1269',
  },
  repository: {
    type: 'git',
    url: 'https://github.com/khill1269/servalsheets',
    source: 'https://github.com/khill1269/servalsheets',
  },
  homepage: 'https://github.com/khill1269/servalsheets#readme',
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
