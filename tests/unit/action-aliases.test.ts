import { describe, expect, it } from 'vitest';
import {
  ACTION_ALIASES,
  isAliasKey,
  listAliasKeys,
  resolveActionAlias,
} from '../../src/schemas/action-aliases.js';
import { TOOL_ACTIONS } from '../../src/mcp/completions.js';

describe('action-aliases registry', () => {
  it('resolves registered aliases by compound key', () => {
    const alias = resolveActionAlias('sheets_data', 'write_range');
    expect(alias).not.toBeNull();
    expect(alias?.canonical).toBe('write');
    expect(alias?.deprecatedSince).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns null for non-aliased actions', () => {
    expect(resolveActionAlias('sheets_data', 'read')).toBeNull();
    expect(resolveActionAlias('nonexistent_tool', 'foo')).toBeNull();
  });

  it('isAliasKey reflects registry membership', () => {
    expect(isAliasKey('sheets_data.write_range')).toBe(true);
    expect(isAliasKey('sheets_data.not_an_alias')).toBe(false);
  });

  it('listAliasKeys returns a stable, frozen view of keys', () => {
    const keys = listAliasKeys();
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBe(Object.keys(ACTION_ALIASES).length);
    // The array is frozen — push should throw in strict mode.
    expect(() => (keys as string[]).push('x')).toThrow();
  });

  it('every canonical target exists in TOOL_ACTIONS (guards against stale renames)', () => {
    for (const [key, meta] of Object.entries(ACTION_ALIASES)) {
      const dotIdx = key.indexOf('.');
      expect(dotIdx).toBeGreaterThan(0);
      const toolName = key.slice(0, dotIdx);
      const valid = TOOL_ACTIONS[toolName];
      expect(valid, `TOOL_ACTIONS missing entry for ${toolName} (alias key: ${key})`).toBeDefined();
      expect(
        valid?.includes(meta.canonical),
        `Alias '${key}' → canonical '${meta.canonical}' is not in TOOL_ACTIONS[${toolName}]`
      ).toBe(true);
    }
  });

  it('no alias key has oldAction === canonical (silent no-op)', () => {
    for (const [key, meta] of Object.entries(ACTION_ALIASES)) {
      const oldAction = key.slice(key.indexOf('.') + 1);
      expect(oldAction, `Alias '${key}' is a no-op`).not.toBe(meta.canonical);
    }
  });

  it('ACTION_ALIASES is frozen (prevents runtime mutation)', () => {
    expect(Object.isFrozen(ACTION_ALIASES)).toBe(true);
  });
});
