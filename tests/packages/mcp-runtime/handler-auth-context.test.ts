import { describe, expect, it } from 'vitest';

import { createHandlerAuthContext } from '../../../packages/mcp-runtime/src/index.js';

describe('@serval/mcp-runtime handler auth context', () => {
  it('reads live auth capability values from the source getter', () => {
    const source = {
      hasElevatedAccess: false,
      scopes: ['spreadsheets.readonly'],
    };

    const auth = createHandlerAuthContext(() => source);

    expect(auth.hasElevatedAccess).toBe(false);
    expect(auth.scopes).toEqual(['spreadsheets.readonly']);

    source.hasElevatedAccess = true;
    source.scopes = ['spreadsheets', 'drive.file'];

    expect(auth.hasElevatedAccess).toBe(true);
    expect(auth.scopes).toEqual(['spreadsheets', 'drive.file']);
  });

  it('falls back safely when the source is absent', () => {
    const auth = createHandlerAuthContext(() => undefined);

    expect(auth.hasElevatedAccess).toBe(false);
    expect(auth.scopes).toEqual([]);
  });
});
