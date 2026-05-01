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
 * JSON output schema:
 *   {
 *     "timestamp": "<ISO-8601>",
 *     "toolsAnalyzed": <number>,
 *     "totalDriftingActions": <number>,
 *     "usedButUndeclaredCount": <number>,
 *     "declaredButUnusedCount": <number>,
 *     "errors": ["<tool>: <message>", ...],
 *     "results": [
 *       {
 *         "tool": "<schema-name>",
 *         "schemaFile": "<relative-path>",
 *         "handlerDir": "<relative-path>",
 *         "actions": [
 *           {
 *             "tool": "<schema-name>",
 *             "action": "<action-literal>",
 *             "schemaFields": ["<field>", ...],
 *             "handlerFields": ["<field>", ...],
 *             "declaredButUnused": ["<field>", ...],
 *             "usedButUndeclared": ["<field>", ...]
 *           }
 *         ]
 *       }
 *     ]
 *   }
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

function exitWithUsage(message: string): never {
  console.error(message);
  console.error('Usage:');
  console.error('  npm run verify:contracts');
  console.error('  npx tsx scripts/contract-diff.ts');
  console.error('  npx tsx scripts/contract-diff.ts --warn-only');
  console.error('  npx tsx scripts/contract-diff.ts --json');
  console.error('  npx tsx scripts/contract-diff.ts --tool history');
  process.exit(2);
}

const toolFilter = (() => {
  const idx = args.indexOf('--tool');
  if (idx === -1) return undefined;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) {
    exitWithUsage('Error: --tool requires a tool name argument.');
  }
  return value;
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

/**
 * Maps schema filename (without .ts) to handler directory/file.
 * - handler: path to handler directory or single file (relative to project root)
 * - mainHandler: optional explicit path to the top-level handler file when the
 *   default naming heuristic (strip "-actions" suffix) would produce the wrong name.
 *   Example: "webhook-actions/" → heuristic gives "webhook.ts" but actual is "webhooks.ts"
 */
const TOOLS: Array<{ schema: string; handler: string; mainHandler?: string }> = [
  { schema: 'advanced', handler: 'src/handlers/advanced-actions' },
  { schema: 'analyze', handler: 'src/handlers/analyze-actions' },
  { schema: 'appsscript', handler: 'src/handlers/appsscript-actions' },
  { schema: 'auth', handler: 'src/handlers/auth-actions' },
  { schema: 'bigquery', handler: 'src/handlers/bigquery-actions' },
  { schema: 'collaborate', handler: 'src/handlers/collaborate-actions' },
  { schema: 'composite', handler: 'src/handlers/composite-actions' },
  { schema: 'compute', handler: 'src/handlers/compute-actions' },
  { schema: 'confirm', handler: 'src/handlers/confirm.ts' },
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
  // webhook-actions/ → top-level handler is "webhooks.ts" (note plural), not "webhook.ts"
  {
    schema: 'webhook',
    handler: 'src/handlers/webhook-actions',
    mainHandler: 'src/handlers/webhooks.ts',
  },
  { schema: 'agent', handler: 'src/handlers/agent.ts' },
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

/**
 * JavaScript built-ins and common response/internal field names that should
 * never be flagged as schema drift, even if accessed on a request variable.
 */
const BUILTIN_IDENTIFIERS = new Set([
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
  // String / Array built-in methods that may appear as property accesses on a
  // local variable that happens to share a name with a request variable
  'slice',
  'splice',
  'indexOf',
  'includes',
  'startsWith',
  'endsWith',
  'trim',
  'split',
  'join',
  'map',
  'filter',
  'find',
  'reduce',
  'forEach',
  'push',
  'pop',
  'shift',
  'unshift',
  'flat',
  'flatMap',
  'every',
  'some',
  'sort',
  'reverse',
  'concat',
  'fill',
  'entries',
  'keys',
  'values',
  'toString',
  'toUpperCase',
  'toLowerCase',
  'replace',
  'match',
  'test',
  'charAt',
  'charCodeAt',
  'substring',
  'padStart',
  'padEnd',
  'at',
  'lastIndexOf',
  'repeat',
  'search',
  'substr',
  'toLocaleLowerCase',
  'toLocaleUpperCase',
  'trimStart',
  'trimEnd',
  'findIndex',
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
 *          SomeBase.pick({...}), SomeBase.omit({...}), z.preprocess(fn, schema)
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

        if (methodName === 'preprocess') {
          // z.preprocess(fn, schema) — skip the transform fn, recurse into schema arg
          if (args[1]) {
            walkCallChain(args[1]);
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
 * Extract schema fields directly from an inline call expression node.
 * Used when a discriminated union element is an inline schema (not a named reference).
 * Supports: z.object({...}), BaseSchema.extend({...}), z.preprocess(fn, z.object({...}))
 */
function extractFieldsFromInlineNode(node: Node, sf: SourceFile): Set<string> {
  const fields = new Set<string>();

  function walk(n: Node): void {
    if (n.getKind() !== SyntaxKind.CallExpression) return;
    const call = n.asKindOrThrow(SyntaxKind.CallExpression);
    const expr = call.getExpression();
    const callArgs = call.getArguments();

    if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return;
    const pa = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
    const methodName = pa.getName();

    if (methodName === 'object') {
      if (callArgs[0]) extractObjectLiteralKeys(callArgs[0]).forEach((k) => fields.add(k));
      return;
    }

    if (methodName === 'preprocess') {
      if (callArgs[1]) walk(callArgs[1]);
      return;
    }

    if (methodName === 'extend') {
      walk(pa.getExpression());
      if (callArgs[0]) extractObjectLiteralKeys(callArgs[0]).forEach((k) => fields.add(k));
      return;
    }

    if (methodName === 'merge') {
      walk(pa.getExpression());
      if (callArgs[0]) {
        const argName = callArgs[0].getText().trim();
        resolveSchemaFields(argName, sf).forEach((k) => fields.add(k));
      }
      return;
    }

    // Other chained methods — recurse into base
    walk(pa.getExpression());
  }

  walk(node);
  return fields;
}

/**
 * Extract the action literal value from an inline node.
 * Scans for z.literal('...') calls within the node.
 */
function extractActionLiteralFromNode(node: Node): string | undefined {
  let found: string | undefined;
  node.forEachDescendant((n) => {
    if (found) return;
    if (n.getKind() !== SyntaxKind.CallExpression) return;
    const call = n.asKindOrThrow(SyntaxKind.CallExpression);
    const expr = call.getExpression();
    if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return;
    const pa = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
    if (pa.getName() !== 'literal') return;
    const callArgs = call.getArguments();
    if (!callArgs[0]) return;
    const val = callArgs[0].getText().replace(/^['"]|['"]$/g, '');
    if (val) found = val;
  });
  return found;
}

/**
 * Given a schema source file, extract all actions defined in the discriminated union
 * along with their declared fields.
 *
 * Supports:
 *  1. z.discriminatedUnion('action', [...]) — the primary pattern; elements can be
 *     either named identifiers (MyActionSchema) or inline expressions (z.object({...}))
 *  2. z.object({ action: z.enum([...]) | z.literal('...'), ...fields }) — enum-action tools
 *     (also handles the nested `request: z.object({ action: ... })` wrapper variant)
 */
function extractActionsFromSchema(sf: SourceFile): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  // ── Pass 1: discriminatedUnion('action', [...]) ──────────────────────────────
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
      let fields: Set<string>;
      let action: string | undefined;

      if (elem.getKind() === SyntaxKind.Identifier) {
        // Named reference: MyActionSchema
        const schemaName = elem.getText().trim();
        fields = resolveSchemaFields(schemaName, sf);
        action = fields.has('action') ? extractActionLiteral(schemaName, sf) : undefined;
      } else {
        // Inline expression: z.object({ action: z.literal('foo'), ... })
        fields = extractFieldsFromInlineNode(elem, sf);
        action = fields.has('action') ? extractActionLiteralFromNode(elem) : undefined;
      }

      if (action && fields.size > 0) {
        result.set(action, fields);
      }
    }
  });

  if (result.size > 0) return result;

  // ── Pass 2: enum-action fallback ─────────────────────────────────────────────
  // Handles tools where the input schema is a plain z.object with action: z.enum([...])
  // (e.g. federation) or action: z.literal('...') (single-action tools).
  // Also handles the `{ request: z.object({ action: z.enum([...]) }) }` wrapper variant.
  for (const decl of sf.getVariableDeclarations()) {
    const init = decl.getInitializer();
    if (!init) continue;

    // Try the direct object: z.object({ action: z.enum([...] | z.literal('...')), ...fields })
    const directResult = tryExtractEnumActionsFromObjectExpr(init);
    if (directResult) {
      for (const [action, fields] of directResult) result.set(action, fields);
    }

    // Try the wrapped variant: z.object({ request: z.object({ action: ... }) })
    if (result.size === 0) {
      const wrappedResult = tryExtractEnumActionsFromWrappedRequest(init);
      if (wrappedResult) {
        for (const [action, fields] of wrappedResult) result.set(action, fields);
      }
    }

    if (result.size > 0) break;
  }

  return result;
}

/**
 * Try to extract actions+fields from a z.object({action: z.enum([...])|z.literal('...'), ...}).
 * Returns a Map<action, fields> if successful, null if the pattern doesn't match.
 */
function tryExtractEnumActionsFromObjectExpr(
  node: Node
): Map<string, Set<string>> | null {
  if (node.getKind() !== SyntaxKind.CallExpression) return null;
  const call = node.asKindOrThrow(SyntaxKind.CallExpression);
  const expr = call.getExpression();
  if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return null;
  const pa = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
  if (pa.getName() !== 'object') return null;

  const args = call.getArguments();
  if (!args[0] || args[0].getKind() !== SyntaxKind.ObjectLiteralExpression) return null;
  const objLit = args[0].asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  const allFields = new Set<string>();
  const actions: string[] = [];

  for (const prop of objLit.getProperties()) {
    if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue;
    const assignment = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
    const propName = assignment.getName().replace(/^['"]|['"]$/g, '');
    allFields.add(propName);

    if (propName !== 'action') continue;

    // Look for z.literal('...') or z.enum([...]) (possibly wrapped in .describe())
    const actionValues = extractActionValuesFromZodExpr(assignment.getInitializer());
    actions.push(...actionValues);

    // Also handle reference to a named const (e.g. `action: FederationActionSchema`)
    if (actionValues.length === 0) {
      const refName = assignment.getInitializer()?.getText().trim() ?? '';
      if (refName && !refName.startsWith('z.')) {
        // It's a reference — try to resolve literal values from the named const
        const resolved = resolveZodEnumValues(refName, assignment.getSourceFile());
        actions.push(...resolved);
      }
    }
  }

  if (actions.length === 0) return null;

  const resultMap = new Map<string, Set<string>>();
  for (const action of new Set(actions)) {
    resultMap.set(action, new Set(allFields));
  }
  return resultMap;
}

/**
 * Try to extract actions+fields from a z.object({ request: z.object({ action: ... }) }) wrapper.
 */
function tryExtractEnumActionsFromWrappedRequest(
  node: Node
): Map<string, Set<string>> | null {
  if (node.getKind() !== SyntaxKind.CallExpression) return null;
  const call = node.asKindOrThrow(SyntaxKind.CallExpression);
  const expr = call.getExpression();
  if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return null;
  if (expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName() !== 'object') return null;

  const args = call.getArguments();
  if (!args[0] || args[0].getKind() !== SyntaxKind.ObjectLiteralExpression) return null;
  const outerObj = args[0].asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  for (const prop of outerObj.getProperties()) {
    if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue;
    const assignment = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
    if (assignment.getName().replace(/^['"]|['"]$/g, '') !== 'request') continue;

    // Walk the initializer to find the inner z.object(...)
    const innerObject = findZodObjectCall(assignment.getInitializer());
    if (!innerObject) continue;

    return tryExtractEnumActionsFromObjectExpr(innerObject);
  }

  return null;
}

/**
 * Walk a call-chain node (e.g. z.object({...}).superRefine(...).describe(...)) to find
 * the innermost z.object call expression and return it.
 */
function findZodObjectCall(node: Node | undefined): Node | null {
  if (!node) return null;

  if (node.getKind() === SyntaxKind.CallExpression) {
    const call = node.asKindOrThrow(SyntaxKind.CallExpression);
    const expr = call.getExpression();
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const pa = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      if (pa.getName() === 'object') return node; // found it
      // Keep walking up the chain
      return findZodObjectCall(pa.getExpression());
    }
  }

  return null;
}

/**
 * Extract literal string action values from a Zod expression:
 *   z.literal('foo')           → ['foo']
 *   z.enum(['foo','bar'])      → ['foo','bar']
 *   z.enum([...]).describe()   → ['foo','bar']
 */
function extractActionValuesFromZodExpr(node: Node | undefined): string[] {
  if (!node) return [];

  // Unwrap chained methods (.describe(), .optional(), etc.)
  if (node.getKind() === SyntaxKind.CallExpression) {
    const call = node.asKindOrThrow(SyntaxKind.CallExpression);
    const expr = call.getExpression();
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const pa = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      const methodName = pa.getName();

      if (methodName === 'literal') {
        const arg = call.getArguments()[0];
        if (!arg) return [];
        const val = arg.getText().replace(/^['"]|['"]$/g, '');
        return val ? [val] : [];
      }

      if (methodName === 'enum') {
        const arg = call.getArguments()[0];
        if (!arg || arg.getKind() !== SyntaxKind.ArrayLiteralExpression) return [];
        return arg
          .asKindOrThrow(SyntaxKind.ArrayLiteralExpression)
          .getElements()
          .map((e) => e.getText().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      }

      // Chained call — recurse into the base
      return extractActionValuesFromZodExpr(pa.getExpression());
    }
  }

  return [];
}

/**
 * Resolve the string values of a named Zod enum constant (e.g. `FederationActionSchema`).
 */
function resolveZodEnumValues(constName: string, sf: SourceFile): string[] {
  const decl = sf.getVariableDeclaration(constName);
  if (!decl) return [];
  const init = decl.getInitializer();
  if (!init) return [];
  return extractActionValuesFromZodExpr(init);
}

/**
 * Extract the string literal from `action: z.literal('xxx')` in the named schema.
 */
function extractActionLiteral(schemaName: string, sf: SourceFile): string | undefined {
  const decl = sf.getVariableDeclaration(schemaName);
  if (!decl) return undefined;

  const init = decl.getInitializer();
  if (!init) return undefined;

  return extractActionLiteralFromNode(init);
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
 *
 * Note: this is a name-based heuristic. Variables named req/input/request that are NOT
 * the handler's input parameter (e.g. helper-function params) may produce false positives,
 * which the UNIVERSAL_FIELDS / SHARED_SCHEMA_FIELDS / BUILTIN_IDENTIFIERS allowlists mitigate.
 */
function extractHandlerFieldAccesses(sf: SourceFile): Set<string> {
  const accessed = new Set<string>();

  sf.forEachDescendant((node) => {
    // Direct property access: req.fieldName or input.fieldName
    // Only capture when the object is a plain Identifier (not a chained access like obj.req.field)
    if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
      const pa = node.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      const obj = pa.getExpression();
      if (obj.getKind() === SyntaxKind.Identifier) {
        const varName = obj.getText();
        if (REQUEST_VAR_NAMES.has(varName)) {
          accessed.add(pa.getName());
        }
      }
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
 *
 * Two-level deduplication:
 *  1. `seenPaths` (call-scoped Set): prevents the same physical path appearing twice in
 *     the returned array within a single invocation (e.g. if mainHandlerOverride happens
 *     to be inside the handler directory).
 *  2. `project.getSourceFile()` (project-scoped): re-uses a SourceFile that was already
 *     added to the ts-morph Project by a prior `loadHandlerFiles` call (e.g. shared
 *     helper modules or the same file referenced by two tools). This avoids ts-morph
 *     errors and ensures each file is parsed only once across the full analysis run.
 *
 * @param handlerPath - relative path to a handler file or directory
 * @param mainHandlerOverride - explicit path for the top-level handler file when the
 *   default naming heuristic (strip "-actions" suffix) would produce the wrong name
 */
function loadHandlerFiles(handlerPath: string, mainHandlerOverride?: string): SourceFile[] {
  const abs = path.resolve(PROJECT_ROOT, handlerPath);
  const seenPaths = new Set<string>();
  const sources: SourceFile[] = [];

  function addFile(filePath: string): void {
    const resolved = path.resolve(filePath);
    if (seenPaths.has(resolved)) return; // already added in this call
    seenPaths.add(resolved);

    // Re-use an already-loaded SourceFile if the project has it; otherwise add it.
    let sf = project.getSourceFile(resolved);
    if (!sf) {
      try {
        sf = project.addSourceFileAtPath(resolved);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`Warning: could not add handler file ${resolved}: ${msg}\n`);
        return;
      }
    }
    sources.push(sf);
  }

  if (!fs.existsSync(abs)) return sources;

  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    addFile(abs);
  } else if (stat.isDirectory()) {
    // Add all TypeScript files inside the directory
    const entries = fs.readdirSync(abs).sort(); // sort for deterministic ordering
    for (const entry of entries) {
      if (!entry.endsWith('.ts')) continue;
      addFile(path.join(abs, entry));
    }

    // Also add the top-level handler file for this tool.
    // Prefer the explicit override; fall back to stripping the "-actions" suffix.
    const mainFile = mainHandlerOverride
      ? path.resolve(PROJECT_ROOT, mainHandlerOverride)
      : path.resolve(
          PROJECT_ROOT,
          'src',
          'handlers',
          `${path.basename(handlerPath).replace(/-actions$/, '')}.ts`
        );

    if (fs.existsSync(mainFile)) {
      addFile(mainFile);
    }
  }

  return sources;
}

// ─── Core analysis ────────────────────────────────────────────────────────────

function analyzeTool(toolDef: {
  schema: string;
  handler: string;
  mainHandler?: string;
}): ToolResult | null {
  const schemaFile = path.join(PROJECT_ROOT, 'src', 'schemas', `${toolDef.schema}.ts`);
  if (!fs.existsSync(schemaFile)) return null;

  // Re-use an already-loaded SourceFile for the schema if available
  let sf = project.getSourceFile(path.resolve(schemaFile));
  if (!sf) {
    sf = project.addSourceFileAtPath(schemaFile);
  }
  const actionMap = extractActionsFromSchema(sf);

  if (actionMap.size === 0) {
    // Surface a warning so CI doesn't silently skip a registered tool
    process.stderr.write(
      `Warning [${toolDef.schema}]: no actions extracted from schema — tool skipped.\n` +
        `  Ensure the schema uses z.discriminatedUnion('action', [...]),\n` +
        `  z.object({action: z.enum([...])}), or z.object({action: z.literal('...')})\n`
    );
    return null;
  }

  const handlerSources = loadHandlerFiles(toolDef.handler, toolDef.mainHandler);
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
  const toolLevelUndeclared = Array.from(allHandlerAccesses)
    .filter(
      (f) =>
        !allSchemaFields.has(f) &&
        !UNIVERSAL_FIELDS.has(f) &&
        !SHARED_SCHEMA_FIELDS.has(f) &&
        !f.startsWith('_') &&
        !BUILTIN_IDENTIFIERS.has(f)
    )
    .sort();

  const actions: ActionDiff[] = [];

  // Per-action: fields declared in that action's schema but not accessed anywhere in handlers
  // Tool-level used-but-undeclared is reported once on the first action with drift (or the
  // first action overall) to avoid redundant repetition per action.
  let toolLevelUndeclaredReported = false;
  for (const [action, schemaFields] of actionMap) {
    const analyzableSchema = Array.from(schemaFields).filter(
      (f) => !UNIVERSAL_FIELDS.has(f) && !SHARED_SCHEMA_FIELDS.has(f)
    );

    const declaredButUnused = analyzableSchema.filter((f) => !allHandlerAccesses.has(f)).sort();

    // Attach the tool-level undeclared list to the first action with drift, or first action
    const usedButUndeclared =
      !toolLevelUndeclaredReported && toolLevelUndeclared.length > 0
        ? toolLevelUndeclared
        : [];
    if (usedButUndeclared.length > 0) toolLevelUndeclaredReported = true;

    if (declaredButUnused.length > 0 || usedButUndeclared.length > 0) {
      actions.push({
        tool: toolDef.schema,
        action,
        schemaFields: Array.from(schemaFields).sort(),
        handlerFields: Array.from(allHandlerAccesses).sort(),
        declaredButUnused,
        usedButUndeclared,
      });
    }
  }

  // If there are tool-level undeclared fields but no per-action drift captured them yet,
  // add a synthetic "(tool-level)" entry so they appear in the report.
  if (toolLevelUndeclared.length > 0 && !toolLevelUndeclaredReported) {
    actions.push({
      tool: toolDef.schema,
      action: '(tool-level)',
      schemaFields: Array.from(allSchemaFields).sort(),
      handlerFields: Array.from(allHandlerAccesses).sort(),
      declaredButUnused: [],
      usedButUndeclared: toolLevelUndeclared,
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

function printHumanReport(results: ToolResult[], errors: string[]): void {
  const allDiffs = results.flatMap((r) => r.actions);
  const undeclaredErrors = allDiffs.filter((a) => a.usedButUndeclared.length > 0);
  const unusedWarnings = allDiffs.filter((a) => a.declaredButUnused.length > 0);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Contract Diff: Zod Schema ↔ Handler Field Drift (C-1)       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

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

  if (errors.length > 0) {
    console.error(`\n⚠️  Analysis errors (${errors.length}):\n`);
    errors.forEach((e) => console.error(`   ${e}`));
    console.error('');
  }

  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Tools analyzed:        ${results.length}`);
  console.log(`  Tools with drift:      ${toolsWithDrift}`);
  console.log(`  used-but-undeclared:   ${undeclaredErrors.length} (errors)`);
  console.log(`  declared-but-unused:   ${unusedWarnings.length} (warnings)`);
  if (errors.length > 0) {
    console.log(`  Analysis errors:       ${errors.length}`);
  }
  console.log('─────────────────────────────────────────────────────────────\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const tools = toolFilter
    ? TOOLS.filter((t) => t.schema === toolFilter)
    : TOOLS;

  if (tools.length === 0) {
    console.error(`Unknown tool: ${toolFilter}`);
    console.error(`Known tools: ${TOOLS.map((t) => t.schema).join(', ')}`);
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
          errors,
          results,
        },
        null,
        2
      )
    );
  } else {
    printHumanReport(results, errors);
  }

  const hasErrors = results.some((r) => r.actions.some((a) => a.usedButUndeclared.length > 0));

  if (hasErrors && !WARN_ONLY) {
    process.exit(1);
  }

  process.exit(0);
}

main();
