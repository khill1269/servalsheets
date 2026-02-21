#!/usr/bin/env tsx
/**
 * Synchronize documentation counts with source of truth
 *
 * Scans documentation and source files for hardcoded tool/action counts
 * and replaces them with current values from action-counts.ts.
 *
 * Usage:
 *   tsx scripts/sync-doc-counts.ts          # Fix all counts
 *   tsx scripts/sync-doc-counts.ts --check  # Check only (exit 1 on drift)
 *
 * This replaces the old bash script (check-doc-action-counts.sh) with a
 * more robust TypeScript implementation that can also fix issues.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const CHECK_ONLY = process.argv.includes('--check');

// ============================================================================
// SOURCE OF TRUTH
// ============================================================================

// Parse action-counts.ts to get current counts without requiring compilation
function getCountsFromSource(): { toolCount: number; actionCount: number } {
  const actionCountsPath = join(ROOT, 'src/schemas/action-counts.ts');
  const content = readFileSync(actionCountsPath, 'utf-8');

  // Extract counts from the ACTION_COUNTS record
  const matches = content.matchAll(/sheets_\w+:\s*(\d+)/g);
  let totalActions = 0;
  let totalTools = 0;

  for (const match of matches) {
    totalTools++;
    totalActions += parseInt(match[1], 10);
  }

  if (totalTools === 0 || totalActions === 0) {
    console.error('❌ Failed to parse action-counts.ts');
    process.exit(1);
  }

  return { toolCount: totalTools, actionCount: totalActions };
}

const { toolCount: TOOL_COUNT, actionCount: ACTION_COUNT } = getCountsFromSource();
console.log(`📊 Source of truth: ${TOOL_COUNT} tools, ${ACTION_COUNT} actions\n`);

// ============================================================================
// FILES TO SCAN
// ============================================================================

// Known old counts that should be replaced
const OLD_ACTION_COUNTS = [272, 291, 293, 294, 298, 299];
const OLD_TOOL_COUNTS = [20, 21];

// Files to scan and fix (root-level and specific known files)
const DOC_FILES = [
  'README.md',
  'CLAUDE.md',
  'OPEN_QUESTIONS.md',
  'SECURITY.md',
  'PRIORITIZED_REMEDIATION_PLAN.md',
  'openapi.json',
  'FINDINGS_REGISTRY.json',
  'server.json',
  'manifest.json',
  'docs/guides/SKILL.md',
  'docs/development/PROJECT_STATUS.md',
  'docs/development/SOURCE_OF_TRUTH.md',
  'tests/manual/TEST_PLAN.md',
];

// Directories to exclude
const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  'docs/archive',
  'docs/generated',
  'docs/releases',
  'coverage',
  '.nyc_output',
]);

// Files to exclude
const EXCLUDE_FILES = new Set(['CHANGELOG.md', 'package-lock.json']);

// File extensions to scan in directory walks
const SCANNABLE_EXTENSIONS = new Set([
  '.ts',
  '.md',
  '.json',
  '.sh',
  '.js',
  '.mjs',
  '.txt',
  '.html',
]);

// ============================================================================
// REPLACEMENT LOGIC
// ============================================================================

interface Replacement {
  file: string;
  line: number;
  old: string;
  new: string;
}

const replacements: Replacement[] = [];
const errors: string[] = [];

function scanFile(filePath: string): void {
  const absPath = join(ROOT, filePath);
  let content: string;
  try {
    content = readFileSync(absPath, 'utf-8');
  } catch {
    return; // File doesn't exist, skip
  }

  const lines = content.split('\n');
  let modified = false;
  let newContent = content;

  // Replace old action counts in "X actions" patterns
  for (const oldCount of OLD_ACTION_COUNTS) {
    const pattern = new RegExp(`\\b${oldCount}\\s+actions\\b`, 'g');
    if (pattern.test(newContent)) {
      const replacement = `${ACTION_COUNT} actions`;
      newContent = newContent.replace(pattern, replacement);
      modified = true;
      replacements.push({
        file: filePath,
        line: 0,
        old: `${oldCount} actions`,
        new: replacement,
      });
    }
  }

  // Replace old tool counts in "X tools" patterns (only in combined "X tools, Y actions" context)
  for (const oldCount of OLD_TOOL_COUNTS) {
    const pattern = new RegExp(`\\b${oldCount}\\s+tools\\b`, 'g');
    if (pattern.test(newContent)) {
      const replacement = `${TOOL_COUNT} tools`;
      newContent = newContent.replace(pattern, replacement);
      modified = true;
      replacements.push({
        file: filePath,
        line: 0,
        old: `${oldCount} tools`,
        new: replacement,
      });
    }
  }

  if (modified) {
    if (CHECK_ONLY) {
      errors.push(`${filePath}: has outdated counts`);
    } else {
      writeFileSync(absPath, newContent);
      console.log(`  ✅ Fixed: ${filePath}`);
    }
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

console.log(
  CHECK_ONLY ? '🔍 Checking documentation counts...\n' : '🔧 Fixing documentation counts...\n'
);

// Scan known doc files
for (const file of DOC_FILES) {
  scanFile(file);
}

// Also scan src/ for any remaining hardcoded counts in comments
// (Only look for "N actions" patterns where N is an old count)
function scanDirectory(dir: string): void {
  const absDir = join(ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(absDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const relPath = join(dir, entry);
    const absPath = join(ROOT, relPath);

    if (EXCLUDE_DIRS.has(entry) || EXCLUDE_FILES.has(entry)) continue;

    try {
      const stat = statSync(absPath);
      if (stat.isDirectory()) {
        scanDirectory(relPath);
      } else {
        const ext = entry.substring(entry.lastIndexOf('.'));
        if (SCANNABLE_EXTENSIONS.has(ext)) {
          // Scan for old action AND tool counts
          const content = readFileSync(absPath, 'utf-8');
          let needsScan = false;
          for (const oldCount of OLD_ACTION_COUNTS) {
            if (content.includes(`${oldCount} actions`)) {
              needsScan = true;
              break;
            }
          }
          if (!needsScan) {
            for (const oldCount of OLD_TOOL_COUNTS) {
              if (content.includes(`${oldCount} tools`)) {
                needsScan = true;
                break;
              }
            }
          }
          if (needsScan) {
            scanFile(relPath);
          }
        }
      }
    } catch {
      // Skip files we can't read
    }
  }
}

// Scan all relevant directories
scanDirectory('src');
scanDirectory('tests');
scanDirectory('docs');
scanDirectory('scripts');
scanDirectory('.claude');
scanDirectory('deployment');

// ============================================================================
// SUMMARY
// ============================================================================

if (replacements.length === 0) {
  console.log('\n✅ All documentation counts are synchronized');
  process.exit(0);
} else if (CHECK_ONLY) {
  console.error(`\n❌ Found ${errors.length} file(s) with outdated counts:`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  console.error('\nRun `npm run fix:metadata` to fix automatically.\n');
  process.exit(1);
} else {
  console.log(`\n✅ Fixed ${replacements.length} outdated count(s) across documentation files`);
  process.exit(0);
}
