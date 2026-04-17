#!/usr/bin/env node
/**
 * schema-fetch.mjs — Fetch latest Google API schemas for drift detection.
 *
 * TODO: Implement using Google Discovery API:
 *   https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest
 *   https://www.googleapis.com/discovery/v1/apis/drive/v3/rest
 *
 * Planned output: schemas/google-api-snapshots/{sheets,drive}-latest.json
 * Used by: schema:compare, schema-check.yml (weekly schedule)
 */

const api = process.argv.find((a) => a.startsWith('--api='))?.split('=')[1] ?? 'all';

console.warn(`[schema:fetch] API schema fetch not yet implemented (api=${api})`);
console.warn('  Planned: fetch Sheets v4 + Drive v3 schemas from Google Discovery API');
console.warn('  See: scripts/schema-fetch.mjs for implementation TODO');
process.exit(0);
