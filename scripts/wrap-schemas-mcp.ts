#!/usr/bin/env tsx
/**
 * Automated Schema Wrapper for MCP Compliance
 *
 * Wraps all 16 tool input schemas with MCP-required request envelope.
 *
 * Before: z.discriminatedUnion('action', [...])
 * After:  z.object({ request: z.discriminatedUnion('action', [...]) })
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMAS_DIR = path.join(__dirname, '../src/schemas');

const TOOL_SCHEMA_FILES = [
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

interface SchemaMatch {
  file: string;
  schemaName: string;
  originalExport: string;
  actionSchemas: string[];
}

async function wrapSchemas() {
  console.log('🔧 Starting MCP Schema Wrapper\n');

  let totalWrapped = 0;
  let totalErrors = 0;

  for (const file of TOOL_SCHEMA_FILES) {
    const filePath = path.join(SCHEMAS_DIR, file);
    try {
      console.log(`📄 Processing ${file}...`);

      let content = await fs.readFile(filePath, 'utf-8');
      const originalContent = content;

      // Find the main input schema export
      // Pattern: export const Sheets*InputSchema = z.discriminatedUnion(...)
      const schemaExportRegex =
        /export const (Sheets\w+InputSchema|CompositeInputSchema) = z\.discriminatedUnion\(\s*'action',\s*\[([\s\S]*?)\]\s*\);/g;

      const matches: SchemaMatch[] = [];
      let match: RegExpExecArray | null;

      while ((match = schemaExportRegex.exec(content)) !== null) {
        matches.push({
          file,
          schemaName: match[1],
          originalExport: match[0],
          actionSchemas: match[2]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        });
      }

      if (matches.length === 0) {
        console.log(`  ⚠️  No discriminated union schema found, skipping`);
        continue;
      }

      for (const schemaMatch of matches) {
        console.log(`  ✓ Found schema: ${schemaMatch.schemaName}`);
        console.log(`    Action schemas: ${schemaMatch.actionSchemas.length}`);

        // Build wrapped version
        const wrappedExport = `export const ${schemaMatch.schemaName} = z.object({
  request: z.discriminatedUnion('action', [
${schemaMatch.actionSchemas.map((s) => `    ${s},`).join('\n')}
  ])
});`;

        // Replace in content
        content = content.replace(schemaMatch.originalExport, wrappedExport);

        // Update the type inference to access .request
        // The inferred type SheetsXxxInput should still work because
        // TypeScript will infer the wrapped structure

        totalWrapped++;
      }

      // Only write if changes were made
      if (content !== originalContent) {
        await fs.writeFile(filePath, content, 'utf-8');
        console.log(`  ✅ Wrapped ${matches.length} schema(s)\n`);
      } else {
        console.log(`  ℹ️  No changes needed\n`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error);
      totalErrors++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Schemas wrapped: ${totalWrapped}`);
  console.log(`  ❌ Errors: ${totalErrors}`);

  if (totalErrors === 0) {
    console.log('\n✨ All schemas wrapped successfully!');
    console.log('\n⚠️  NEXT STEPS:');
    console.log('  1. Run: npm run scripts/update-handlers-mcp.ts');
    console.log('  2. Run: npm run typecheck');
    console.log('  3. Run: npm run test');
    console.log('  4. Run: npm run validate:compliance');
  } else {
    console.log('\n⚠️  Some schemas failed to wrap. Review errors above.');
    process.exit(1);
  }
}

wrapSchemas().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
