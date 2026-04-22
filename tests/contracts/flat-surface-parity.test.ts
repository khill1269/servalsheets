/**
 * Flat Surface Parity Contract Tests
 *
 * Guarantees that the LLM-facing flat tool surface is a lossless projection
 * of the compound-tool Zod schemas.
 *
 * Background
 * ----------
 * The flat surface presents each of the current 409 actions as a standalone
 * MCP tool (`sheets_<domain>_<action>`). Its `inputSchema` is built in
 * `src/mcp/registration/tools-list-compat.ts` via a three-step resolution:
 *
 *   1. Hand-tuned `ALWAYS_LOADED_SCHEMAS` overrides (bootstrap-critical only)
 *   2. Derived from the compound Zod DU via `buildFlatInputSchemaForAction()`
 *   3. Generic `{spreadsheetId}` fallback (should be unreachable in practice)
 *
 * Before this contract, there was no test asserting that:
 *   - Every flat tool's advertised schema actually derives from the compound
 *     source of truth (step 2 is reachable for every entry).
 *   - The hand-tuned entries (step 1) stay in sync with the compound schema
 *     they are shadowing.
 *
 * These are the exact drift vectors that produced BUG #3 and BUG #6 in the
 * 2026-04-21 E2E session. This test generalizes the fix.
 *
 * Assertions
 * ----------
 *   1. Derivability — `buildFlatInputSchemaForAction(parentTool, action)`
 *      returns a non-null JSON schema for every entry in `getFlatToolRegistry()`.
 *      No flat tool may rely on the generic fallback.
 *
 *   2. Hand-tuned ↔ derived agreement — for every key in `ALWAYS_LOADED_SCHEMAS`,
 *      compare `required[]` against the derived schema. They must match
 *      (modulo documented deviations in `HAND_TUNED_DEVIATIONS`).
 *
 *   3. Action field stripped — the derived schema must not expose `action`
 *      as a property (it is injected by `flat-tool-routing`).
 *
 *   4. Registry integrity — every flat tool's (parentTool, action) pair must
 *      exist in `TOOL_ACTIONS`.
 *
 * @module tests/contracts/flat-surface-parity
 */

import { describe, it, expect } from 'vitest';

import { TOOL_ACTIONS } from '../../src/mcp/completions.js';
import {
  getFlatToolRegistry,
  type FlatToolDefinition,
} from '../../src/mcp/registration/flat-tool-registry.js';
import {
  buildFlatInputSchemaForAction,
  clearFlatInputSchemaCache,
} from '../../src/mcp/registration/flat-input-schemas.js';

// --------------------------------------------------------------------------
// Hand-tuned deviations
// --------------------------------------------------------------------------
//
// Entries in `ALWAYS_LOADED_SCHEMAS` (tools-list-compat.ts:597) that are
// intentionally different from what `buildFlatInputSchemaForAction` derives.
// These typically happen when a bootstrap-critical tool advertises a
// simplified shape to reduce LLM token use during session start.
//
// Each entry must have a comment explaining WHY the deviation is acceptable.
// Undocumented deviations will fail the parity test.
// --------------------------------------------------------------------------
const HAND_TUNED_DEVIATIONS: Record<
  string,
  { reason: string; extraRequired?: string[]; missingRequired?: string[] }
> = {
  // Example (none currently): 'sheets_session.foo': { reason: '...', extraRequired: ['x'] }
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function getDerived(parentTool: string, action: string): Record<string, unknown> | null {
  return buildFlatInputSchemaForAction(parentTool, action);
}

function readRequired(schema: Record<string, unknown> | null | undefined): string[] {
  if (!schema) return [];
  const r = schema['required'];
  return Array.isArray(r) ? (r as string[]).filter((x) => typeof x === 'string').sort() : [];
}

function readPropertyKeys(schema: Record<string, unknown> | null | undefined): string[] {
  if (!schema) return [];
  const p = schema['properties'];
  if (!p || typeof p !== 'object') return [];
  return Object.keys(p as Record<string, unknown>).sort();
}

// --------------------------------------------------------------------------
// Test fixture
// --------------------------------------------------------------------------

describe('Flat Surface Parity (flat ↔ compound Zod)', () => {
  // Reset the helper's internal cache once so the test runs against the
  // same derivation logic the server uses at wire time.
  clearFlatInputSchemaCache();

  const registry = getFlatToolRegistry();

  it('registry is non-empty', () => {
    expect(registry.length).toBeGreaterThan(100);
  });

  // --------------------------------------------------------------------------
  // Assertion 1: Derivability
  // --------------------------------------------------------------------------
  describe('Assertion 1: every flat tool is derivable from compound Zod', () => {
    // Build the list once so the test output groups per-tool instead of
    // per-registry-entry (keeps failure messages readable).
    const byParent = new Map<string, FlatToolDefinition[]>();
    for (const entry of registry) {
      const list = byParent.get(entry.parentTool) ?? [];
      list.push(entry);
      byParent.set(entry.parentTool, list);
    }

    for (const [parentTool, entries] of byParent.entries()) {
      it(`${parentTool}: all ${entries.length} action schemas derive`, () => {
        const failures: string[] = [];
        for (const entry of entries) {
          const derived = getDerived(entry.parentTool, entry.action);
          if (!derived) {
            failures.push(`  - ${entry.name} (${entry.parentTool}.${entry.action})`);
          }
        }
        expect(
          failures.length,
          `\n${failures.length} flat tool(s) could not derive from compound Zod:\n${failures.join('\n')}\n\n` +
            `This means tools-list-compat.ts will fall back to the generic {spreadsheetId} schema\n` +
            `for these actions, and LLMs will not see the action-specific required params.\n` +
            `Fix by ensuring the action is in the compound DU for ${parentTool} and readable via .options[].shape.action.`
        ).toBe(0);
      });
    }
  });

  // --------------------------------------------------------------------------
  // Assertion 2: Hand-tuned ↔ derived required[] agreement
  // --------------------------------------------------------------------------
  describe('Assertion 2: ALWAYS_LOADED_SCHEMAS required[] matches derived', () => {
    // Re-import lazily so the test can see the current state of the module.
    // The list is small (currently ~16 entries) so a static dynamic import
    // is fine.
    it('every hand-tuned entry agrees with derived (or is documented)', async () => {
      // Use the exported constant if available. Otherwise parse from source.
      // At present the constant is module-local, so we parse it from the
      // source file to avoid widening the public API.
      const fs = await import('node:fs');
      const path = await import('node:path');
      const compat = fs.readFileSync(
        path.resolve(__dirname, '../../src/mcp/registration/tools-list-compat.ts'),
        'utf-8'
      );
      // Extract all keys like `'sheets_<domain>.<action>': {` inside the
      // ALWAYS_LOADED_SCHEMAS object literal. Tolerant regex — a later
      // refactor that moves the map to a separate file should update this.
      const startIdx = compat.indexOf('const ALWAYS_LOADED_SCHEMAS');
      expect(startIdx, 'ALWAYS_LOADED_SCHEMAS constant not found').toBeGreaterThan(0);
      // Find the matching closing `};` for the object literal
      const afterStart = compat.slice(startIdx);
      const endRel = afterStart.indexOf('\n};');
      expect(endRel, 'ALWAYS_LOADED_SCHEMAS end delimiter not found').toBeGreaterThan(0);
      const blob = afterStart.slice(0, endRel + 3);
      // Collect (key, required[]) pairs by regex.
      const keyRe = /'([a-z_]+\.[a-z_]+)':\s*\{([\s\S]*?)\n  \}/g;
      const reqRe = /required:\s*\[([^\]]*)\]/;
      const mismatches: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = keyRe.exec(blob)) !== null) {
        const actionKey = m[1];
        if (!actionKey) continue;
        const [parentTool, action] = actionKey.split('.');
        if (!parentTool || !action) continue;
        const body = m[2] ?? '';
        const reqMatch = body.match(reqRe);
        const handTunedRequired: string[] = reqMatch?.[1]
          ? reqMatch[1]
              .split(',')
              .map((s) => s.trim().replace(/^'|'$/g, '').replace(/^"|"$/g, ''))
              .filter(Boolean)
              .sort()
          : [];

        const derived = getDerived(parentTool, action);
        const derivedRequired = readRequired(derived);

        const dev = HAND_TUNED_DEVIATIONS[actionKey];
        const expected = (() => {
          if (!dev) return derivedRequired;
          const s = new Set(derivedRequired);
          for (const x of dev.extraRequired ?? []) s.add(x);
          for (const x of dev.missingRequired ?? []) s.delete(x);
          return [...s].sort();
        })();

        if (JSON.stringify(handTunedRequired) !== JSON.stringify(expected)) {
          mismatches.push(
            `  - ${actionKey}:\n` +
              `      hand-tuned required:  [${handTunedRequired.join(', ')}]\n` +
              `      derived required:     [${derivedRequired.join(', ')}]\n` +
              `      expected (w/ devs):   [${expected.join(', ')}]` +
              (dev ? `  (deviation: ${dev.reason})` : '')
          );
        }
      }

      expect(
        mismatches.length,
        `\n${mismatches.length} ALWAYS_LOADED_SCHEMAS entries disagree with compound Zod:\n${mismatches.join(
          '\n\n'
        )}\n\n` +
          `Either update the hand-tuned entry to match, delete the hand-tuned entry (let\n` +
          `buildFlatInputSchemaForAction supply it), or add a documented deviation in\n` +
          `HAND_TUNED_DEVIATIONS with a justifying comment.`
      ).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Assertion 3: Action field stripped from derived schema
  // --------------------------------------------------------------------------
  describe('Assertion 3: derived schemas strip the `action` field', () => {
    it('no derived schema exposes `action` as a property or in required[]', () => {
      const failures: string[] = [];
      // Sample 1 action per parent tool — sufficient because the stripping
      // logic is parent-tool-agnostic. The full sweep happens in Assertion 1.
      const seen = new Set<string>();
      for (const entry of registry) {
        if (seen.has(entry.parentTool)) continue;
        seen.add(entry.parentTool);
        const derived = getDerived(entry.parentTool, entry.action);
        if (!derived) continue;
        const props = readPropertyKeys(derived);
        const req = readRequired(derived);
        if (props.includes('action')) {
          failures.push(`  - ${entry.name}: properties includes 'action'`);
        }
        if (req.includes('action')) {
          failures.push(`  - ${entry.name}: required[] includes 'action'`);
        }
      }
      expect(
        failures.length,
        `\nDerived schemas leaked the 'action' discriminant field:\n${failures.join('\n')}\n\n` +
          `Fix in src/mcp/registration/flat-input-schemas.ts — the action field is injected\n` +
          `by flat-tool-routing and must not appear in the LLM-facing schema.`
      ).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Assertion 4: Registry integrity (parentTool × action ∈ TOOL_ACTIONS)
  // --------------------------------------------------------------------------
  describe('Assertion 4: every flat tool resolves to a known parent action', () => {
    it('no orphan entries', () => {
      const orphans: string[] = [];
      for (const entry of registry) {
        const actions = (TOOL_ACTIONS as Record<string, readonly string[] | undefined>)[
          entry.parentTool
        ];
        if (!actions || !actions.includes(entry.action)) {
          orphans.push(
            `  - ${entry.name} (${entry.parentTool}.${entry.action}) — parent/action not in TOOL_ACTIONS`
          );
        }
      }
      expect(orphans.length, `\nOrphan flat tools:\n${orphans.join('\n')}`).toBe(0);
    });
  });
});
