/**
 * Validate Action Count Consistency
 *
 * Ensures action counts are synchronized across all files:
 * 1. src/schemas/index.ts (TOOL_COUNT / ACTION_COUNT constants)
 * 2. src/schemas/action-metadata.ts (ACTION_METADATA)
 * 3. src/mcp/completions.ts (TOOL_ACTIONS)
 * 4. package.json (description)
 * 5. server.json (metadata)
 *
 * Source of truth:
 * - TOOL_DEFINITIONS.length for tool count
 * - Sum of TOOL_ACTIONS arrays for action count
 *
 * Run: npx tsx scripts/validate-action-counts.ts
 * CI: npm run validate:actions
 *
 * Exit codes:
 * 0 = All validations passed
 * 1 = Validation failures detected
 */

import { readFileSync } from 'fs';
import { TOOL_DEFINITIONS } from '../src/mcp/registration/tool-definitions.js';
import { TOOL_ACTIONS } from '../src/mcp/completions.js';

interface ValidationResult {
  file: string;
  toolCount: number;
  actionCount: number;
  issues: string[];
}

/**
 * Validate src/schemas/index.ts constants against source-of-truth maps
 */
function validateSchemaIndex(expectedToolCount: number, expectedActionCount: number): ValidationResult {
  const filePath = './src/schemas/index.ts';
  const content = readFileSync(filePath, 'utf-8');

  const issues: string[] = [];

  // Extract TOOL_COUNT
  const toolCountMatch = content.match(/export const TOOL_COUNT = (\d+);/);
  const toolCount = toolCountMatch ? parseInt(toolCountMatch[1]) : 0;

  // Extract ACTION_COUNT
  const actionCountMatch = content.match(/export const ACTION_COUNT = (\d+);/);
  const actionCount = actionCountMatch ? parseInt(actionCountMatch[1]) : 0;

  if (toolCount !== expectedToolCount) {
    issues.push(
      `TOOL_COUNT constant (${toolCount}) doesn't match source of truth (${expectedToolCount})`
    );
  }

  if (actionCount !== expectedActionCount) {
    issues.push(
      `ACTION_COUNT constant (${actionCount}) doesn't match source of truth (${expectedActionCount})`
    );
  }

  if (toolCount === 0) {
    issues.push('TOOL_COUNT not found or is 0');
  }

  if (actionCount === 0) {
    issues.push('ACTION_COUNT not found or is 0');
  }

  return {
    file: filePath,
    toolCount,
    actionCount,
    issues,
  };
}

/**
 * Validate ACTION_METADATA has entries for all tools
 */
function validateActionMetadata(expectedToolCount: number): ValidationResult {
  const filePath = './src/schemas/action-metadata.ts';
  const content = readFileSync(filePath, 'utf-8');

  const issues: string[] = [];

  // Count tool entries (sheets_xxx: {)
  const toolMatches = content.match(/\s+sheets_\w+:\s+\{/g);
  const toolCount = toolMatches ? toolMatches.length : 0;

  // Count total action entries across all tools
  let actionCount = 0;
  const actionMatches = content.match(/\s+[a-z_]+:\s+\{[\s\S]*?readOnly:/g);
  actionCount = actionMatches ? actionMatches.length : 0;

  if (toolCount !== expectedToolCount) {
    issues.push(`Tool count (${toolCount}) doesn't match expected (${expectedToolCount})`);
  }

  if (actionCount === 0) {
    issues.push('No action metadata found');
  }

  return {
    file: filePath,
    toolCount,
    actionCount,
    issues,
  };
}

/**
 * Validate package.json description
 */
function validatePackageJson(expectedTools: number, expectedActions: number): ValidationResult {
  const filePath = './package.json';
  const content = JSON.parse(readFileSync(filePath, 'utf-8'));

  const issues: string[] = [];
  const description = content.description || '';

  // Extract numbers from description
  const toolMatch = description.match(/(\d+)\s+tools?/);
  const actionMatch = description.match(/(\d+)\s+actions?/);

  const toolCount = toolMatch ? parseInt(toolMatch[1]) : 0;
  const actionCount = actionMatch ? parseInt(actionMatch[1]) : 0;

  if (toolCount !== expectedTools) {
    issues.push(
      `Tool count in description (${toolCount}) doesn't match expected (${expectedTools})`
    );
  }

  if (actionCount !== expectedActions) {
    issues.push(
      `Action count in description (${actionCount}) doesn't match expected (${expectedActions})`
    );
  }

  return {
    file: filePath,
    toolCount,
    actionCount,
    issues,
  };
}

/**
 * Validate server.json metadata
 */
function validateServerJson(expectedTools: number, expectedActions: number): ValidationResult {
  const filePath = './server.json';
  const content = JSON.parse(readFileSync(filePath, 'utf-8'));

  const issues: string[] = [];
  const metadata = content.metadata || {};

  const toolCount = metadata.toolCount || 0;
  const actionCount = metadata.actionCount || 0;

  if (toolCount !== expectedTools) {
    issues.push(`toolCount (${toolCount}) doesn't match expected (${expectedTools})`);
  }

  if (actionCount !== expectedActions) {
    issues.push(`actionCount (${actionCount}) doesn't match expected (${expectedActions})`);
  }

  return {
    file: filePath,
    toolCount,
    actionCount,
    issues,
  };
}

/**
 * Validate src/mcp/completions.ts TOOL_ACTIONS
 */
function validateCompletions(expectedToolCount: number, expectedActionCount: number): ValidationResult {
  const filePath = './src/mcp/completions.ts';
  const content = readFileSync(filePath, 'utf-8');

  const issues: string[] = [];

  // Count tool entries in TOOL_ACTIONS
  const toolMatches = content.match(/\s+sheets_\w+:\s+\[/g);
  const toolCount = toolMatches ? toolMatches.length : 0;

  // Count total actions across all tools
  let actionCount = 0;
  const sectionMatches = content.match(/sheets_\w+:\s+\[([\s\S]*?)\]/g);
  if (sectionMatches) {
    for (const section of sectionMatches) {
      const actions = section.match(/['"][a-z_]+['"]/g);
      if (actions) {
        actionCount += actions.length;
      }
    }
  }

  if (toolCount !== expectedToolCount) {
    issues.push(
      `Tool count in TOOL_ACTIONS (${toolCount}) doesn't match expected (${expectedToolCount})`
    );
  }

  if (actionCount !== expectedActionCount) {
    issues.push(
      `Action count in TOOL_ACTIONS (${actionCount}) doesn't match expected (${expectedActionCount})`
    );
  }

  return {
    file: filePath,
    toolCount,
    actionCount,
    issues,
  };
}

/**
 * Main validation execution
 */
function runValidation(): void {
  console.log('='.repeat(70));
  console.log('ACTION COUNT VALIDATION');
  console.log('='.repeat(70));
  console.log();

  const results: ValidationResult[] = [];
  const sourceOfTruthToolCount = TOOL_DEFINITIONS.length;
  const sourceOfTruthActionCount = Object.values(TOOL_ACTIONS).reduce(
    (sum, actions) => sum + actions.length,
    0
  );

  console.log(`Source of truth: ${sourceOfTruthToolCount} tools, ${sourceOfTruthActionCount} actions`);
  console.log();

  // 1. Validate schema index (source of truth)
  console.log('📝 Validating src/schemas/index.ts...');
  const schemaResult = validateSchemaIndex(sourceOfTruthToolCount, sourceOfTruthActionCount);
  results.push(schemaResult);

  if (schemaResult.issues.length > 0) {
    console.log('❌ FAILED');
    schemaResult.issues.forEach((issue) => console.log(`   ${issue}`));
    console.log();
    console.log('Cannot proceed with other validations due to source of truth errors.');
    process.exit(1);
  } else {
    console.log(`✓ ${schemaResult.toolCount} tools, ${schemaResult.actionCount} actions`);
  }
  console.log();

  // 2. Validate action metadata
  console.log('📝 Validating src/schemas/action-metadata.ts...');
  const metadataResult = validateActionMetadata(sourceOfTruthToolCount);
  results.push(metadataResult);

  if (metadataResult.issues.length > 0) {
    console.log('❌ FAILED');
    metadataResult.issues.forEach((issue) => console.log(`   ${issue}`));
  } else {
    console.log(
      `✓ ${metadataResult.toolCount} tools, ${metadataResult.actionCount} action entries`
    );
  }
  console.log();

  // 3. Validate package.json
  console.log('📝 Validating package.json...');
  const packageResult = validatePackageJson(sourceOfTruthToolCount, sourceOfTruthActionCount);
  results.push(packageResult);

  if (packageResult.issues.length > 0) {
    console.log('❌ FAILED');
    packageResult.issues.forEach((issue) => console.log(`   ${issue}`));
  } else {
    console.log('✓ Description matches expected counts');
  }
  console.log();

  // 4. Validate server.json
  console.log('📝 Validating server.json...');
  const serverResult = validateServerJson(sourceOfTruthToolCount, sourceOfTruthActionCount);
  results.push(serverResult);

  if (serverResult.issues.length > 0) {
    console.log('❌ FAILED');
    serverResult.issues.forEach((issue) => console.log(`   ${issue}`));
  } else {
    console.log('✓ Metadata matches expected counts');
  }
  console.log();

  // 5. Validate completions
  console.log('📝 Validating src/mcp/completions.ts...');
  const completionsResult = validateCompletions(
    sourceOfTruthToolCount,
    sourceOfTruthActionCount
  );
  results.push(completionsResult);

  if (completionsResult.issues.length > 0) {
    console.log('❌ FAILED');
    completionsResult.issues.forEach((issue) => console.log(`   ${issue}`));
  } else {
    console.log(`✓ ${completionsResult.toolCount} tools, ${completionsResult.actionCount} actions`);
  }
  console.log();

  // Summary
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

  console.log(`Files validated: ${results.length}`);
  console.log(`Total issues: ${totalIssues}`);
  console.log();

  if (totalIssues > 0) {
    console.log('❌ VALIDATION FAILED');
    console.log('   Run npm run gen:metadata to regenerate metadata files');
    process.exit(1);
  } else {
    console.log('✅ ALL VALIDATIONS PASSED');
    console.log(`   ${sourceOfTruthToolCount} tools with ${sourceOfTruthActionCount} actions`);
    process.exit(0);
  }
}

// Run validation
runValidation();
