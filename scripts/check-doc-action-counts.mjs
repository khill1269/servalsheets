#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { hasFreshDocFactsFile, loadSourceDocFacts } from './lib/docs-facts.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const facts = loadSourceDocFacts(ROOT);

const ROOT_DOCS = [
  'README.md',
  'CLAUDE.md',
  'add-on/README.md',
];

const ADDITIONAL_DOCS = [
  'src/mcp/completions.ts',
  'src/mcp/registration/prompt-registration.ts',
  'src/config/constants.ts',
  'src/schemas/descriptions.ts',
  'src/schemas/action-metadata.ts',
];

const HISTORICAL_DOC_DIRS = new Set(['releases', 'historical', 'archive', 'audits', 'review']);

function readLines(filePath) {
  return readFileSync(join(ROOT, filePath), 'utf8').split('\n');
}

function walkDocs(dirPath) {
  const files = [];

  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!HISTORICAL_DOC_DIRS.has(entry)) {
        files.push(...walkDocs(fullPath));
      }
      continue;
    }

    if (entry.endsWith('.md')) {
      files.push(relative(ROOT, fullPath));
    }
  }

  return files;
}

const ACTIVE_DOCS = [...new Set([
  ...ROOT_DOCS.filter(filePath => existsSync(join(ROOT, filePath))),
  ...walkDocs(join(ROOT, 'docs')),
])].sort();

function extractNumericLiterals(line) {
  return [...line.matchAll(/`?(\d{1,4})`?/g)]
    .map(match => Number.parseInt(match[1], 10))
    .filter(value => value < 1000);
}

function isProgressionOrDeltaLine(line) {
  return /\bnew tools\b|\bnew actions\b|→|->/i.test(line);
}

function scanFile(filePath, severity = 'warning') {
  const issues = [];
  const warnings = [];
  const lines = readLines(filePath);

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;

    const combinedMatch = line.match(
      /(?<![\d.])(\d+)(?:\s+\w+){0,2}\s+tools?[^\n]{0,80}?(?<![\d.])(\d+)(?:\s+\w+){0,2}\s+actions?/i,
    );
    if (combinedMatch && !isProgressionOrDeltaLine(line)) {
      const toolCount = Number.parseInt(combinedMatch[1], 10);
      const actionCount = Number.parseInt(combinedMatch[2], 10);

      if (toolCount !== facts.counts.tools) {
        issues.push(
          `${filePath}:${lineNumber}: combined pattern has '${toolCount} tools' (expected '${facts.counts.tools} tools')`,
        );
      }
      if (actionCount !== facts.counts.actions) {
        issues.push(
          `${filePath}:${lineNumber}: combined pattern has '${actionCount} actions' (expected '${facts.counts.actions} actions')`,
        );
      }
      continue;
    }

    const toolRowMatch = line.match(
      /^\|\s*(?:\*\*)?(?:TOOL_COUNT|Tools?)(?:\*\*)?\s*\|\s*(?:\*\*)?`?(\d{1,4})`?/i,
    );
    if (toolRowMatch) {
      const toolCount = Number.parseInt(toolRowMatch[1], 10);
      if (toolCount != null && toolCount !== facts.counts.tools) {
        const message = `${filePath}:${lineNumber}: tool count row has '${toolCount}' (expected '${facts.counts.tools}')`;
        if (severity === 'error') {
          issues.push(message);
        } else {
          warnings.push(message);
        }
      }
      continue;
    }

    const actionRowMatch = line.match(
      /^\|\s*(?:\*\*)?(?:ACTION_COUNT|Actions)(?:\*\*)?\s*\|\s*(?:\*\*)?`?(\d{1,4})`?/i,
    );
    if (actionRowMatch) {
      const actionCount = Number.parseInt(actionRowMatch[1], 10);
      if (actionCount != null && actionCount !== facts.counts.actions) {
        const message = `${filePath}:${lineNumber}: action count row has '${actionCount}' (expected '${facts.counts.actions}')`;
        if (severity === 'error') {
          issues.push(message);
        } else {
          warnings.push(message);
        }
      }
    }
  }

  return { issues, warnings };
}

const staleFactsFile = !hasFreshDocFactsFile(ROOT, facts);
const errors = [];
const warnings = [];

console.log('🔍 Comprehensive documentation validation...\n');
console.log(`Source of truth: ${facts.counts.tools} tools, ${facts.counts.actions} actions`);
console.log(`Generated facts file: ${staleFactsFile ? 'STALE or missing' : 'fresh'}\n`);

if (staleFactsFile) {
  errors.push(
    `docs/generated/facts.json is stale or missing. Run: node scripts/gen-doc-facts.mjs`,
  );
}

console.log('Validating active documentation files...');
for (const filePath of ACTIVE_DOCS) {
  const result = scanFile(filePath, 'error');
  errors.push(...result.issues);
  warnings.push(...result.warnings);
}
console.log(
  errors.length === 0
    ? '  ✅ All active docs match source of truth'
    : `  ❌ Found ${errors.length} mismatch(es) in active docs`,
);
console.log('');

console.log('Checking additional documentation files...');
for (const filePath of ADDITIONAL_DOCS) {
  if (!existsSync(join(ROOT, filePath))) {
    continue;
  }

  const result = scanFile(filePath, 'warning');
  warnings.push(...result.issues, ...result.warnings);
}
console.log(
  warnings.length === 0
    ? '  ✅ All additional docs match source of truth'
    : `  ⚠️  Found ${warnings.length} potential issue(s) in additional docs`,
);
console.log('');

if (warnings.length > 0) {
  console.log('========================================================================\n');
  console.log('⚠️  WARNINGS (non-critical):\n');
  for (const warning of warnings) {
    console.log(`  - ${warning}`);
  }
  console.log('');
}

if (errors.length > 0) {
  console.log('❌ DOCUMENTATION VALIDATION FAILED\n');
  console.log(`   Found ${errors.length} critical error(s):\n`);
  for (const error of errors) {
    console.log(`   - ${error}`);
  }
  process.exit(1);
}

console.log('✅ DOCUMENTATION VALIDATION PASSED');
