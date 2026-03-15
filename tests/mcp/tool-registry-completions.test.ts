import { afterEach, describe, expect, it } from 'vitest';
import { completeAction, completeToolName } from '../../src/mcp/completions.js';
import {
  replaceAvailableToolNames,
  resetAvailableToolNames,
} from '../../src/mcp/tool-registry-state.js';

describe('runtime tool registry completions', () => {
  afterEach(() => {
    resetAvailableToolNames();
  });

  it('filters tool-name completion to currently available tools', () => {
    replaceAvailableToolNames(['sheets_auth', 'sheets_core', 'sheets_data']);

    expect(completeToolName('sheets_')).toEqual(['sheets_auth', 'sheets_core', 'sheets_data']);
    expect(completeToolName('sheets_v')).toEqual([]);
  });

  it('filters action completion when a tool is not currently available', () => {
    replaceAvailableToolNames(['sheets_auth', 'sheets_core']);

    expect(completeAction('sheets_visualize', 'chart')).toEqual([]);
    expect(completeAction('sheets_core', 'add')).toContain('add_sheet');
  });
});
