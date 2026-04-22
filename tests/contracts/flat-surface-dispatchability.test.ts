/**
 * Flat Surface Dispatchability Contract Tests
 *
 * Every tool advertised by the flat tools/list surface MUST be dispatchable
 * through the flat-tool-call-interceptor — otherwise the MCP SDK returns
 * "handler is not a function" at runtime.
 *
 * Background
 * ----------
 * The flat tool surface publishes three families of tool names:
 *
 *   A. `sheets_<domain>_<action>` — from `getFlatToolRegistry()`; dispatched
 *      via `routeFlatToolCall()` → compound handler.
 *   B. `sheets_discover` — meta-tool from `buildDiscoverToolEntry()`; dispatched
 *      directly by the interceptor's special-case branch (it is NOT a registered
 *      SDK tool and NOT in the flat registry).
 *   C. Short aliases (`data`, `viz`, ...) — from `SHORT_ALIAS_TO_COMPOUND`;
 *      rewritten by the interceptor to a compound tool name.
 *
 * BUG #2 of the 2026-04-21 E2E session: `sheets_discover` was advertised by
 * `tools/list` but the SDK's dispatcher 404'd it because it had no
 * corresponding registration. The fix wired a special case in the
 * interceptor (flat-tool-call-interceptor.ts:106). This contract guarantees
 * no future "advertised but unroutable" tool ever ships.
 *
 * Assertions
 * ----------
 *   1. Every `getFlatToolRegistry()` entry round-trips through
 *      `parseFlatToolName()` back to the same (parentTool, action) pair.
 *
 *   2. Every `getFlatToolRegistry()` entry's parent tool is in
 *      `COMPOUND_TOOL_NAMES` (i.e. a real handler exists to receive the call).
 *
 *   3. `routeFlatToolCall(entry.name, {})` returns a non-null route for
 *      every flat registry entry, and that route's `compoundToolName`
 *      matches `entry.parentTool`. Action is injected into the request
 *      envelope (normalizedArgs.request.action === entry.action).
 *
 *   4. Every short alias in `SHORT_ALIAS_TO_COMPOUND` resolves to a name
 *      present in `COMPOUND_TOOL_NAMES`.
 *
 *   5. `sheets_discover` is NOT in the flat registry (it is special-cased)
 *      but `flat-tool-call-interceptor.ts` source contains the `'sheets_discover'`
 *      special-case branch AND it imports `handleDiscover` from
 *      `flat-discover-handler.js`.
 *
 *   6. `isFlatToolName()` recognises every flat registry entry and rejects
 *      every compound name.
 *
 * @module tests/contracts/flat-surface-dispatchability
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  getFlatToolRegistry,
  parseFlatToolName,
} from '../../src/mcp/registration/flat-tool-registry.js';
import {
  routeFlatToolCall,
  isFlatToolName,
  COMPOUND_TOOL_NAMES,
} from '../../src/mcp/registration/flat-tool-routing.js';

// --------------------------------------------------------------------------

describe('Flat Surface Dispatchability (advertised ⇒ routable)', () => {
  const registry = getFlatToolRegistry();

  it('registry is non-empty (sanity)', () => {
    expect(registry.length).toBeGreaterThan(100);
  });

  // ------------------------------------------------------------------------
  // Assertion 1: name round-trip
  // ------------------------------------------------------------------------
  describe('Assertion 1: parseFlatToolName round-trip', () => {
    it('every registry entry round-trips through parseFlatToolName', () => {
      const failures: string[] = [];
      for (const entry of registry) {
        const parsed = parseFlatToolName(entry.name);
        if (!parsed) {
          failures.push(`  - ${entry.name}: parseFlatToolName returned null`);
          continue;
        }
        if (parsed.parentTool !== entry.parentTool || parsed.action !== entry.action) {
          failures.push(
            `  - ${entry.name}: parsed {${parsed.parentTool}.${parsed.action}} !== registry {${entry.parentTool}.${entry.action}}`
          );
        }
      }
      expect(
        failures.length,
        `\n${failures.length} flat tool name(s) failed round-trip:\n${failures.join('\n')}\n`
      ).toBe(0);
    });
  });

  // ------------------------------------------------------------------------
  // Assertion 2: every parent is a real compound tool
  // ------------------------------------------------------------------------
  describe('Assertion 2: every parentTool is in COMPOUND_TOOL_NAMES', () => {
    it('no flat tool points to a non-existent compound', () => {
      const orphans: string[] = [];
      for (const entry of registry) {
        if (!COMPOUND_TOOL_NAMES.has(entry.parentTool)) {
          orphans.push(
            `  - ${entry.name} → parent ${entry.parentTool} not in COMPOUND_TOOL_NAMES`
          );
        }
      }
      expect(
        orphans.length,
        `\nFlat tools without a backing compound handler:\n${orphans.join('\n')}\n\n` +
          `Either add the parent to COMPOUND_TOOL_NAMES in flat-tool-routing.ts:37,\n` +
          `or remove the orphan action from TOOL_ACTIONS.`
      ).toBe(0);
    });
  });

  // ------------------------------------------------------------------------
  // Assertion 3: routeFlatToolCall succeeds for every entry
  // ------------------------------------------------------------------------
  describe('Assertion 3: routeFlatToolCall produces a valid envelope for every entry', () => {
    it('no flat tool is unroutable (would-be "handler is not a function")', () => {
      const unroutable: string[] = [];
      const misrouted: string[] = [];
      const malformed: string[] = [];

      for (const entry of registry) {
        const routed = routeFlatToolCall(entry.name, {});
        if (!routed) {
          unroutable.push(`  - ${entry.name}`);
          continue;
        }
        if (routed.compoundToolName !== entry.parentTool) {
          misrouted.push(
            `  - ${entry.name}: routed to ${routed.compoundToolName} (expected ${entry.parentTool})`
          );
        }
        const req = (routed.normalizedArgs as { request?: Record<string, unknown> }).request;
        if (!req || typeof req !== 'object') {
          malformed.push(`  - ${entry.name}: normalizedArgs.request missing/not-object`);
          continue;
        }
        if (req['action'] !== entry.action) {
          malformed.push(
            `  - ${entry.name}: injected action '${String(req['action'])}' !== entry.action '${entry.action}'`
          );
        }
      }

      const failures = [
        unroutable.length > 0
          ? `${unroutable.length} unroutable:\n${unroutable.join('\n')}`
          : '',
        misrouted.length > 0 ? `${misrouted.length} misrouted:\n${misrouted.join('\n')}` : '',
        malformed.length > 0 ? `${malformed.length} malformed:\n${malformed.join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      expect(
        unroutable.length + misrouted.length + malformed.length,
        `\nFlat tool dispatch contract failure:\n${failures}\n\n` +
          `This is exactly the class of bug that produced BUG #2 (sheets_discover) —\n` +
          `tools advertised by tools/list but not wired to a handler.\n`
      ).toBe(0);
    });
  });

  // ------------------------------------------------------------------------
  // Assertion 4: short alias map is coherent
  // ------------------------------------------------------------------------
  describe('Assertion 4: SHORT_ALIAS_TO_COMPOUND resolves to real compounds', () => {
    // Parse the map out of the interceptor source (module-local).
    it('every short alias maps to a name in COMPOUND_TOOL_NAMES', () => {
      const src = fs.readFileSync(
        path.resolve(__dirname, '../../src/mcp/registration/flat-tool-call-interceptor.ts'),
        'utf-8'
      );
      const mapStart = src.indexOf('const SHORT_ALIAS_TO_COMPOUND');
      expect(mapStart, 'SHORT_ALIAS_TO_COMPOUND not found').toBeGreaterThan(0);
      const after = src.slice(mapStart);
      const endRel = after.indexOf('\n};');
      expect(endRel, 'end of SHORT_ALIAS_TO_COMPOUND not found').toBeGreaterThan(0);
      const blob = after.slice(0, endRel + 3);

      const entryRe = /(\w+):\s*'(sheets_\w+)'/g;
      const aliases: Array<[string, string]> = [];
      let m: RegExpExecArray | null;
      while ((m = entryRe.exec(blob)) !== null) {
        const alias = m[1];
        const target = m[2];
        if (alias && target) {
          aliases.push([alias, target]);
        }
      }
      expect(aliases.length, 'no aliases parsed from SHORT_ALIAS_TO_COMPOUND').toBeGreaterThan(10);

      const broken: string[] = [];
      for (const [alias, target] of aliases) {
        if (!COMPOUND_TOOL_NAMES.has(target)) {
          broken.push(`  - ${alias} → ${target} (not in COMPOUND_TOOL_NAMES)`);
        }
      }
      expect(
        broken.length,
        `\nShort aliases pointing at non-existent compounds:\n${broken.join('\n')}\n`
      ).toBe(0);
    });
  });

  // ------------------------------------------------------------------------
  // Assertion 5: sheets_discover special-case is wired
  // ------------------------------------------------------------------------
  describe('Assertion 5: sheets_discover is advertised but special-cased', () => {
    it('sheets_discover is NOT in the flat registry', () => {
      const inRegistry = registry.find((e) => e.name === 'sheets_discover');
      expect(inRegistry, 'sheets_discover should not be in getFlatToolRegistry()').toBeUndefined();
    });

    it('flat-tool-call-interceptor.ts contains the sheets_discover branch and import', () => {
      const src = fs.readFileSync(
        path.resolve(__dirname, '../../src/mcp/registration/flat-tool-call-interceptor.ts'),
        'utf-8'
      );
      // Import of handleDiscover — concrete proof the handler is reachable.
      expect(
        src,
        'handleDiscover must be imported from flat-discover-handler'
      ).toContain('handleDiscover');
      expect(src).toContain("from './flat-discover-handler.js'");
      // Special-case branch inside the tools/call wrapper.
      expect(
        src,
        "sheets_discover special-case branch must exist in the interceptor"
      ).toMatch(/name === 'sheets_discover'/);
    });

    it('flat-discover-handler.ts exports handleDiscover', () => {
      const src = fs.readFileSync(
        path.resolve(__dirname, '../../src/mcp/registration/flat-discover-handler.ts'),
        'utf-8'
      );
      expect(src).toMatch(/export\s+function\s+handleDiscover/);
    });
  });

  // ------------------------------------------------------------------------
  // Assertion 6: isFlatToolName symmetry
  // ------------------------------------------------------------------------
  describe('Assertion 6: isFlatToolName recognition', () => {
    it('accepts every flat registry entry', () => {
      const rejected: string[] = [];
      for (const entry of registry) {
        if (!isFlatToolName(entry.name)) rejected.push(entry.name);
      }
      expect(
        rejected.length,
        `\nisFlatToolName rejected these registry entries:\n  ${rejected.join('\n  ')}\n`
      ).toBe(0);
    });

    it('rejects every compound tool name', () => {
      const misclassified: string[] = [];
      for (const compound of COMPOUND_TOOL_NAMES) {
        if (isFlatToolName(compound)) misclassified.push(compound);
      }
      expect(
        misclassified.length,
        `\nisFlatToolName wrongly classified these compounds as flat:\n  ${misclassified.join('\n  ')}\n`
      ).toBe(0);
    });
  });
});
