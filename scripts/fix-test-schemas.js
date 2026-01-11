#!/usr/bin/env node
/**
 * Fix test files to use flat schema format
 * 
 * Transforms:
 *   handler.handle({
 *     request: {
 *       action: 'read',
 *       ...
 *     },
 *   });
 * 
 * To:
 *   handler.handle({
 *     action: 'read',
 *     ...
 *   });
 */

const fs = require('fs');
const path = require('path');

const TEST_FILES = [
  'tests/handlers/values.test.ts',
  'tests/handlers/sheet.test.ts',
  'tests/handlers/spreadsheet.test.ts',
  'tests/handlers/cells.test.ts',
  'tests/handlers/charts.test.ts',
  'tests/handlers/pivot.test.ts',
  'tests/handlers/filter-sort.test.ts',
  'tests/handlers/sharing.test.ts',
  'tests/handlers/comments.test.ts',
  'tests/handlers/versions.test.ts',
  'tests/handlers/analysis.test.ts',
  'tests/handlers/advanced.test.ts',
  'tests/contracts/schema-contracts.test.ts',
  'tests/property/schema-validation.property.test.ts',
];

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return 0;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  let replacements = 0;

  // Pattern 1: Handle handler.handle({ request: { ... }, }) multi-line
  // Match: handler.handle({\n    request: {\n      ...\n    },\n  });
  content = content.replace(
    /(handler\.handle\(\{)\s*\n(\s*)request:\s*\{\n([\s\S]*?)\n(\s*)\},\s*\n(\s*)\}\);/gm,
    (match, prefix, indent1, body, indent2, indent3) => {
      replacements++;
      // Re-indent the body
      return `${prefix}\n${body}\n${indent3}});`;
    }
  );

  // Pattern 2: Schema.safeParse({ request: { ... } })
  content = content.replace(
    /(Schema\.safeParse\(\{)\s*\n(\s*)request:\s*\{\n([\s\S]*?)\n(\s*)\},?\s*\n(\s*)\}\);/gm,
    (match, prefix, indent1, body, indent2, indent3) => {
      replacements++;
      return `${prefix}\n${body}\n${indent3}});`;
    }
  );

  // Pattern 3: Inline { request: { action: ... } } → { action: ... }
  content = content.replace(
    /\{\s*request:\s*\{([^}]+)\}\s*\}/g,
    (match, inner) => {
      replacements++;
      return `{${inner}}`;
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${filePath} (${replacements} patterns)`);
    return replacements;
  }

  console.log(`⏭️  No changes: ${filePath}`);
  return 0;
}

// Main
console.log('Fixing test schema formats...\n');

let totalFixed = 0;
for (const file of TEST_FILES) {
  totalFixed += fixFile(file);
}

console.log(`\n📊 Total patterns fixed: ${totalFixed}`);
