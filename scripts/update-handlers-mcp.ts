#!/usr/bin/env tsx
/**
 * Automated Handler Update for MCP Compliance
 *
 * Updates all 16 tool handlers to extract request envelope from input.
 *
 * Before: switch (input.action)
 * After:  const req = input.request; switch (req.action)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HANDLERS_DIR = path.join(__dirname, '../src/handlers');

const HANDLER_FILES = [
  'auth.ts',
  'core.ts',
  'data.ts',
  'format.ts',
  'dimensions.ts',
  'visualize.ts',
  'collaborate.ts',
  'advanced.ts',
  'transaction.ts',
  'quality.ts',
  'history.ts',
  'confirm.ts',
  'analyze.ts',
  'fix.ts',
  'composite.ts',
  'session.ts',
];

interface HandlerUpdate {
  file: string;
  updatesApplied: number;
  patterns: string[];
}

async function updateHandlers() {
  console.log('🔧 Starting MCP Handler Updater\n');

  let totalUpdates = 0;
  let totalErrors = 0;
  const updates: HandlerUpdate[] = [];

  for (const file of HANDLER_FILES) {
    const filePath = path.join(HANDLERS_DIR, file);
    try {
      console.log(`📄 Processing ${file}...`);

      let content = await fs.readFile(filePath, 'utf-8');
      const originalContent = content;
      let updatesApplied = 0;
      const patterns: string[] = [];

      // Pattern 1: Add request extraction at start of handle() method
      // Look for: async handle(input: Sheets*Input): Promise<Sheets*Output> {
      const handleMethodRegex =
        /async handle\(input: (\w+)\): Promise<\w+> \{\s*(?:\/\/[^\n]*\n\s*)?/g;

      content = content.replace(handleMethodRegex, (match, inputType) => {
        // Check if extraction already exists
        const nextLines = content.slice(
          content.indexOf(match) + match.length,
          content.indexOf(match) + match.length + 200
        );
        if (nextLines.includes('const req = input.request')) {
          return match; // Already updated
        }

        patterns.push('handle() method entry');
        updatesApplied++;

        // Add extraction after handle method signature
        return `${match}const req = input.request;\n    `;
      });

      // Pattern 2: Replace direct input.action with req.action
      // This is more complex as we need to preserve other input. accesses
      const actionAccessRegex = /\binput\.action\b/g;
      const actionMatches = content.match(actionAccessRegex);
      if (actionMatches) {
        content = content.replace(actionAccessRegex, 'req.action');
        patterns.push(`input.action → req.action (${actionMatches.length} instances)`);
        updatesApplied += actionMatches.length;
      }

      // Pattern 3: Replace input as Type casts with req as Type
      // Example: input as AuthLoginInput → req as AuthLoginInput
      const inputCastRegex = /\binput as (\w+Input)\b/g;
      const castMatches = content.match(inputCastRegex);
      if (castMatches) {
        content = content.replace(inputCastRegex, 'req as $1');
        patterns.push(`input as XxxInput → req as XxxInput (${castMatches.length} instances)`);
        updatesApplied += castMatches.length;
      }

      // Pattern 4: Replace other input field accesses that should be req
      // Common fields: spreadsheetId, sheetId, range, etc.
      // BUT: Be careful not to replace input parameters in helper methods
      // Strategy: Only replace in handle() method body

      // Extract handle method body
      const handleBodyMatch = content.match(
        /async handle\(input: \w+\): Promise<\w+> \{([\s\S]*?)\n  \}/
      );
      if (handleBodyMatch) {
        let handleBody = handleBodyMatch[1];
        const originalHandleBody = handleBody;

        // Replace common field accesses within handle body
        // Only if they come after switch (req.action) to avoid replacing before extraction
        const fieldAccessPatterns = [
          /\binput\.(spreadsheetId|sheetId|sheetName|range|values|transactionId|historyId)\b/g,
        ];

        for (const pattern of fieldAccessPatterns) {
          const fieldMatches = handleBody.match(pattern);
          if (fieldMatches) {
            handleBody = handleBody.replace(pattern, 'req.$1');
            patterns.push(`input.field → req.field (${fieldMatches.length} instances)`);
            updatesApplied += fieldMatches.length;
          }
        }

        // Replace the handle body if changes were made
        if (handleBody !== originalHandleBody) {
          content = content.replace(
            handleBodyMatch[0],
            `async handle(input: ${handleBodyMatch[0].match(/input: (\w+)/)?.[1]}): Promise<${handleBodyMatch[0].match(/Promise<(\w+)>/)?.[1]}> {${handleBody}\n  }`
          );
        }
      }

      // Only write if changes were made
      if (content !== originalContent) {
        await fs.writeFile(filePath, content, 'utf-8');
        console.log(`  ✅ Applied ${updatesApplied} updates`);
        patterns.forEach((p) => console.log(`     - ${p}`));
        console.log();

        updates.push({ file, updatesApplied, patterns });
        totalUpdates += updatesApplied;
      } else {
        console.log(`  ℹ️  No changes needed\n`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error);
      totalErrors++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Handlers updated: ${updates.length}`);
  console.log(`  🔄 Total updates applied: ${totalUpdates}`);
  console.log(`  ❌ Errors: ${totalErrors}`);

  if (updates.length > 0) {
    console.log('\n📋 Detailed Updates:');
    updates.forEach((u) => {
      console.log(`  ${u.file}: ${u.updatesApplied} updates`);
    });
  }

  if (totalErrors === 0) {
    console.log('\n✨ All handlers updated successfully!');
    console.log('\n⚠️  NEXT STEPS:');
    console.log('  1. Run: npm run typecheck');
    console.log('  2. Run: npm run test');
    console.log('  3. Run: npm run validate:compliance');
    console.log('  4. Manual review: Check for any edge cases');
  } else {
    console.log('\n⚠️  Some handlers failed to update. Review errors above.');
    process.exit(1);
  }
}

updateHandlers().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
