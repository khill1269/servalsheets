import { describe, expect, it, vi } from 'vitest';

import { registerStdioTools } from '../../../packages/mcp-stdio/src/register-stdio-tools.js';

describe('@serval/mcp-stdio registerStdioTools', () => {
  it('registers initial tools, marks them registered, and syncs tool list notifications', () => {
    const registerToolSet = vi.fn();
    const markRegistered = vi.fn();
    const syncToolList = vi.fn();
    const initializeStageManager = vi.fn();

    const allTools = [{ name: 'sheets_auth' }, { name: 'sheets_core' }, { name: 'sheets_data' }];
    const initialTools = [{ name: 'sheets_auth' }, { name: 'sheets_core' }];

    registerStdioTools(allTools, {
      initializeStageManager,
      getInitialTools: () => initialTools,
      registerToolSet,
      markRegistered,
      stagedRegistrationEnabled: true,
      registerToolsListCompatibilityHandler: vi.fn(),
      enableToolsListChangedNotifications: true,
      syncToolList,
      log: { info: vi.fn() },
    });

    expect(initializeStageManager).toHaveBeenCalledOnce();
    expect(registerToolSet).toHaveBeenCalledWith(initialTools);
    expect(markRegistered).toHaveBeenCalledWith(['sheets_auth', 'sheets_core']);
    expect(syncToolList).toHaveBeenCalledWith(['sheets_auth', 'sheets_core'], {
      emitOnFirstSet: false,
      reason: 'tool registration updated',
    });
  });
});
