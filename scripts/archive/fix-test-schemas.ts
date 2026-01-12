#!/usr/bin/env tsx
/**
 * Fix test files to use flat schema format instead of wrapped request format
 * 
 * Transforms:
 *   { request: { action: 'read', spreadsheetId: 'x', ... } }
 * To:
 *   { action: 'read', spreadsheetId: 'x', ... }
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const TEST_DIRS = ['tests/handlers', 'tests/contracts', 'tests/property'];

function fixFile(filePath: string): { changed: boolean; replacements: number } {
  let content = readFileSync(filePath, 'utf-8');
  let replacements = 0;
  
  // Pattern 1: Remove `request: {` wrapper and closing `}`
  // This is tricky because we need to handle nested objects
  
  // Simpler approach: replace common patterns
  const patterns = [
    // Handle multi-line request wrapper
    {
      from: /(\{)\s*request:\s*\{([^}]+action:[^}]+)\}/g,
      to: '$1$2'
    },
    // Handle inline request wrapper  
    {
      from: /request:\s*\{\s*action:/g,
      to: 'action:'
    },
    // Remove trailing } for request wrapper (careful with this one)
    {
      from: /,\s*\},\s*\}/g,
      to: ','
    }
  ];
  
  for (const pattern of patterns) {
    const newContent = content.replace(pattern.from, pattern.to);
    if (newContent !== content) {
      replacements++;
      content = newContent;
    }
  }
  
  if (replacements > 0) {
    writeFileSync(filePath, content);
    return { changed: true, replacements };
  }
  
  return { changed: false, replacements: 0 };
}

function walkDir(dir: string, callback: (file: string) => void): void {
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (file.endsWith('.test.ts')) {
      callback(filePath);
    }
  }
}

// Main
console.log('Fixing test schema formats...\n');

let totalFixed = 0;
for (const dir of TEST_DIRS) {
  try {
    walkDir(dir, (file) => {
      const result = fixFile(file);
      if (result.changed) {
        console.log(`✅ Fixed: ${file} (${result.replacements} replacements)`);
        totalFixed++;
      }
    });
  } catch (e) {
    console.log(`⚠️  Directory not found: ${dir}`);
  }
}

console.log(`\nFixed ${totalFixed} files`);
console.log('\nRemaining manual fixes needed:');
console.log('1. Update ACTION_COUNT expectations in tests/schemas.test.ts and tests/contracts/schema-contracts.test.ts');
console.log('2. Fix redact test expectation in tests/unit/redact.test.ts');
console.log('3. Review and test changes');
