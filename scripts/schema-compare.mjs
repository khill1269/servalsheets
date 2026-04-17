#!/usr/bin/env node
/**
 * schema-compare.mjs — Compare fetched Google API schemas against our Zod schemas.
 *
 * TODO: Implement by:
 *   1. Loading schemas/google-api-snapshots/{sheets,drive}-latest.json (from schema:fetch)
 *   2. Diffing against Zod schema definitions in src/schemas/
 *   3. Reporting: new fields, removed fields, type changes
 *   4. Exiting non-zero if breaking changes found
 *
 * Used by: schema-check.yml (weekly schedule), triggered after schema:fetch
 */

const api = process.argv.find((a) => a.startsWith('--api='))?.split('=')[1] ?? 'all';

console.warn(`[schema:compare] API schema comparison not yet implemented (api=${api})`);
console.warn('  Planned: diff Google API snapshots against src/schemas/ Zod definitions');
console.warn('  See: scripts/schema-compare.mjs for implementation TODO');
process.exit(0);
