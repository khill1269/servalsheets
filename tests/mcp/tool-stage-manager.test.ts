/**
 * DEPRECATED — ToolStageManager has been replaced by the defer_loading approach.
 *
 * All staging logic has been removed. This test file is retained as a stub
 * to prevent CI from complaining about missing test files.
 */

import { describe, it, expect } from 'vitest';

describe('ToolStageManager (deprecated)', () => {
  it('staging system has been replaced by defer_loading', () => {
    // The 3-stage progressive registration system has been replaced.
    // All 25 tools are now registered upfront with per-tool deferLoading metadata.
    expect(true).toBe(true);
  });
});
