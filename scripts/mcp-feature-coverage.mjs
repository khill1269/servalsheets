#!/usr/bin/env node
/**
 * MCP Feature Coverage Scanner
 *
 * Scans the codebase and reports which MCP 2025-11-25 advanced features are used,
 * where they're used, and whether tests cover each feature.
 *
 * Usage:
 *   node scripts/mcp-feature-coverage.mjs
 *   node scripts/mcp-feature-coverage.mjs --json      # machine-readable output
 *
 * Exit codes:
 *   0 = all features have test coverage
 *   1 = one or more features lack test coverage
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const ROOT = join(__dirname, '..');
const JSON_MODE = process.argv.includes('--json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function walkTs(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkTs(full, files);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.mjs')) files.push(full);
  }
  return files;
}

function grep(files, pattern) {
  const re = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  const matches = [];
  for (const f of files) {
    try {
      const content = readFileSync(f, 'utf8');
      if (re.test(content)) matches.push(relative(ROOT, f));
    } catch {
      // skip unreadable files
    }
  }
  return matches;
}

// ── Scan ─────────────────────────────────────────────────────────────────────

const srcFiles = walkTs(join(ROOT, 'src'));
const testFiles = walkTs(join(ROOT, 'tests'));
const handlerFiles = srcFiles.filter((f) => f.includes('/handlers/'));

const features = {
  sampling: {
    description: 'MCP sampling — server-initiated LLM calls with consent gating (SEP-1577)',
    sourceFiles: grep(
      handlerFiles,
      /assertSamplingConsent|requestSampling|callSampling|sampling\.ts/
    ),
    testFiles: grep(testFiles, /sampling/i),
    consentGated: grep(srcFiles, /assertSamplingConsent|SAMPLING_CONSENT_REQUIRED/).length > 0,
    implementation: grep(srcFiles, /src\/mcp\/sampling\.ts|src\/utils\/sampling-consent\.ts/),
  },

  elicitation: {
    description: 'MCP elicitation — server-initiated user input requests (SEP-1036)',
    sourceFiles: grep(
      handlerFiles,
      /confirmDestructiveAction|elicitSpreadsheetCreation|runWizard|elicit[A-Z]/
    ),
    testFiles: grep(testFiles, /elicitation/i),
    wizardCount: grep(srcFiles, /runWizard\(/).length,
    implementation: grep(srcFiles, /src\/mcp\/elicitation\.ts/),
  },

  tasks: {
    description: 'MCP tasks — long-running async operations with progress (SEP-1686)',
    sourceFiles: grep(handlerFiles, /taskStatusUpdater|updateTaskStatus|TaskStatusUpdater/),
    testFiles: grep(testFiles, /task.*aware|task-aware|tasks/i),
    implementation: grep(srcFiles, /tasks\.ts|task-aware/),
  },

  sessionContext: {
    description: 'MCP session context — per-session state shared across tool calls',
    sourceFiles: grep(handlerFiles, /sessionContext|getSessionContext|recordOperation/),
    testFiles: grep(testFiles, /session.?context|session-context/i),
    implementation: grep(srcFiles, /session-context/),
  },

  contentAudience: {
    description:
      'MCP content audience annotations — assistant-only vs user+assistant content (2025-11-25)',
    sourceFiles: grep(srcFiles, /audience.*assistant|content.*audience|\['assistant'\]/),
    testFiles: grep(testFiles, /content.?audience|audience/i),
    implementation: grep(srcFiles, /features-2025-11-25/),
  },

  completions: {
    description: 'MCP completions — context-aware range and argument completion',
    sourceFiles: grep(srcFiles, /recordRange|recordSpreadsheetId|getCompletions/),
    testFiles: grep(testFiles, /completions/i),
    implementation: grep(srcFiles, /src\/mcp\/completions\.ts/),
  },

  toolsListChanged: {
    description: 'MCP tools/list changed notifications + staged registration',
    sourceFiles: grep(srcFiles, /ENABLE_TOOLS_LIST_CHANGED|tools.*listChanged|STAGED_REGISTRATION/),
    testFiles: grep(testFiles, /tools.list.changed|staged.registration/i),
    implementation: grep(srcFiles, /tool-catalog|STAGED_REGISTRATION/),
  },

  resources: {
    description: 'MCP resources — server-provided read-only resource URIs',
    sourceFiles: grep(srcFiles, /registerResource|resource-registration/),
    testFiles: grep(testFiles, /resource/i),
    implementation: grep(srcFiles, /resource-registration/),
  },

  prompts: {
    description: 'MCP prompts — server-provided reusable prompt templates',
    sourceFiles: grep(srcFiles, /registerPrompt|prompt-registration/),
    testFiles: grep(testFiles, /prompt-registration|mcp.*prompt/i),
    implementation: grep(srcFiles, /prompt-registration/),
  },
};

// ── Report ────────────────────────────────────────────────────────────────────

let hasGaps = false;

if (JSON_MODE) {
  console.log(JSON.stringify(features, null, 2));
} else {
  console.log('\nMCP 2025-11-25 Feature Coverage Report');
  console.log('═'.repeat(60));

  for (const [name, info] of Object.entries(features)) {
    const srcCount = info.sourceFiles?.length ?? 0;
    const testCount = info.testFiles?.length ?? 0;
    const status = testCount === 0 ? '✗ NO TESTS' : srcCount === 0 ? '○ UNUSED' : '✓ COVERED';
    if (testCount === 0 && srcCount > 0) hasGaps = true;

    console.log(`\n${status}  ${name}`);
    console.log(`  ${info.description}`);
    if (srcCount > 0) console.log(`  Source: ${srcCount} file(s) using this feature`);
    if (testCount > 0) console.log(`  Tests:  ${testCount} test file(s)`);
    if (testCount === 0 && srcCount > 0) {
      console.log(`  ⚠ Missing tests for: ${info.sourceFiles.slice(0, 3).join(', ')}`);
    }
    if ('consentGated' in info) console.log(`  Consent-gated: ${String(info.consentGated)}`);
    if ('wizardCount' in info) console.log(`  Wizard count: ${String(info.wizardCount)}`);
  }

  console.log('\n' + '═'.repeat(60));
  if (hasGaps) {
    console.log('FAIL: One or more active MCP features lack test coverage.\n');
  } else {
    console.log('PASS: All active MCP features have test coverage.\n');
  }
}

process.exit(hasGaps ? 1 : 0);
