#!/usr/bin/env tsx
/**
 * Comprehensive Tool Validation Script
 *
 * Validates that all 24 tools are properly wired:
 * - Tool definitions exist
 * - Handlers exist and are wired
 * - Descriptions exist
 * - Schemas exist and match
 * - Annotations exist
 * - Incremental scope configured where needed
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ValidationIssue {
  tool: string;
  category: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

const issues: ValidationIssue[] = [];

// Expected 24 tools
const EXPECTED_TOOLS = [
  'sheets_auth',
  'sheets_spreadsheet',
  'sheets_sheet',
  'sheets_values',
  'sheets_cells',
  'sheets_format',
  'sheets_dimensions',
  'sheets_rules',
  'sheets_charts',
  'sheets_pivot',
  'sheets_filter_sort',
  'sheets_sharing',
  'sheets_comments',
  'sheets_versions',
  'sheets_analysis',
  'sheets_advanced',
  'sheets_transaction',
  'sheets_validation',
  'sheets_conflict',
  'sheets_impact',
  'sheets_history',
  'sheets_confirm',
  'sheets_analyze',
  'sheets_fix',
];

// Tools that need elevated Drive scopes
const DRIVE_SCOPE_TOOLS = [
  'sheets_spreadsheet', // create action
  'sheets_sharing',     // all actions
];

const rootDir = path.resolve(__dirname, '..');

console.log('🔍 ServalSheets Tool Validation\n');
console.log(`Validating ${EXPECTED_TOOLS.length} tools...\n`);

// ============================================================================
// 1. Check Tool Definitions
// ============================================================================
console.log('📋 Step 1: Checking tool definitions in registration.ts...');
const registrationPath = path.join(rootDir, 'src/mcp/registration.ts');
const registrationContent = fs.readFileSync(registrationPath, 'utf-8');

for (const tool of EXPECTED_TOOLS) {
  const toolDefPattern = new RegExp(`name:\\s*['"](${tool})['"]`, 'g');
  const matches = registrationContent.match(toolDefPattern);

  if (!matches || matches.length === 0) {
    issues.push({
      tool,
      category: 'definition',
      severity: 'error',
      message: 'Tool definition missing in TOOL_DEFINITIONS array'
    });
  } else if (matches.length > 1) {
    issues.push({
      tool,
      category: 'definition',
      severity: 'warning',
      message: `Tool defined multiple times (${matches.length} times)`
    });
  }
}

const definedCount = EXPECTED_TOOLS.filter(tool => {
  const pattern = new RegExp(`name:\\s*['"](${tool})['"]`);
  return pattern.test(registrationContent);
}).length;

console.log(`   ✓ Found ${definedCount}/${EXPECTED_TOOLS.length} tool definitions\n`);

// ============================================================================
// 2. Check Handlers
// ============================================================================
console.log('📂 Step 2: Checking handler files...');
const handlersDir = path.join(rootDir, 'src/handlers');
const handlerFiles = fs.readdirSync(handlersDir).filter(f => f.endsWith('.ts') && f !== 'base.ts' && f !== 'index.ts');

console.log(`   Found ${handlerFiles.length} handler files`);

// Check if each tool has a handler mapping
for (const tool of EXPECTED_TOOLS) {
  const toolKey = tool.replace('sheets_', '');
  const expectedFile = `${toolKey}.ts`;

  if (!handlerFiles.includes(expectedFile)) {
    issues.push({
      tool,
      category: 'handler-file',
      severity: 'error',
      message: `Handler file missing: ${expectedFile}`
    });
  }

  // Check handler is wired in createToolHandlerMap
  const handlerPattern = new RegExp(`['"]${tool}['"]:\\s*\\(args\\)`, 'g');
  if (!handlerPattern.test(registrationContent)) {
    issues.push({
      tool,
      category: 'handler-wiring',
      severity: 'error',
      message: 'Handler not wired in createToolHandlerMap'
    });
  }
}

console.log(`   ✓ Checked handler wiring\n`);

// ============================================================================
// 3. Check Descriptions
// ============================================================================
console.log('📝 Step 3: Checking tool descriptions...');
const descriptionsPath = path.join(rootDir, 'src/schemas/descriptions.ts');
const descriptionsContent = fs.readFileSync(descriptionsPath, 'utf-8');

for (const tool of EXPECTED_TOOLS) {
  const descPattern = new RegExp(`^\\s*${tool}:\\s*\``, 'm');
  if (!descPattern.test(descriptionsContent)) {
    issues.push({
      tool,
      category: 'description',
      severity: 'error',
      message: 'Description missing in TOOL_DESCRIPTIONS'
    });
  } else {
    // Check if description mentions "WHEN TO USE" or similar guidance
    const toolDescStart = descriptionsContent.indexOf(`${tool}:`);
    const nextToolStart = descriptionsContent.indexOf('\n  sheets_', toolDescStart + 1);
    const toolDesc = descriptionsContent.slice(toolDescStart, nextToolStart > 0 ? nextToolStart : descriptionsContent.length);

    if (!toolDesc.includes('Quick Examples') && !toolDesc.includes('**Quick Examples:**')) {
      issues.push({
        tool,
        category: 'description',
        severity: 'warning',
        message: 'Description missing "Quick Examples" section'
      });
    }

    // Check for critical tools that need strong guidance
    if (['sheets_confirm', 'sheets_transaction', 'sheets_dimensions'].includes(tool)) {
      if (!toolDesc.includes('WHEN') && !toolDesc.includes('When')) {
        issues.push({
          tool,
          category: 'description',
          severity: 'warning',
          message: 'Critical tool missing "WHEN TO USE" guidance'
        });
      }
    }
  }
}

console.log(`   ✓ Checked descriptions\n`);

// ============================================================================
// 4. Check Schemas
// ============================================================================
console.log('🔷 Step 4: Checking schemas...');

for (const tool of EXPECTED_TOOLS) {
  const schemaName = tool.split('_').map((part, i) =>
    i === 0 ? 'Sheets' : part.charAt(0).toUpperCase() + part.slice(1)
  ).join('') + 'InputSchema';

  const schemaPattern = new RegExp(`${schemaName}`, 'g');
  if (!schemaPattern.test(registrationContent)) {
    issues.push({
      tool,
      category: 'schema',
      severity: 'error',
      message: `Input schema ${schemaName} not imported or used`
    });
  }
}

console.log(`   ✓ Checked schema imports\n`);

// ============================================================================
// 5. Check Incremental Scope Coverage
// ============================================================================
console.log('🔒 Step 5: Checking incremental scope coverage...');

for (const tool of DRIVE_SCOPE_TOOLS) {
  const handlerFile = tool.replace('sheets_', '') + '.ts';
  const handlerPath = path.join(handlersDir, handlerFile);

  if (fs.existsSync(handlerPath)) {
    const handlerContent = fs.readFileSync(handlerPath, 'utf-8');

    if (!handlerContent.includes('ScopeValidator')) {
      issues.push({
        tool,
        category: 'scope',
        severity: 'error',
        message: 'Missing ScopeValidator import (needs incremental scope)'
      });
    }

    if (!handlerContent.includes('validateOperation') && !handlerContent.includes('getOperationRequirements')) {
      issues.push({
        tool,
        category: 'scope',
        severity: 'error',
        message: 'Missing scope validation logic'
      });
    }
  }
}

console.log(`   ✓ Checked incremental scope\n`);

// ============================================================================
// 6. Check Annotations
// ============================================================================
console.log('🏷️  Step 6: Checking annotations...');
const annotationsPath = path.join(rootDir, 'src/schemas/annotations.ts');
const annotationsContent = fs.readFileSync(annotationsPath, 'utf-8');

for (const tool of EXPECTED_TOOLS) {
  const annotationName = tool.toUpperCase() + '_ANNOTATIONS';
  const annotationPattern = new RegExp(`export const ${annotationName}`, 'g');

  if (!annotationPattern.test(annotationsContent)) {
    issues.push({
      tool,
      category: 'annotations',
      severity: 'error',
      message: `Annotations constant ${annotationName} missing`
    });
  }
}

console.log(`   ✓ Checked annotations\n`);

// ============================================================================
// Results
// ============================================================================
console.log('═'.repeat(70));
console.log('VALIDATION RESULTS');
console.log('═'.repeat(70));
console.log();

const errors = issues.filter(i => i.severity === 'error');
const warnings = issues.filter(i => i.severity === 'warning');
const infos = issues.filter(i => i.severity === 'info');

if (issues.length === 0) {
  console.log('✅ ALL CHECKS PASSED! All 24 tools are properly wired.\n');
  console.log('Summary:');
  console.log(`  • ${EXPECTED_TOOLS.length} tools defined`);
  console.log(`  • ${handlerFiles.length} handler files`);
  console.log(`  • All descriptions present`);
  console.log(`  • All schemas wired`);
  console.log(`  • Incremental scope configured`);
  console.log(`  • All annotations defined`);
  console.log();
  process.exit(0);
}

console.log(`Found ${issues.length} issue(s):\n`);

if (errors.length > 0) {
  console.log(`🔴 ERRORS (${errors.length}):`);
  errors.forEach(issue => {
    console.log(`   ${issue.tool} [${issue.category}]: ${issue.message}`);
  });
  console.log();
}

if (warnings.length > 0) {
  console.log(`⚠️  WARNINGS (${warnings.length}):`);
  warnings.forEach(issue => {
    console.log(`   ${issue.tool} [${issue.category}]: ${issue.message}`);
  });
  console.log();
}

if (infos.length > 0) {
  console.log(`ℹ️  INFO (${infos.length}):`);
  infos.forEach(issue => {
    console.log(`   ${issue.tool} [${issue.category}]: ${issue.message}`);
  });
  console.log();
}

// Group issues by tool
const issuesByTool = new Map<string, ValidationIssue[]>();
for (const issue of issues) {
  if (!issuesByTool.has(issue.tool)) {
    issuesByTool.set(issue.tool, []);
  }
  issuesByTool.get(issue.tool)!.push(issue);
}

console.log('═'.repeat(70));
console.log('ISSUES BY TOOL');
console.log('═'.repeat(70));
console.log();

for (const [tool, toolIssues] of issuesByTool.entries()) {
  const errorCount = toolIssues.filter(i => i.severity === 'error').length;
  const warnCount = toolIssues.filter(i => i.severity === 'warning').length;

  console.log(`${tool}:`);
  console.log(`  ${errorCount} error(s), ${warnCount} warning(s)`);
  toolIssues.forEach(issue => {
    const icon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`  ${icon} [${issue.category}] ${issue.message}`);
  });
  console.log();
}

console.log('═'.repeat(70));

if (errors.length > 0) {
  console.log('❌ VALIDATION FAILED - Fix errors before proceeding');
  process.exit(1);
} else {
  console.log('✅ VALIDATION PASSED - Only warnings found');
  process.exit(0);
}
