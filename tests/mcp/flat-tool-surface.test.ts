/**
 * Tests for the flat tool presentation layer.
 *
 * Covers:
 * - flat-tool-registry.ts: registry generation, naming, always-loaded set
 * - flat-tool-routing.ts: flat→compound routing, name resolution
 * - flat-discover-handler.ts: sheets_discover tool
 * - flat-tool-call-interceptor.ts: integration contract tests
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildFlatToolName,
  parseFlatToolName,
  getFlatToolRegistry,
  getAlwaysLoadedFlatTools,
  getDeferredFlatTools,
  searchFlatToolsByPattern,
  getFlatRegistryStats,
  type FlatToolDefinition,
} from '../../src/mcp/registration/flat-tool-registry.js';
import {
  isFlatToolName,
  routeFlatToolCall,
  resolveCompoundToolName,
  buildFlatToCompoundMap,
} from '../../src/mcp/registration/flat-tool-routing.js';
import { handleDiscover } from '../../src/mcp/registration/flat-discover-handler.js';
import { TOOL_ACTIONS } from '../../src/mcp/completions.js';

// ============================================================================
// flat-tool-registry.ts
// ============================================================================

describe('flat-tool-registry', () => {
  describe('buildFlatToolName', () => {
    it('builds standard flat tool names', () => {
      expect(buildFlatToolName('sheets_data', 'read')).toBe('sheets_data_read');
      expect(buildFlatToolName('sheets_core', 'create')).toBe('sheets_core_create');
      expect(buildFlatToolName('sheets_auth', 'status')).toBe('sheets_auth_status');
    });

    it('applies domain prefix overrides for long names', () => {
      expect(buildFlatToolName('sheets_dimensions', 'freeze')).toBe('sheets_dim_freeze');
      expect(buildFlatToolName('sheets_collaborate', 'comment_add')).toBe(
        'sheets_collab_comment_add'
      );
      expect(buildFlatToolName('sheets_visualize', 'chart_create')).toBe(
        'sheets_viz_chart_create'
      );
      expect(buildFlatToolName('sheets_dependencies', 'model_scenario')).toBe(
        'sheets_deps_model_scenario'
      );
      expect(buildFlatToolName('sheets_transaction', 'begin')).toBe('sheets_tx_begin');
      expect(buildFlatToolName('sheets_appsscript', 'run')).toBe('sheets_script_run');
      expect(buildFlatToolName('sheets_bigquery', 'query')).toBe('sheets_bq_query');
      expect(buildFlatToolName('sheets_federation', 'call_remote')).toBe(
        'sheets_fed_call_remote'
      );
    });

    it('generates unique names for all actions', () => {
      const registry = getFlatToolRegistry();
      const names = new Set(registry.map((t) => t.name));
      expect(names.size).toBe(registry.length);
    });
  });

  describe('parseFlatToolName', () => {
    it('parses standard flat tool names back to parent + action', () => {
      const parsed = parseFlatToolName('sheets_data_read');
      expect(parsed).not.toBeNull();
      expect(parsed!.parentTool).toBe('sheets_data');
      expect(parsed!.action).toBe('read');
    });

    it('parses domain-shortened flat tool names', () => {
      const parsed = parseFlatToolName('sheets_dim_freeze');
      expect(parsed).not.toBeNull();
      expect(parsed!.parentTool).toBe('sheets_dimensions');
      expect(parsed!.action).toBe('freeze');
    });

    it('returns null for unknown flat tool names', () => {
      expect(parseFlatToolName('sheets_nonexistent_action')).toBeNull();
      expect(parseFlatToolName('totally_unknown')).toBeNull();
      expect(parseFlatToolName('')).toBeNull();
    });

    it('returns null for compound tool names', () => {
      expect(parseFlatToolName('sheets_data')).toBeNull();
      expect(parseFlatToolName('sheets_core')).toBeNull();
    });
  });

  describe('getFlatToolRegistry', () => {
    it('returns a non-empty array', () => {
      const registry = getFlatToolRegistry();
      expect(registry.length).toBeGreaterThan(0);
    });

    it('covers all actions from TOOL_ACTIONS', () => {
      const registry = getFlatToolRegistry();
      const totalToolActions = Object.values(TOOL_ACTIONS).reduce(
        (sum, actions) => sum + actions.length,
        0
      );
      // Registry may be slightly smaller if some tools are filtered as unavailable
      expect(registry.length).toBeLessThanOrEqual(totalToolActions);
      expect(registry.length).toBeGreaterThan(totalToolActions * 0.9); // at least 90%
    });

    it('every entry has required fields', () => {
      const registry = getFlatToolRegistry();
      for (const entry of registry) {
        expect(entry.name).toBeTruthy();
        expect(entry.parentTool).toBeTruthy();
        expect(entry.action).toBeTruthy();
        expect(entry.title).toBeTruthy();
        expect(entry.description).toBeTruthy();
        expect(typeof entry.deferLoading).toBe('boolean');
        expect(entry.annotations).toBeDefined();
        expect(typeof entry.annotations.readOnlyHint).toBe('boolean');
        expect(typeof entry.annotations.destructiveHint).toBe('boolean');
      }
    });

    it('parentTool references a valid compound tool', () => {
      const registry = getFlatToolRegistry();
      const validTools = new Set(Object.keys(TOOL_ACTIONS));
      for (const entry of registry) {
        expect(validTools.has(entry.parentTool)).toBe(true);
      }
    });

    it('is cached across calls', () => {
      const a = getFlatToolRegistry();
      const b = getFlatToolRegistry();
      expect(a).toBe(b); // same reference
    });
  });

  describe('getAlwaysLoadedFlatTools', () => {
    it('returns only non-deferred tools', () => {
      const loaded = getAlwaysLoadedFlatTools();
      for (const t of loaded) {
        expect(t.deferLoading).toBe(false);
      }
    });

    it('includes auth and session bootstrap tools', () => {
      const loaded = getAlwaysLoadedFlatTools();
      const names = new Set(loaded.map((t) => t.name));
      expect(names.has('sheets_auth_status')).toBe(true);
      expect(names.has('sheets_session_get_context')).toBe(true);
      expect(names.has('sheets_session_set_active')).toBe(true);
    });

    it('includes data essentials', () => {
      const loaded = getAlwaysLoadedFlatTools();
      const names = new Set(loaded.map((t) => t.name));
      expect(names.has('sheets_data_read')).toBe(true);
      expect(names.has('sheets_data_write')).toBe(true);
      expect(names.has('sheets_data_append')).toBe(true);
      expect(names.has('sheets_core_list')).toBe(true);
    });

    it('is a small subset of total registry', () => {
      const loaded = getAlwaysLoadedFlatTools();
      const total = getFlatToolRegistry();
      expect(loaded.length).toBeLessThan(20); // ~15 expected
      expect(loaded.length).toBeLessThan(total.length * 0.1);
    });
  });

  describe('getDeferredFlatTools', () => {
    it('returns only deferred tools', () => {
      const deferred = getDeferredFlatTools();
      for (const t of deferred) {
        expect(t.deferLoading).toBe(true);
      }
    });

    it('is the vast majority of the registry', () => {
      const deferred = getDeferredFlatTools();
      const total = getFlatToolRegistry();
      expect(deferred.length).toBeGreaterThan(total.length * 0.9);
    });
  });

  describe('searchFlatToolsByPattern', () => {
    it('finds tools by regex pattern', () => {
      const results = searchFlatToolsByPattern('read');
      expect(results.length).toBeGreaterThan(0);
      // Results match by name OR description
      expect(
        results.some((t) => t.name.includes('read') || t.description.toLowerCase().includes('read'))
      ).toBe(true);
    });

    it('respects maxResults', () => {
      const results = searchFlatToolsByPattern('sheet', 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('falls back to substring match on invalid regex', () => {
      const results = searchFlatToolsByPattern('[invalid(regex');
      // Should not throw, and should return results based on substring match
      expect(Array.isArray(results)).toBe(true);
    });

    it('searches descriptions too', () => {
      const results = searchFlatToolsByPattern('format', 10);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getFlatRegistryStats', () => {
    it('returns correct totals', () => {
      const stats = getFlatRegistryStats();
      const registry = getFlatToolRegistry();
      const loaded = getAlwaysLoadedFlatTools();
      const deferred = getDeferredFlatTools();

      expect(stats.total).toBe(registry.length);
      expect(stats.alwaysLoaded).toBe(loaded.length);
      expect(stats.deferred).toBe(deferred.length);
      expect(stats.alwaysLoaded + stats.deferred).toBe(stats.total);
    });

    it('has byDomain breakdown', () => {
      const stats = getFlatRegistryStats();
      expect(Object.keys(stats.byDomain).length).toBeGreaterThan(0);
      const domainTotal = Object.values(stats.byDomain).reduce((a, b) => a + b, 0);
      expect(domainTotal).toBe(stats.total);
    });
  });

  describe('mutation annotations', () => {
    it('marks write actions as destructive', () => {
      const registry = getFlatToolRegistry();
      const writeEntry = registry.find(
        (t) => t.parentTool === 'sheets_data' && t.action === 'write'
      );
      expect(writeEntry).toBeDefined();
      expect(writeEntry!.annotations.destructiveHint).toBe(true);
      expect(writeEntry!.annotations.readOnlyHint).toBe(false);
    });

    it('marks read actions as readOnly', () => {
      const registry = getFlatToolRegistry();
      const readEntry = registry.find(
        (t) => t.parentTool === 'sheets_data' && t.action === 'read'
      );
      expect(readEntry).toBeDefined();
      expect(readEntry!.annotations.readOnlyHint).toBe(true);
      expect(readEntry!.annotations.destructiveHint).toBe(false);
    });
  });
});

// ============================================================================
// flat-tool-routing.ts
// ============================================================================

describe('flat-tool-routing', () => {
  describe('isFlatToolName', () => {
    it('returns false for compound tool names', () => {
      expect(isFlatToolName('sheets_data')).toBe(false);
      expect(isFlatToolName('sheets_core')).toBe(false);
      expect(isFlatToolName('sheets_auth')).toBe(false);
      expect(isFlatToolName('sheets_format')).toBe(false);
      expect(isFlatToolName('sheets_dimensions')).toBe(false);
    });

    it('returns true for valid flat tool names', () => {
      expect(isFlatToolName('sheets_data_read')).toBe(true);
      expect(isFlatToolName('sheets_core_create')).toBe(true);
      expect(isFlatToolName('sheets_dim_freeze')).toBe(true);
      expect(isFlatToolName('sheets_collab_comment_add')).toBe(true);
    });

    it('returns false for unknown tool names', () => {
      expect(isFlatToolName('totally_unknown')).toBe(false);
      expect(isFlatToolName('sheets_nonexistent_foo')).toBe(false);
    });
  });

  describe('routeFlatToolCall', () => {
    it('routes sheets_data_read to sheets_data with action injected', () => {
      const result = routeFlatToolCall('sheets_data_read', {
        spreadsheetId: 'test-id',
        range: 'A1:B10',
      });
      expect(result).not.toBeNull();
      expect(result!.compoundToolName).toBe('sheets_data');
      expect(result!.normalizedArgs).toEqual({
        action: 'read',
        spreadsheetId: 'test-id',
        range: 'A1:B10',
      });
    });

    it('routes domain-shortened names correctly', () => {
      const result = routeFlatToolCall('sheets_dim_freeze', {
        spreadsheetId: 'test-id',
        rows: 1,
      });
      expect(result).not.toBeNull();
      expect(result!.compoundToolName).toBe('sheets_dimensions');
      expect(result!.normalizedArgs['action']).toBe('freeze');
    });

    it('returns null for unknown flat tool names', () => {
      const result = routeFlatToolCall('sheets_nonexistent_foo', { bar: 1 });
      expect(result).toBeNull();
    });

    it('preserves all original args and adds action', () => {
      const originalArgs = {
        spreadsheetId: 'abc',
        range: 'A1',
        values: [[1, 2, 3]],
        verbosity: 'standard',
      };
      const result = routeFlatToolCall('sheets_data_write', originalArgs);
      expect(result).not.toBeNull();
      expect(result!.normalizedArgs).toEqual({
        ...originalArgs,
        action: 'write',
      });
    });

    it('does not mutate the original args object', () => {
      const originalArgs = { spreadsheetId: 'test' };
      routeFlatToolCall('sheets_data_read', originalArgs);
      expect(originalArgs).toEqual({ spreadsheetId: 'test' });
    });
  });

  describe('resolveCompoundToolName', () => {
    it('returns compound name unchanged', () => {
      expect(resolveCompoundToolName('sheets_data')).toBe('sheets_data');
      expect(resolveCompoundToolName('sheets_core')).toBe('sheets_core');
    });

    it('resolves flat names to compound names', () => {
      expect(resolveCompoundToolName('sheets_data_read')).toBe('sheets_data');
      expect(resolveCompoundToolName('sheets_dim_freeze')).toBe('sheets_dimensions');
    });

    it('returns input unchanged for unknown names', () => {
      expect(resolveCompoundToolName('unknown_tool')).toBe('unknown_tool');
    });
  });

  describe('buildFlatToCompoundMap', () => {
    it('returns a map with all flat tools', () => {
      const map = buildFlatToCompoundMap();
      const registry = getFlatToolRegistry();
      expect(map.size).toBe(registry.length);
    });

    it('maps flat names to correct parent + action', () => {
      const map = buildFlatToCompoundMap();
      const entry = map.get('sheets_data_read');
      expect(entry).toBeDefined();
      expect(entry!.parentTool).toBe('sheets_data');
      expect(entry!.action).toBe('read');
    });
  });
});

// ============================================================================
// flat-discover-handler.ts
// ============================================================================

describe('flat-discover-handler', () => {
  describe('handleDiscover', () => {
    it('returns matches for a valid query', () => {
      const result = handleDiscover({ query: 'read data from spreadsheet' });
      expect(result.success).toBe(true);
      expect(result.action).toBe('discover');
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('returns flat tool names in matches', () => {
      const result = handleDiscover({ query: 'read data' });
      for (const match of result.matches) {
        // Flat tool names start with 'sheets_' and have at least 3 segments
        expect(match.tool).toMatch(/^sheets_/);
        expect(match.tool.split('_').length).toBeGreaterThanOrEqual(3);
      }
    });

    it('respects maxResults', () => {
      const result = handleDiscover({ query: 'format', maxResults: 2 });
      expect(result.matches.length).toBeLessThanOrEqual(2);
    });

    it('returns guidance for empty queries', () => {
      const result = handleDiscover({ query: '' });
      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(0);
      expect(result.guidance?.needsClarification).toBe(true);
    });

    it('returns confidence scores between 0 and 1', () => {
      const result = handleDiscover({ query: 'write values to cells' });
      for (const match of result.matches) {
        expect(match.confidence).toBeGreaterThanOrEqual(0);
        expect(match.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('includes description in each match', () => {
      const result = handleDiscover({ query: 'create chart' });
      for (const match of result.matches) {
        expect(match.description).toBeTruthy();
      }
    });
  });
});

// ============================================================================
// Cross-layer integration tests
// ============================================================================

describe('flat tool surface integration', () => {
  it('roundtrips: registry → build name → parse name → route call', () => {
    const registry = getFlatToolRegistry();
    // Test a sample of entries
    const sample = registry.slice(0, 20);

    for (const entry of sample) {
      // Build name matches registry
      const builtName = buildFlatToolName(entry.parentTool, entry.action);
      expect(builtName).toBe(entry.name);

      // Parse name recovers parent + action
      const parsed = parseFlatToolName(entry.name);
      expect(parsed).not.toBeNull();
      expect(parsed!.parentTool).toBe(entry.parentTool);
      expect(parsed!.action).toBe(entry.action);

      // Route call produces correct compound tool
      const routed = routeFlatToolCall(entry.name, { spreadsheetId: 'test' });
      expect(routed).not.toBeNull();
      expect(routed!.compoundToolName).toBe(entry.parentTool);
      expect(routed!.normalizedArgs['action']).toBe(entry.action);

      // isFlatToolName returns true
      expect(isFlatToolName(entry.name)).toBe(true);

      // resolveCompoundToolName returns parent
      expect(resolveCompoundToolName(entry.name)).toBe(entry.parentTool);
    }
  });

  it('discover returns tools that can be routed', () => {
    const result = handleDiscover({ query: 'read data' });
    for (const match of result.matches) {
      const routed = routeFlatToolCall(match.tool, { spreadsheetId: 'test' });
      expect(routed).not.toBeNull();
    }
  });

  it('most compound tools have at least one flat tool', () => {
    const registry = getFlatToolRegistry();
    const parentTools = new Set(registry.map((t) => t.parentTool));

    // Some tools may be filtered as unavailable (e.g., sheets_federation
    // requires specific config, sheets_webhook requires Redis)
    let coveredCount = 0;
    for (const compoundName of Object.keys(TOOL_ACTIONS)) {
      if (parentTools.has(compoundName)) coveredCount++;
    }

    // At least 20 of 25 compound tools should have flat tool coverage
    expect(coveredCount).toBeGreaterThanOrEqual(20);
  });

  it('no flat tool name collides with a compound tool name', () => {
    const registry = getFlatToolRegistry();
    const compoundNames = new Set(Object.keys(TOOL_ACTIONS));
    for (const entry of registry) {
      expect(
        compoundNames.has(entry.name),
        `Flat tool ${entry.name} collides with compound tool name`
      ).toBe(false);
    }
  });
});
