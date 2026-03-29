import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmDestructiveAction } from '../../src/mcp/elicitation.js';

function createServer() {
  return {
    getClientCapabilities: vi.fn(),
    elicitInput: vi.fn(),
  };
}

describe('confirmDestructiveAction', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns confirmed=true only after an explicit accept response', async () => {
    const server = createServer();
    server.elicitInput.mockResolvedValue({
      action: 'accept',
      content: { confirm: true, reason: 'Approved for cleanup' },
    });

    const result = await confirmDestructiveAction(server as any, 'delete_sheet', 'Delete Sheet1');

    expect(result).toEqual({
      confirmed: true,
      outcome: 'accepted',
      reason: 'Approved for cleanup',
    });
  });

  it('returns confirmed=false when the user declines the destructive action', async () => {
    const server = createServer();
    server.elicitInput.mockResolvedValue({
      action: 'decline',
      content: { reason: 'Not safe yet' },
    });

    const result = await confirmDestructiveAction(server as any, 'delete_sheet', 'Delete Sheet1');

    expect(result).toEqual({
      confirmed: false,
      outcome: 'declined',
      reason: 'Not safe yet',
    });
  });

  it('returns cancelled when the user closes the confirmation flow', async () => {
    const server = createServer();
    server.elicitInput.mockResolvedValue({
      action: 'cancel',
      content: { reason: 'Need more time' },
    });

    const result = await confirmDestructiveAction(server as any, 'delete_sheet', 'Delete Sheet1');

    expect(result).toEqual({
      confirmed: false,
      outcome: 'cancelled',
      reason: 'Need more time',
    });
  });

  it('fails closed when elicitation is unavailable', async () => {
    const server = createServer();
    server.elicitInput.mockRejectedValue(new Error('Client does not support elicitation'));

    const result = await confirmDestructiveAction(server as any, 'delete_sheet', 'Delete Sheet1');

    expect(result.confirmed).toBe(false);
    expect(result.outcome).toBe('unavailable');
    expect(result.reason).toContain('Interactive confirmation is unavailable');
  });

  it('fails closed when confirmation times out', async () => {
    vi.useFakeTimers();
    const server = createServer();
    server.elicitInput.mockImplementation(() => new Promise(() => {}));

    const resultPromise = confirmDestructiveAction(server as any, 'delete_sheet', 'Delete Sheet1');
    await vi.advanceTimersByTimeAsync(5000);

    await expect(resultPromise).resolves.toMatchObject({
      confirmed: false,
      outcome: 'timed_out',
      reason: expect.stringContaining('timed out'),
    });
  });
});
