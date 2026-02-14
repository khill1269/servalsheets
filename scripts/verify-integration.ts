#!/usr/bin/env tsx
/**
 * ServalSheets - Integration Verification
 *
 * Verifies all components are properly wired:
 * - Tools → Handlers → Schemas → Descriptions
 * - Resources → URIs → Handlers
 * - Prompts → Templates → Handlers
 * - MCP Features → Implementation
 */

import { TOOL_DEFINITIONS } from '../src/mcp/registration/tool-definitions.js';
import { TOOL_ANNOTATIONS, ACTION_COUNTS } from '../src/schemas/annotations.js';
import { TOOL_DESCRIPTIONS } from '../src/schemas/descriptions.js';
import { TOOL_ACTIONS } from '../src/mcp/completions.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Issue {
  severity: 'error' | 'warning';
  component: string;
  message: string;
}

const issues: Issue[] = [];

function addIssue(severity: 'error' | 'warning', component: string, message: string) {
  issues.push({ severity, component, message });
}

console.log('🔍 ServalSheets Integration Verification\n');
console.log('Checking 21 tools with 294 actions across all components...\n');

// ============================================================================
// 1. TOOL DEFINITIONS
// ============================================================================

console.log('📋 Verifying Tool Definitions...');
const expectedTools = [
  'sheets_auth',
  'sheets_core',
  'sheets_data',
  'sheets_format',
  'sheets_dimensions',
  'sheets_visualize',
  'sheets_collaborate',
  'sheets_advanced',
  'sheets_transaction',
  'sheets_quality',
  'sheets_history',
  'sheets_confirm',
  'sheets_analyze',
  'sheets_fix',
  'sheets_composite',
  'sheets_session',
  'sheets_templates',
  'sheets_bigquery',
  'sheets_appsscript',
  'sheets_webhook',
  'sheets_dependencies',
];

const definedTools = TOOL_DEFINITIONS.map((t) => t.name);

for (const tool of expectedTools) {
  if (!definedTools.includes(tool)) {
    addIssue('error', 'tool-definitions', `Missing tool definition: ${tool}`);
  } else {
    console.log(`  ✅ ${tool} defined`);
  }
}

// ============================================================================
// 2. HANDLERS
// ============================================================================

console.log('\n🛠️  Verifying Handlers...');
const handlerDir = path.join(__dirname, '../src/handlers');

const toolToHandler: Record<string, string> = {
  sheets_auth: 'auth.ts',
  sheets_core: 'core.ts',
  sheets_data: 'data.ts',
  sheets_format: 'format.ts',
  sheets_dimensions: 'dimensions.ts',
  sheets_visualize: 'visualize.ts',
  sheets_collaborate: 'collaborate.ts',
  sheets_advanced: 'advanced.ts',
  sheets_transaction: 'transaction.ts',
  sheets_quality: 'quality.ts',
  sheets_history: 'history.ts',
  sheets_confirm: 'confirm.ts',
  sheets_analyze: 'analyze.ts',
  sheets_fix: 'fix.ts',
  sheets_composite: 'composite.ts',
  sheets_session: 'session.ts',
  sheets_templates: 'templates.ts',
  sheets_bigquery: 'bigquery.ts',
  sheets_appsscript: 'appsscript.ts',
  sheets_webhook: 'webhooks.ts',
  sheets_dependencies: 'dependencies.ts',
};

for (const [tool, handlerFile] of Object.entries(toolToHandler)) {
  const handlerPath = path.join(handlerDir, handlerFile);
  if (fs.existsSync(handlerPath)) {
    console.log(`  ✅ ${tool} → ${handlerFile}`);
  } else {
    addIssue('error', 'handlers', `Missing handler file: ${handlerFile} for ${tool}`);
  }
}

// Check handler registration in tool-handlers.ts
const toolHandlersPath = path.join(__dirname, '../src/mcp/registration/tool-handlers.ts');
const toolHandlersContent = fs.readFileSync(toolHandlersPath, 'utf-8');

console.log('\n📝 Verifying Handler Registration...');
for (const tool of expectedTools) {
  if (toolHandlersContent.includes(`${tool}:`)) {
    console.log(`  ✅ ${tool} registered in handler map`);
  } else {
    addIssue('error', 'handler-registration', `${tool} not registered in createToolHandlerMap`);
  }
}

// ============================================================================
// 3. SCHEMAS
// ============================================================================

console.log('\n📐 Verifying Schemas...');
const schemaDir = path.join(__dirname, '../src/schemas');

const toolToSchema: Record<string, string> = {
  sheets_auth: 'auth.ts',
  sheets_core: 'core.ts',
  sheets_data: 'data.ts',
  sheets_format: 'format.ts',
  sheets_dimensions: 'dimensions.ts',
  sheets_visualize: 'visualize.ts',
  sheets_collaborate: 'collaborate.ts',
  sheets_advanced: 'advanced.ts',
  sheets_transaction: 'transaction.ts',
  sheets_quality: 'quality.ts',
  sheets_history: 'history.ts',
  sheets_confirm: 'confirm.ts',
  sheets_analyze: 'analyze.ts',
  sheets_fix: 'fix.ts',
  sheets_composite: 'composite.ts',
  sheets_session: 'session.ts',
  sheets_templates: 'templates.ts',
  sheets_bigquery: 'bigquery.ts',
  sheets_appsscript: 'appsscript.ts',
  sheets_webhook: 'webhook.ts',
  sheets_dependencies: 'dependencies.ts',
};

for (const [tool, schemaFile] of Object.entries(toolToSchema)) {
  const schemaPath = path.join(schemaDir, schemaFile);
  if (fs.existsSync(schemaPath)) {
    console.log(`  ✅ ${tool} → ${schemaFile}`);
  } else {
    addIssue('error', 'schemas', `Missing schema file: ${schemaFile} for ${tool}`);
  }
}

// ============================================================================
// 4. DESCRIPTIONS
// ============================================================================

console.log('\n📖 Verifying Descriptions...');
for (const tool of expectedTools) {
  if (TOOL_DESCRIPTIONS[tool]) {
    console.log(`  ✅ ${tool} has description (${TOOL_DESCRIPTIONS[tool].length} chars)`);
  } else {
    addIssue('error', 'descriptions', `Missing description for ${tool}`);
  }
}

// ============================================================================
// 5. ANNOTATIONS
// ============================================================================

console.log('\n🏷️  Verifying Annotations...');
for (const tool of expectedTools) {
  if (TOOL_ANNOTATIONS[tool]) {
    console.log(`  ✅ ${tool} has annotations`);
  } else {
    addIssue('error', 'annotations', `Missing annotations for ${tool}`);
  }
}

// ============================================================================
// 6. ACTION COUNTS
// ============================================================================

console.log('\n🔢 Verifying Action Counts...');
let totalActions = 0;
for (const tool of expectedTools) {
  const count = ACTION_COUNTS[tool];
  if (count !== undefined) {
    totalActions += count;
    console.log(`  ✅ ${tool}: ${count} actions`);
  } else {
    addIssue('error', 'action-counts', `Missing action count for ${tool}`);
  }
}

if (totalActions !== 293) {
  addIssue('error', 'action-counts', `Total actions: ${totalActions}, expected: 293`);
} else {
  console.log(`\n  ✅ Total: ${totalActions} actions (matches expected 293)`);
}

// ============================================================================
// 7. COMPLETION ACTIONS
// ============================================================================

console.log('\n⌨️  Verifying Completion Actions...');
for (const tool of expectedTools) {
  if (TOOL_ACTIONS[tool]) {
    const completionCount = TOOL_ACTIONS[tool].length;
    const expectedCount = ACTION_COUNTS[tool];
    if (completionCount === expectedCount) {
      console.log(`  ✅ ${tool}: ${completionCount} completion actions`);
    } else {
      addIssue(
        'error',
        'completions',
        `${tool}: completion count ${completionCount} doesn't match expected ${expectedCount}`
      );
    }
  } else {
    addIssue('error', 'completions', `Missing completion actions for ${tool}`);
  }
}

// ============================================================================
// 8. RESOURCES
// ============================================================================

console.log('\n📦 Verifying Resources...');
const resourceRegPath = path.join(__dirname, '../src/mcp/registration/resource-registration.ts');
const resourceRegContent = fs.readFileSync(resourceRegPath, 'utf-8');

const expectedResources = [
  'spreadsheet',
  'spreadsheet_range',
  'spreadsheet_charts',
  'spreadsheet_pivots',
  'quality_report',
];

for (const resource of expectedResources) {
  if (resourceRegContent.includes(`'${resource}'`)) {
    console.log(`  ✅ Resource: ${resource}`);
  } else {
    addIssue('warning', 'resources', `Resource '${resource}' might not be registered`);
  }
}

// ============================================================================
// 9. PROMPTS
// ============================================================================

console.log('\n💬 Verifying Prompts...');
const promptRegPath = path.join(__dirname, '../src/mcp/registration/prompt-registration.ts');
const promptRegContent = fs.readFileSync(promptRegPath, 'utf-8');

const expectedPrompts = [
  'analyze-spreadsheet',
  'fix-formulas',
  'create-visualization',
  'optimize-structure',
  'generate-report',
  'setup-collaboration',
];

for (const prompt of expectedPrompts) {
  if (promptRegContent.includes(`'${prompt}'`)) {
    console.log(`  ✅ Prompt: ${prompt}`);
  } else {
    addIssue('warning', 'prompts', `Prompt '${prompt}' might not be registered`);
  }
}

// ============================================================================
// 10. MCP FEATURES
// ============================================================================

console.log('\n🎯 Verifying MCP 2025-11-25 Features...');
const featuresPath = path.join(__dirname, '../src/mcp/features-2025-11-25.ts');
const featuresContent = fs.readFileSync(featuresPath, 'utf-8');

const requiredFeatures = [
  'TOOL_EXECUTION_CONFIG',
  'TOOL_ICONS',
  'taskSupport',
  'cachePolicy',
  'rateLimitPolicy',
];

for (const feature of requiredFeatures) {
  if (featuresContent.includes(feature)) {
    console.log(`  ✅ Feature: ${feature}`);
  } else {
    addIssue('error', 'mcp-features', `Missing MCP feature: ${feature}`);
  }
}

// ============================================================================
// REPORT
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('📊 VERIFICATION REPORT');
console.log('='.repeat(80));

const errors = issues.filter((i) => i.severity === 'error');
const warnings = issues.filter((i) => i.severity === 'warning');

console.log(`\nTotal Issues: ${issues.length}`);
console.log(`  🔴 Errors: ${errors.length}`);
console.log(`  🟡 Warnings: ${warnings.length}`);

if (issues.length === 0) {
  console.log('\n✨ Perfect! All components are properly wired and integrated!\n');
  console.log('Summary:');
  console.log(`  • 21 tools defined and registered`);
  console.log(`  • 294 actions implemented`);
  console.log(`  • All handlers present`);
  console.log(`  • All schemas defined`);
  console.log(`  • All descriptions present`);
  console.log(`  • All resources registered`);
  console.log(`  • All prompts registered`);
  console.log(`  • MCP 2025-11-25 features implemented`);
  process.exit(0);
} else {
  console.log('\n❌ Issues found:\n');
  for (const issue of issues) {
    const icon = issue.severity === 'error' ? '🔴' : '🟡';
    console.log(`${icon} [${issue.component}] ${issue.message}`);
  }
  process.exit(errors.length > 0 ? 1 : 0);
}
