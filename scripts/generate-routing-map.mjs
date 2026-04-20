#!/usr/bin/env node
/**
 * Generates .serval/routing-map.json — a compact, machine-readable dispatch index.
 * Replaces the 2.2MB codebase-manifest.json for AI navigation purposes.
 *
 * Sources: src/generated/manifest.json (tool→action lists) + handler file grep for line numbers.
 * Output: ~60-100KB JSON with tool→actions, dispatch table with file:line, handler types.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'src/generated/manifest.json');
const OUTPUT_PATH = join(ROOT, '.serval/routing-map.json');

// Known handler file mapping (tool name → relative path)
const HANDLER_FILES = {
  sheets_advanced: 'src/handlers/advanced.ts',
  sheets_agent: 'src/handlers/agent.ts',
  sheets_analyze: 'src/handlers/analyze.ts',
  sheets_appsscript: 'src/handlers/appsscript.ts',
  sheets_auth: 'src/handlers/auth.ts',
  sheets_bigquery: 'src/handlers/bigquery.ts',
  sheets_collaborate: 'src/handlers/collaborate.ts',
  sheets_composite: 'src/handlers/composite.ts',
  sheets_compute: 'src/handlers/compute.ts',
  sheets_confirm: 'src/handlers/confirm.ts',
  sheets_connectors: 'src/handlers/connectors.ts',
  sheets_core: 'src/handlers/core.ts',
  sheets_data: 'src/handlers/data.ts',
  sheets_dependencies: 'src/handlers/dependencies.ts',
  sheets_dimensions: 'src/handlers/dimensions.ts',
  sheets_federation: 'src/handlers/federation.ts',
  sheets_fix: 'src/handlers/fix.ts',
  sheets_format: 'src/handlers/format.ts',
  sheets_history: 'src/handlers/history.ts',
  sheets_quality: 'src/handlers/quality.ts',
  sheets_session: 'src/handlers/session.ts',
  sheets_templates: 'src/handlers/templates.ts',
  sheets_transaction: 'src/handlers/transaction.ts',
  sheets_visualize: 'src/handlers/visualize.ts',
  sheets_webhook: 'src/handlers/webhooks.ts',
};

// BaseHandler subclasses vs standalone (from architecture docs)
const BASE_HANDLER_TOOLS = new Set([
  'sheets_core', 'sheets_data', 'sheets_format', 'sheets_dimensions',
  'sheets_advanced', 'sheets_visualize', 'sheets_collaborate', 'sheets_composite',
  'sheets_analyze', 'sheets_fix', 'sheets_templates', 'sheets_bigquery', 'sheets_appsscript',
]);

function findActionLine(fileContent, actionName) {
  const lines = fileContent.split('\n');
  // Match: case 'action_name': or case "action_name":
  const patterns = [
    new RegExp(`case\\s+['"]${actionName}['"]\\s*:`),
    new RegExp(`action\\s*===\\s*['"]${actionName}['"]`),
  ];
  for (let i = 0; i < lines.length; i++) {
    if (patterns.some(p => p.test(lines[i]))) {
      return i + 1; // 1-indexed
    }
  }
  return null;
}

function findHandlerMethod(fileContent, actionName) {
  const lines = fileContent.split('\n');
  // Look for: private async handleXxx or handle + PascalCase of action
  // Convert action_name → ActionName
  const pascal = actionName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const pascal2 = pascal.charAt(0).toUpperCase() + pascal.slice(1);
  const patterns = [
    new RegExp(`private\\s+async\\s+handle${pascal2}\\b`),
    new RegExp(`private\\s+handle${pascal2}\\b`),
    new RegExp(`async\\s+handle${pascal2}\\b`),
  ];
  for (let i = 0; i < lines.length; i++) {
    if (patterns.some(p => p.test(lines[i]))) {
      return { method: `handle${pascal2}`, line: i + 1 };
    }
  }
  return null;
}

function main() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`❌ Manifest not found: ${MANIFEST_PATH}`);
    console.error('   Run: npm run schema:commit');
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

  const routingMap = {
    generated: new Date().toISOString(),
    toolCount: manifest.toolCount,
    actionCount: manifest.actionCount,
    tools: {},
    dispatch: {},
    mutations: [],
    layerModel: {
      BaseHandler: Array.from(BASE_HANDLER_TOOLS),
      standalone: Object.keys(HANDLER_FILES).filter(t => !BASE_HANDLER_TOOLS.has(t)),
    },
  };

  // Load MUTATION_ACTIONS from audit-middleware if it exists
  const auditMiddlewarePath = join(ROOT, 'src/middleware/audit-middleware.ts');
  if (existsSync(auditMiddlewarePath)) {
    const auditContent = readFileSync(auditMiddlewarePath, 'utf8');
    const mutationMatch = auditContent.match(/MUTATION_ACTIONS\s*=\s*new\s*Set(?:<[^>]+>)?\s*\(\s*\[([^\]]+)\]/s);
    if (mutationMatch) {
      routingMap.mutations = mutationMatch[1]
        .split(',')
        .map(s => s.trim().replace(/['"]/g, ''))
        .filter(Boolean);
    }
  }

  // Process each tool from manifest
  for (const tool of manifest.tools) {
    const toolName = tool.name;
    const handlerFile = HANDLER_FILES[toolName];

    routingMap.tools[toolName] = {
      file: handlerFile || 'unknown',
      type: BASE_HANDLER_TOOLS.has(toolName) ? 'BaseHandler' : 'standalone',
      actionCount: tool.actionCount,
      actions: tool.actions,
    };

    if (!handlerFile) continue;

    const fullPath = join(ROOT, handlerFile);
    if (!existsSync(fullPath)) {
      console.warn(`⚠️  Handler file not found: ${handlerFile}`);
      continue;
    }

    const fileContent = readFileSync(fullPath, 'utf8');

    for (const action of tool.actions) {
      const key = `${toolName}.${action}`;
      const caseLine = findActionLine(fileContent, action);
      const methodInfo = findHandlerMethod(fileContent, action);

      routingMap.dispatch[key] = {
        file: handlerFile,
        caseLine,
        method: methodInfo?.method || null,
        methodLine: methodInfo?.line || null,
        isMutation: routingMap.mutations.includes(action),
      };
    }
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(routingMap, null, 2));

  const sizeKB = Math.round(JSON.stringify(routingMap).length / 1024);
  console.log(`✅ Routing map generated: .serval/routing-map.json (${sizeKB} KB)`);
  console.log(`   ${routingMap.toolCount} tools | ${routingMap.actionCount} actions | ${Object.keys(routingMap.dispatch).length} dispatch entries`);
  console.log(`   ${routingMap.mutations.length} mutation actions tracked`);
}

main();
