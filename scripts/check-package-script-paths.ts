#!/usr/bin/env tsx

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const TRACKED_ROOTS = ['scripts/', 'tests/', 'src/', 'dashboard/'];
const TOKEN_BOUNDARY = /[\s"'`()|&;<>]+/;
const GLOB_CHARS = /[*?[\]{}]/;
const TRAILING_PUNCTUATION = /[),:]+$/;

type MissingReference = {
  scriptName: string;
  scriptValue: string;
  reference: string;
};

function normalizeCandidate(token: string): string | null {
  const trimmed = token.trim().replace(TRAILING_PUNCTUATION, '');
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('./')) {
    const withoutDot = trimmed.slice(2);
    return TRACKED_ROOTS.some((prefix) => withoutDot.startsWith(prefix)) ? withoutDot : null;
  }

  return TRACKED_ROOTS.some((prefix) => trimmed.startsWith(prefix)) ? trimmed : null;
}

function shouldIgnore(reference: string): boolean {
  if (GLOB_CHARS.test(reference)) {
    return true;
  }

  if (reference.includes('$')) {
    return true;
  }

  return false;
}

function existsAsRepoPath(reference: string): boolean {
  const fullPath = path.join(ROOT, reference);
  if (!existsSync(fullPath)) {
    return false;
  }

  try {
    statSync(fullPath);
    return true;
  } catch {
    return false;
  }
}

function main(): void {
  const packageJson = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };

  const missing: MissingReference[] = [];

  for (const [scriptName, scriptValue] of Object.entries(packageJson.scripts ?? {})) {
    const checkedReferences = new Set<string>();
    const tokens = scriptValue.split(TOKEN_BOUNDARY);

    for (const token of tokens) {
      const candidate = normalizeCandidate(token);
      if (!candidate || shouldIgnore(candidate) || checkedReferences.has(candidate)) {
        continue;
      }

      checkedReferences.add(candidate);

      if (!existsAsRepoPath(candidate)) {
        missing.push({
          scriptName,
          scriptValue,
          reference: candidate,
        });
      }
    }
  }

  if (missing.length > 0) {
    console.error('Package scripts reference missing repo-local paths:\n');
    for (const item of missing) {
      console.error(`- ${item.scriptName}: ${item.reference}`);
      console.error(`  ${item.scriptValue}`);
    }
    process.exit(1);
  }

  console.log('✅ package.json repo-local script paths are valid');
}

main();
