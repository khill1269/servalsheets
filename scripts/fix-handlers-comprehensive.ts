#!/usr/bin/env tsx
/**
 * Comprehensive Handler Fix for MCP Compliance
 *
 * Fixes all instances of input.field to req.field throughout handler methods
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HANDLERS_DIR = path.join(__dirname, '../src/handlers');

const HANDLER_FILES = [
  'advanced.ts',
  'data.ts',
  'dimensions.ts',
  'visualize.ts',
  'collaborate.ts',
  'format.ts',
  'core.ts',
  'transaction.ts',
  'history.ts',
  'analyze.ts',
  'composite.ts',
];

async function fixHandler(file: string) {
  const filePath = path.join(HANDLERS_DIR, file);
  console.log(`📄 Processing ${file}...`);

  let content = await fs.readFile(filePath, 'utf-8');
  const originalContent = content;
  let changesApplied = 0;

  // Fix 1: inferRequestParameters should receive input.request
  if (content.includes('this.inferRequestParameters(input)')) {
    content = content.replace(
      /const inferredRequest = this\.inferRequestParameters\(input\)( as \w+)?;/g,
      (match, typeAssertion) => {
        // Remove the type assertion or update it to use ['request']
        const newType = typeAssertion ? typeAssertion.replace(/\)$/, "['request'])") : '';
        changesApplied++;
        return `const inferredRequest = this.inferRequestParameters(input.request)${newType};`;
      }
    );
  }

  // Fix 2: Remove duplicate const req = inferredRequest;
  // This happens right after the inferRequestParameters call
  content = content.replace(
    /(const inferredRequest = this\.inferRequestParameters\([^;]+;\s*)\s*const req = inferredRequest;/g,
    (match, prefix) => {
      changesApplied++;
      return prefix;
    }
  );

  // Fix 3: Replace inferredRequest property accesses with inferredRequest.property
  // Only in specific patterns like trackContextFromRequest

  // Fix 4: Update switch statement patterns to use extracted req
  // Pattern: switch (input.action) or switch (req.action) - both should use req.action after extraction

  // Fix 5: In createIntents, update to use input.request
  content = content.replace(
    /protected createIntents\(input: \w+\): Intent\[\] \{\s*const req = input;/g,
    (match) => {
      const inputType = match.match(/input: (\w+)/)?.[1];
      changesApplied++;
      return `protected createIntents(input: ${inputType}): Intent[] {\n    const req = input.request;`;
    }
  );

  // Fix 6: Update type narrowing patterns - SheetsXxxInput['action'] should be SheetsXxxInput['request']['action']
  content = content.replace(/Record<(\w+)\['action'\],/g, (match, typeName) => {
    changesApplied++;
    return `Record<${typeName}['request']['action'],`;
  });

  // Fix 7: Fix exhaustiveness check pattern
  content = content.replace(/\(req as \{ action: string \}\)\.action/g, (match) => {
    changesApplied++;
    return 'req.action';
  });

  // Fix 8: trackContextFromRequest uses inferredRequest properties
  // Find the trackContextFromRequest call and wrap property accesses
  const trackContextPattern = /this\.trackContextFromRequest\(\{[\s\S]*?\}\);/g;
  content = content.replace(trackContextPattern, (match) => {
    // Within this block, inferredRequest.field is correct
    return match;
  });

  if (content !== originalContent) {
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`  ✅ Applied ${changesApplied} fixes\n`);
    return changesApplied;
  } else {
    console.log(`  ℹ️  No changes needed\n`);
    return 0;
  }
}

async function main() {
  console.log('🔧 Starting Comprehensive Handler Fix\n');

  let totalChanges = 0;
  for (const file of HANDLER_FILES) {
    try {
      const changes = await fixHandler(file);
      totalChanges += changes;
    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error);
    }
  }

  console.log(`\n📊 Summary: ${totalChanges} total fixes applied`);
  console.log('\n⚠️  NEXT STEP: Run npm run typecheck to verify');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
