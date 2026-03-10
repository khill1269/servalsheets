#!/usr/bin/env node
/**
 * sync-doc-counts.mjs — Sync tool/action counts from action-counts.ts into docs
 *
 * Reads TOOL_COUNT and ACTION_COUNT from src/schemas/action-counts.ts (source of truth),
 * then reports any docs/*.md files that still reference outdated counts.
 *
 * Usage:
 *   node scripts/sync-doc-counts.mjs          # Dry-run (report only)
 *   node scripts/sync-doc-counts.mjs --fix    # Apply fixes (skip historical/release docs)
 *
 * Note: Historical docs (docs/releases/*, docs/historical/*) are intentionally excluded
 * from --fix mode since their counts reflect the state at the time of writing.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/\/$/, '');
const COUNTS_FILE = join(ROOT, 'src/schemas/action-counts.ts');

// --- Parse action-counts.ts ---
const countsSource = readFileSync(COUNTS_FILE, 'utf8');

const toolCountMatch = countsSource.match(/export const TOOL_COUNT\s*=\s*Object\.keys\(ACTION_COUNTS\)\.length/);
const actionCountsBlock = countsSource.match(/export const ACTION_COUNTS[^{]*\{([^}]+)\}/);

if (!actionCountsBlock) {
  console.error('ERROR: Could not parse ACTION_COUNTS from', COUNTS_FILE);
  process.exit(1);
}

// Count entries in the ACTION_COUNTS object
const entries = actionCountsBlock[1].match(/\w+:\s*\d+/g);
const toolCount = entries ? entries.length : 0;
const actionCount = entries
  ? entries.reduce((sum, e) => sum + parseInt(e.split(':')[1].trim(), 10), 0)
  : 0;

console.log(`Source of truth: ${toolCount} tools, ${actionCount} actions`);
console.log(`Source: ${relative(ROOT, COUNTS_FILE)}\n`);

// --- Known stale patterns (old values that should be updated) ---
const STALE_TOOL_COUNTS = [22, 23, 24]; // versions before 25
const STALE_ACTION_COUNTS = [291, 300, 305, 315, 335, 340, 342, 377]; // all historical counts

// --- Scan docs/ ---
const FIX_MODE = process.argv.includes('--fix');
const SKIP_DIRS = ['releases', 'historical', 'archive']; // historical docs preserved as-is

function walkDir(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkDir(full));
    } else if (entry.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

const docsDir = join(ROOT, 'docs');
const mdFiles = walkDir(docsDir);

let totalStale = 0;
let totalFixed = 0;

for (const filePath of mdFiles) {
  const relPath = relative(ROOT, filePath);
  const content = readFileSync(filePath, 'utf8');
  const issues = [];

  // Helper: check if a match is part of a "X → Y" progression pattern (historical, don't fix)
  function isProgressionPattern(text, matchIndex) {
    const surrounding = text.substring(Math.max(0, matchIndex - 30), matchIndex + 30);
    return /→|->|before P\d|through P\d/i.test(surrounding);
  }

  // Check for stale tool counts: "\b22 tools\b" etc.
  for (const oldCount of STALE_TOOL_COUNTS) {
    const regex = new RegExp(`\\b${oldCount} tools\\b`, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (isProgressionPattern(content, match.index)) continue;
      const lineNum = content.substring(0, match.index).split('\n').length;
      issues.push({ line: lineNum, old: `${oldCount} tools`, new: `${toolCount} tools`, index: match.index, length: match[0].length });
    }
  }

  // Check for stale action counts: "\b305 actions\b" etc.
  for (const oldCount of STALE_ACTION_COUNTS) {
    const regex = new RegExp(`\\b${oldCount} actions\\b`, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (isProgressionPattern(content, match.index)) continue;
      const lineNum = content.substring(0, match.index).split('\n').length;
      issues.push({ line: lineNum, old: `${oldCount} actions`, new: `${actionCount} actions`, index: match.index, length: match[0].length });
    }
  }

  if (issues.length === 0) continue;

  totalStale += issues.length;
  const isHistorical = SKIP_DIRS.some(d => relPath.includes(`/${d}/`));

  console.log(`${relPath} (${issues.length} stale reference${issues.length > 1 ? 's' : ''})${isHistorical ? ' [HISTORICAL - skipped]' : ''}`);
  for (const issue of issues) {
    console.log(`  line ${issue.line}: "${issue.old}" → "${issue.new}"`);
  }

  if (FIX_MODE && !isHistorical) {
    // Apply replacements (process from end to preserve indices)
    let fixed = content;
    const sorted = [...issues].sort((a, b) => b.index - a.index);
    for (const issue of sorted) {
      fixed = fixed.substring(0, issue.index) + issue.new + fixed.substring(issue.index + issue.length);
    }
    writeFileSync(filePath, fixed, 'utf8');
    totalFixed += issues.length;
    console.log(`  ✅ Fixed ${issues.length} reference${issues.length > 1 ? 's' : ''}`);
  }

  console.log();
}

console.log('---');
console.log(`Total stale references: ${totalStale}`);
if (FIX_MODE) {
  console.log(`Fixed: ${totalFixed}, Skipped (historical): ${totalStale - totalFixed}`);
} else {
  console.log('Run with --fix to apply changes (historical docs will be skipped)');
}
