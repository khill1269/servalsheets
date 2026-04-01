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
  const seen = new Set();

  function record(message, level = severity) {
    if (seen.has(message)) return;
    seen.add(message);
    if (level === 'error') {
      issues.push(message);
    } else {
      warnings.push(message);
    }
  }

  function recordCountMismatch(lineNumber, label, actual, expected, level = severity, detail = label) {
    if (actual === expected) {
      return;
    }

    record(
      `${filePath}:${lineNumber}: ${detail} has '${actual}' (expected '${expected}')`,
      level,
    );
  }

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;

    const combinedMatch = line.match(
      /(?<![\d.])(\d+)(?:\s+\w+){0,2}\s+tools?[^\n]{0,80}?(?<![\d.])(\d+)(?:\s+\w+){0,2}\s+actions?/i,
    );
    if (combinedMatch && !isProgressionOrDeltaLine(line)) {
      const toolCount = Number.parseInt(combinedMatch[1], 10);
      const actionCount = Number.parseInt(combinedMatch[2], 10);

      if (toolCount !== facts.counts.tools) {
        record(
          `${filePath}:${lineNumber}: combined pattern has '${toolCount} tools' (expected '${facts.counts.tools} tools')`,
          'error',
        );
      }
      if (actionCount !== facts.counts.actions) {
        record(
          `${filePath}:${lineNumber}: combined pattern has '${actionCount} actions' (expected '${facts.counts.actions} actions')`,
          'error',
        );
      }
    }

    const toolRowMatch = line.match(
      /^\|\s*(?:\*\*)?(?:TOOL_COUNT|Tools?)(?:\*\*)?\s*\|\s*(?:\*\*)?`?(\d{1,4})`?/i,
    );
    if (toolRowMatch) {
      const toolCount = Number.parseInt(toolRowMatch[1], 10);
      recordCountMismatch(lineNumber, 'tool count row', toolCount, facts.counts.tools);
    }

    const actionRowMatch = line.match(
      /^\|\s*(?:\*\*)?(?:ACTION_COUNT|Actions)(?:\*\*)?\s*\|\s*(?:\*\*)?`?(\d{1,4})`?/i,
    );
    if (actionRowMatch) {
      const actionCount = Number.parseInt(actionRowMatch[1], 10);
      recordCountMismatch(lineNumber, 'action count row', actionCount, facts.counts.actions);
    }

    const promptRowMatch = line.match(
      /^\|\s*(?:\*\*)?(?:PROMPT_COUNT|Prompts?)(?:\*\*)?\s*\|\s*(?:\*\*)?`?(\d{1,4})`?/i,
    );
    if (promptRowMatch) {
      const promptCount = Number.parseInt(promptRowMatch[1], 10);
      recordCountMismatch(lineNumber, 'prompt count row', promptCount, facts.counts.prompts);
    }

    const resourceRowMatch = line.match(
      /^\|\s*(?:\*\*)?(?:RESOURCE_COUNT|Resources?)(?:\*\*)?\s*\|\s*(?:\*\*)?`?(\d{1,4})`?/i,
    );
    if (resourceRowMatch) {
      const resourceCount = Number.parseInt(resourceRowMatch[1], 10);
      recordCountMismatch(lineNumber, 'resource count row', resourceCount, facts.counts.resources);
    }

    const resourceTemplateRowMatch = line.match(
      /^\|\s*(?:\*\*)?(?:RESOURCE_TEMPLATE_COUNT|URI Templates|Resource Templates?)(?:\*\*)?\s*\|\s*(?:\*\*)?`?(\d{1,4})`?/i,
    );
    if (resourceTemplateRowMatch) {
      const resourceTemplateCount = Number.parseInt(resourceTemplateRowMatch[1], 10);
      recordCountMismatch(
        lineNumber,
        'resource template count row',
        resourceTemplateCount,
        facts.counts.resourceTemplates,
      );
    }

    for (const match of line.matchAll(/(?<![\d.])(\d{1,4})\s+(guided\s+workflows?|prompts?)\b/gi)) {
      recordCountMismatch(
        lineNumber,
        'prompt count',
        Number.parseInt(match[1], 10),
        facts.counts.prompts,
      );
    }

    for (const match of line.matchAll(/(?<![\d.])(\d{1,4})\s+(?:MCP\s+)?resources?\b(?!\s+templates?\b)/gi)) {
      recordCountMismatch(
        lineNumber,
        'resource count',
        Number.parseInt(match[1], 10),
        facts.counts.resources,
      );
    }

    for (const match of line.matchAll(/(?<![\d.])(\d{1,4})\s+(?:URI|resource)\s+templates?\b/gi)) {
      recordCountMismatch(
        lineNumber,
        'resource template count',
        Number.parseInt(match[1], 10),
        facts.counts.resourceTemplates,
      );
    }

    for (const match of line.matchAll(/actions\/workflows\/([A-Za-z0-9._-]+\.ya?ml)/g)) {
      const workflowPath = join(ROOT, '.github/workflows', match[1]);
      if (!existsSync(workflowPath)) {
        record(
          `${filePath}:${lineNumber}: references missing workflow '${match[1]}'`,
          'error',
        );
      }
    }
  }

  return { issues, warnings };
}

const staleFactsFile = !hasFreshDocFactsFile(ROOT, facts);
const errors = [];
const warnings = [];

console.log('🔍 Comprehensive documentation validation...\n');
console.log(
  `Source of truth: ${facts.counts.tools} tools, ${facts.counts.actions} actions, ${facts.counts.prompts} prompts, ${facts.counts.resources} resources, ${facts.counts.resourceTemplates} resource templates`,
);
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
