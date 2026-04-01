#!/usr/bin/env node

/**
 * CI check: Verify Zod schema detection markers are present.
 *
 * The tools-list-compat.ts isZodSchema() function relies on undocumented
 * Zod internals (_def for v3, _zod for v4). This script validates that
 * the installed Zod version exposes at least one of these markers.
 *
 * If this check fails after a Zod upgrade, tools/list will silently
 * return empty schemas ({}) for all tools — a critical regression.
 */

import { z } from 'zod';

const testSchema = z.object({ test: z.string() });

const hasV3Marker = '_def' in testSchema;
const hasV4Marker = '_zod' in testSchema;

if (!hasV3Marker && !hasV4Marker) {
  console.error('FATAL: Zod schema detection markers missing!');
  console.error('Neither _def (v3) nor _zod (v4) found on z.object() instance.');
  console.error('This will break tools/list schema serialization.');
  console.error('');
  console.error('Zod version:', z.ZodObject ? 'v3.x' : 'unknown');
  console.error('Schema keys:', Object.keys(testSchema).filter((k) => k.startsWith('_')));
  console.error('');
  console.error('Fix: Update isZodSchema() in src/mcp/registration/tools-list-compat.ts');
  process.exit(1);
}

console.log(`✓ Zod marker detection OK (v3._def: ${hasV3Marker}, v4._zod: ${hasV4Marker})`);

// Also verify that discriminatedUnion schemas preserve markers
const unionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('a'), value: z.string() }),
  z.object({ type: z.literal('b'), count: z.number() }),
]);

const unionHasMarker = '_def' in unionSchema || '_zod' in unionSchema;
if (!unionHasMarker) {
  console.error('WARN: Discriminated union schema missing markers.');
  console.error('This may affect tool schema serialization for compound tools.');
  process.exit(1);
}

console.log('✓ Discriminated union marker detection OK');
process.exit(0);
