import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceEventsService } from '../../src/services/workspace-events.js';

describe('WorkspaceEventsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('prefers the subscription resource name from operation.response.name', async () => {
    const create = vi.fn().mockResolvedValue({
      data: {
        name: 'operations/123',
        response: {
          name: 'subscriptions/abc',
        },
        metadata: {
          subscription: {
            name: 'subscriptions/fallback',
            expireTime: '2026-03-16T12:00:00.000Z',
          },
        },
      },
    });

    const service = new WorkspaceEventsService({
      workspaceEvents: {
        subscriptions: {
          create,
          patch: vi.fn(),
          delete: vi.fn(),
        },
      },
    } as never);

    const subscriptionId = await service.createSubscription(
      'spreadsheet-123',
      'projects/demo/topics/workspace-events'
    );

    expect(subscriptionId).toBe('subscriptions/abc');
    expect(service.listSubscriptions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'subscriptions/abc',
          spreadsheetId: 'spreadsheet-123',
        }),
      ])
    );
  });

  it('falls back to metadata.subscription.name when operation.response.name is absent', async () => {
    const create = vi.fn().mockResolvedValue({
      data: {
        name: 'operations/456',
        metadata: {
          subscription: {
            name: 'subscriptions/from-metadata',
            expireTime: '2026-03-16T12:00:00.000Z',
          },
        },
      },
    });

    const service = new WorkspaceEventsService({
      workspaceEvents: {
        subscriptions: {
          create,
          patch: vi.fn(),
          delete: vi.fn(),
        },
      },
    } as never);

    const subscriptionId = await service.createSubscription(
      'spreadsheet-456',
      'projects/demo/topics/workspace-events'
    );

    expect(subscriptionId).toBe('subscriptions/from-metadata');
  });
});
