#!/usr/bin/env tsx
/**
 * Contract Diff: Zod Schema-to-Handler Field Drift Analysis (Issue #221, C-1)
 *
 * Uses ts-morph to detect drift between Zod schema field declarations and handler
 * implementations, surfacing two categories:
 *
 *   declared-but-unused  — schema declares a field no handler reads (dead schema, warn)
 *   used-but-undeclared  — handler reads a field absent from schema (runtime error risk, fail)
 *
 * Usage:
 *   npm run verify:contracts              # CI gate (exits 1 on any used-but-undeclared)
 *   npx tsx scripts/contract-diff.ts      # same
 *   npx tsx scripts/contract-diff.ts --warn-only   # exit 0 even with errors
 *   npx tsx scripts/contract-diff.ts --json        # machine-readable JSON output
 *   npx tsx scripts/contract-diff.ts --tool history # restrict to one tool
 *
 * CI gate: 0 used-but-undeclared tolerated; declared-but-unused is warning only.
 *
 * @see https://github.com/khill1269/servalsheets/issues/221
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Project, SyntaxKind, type SourceFile, type Node } from 'ts-morph';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const WARN_ONLY = args.includes('--warn-only');
const JSON_OUTPUT = args.includes('--json');
const toolFilter = (() => {
  const idx = args.indexOf('--tool');
  return idx !== -1 ? args[idx + 1] : undefined;
})();

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActionDiff {
  tool: string;
  action: string;
  schemaFields: string[];
  handlerFields: string[];
  declaredButUnused: string[];
  usedButUndeclared: string[];
}

interface ToolResult {
  tool: string;
  actions: ActionDiff[];
  schemaFile: string;
  handlerDir: string;
}

// ─── Tool definitions ────────────────────────────────────────────────────────

/** Maps schema filename (without .ts) to handler directory / file. */
const TOOLS: Array<{ schema: string; handler: string }> = [
  { schema: 'advanced', handler: 'src/handlers/advanced-actions' },
  { schema: 'analyze', handler: 'src/handlers/analyze-actions' },
  { schema: 'appsscript', handler: 'src/handlers/appsscript-actions' },
  { schema: 'auth', handler: 'src/handlers/auth-actions' },
  { schema: 'bigquery', handler: 'src/handlers/bigquery.ts' },
  { schema: 'collaborate', handler: 'src/handlers/collaborate-actions' },
  { schema: 'composite', handler: 'src/handlers/composite-actions' },
  { schema: 'compute', handler: 'src/handlers/compute-actions' },
  { schema: 'connectors', handler: 'src/handlers/connectors-actions' },
  { schema: 'core', handler: 'src/handlers/core-actions' },
  { schema: 'data', handler: 'src/handlers/data-actions' },
  { schema: 'dependencies', handler: 'src/handlers/dependencies-actions' },
  { schema: 'dimensions', handler: 'src/handlers/dimensions-actions' },
  { schema: 'fix', handler: 'src/handlers/fix-actions' },
  { schema: 'format', handler: 'src/handlers/format-actions' },
  { schema: 'history', handler: 'src/handlers/history-actions' },
  { schema: 'quality', handler: 'src/handlers/quality.ts' },
  { schema: 'session', handler: 'src/handlers/session-actions' },
  { schema: 'templates', handler: 'src/handlers/templates-actions' },
  { schema: 'visualize', handler: 'src/handlers/visualize-actions' },
  { schema: 'webhook', handler: 'src/handlers/webhook-actions' },
  { schema: 'agent', handler: 'src/handlers/agent.ts' },
  { schema: 'collaborate', handler: 'src/handlers/collaborate-actions' },
  { schema: 'federation', handler: 'src/handlers/federation.ts' },
  { schema: 'transaction', handler: 'src/handlers/transaction.ts' },
];

/** Fields that come from CommonFieldsSchema in most tools — treated as "always declared". */
const UNIVERSAL_FIELDS = new Set([
  'action',
  'verbosity',
  'safety',
  'spreadsheetId',
  'responseFormat',
  'response_format',
  // Outer wrapper property used by unwrapRequest pattern
  'request',
]);

/**
 * Fields known to exist in shared schemas (SafetyOptionsSchema, etc.) that
 * are not directly declared per-action but may be accessed in handlers.
 */
const SHARED_SCHEMA_FIELDS = new Set([
  'confirmed',
  'dryRun',
  'autoSnapshot',
  'createSnapshot',
  'requireConfirmation',
]);

// ─── ts-morph project ────────────────────────────────────────────────────────

const project = new Project({
  tsConfigFilePath: path.join(PROJECT_ROOT, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
});

// ─── Schema field extraction ─────────────────────────────────────────────────

/**
 * Extract the field names from a Zod object literal (z.object({...}) or .extend({...})).
 * Returns just the property name strings.
 */
function extractObjectLiteralKeys(node: Node): string[] {
  const keys: string[] = [];
  if (node.getKind() !== SyntaxKind.ObjectLiteralExpression) return keys;
  const obj = node.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  for (const prop of obj.getProperties()) {
    if (
      prop.getKind() === SyntaxKind.PropertyAssignment ||
      prop.getKind() === SyntaxKind.ShorthandPropertyAssignment ||
      prop.getKind() === SyntaxKind.MethodDeclaration
    ) {
      const name = prop.getChildAtIndex(0).getText().replace(/^['"]|['"]$/g, '');
      if (name && !name.startsWith('_')) {
        keys.push(name);
      }
    }
  }
  return keys;
}

/**
 * Recursively resolve Zod schema fields for a named schema constant.
 * Handles: z.object({...}), SomeBase.extend({...}), SomeBase.merge(...),
 *          SomeBase.pick({...}), SomeBase.omit({...})
 */
function resolveSchemaFields(
  schemaName: string,
  sf: SourceFile,
  visited = new Set<string>()
): Set<string> {
  if (visited.has(schemaName)) return new Set<string>();
  visited.add(schemaName);

  const fields = new Set<string>();

  // Find the variable declaration
  const decl = sf.getVariableDeclaration(schemaName);
  if (!decl) return fields;

  const initializer = decl.getInitializer();
  if (!initializer) return fields;

  const text = initializer.getText();

  // Walk call chain: A.extend({...}).extend({...})
  function walkCallChain(node: Node): void {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const call = node.asKindOrThrow(SyntaxKind.CallExpression);
      const expr = call.getExpression();
      const args = call.getArguments();

      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const pa = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
        const methodName = pa.getName();

        if (methodName === 'object') {
          // z.object({ ... })
          if (args[0]) {
            extractObjectLiteralKeys(args[0]).forEach((k) => fields.add(k));
          }
          return;
        }

        if (methodName === 'extend') {
          // Base.extend({ ... }) — recurse into base, then add extend fields
          walkCallChain(pa.getExpression());
          if (args[0]) {
            extractObjectLiteralKeys(args[0]).forEach((k) => fields.add(k));
          }
          return;
        }

        if (methodName === 'merge') {
          // Base.merge(Other) — recurse into both
          walkCallChain(pa.getExpression());
          if (args[0]) {
            const argName = args[0].getText().trim();
            resolveSchemaFields(argName, sf, visited).forEach((k) => fields.add(k));
          }
          return;
        }

        if (methodName === 'pick') {
          // Base.pick({ field1: true, ... }) — only the listed keys
          walkCallChain(pa.getExpression());
          if (args[0] && args[0].getKind() === SyntaxKind.ObjectLiteralExpression) {
            const picked = extractObjectLiteralKeys(args[0]);
            // Keep only picked fields from what was collected
            for (const f of Array.from(fields)) {
              if (!picked.includes(f)) fields.delete(f);
            }
          }
          return;
        }

        if (methodName === 'omit') {
          // Base.omit({ field1: true, ... }) — remove listed keys
          walkCallChain(pa.getExpression());
          if (args[0] && args[0].getKind() === SyntaxKind.ObjectLiteralExpression) {
            const omitted = extractObjectLiteralKeys(args[0]);
            omitted.forEach((k) => fields.delete(k));
          }
          return;
        }

        // Other methods (optional, describe, default, etc.) — recurse to base
        walkCallChain(pa.getExpression());
        return;
      }

      if (expr.getKind() === SyntaxKind.Identifier) {
        // Direct identifier — could be a reference to another schema
        const refName = expr.getText();
        resolveSchemaFields(refName, sf, visited).forEach((k) => fields.add(k));
        return;
      }
    }

    if (node.getKind() === SyntaxKind.Identifier) {
      // Plain reference to another schema const
      const refName = node.getText();
      if (refName !== 'z' && refName !== 'zod') {
        resolveSchemaFields(refName, sf, visited).forEach((k) => fields.add(k));
      }
    }
  }

  walkCallChain(initializer);

  // Also try the raw text approach for superRefine/passthrough wrappers
  if (fields.size === 0 && (text.includes('z.object') || text.includes('.extend'))) {
    // Fallback: regex extract keys from object literals in the definition
    const keyPattern = /^\s{2,}(\w+)\s*:/gm;
    let m: RegExpExecArray | null;
    while ((m = keyPattern.exec(text)) !== null) {
      if (m[1] && m[1] !== 'z' && m[1] !== 'message' && m[1] !== 'code') {
        fields.add(m[1]);
      }
    }
  }

  return fields;
}

/**
 * Given a schema source file, extract all actions defined in the discriminated union
 * along with their declared fields.
 */
function extractActionsFromSchema(sf: SourceFile): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  // Find z.discriminatedUnion('action', [...]) calls ONLY
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.CallExpression) return;
    const call = node.asKindOrThrow(SyntaxKind.CallExpression);
    const expr = call.getExpression();
    if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return;
    const pa = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
    if (pa.getName() !== 'discriminatedUnion') return;

    const callArgs = call.getArguments();
    if (callArgs.length < 2) return;

    // First arg MUST be 'action' — skip success/error discriminated unions
    const discriminator = callArgs[0].getText().replace(/^['"]|['"]$/g, '');
    if (discriminator !== 'action') return;

    // Second arg is the array of schemas
    const arr = callArgs[1];
    if (arr.getKind() !== SyntaxKind.ArrayLiteralExpression) return;
    const arrLit = arr.asKindOrThrow(SyntaxKind.ArrayLiteralExpression);

    for (const elem of arrLit.getElements()) {
      const schemaName = elem.getText().trim();
      if (!schemaName) continue;

      const fields = resolveSchemaFields(schemaName, sf);
      const action = fields.has('action')
        ? extractActionLiteral(schemaName, sf)
        : undefined;

      if (action) {
        result.set(action, fields);
      }
    }
  });

  // Also handle z.enum action patterns (federation, single-action tools)
  if (result.size === 0) {
    // Try to find actions from a direct action enum
    sf.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return;
      const call = node.asKindOrThrow(SyntaxKind.CallExpression);
      const text = call.getText();
      if (!text.startsWith('z.enum') && !text.includes("z.literal('")) return;
    });
  }

  return result;
}

/**
 * Extract the string literal from `action: z.literal('xxx')` in the named schema.
 */
function extractActionLiteral(schemaName: string, sf: SourceFile): string | undefined {
  const decl = sf.getVariableDeclaration(schemaName);
  if (!decl) return undefined;

  const init = decl.getInitializer();
  if (!init) return undefined;

  // Walk looking for z.literal('...')
  let found: string | undefined;
  init.forEachDescendant((node) => {
    if (found) return;
    if (node.getKind() !== SyntaxKind.CallExpression) return;
    const call = node.asKindOrThrow(SyntaxKind.CallExpression);
    const expr = call.getExpression();
    if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return;
    const pa = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
    if (pa.getName() !== 'literal') return;
    const args = call.getArguments();
    if (!args[0]) return;
    const val = args[0].getText().replace(/^['"]|['"]$/g, '');
    if (val) found = val;
  });

  return found;
}

// ─── Handler field access extraction ─────────────────────────────────────────

/**
 * Names of variables considered to be the handler's request/input parameter.
 * The contract diff looks for property accesses on these names.
 * Kept intentionally narrow to avoid false positives from internal helper params.
 */
const REQUEST_VAR_NAMES = new Set([
  'req',
  'input',
  'request',
  'rawReq',
]);

/**
 * Extract all field names accessed via `req.field`, `input.field`, etc. in a source file.
 * Also captures destructuring: `const { field1, field2 } = req`.
 */
function extractHandlerFieldAccesses(sf: SourceFile): Set<string> {
  const accessed = new Set<string>();

  sf.forEachDescendant((node) => {
    // Direct property access: req.fieldName or input.fieldName
    if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
      const pa = node.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      const obj = pa.getExpression();
      if (obj.getKind() === SyntaxKind.Identifier) {
        const varName = obj.getText();
        if (REQUEST_VAR_NAMES.has(varName)) {
          accessed.add(pa.getName());
        }
      }
      // Also handle nested: req.safety?.dryRun -> capture 'safety'
      return;
    }

    // Element access: req['fieldName']
    if (node.getKind() === SyntaxKind.ElementAccessExpression) {
      const ea = node.asKindOrThrow(SyntaxKind.ElementAccessExpression);
      const obj = ea.getExpression();
      if (obj.getKind() === SyntaxKind.Identifier && REQUEST_VAR_NAMES.has(obj.getText())) {
        const arg = ea.getArgumentExpression();
        if (arg && arg.getKind() === SyntaxKind.StringLiteral) {
          accessed.add(arg.getText().replace(/^['"]|['"]$/g, ''));
        }
      }
      return;
    }

    // Destructuring: const { field1, field2, field3: alias } = req
    if (node.getKind() === SyntaxKind.VariableDeclaration) {
      const vd = node.asKindOrThrow(SyntaxKind.VariableDeclaration);
      const init = vd.getInitializer();
      if (
        init &&
        init.getKind() === SyntaxKind.Identifier &&
        REQUEST_VAR_NAMES.has(init.getText())
      ) {
        const nameNode = vd.getNameNode();
        if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
          const obp = nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern);
          for (const element of obp.getElements()) {
            // property name is the schema key (before : alias)
            const propNameNode = element.getPropertyNameNode();
            if (propNameNode) {
              accessed.add(propNameNode.getText().replace(/^['"]|['"]$/g, ''));
            } else {
              // No alias — binding name IS the property name
              accessed.add(element.getNameNode().getText());
            }
          }
        }
      }
      return;
    }
  });

  return accessed;
}

/**
 * Load all TypeScript source files under a handler path (file or directory).
 * Returns an array of ts-morph SourceFile objects.
 */
function loadHandlerFiles(handlerPath: string): SourceFile[] {
  const abs = path.join(PROJECT_ROOT, handlerPath);
  const sources: SourceFile[] = [];

  if (!fs.existsSync(abs)) return sources;

  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    const sf = project.addSourceFileAtPath(abs);
    sources.push(sf);
  } else if (stat.isDirectory()) {
    const entries = fs.readdirSync(abs);
    for (const entry of entries) {
      if (!entry.endsWith('.ts')) continue;
      const sf = project.addSourceFileAtPath(path.join(abs, entry));
      sources.push(sf);
    }
    // Also add the main handler file (e.g. src/handlers/history.ts) if it exists
    const toolName = path.basename(handlerPath);
    const mainFile = path.join(PROJECT_ROOT, 'src', 'handlers', `${toolName}.ts`);
    if (fs.existsSync(mainFile)) {
      try {
        const sf = project.addSourceFileAtPath(mainFile);
        sources.push(sf);
      } catch {
        /* already added */
      }
    }
  }

  return sources;
}

// ─── Core analysis ────────────────────────────────────────────────────────────

function analyzeTool(toolDef: { schema: string; handler: string }): ToolResult | null {
  const schemaFile = path.join(PROJECT_ROOT, 'src', 'schemas', `${toolDef.schema}.ts`);
  if (!fs.existsSync(schemaFile)) return null;

  const sf = project.addSourceFileAtPath(schemaFile);
  const actionMap = extractActionsFromSchema(sf);

  if (actionMap.size === 0) return null;

  const handlerSources = loadHandlerFiles(toolDef.handler);
  if (handlerSources.length === 0) return null;

  // Aggregate all fields accessed across all handler files for this tool
  const allHandlerAccesses = new Set<string>();
  for (const hs of handlerSources) {
    extractHandlerFieldAccesses(hs).forEach((f) => allHandlerAccesses.add(f));
  }

  // Aggregate ALL declared schema fields across ALL actions for this tool
  // so that "used-but-undeclared" means "not in any action's schema" (not just one action)
  const allSchemaFields = new Set<string>();
  for (const fields of actionMap.values()) {
    fields.forEach((f) => allSchemaFields.add(f));
  }

  // Tool-level: fields accessed in handlers but not declared in ANY action schema
  const toolLevelUndeclared = Array.from(allHandlerAccesses).filter(
    (f) =>
      !allSchemaFields.has(f) &&
      !UNIVERSAL_FIELDS.has(f) &&
      !SHARED_SCHEMA_FIELDS.has(f) &&
      !f.startsWith('_') &&
      // Exclude JavaScript built-ins and common non-request identifiers
      ![
        'length',
        'prototype',
        'constructor',
        'then',
        'catch',
        'finally',
        'message',
        'stack',
        'code',
        'name',
        'type',
        'result',
        'error',
        'data',
        'value',
        'key',
        'id',
        'status',
        'success',
        'response',
        'body',
        'headers',
        'method',
        'url',
      ].includes(f)
  );

  const actions: ActionDiff[] = [];

  // Per-action: fields declared in that action's schema but not accessed anywhere in handlers
  for (const [action, schemaFields] of actionMap) {
    const analyzableSchema = Array.from(schemaFields).filter(
      (f) => !UNIVERSAL_FIELDS.has(f) && !SHARED_SCHEMA_FIELDS.has(f)
    );

    const declaredButUnused = analyzableSchema.filter((f) => !allHandlerAccesses.has(f));

    // usedButUndeclared is tool-level (same list for each action to avoid duplication)
    const usedButUndeclared = action === Array.from(actionMap.keys())[0] ? toolLevelUndeclared : [];

    if (declaredButUnused.length > 0 || usedButUndeclared.length > 0) {
      actions.push({
        tool: toolDef.schema,
        action,
        schemaFields: Array.from(schemaFields).sort(),
        handlerFields: Array.from(allHandlerAccesses).sort(),
        declaredButUnused: declaredButUnused.sort(),
        usedButUndeclared: usedButUndeclared.sort(),
      });
    }
  }

  // If there are tool-level undeclared fields, add them to a synthetic "tool" action diff
  // when no action diff captured them
  if (toolLevelUndeclared.length > 0 && !actions.some((a) => a.usedButUndeclared.length > 0)) {
    actions.push({
      tool: toolDef.schema,
      action: '(tool-level)',
      schemaFields: Array.from(allSchemaFields).sort(),
      handlerFields: Array.from(allHandlerAccesses).sort(),
      declaredButUnused: [],
      usedButUndeclared: toolLevelUndeclared.sort(),
    });
  }

  return {
    tool: toolDef.schema,
    actions,
    schemaFile: path.relative(PROJECT_ROOT, schemaFile),
    handlerDir: toolDef.handler,
  };
}

// ─── Output formatting ────────────────────────────────────────────────────────

function printHumanReport(results: ToolResult[]): void {
  const allDiffs = results.flatMap((r) => r.actions);
  const undeclaredErrors = allDiffs.filter((a) => a.usedButUndeclared.length > 0);
  const unusedWarnings = allDiffs.filter((a) => a.declaredButUnused.length > 0);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Contract Diff: Zod Schema ↔ Handler Field Drift (C-1)       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const totalActions = results.reduce(
    (n, r) => n + (r ? r.actions.length : 0),
    0
  );
  const toolsWithDrift = results.filter((r) => r.actions.length > 0).length;

  if (undeclaredErrors.length === 0 && unusedWarnings.length === 0) {
    console.log('✅  No drift detected across all analyzed tools.\n');
  } else {
    if (undeclaredErrors.length > 0) {
      console.log(
        `❌  used-but-undeclared (${undeclaredErrors.length} action(s) — CI gate FAIL):\n`
      );
      for (const diff of undeclaredErrors) {
        console.log(`   [${diff.tool}] action=${diff.action}`);
        console.log(`   Fields accessed in handler but absent from schema:`);
        diff.usedButUndeclared.forEach((f) => console.log(`     ✗ ${f}`));
        console.log('');
      }
    }

    if (unusedWarnings.length > 0) {
      console.log(
        `⚠️   declared-but-unused (${unusedWarnings.length} action(s) — warning only):\n`
      );
      for (const diff of unusedWarnings) {
        console.log(`   [${diff.tool}] action=${diff.action}`);
        console.log(`   Fields declared in schema but not accessed in handler:`);
        diff.declaredButUnused.forEach((f) => console.log(`     ~ ${f}`));
        console.log('');
      }
    }
  }

  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Tools analyzed:        ${results.length}`);
  console.log(`  Actions with drift:    ${totalActions} (${toolsWithDrift} tool(s))`);
  console.log(`  used-but-undeclared:   ${undeclaredErrors.length} (errors)`);
  console.log(`  declared-but-unused:   ${unusedWarnings.length} (warnings)`);
  console.log('─────────────────────────────────────────────────────────────\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const tools = toolFilter
    ? TOOLS.filter((t) => t.schema === toolFilter)
    : TOOLS;

  if (tools.length === 0) {
    console.error(`Unknown tool: ${toolFilter}`);
    process.exit(2);
  }

  const results: ToolResult[] = [];
  const errors: string[] = [];

  for (const toolDef of tools) {
    try {
      const result = analyzeTool(toolDef);
      if (result) results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${toolDef.schema}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    console.error('\nErrors during analysis:');
    errors.forEach((e) => console.error(`  ⚠️  ${e}`));
  }

  if (JSON_OUTPUT) {
    const allDiffs = results.flatMap((r) => r.actions);
    console.log(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          toolsAnalyzed: results.length,
          totalDriftingActions: allDiffs.length,
          usedButUndeclaredCount: allDiffs.filter((a) => a.usedButUndeclared.length > 0).length,
          declaredButUnusedCount: allDiffs.filter((a) => a.declaredButUnused.length > 0).length,
          results,
        },
        null,
        2
      )
    );
  } else {
    printHumanReport(results);
  }

  const hasErrors = results.some((r) => r.actions.some((a) => a.usedButUndeclared.length > 0));

  if (hasErrors && !WARN_ONLY) {
    process.exit(1);
  }

  process.exit(0);
}

main();
