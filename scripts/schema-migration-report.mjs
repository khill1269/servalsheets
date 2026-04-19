#!/usr/bin/env node
/**
 * schema-migration-report.mjs — Generate migration guide for Google API schema changes.
 *
 * TODO: Implement by:
 *   1. Reading schema diff output from schema:compare
 *   2. Generating a structured report: which Zod schemas need updating
 *   3. Suggesting minimal changes for each breaking field change
 *   4. Writing report to migration-report.txt (picked up as CI artifact)
 *
 * Used by: schema-check.yml — only runs when schema:compare exits non-zero (breaking changes)
 */

const api = process.argv.find((a) => a.startsWith('--api='))?.split('=')[1] ?? 'all';

console.warn(`[schema:migration-report] Migration report generation not yet implemented (api=${api})`);
console.warn('  Planned: structured diff report mapping Google API changes to Zod schema updates needed');
console.warn('  See: scripts/schema-migration-report.mjs for implementation TODO');
process.exit(0);
