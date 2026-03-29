import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceEventsService } from '../../src/services/workspace-events.js';

const makeMockClient = () =>
  ({
    oauth2: {
      credentials: { access_token: 'test-token', expiry_date: Date.now() + 3600_000 },
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
    },
  }) as never;

describe('WorkspaceEventsService', () => {
  let persistenceDir: string;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T12:00:00.000Z'));
    persistenceDir = mkdtempSync(path.join(tmpdir(), 'servalsheets-workspace-events-'));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    rmSync(persistenceDir, { recursive: true, force: true });
  });

  it('prefers the subscription resource name from operation.response.name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            name: 'operations/123',
            response: { name: 'subscriptions/abc' },
            metadata: {
              subscription: {
                name: 'subscriptions/fallback',
                expireTime: '2026-03-16T12:00:00.000Z',
              },
            },
          }),
      })
    );

    const service = new WorkspaceEventsService(makeMockClient(), {
      persistencePath: path.join(persistenceDir, 'subscriptions.json'),
    });
    const subscription = await service.createSubscription(
      'spreadsheet-123',
      'projects/demo/topics/workspace-events'
    );

    expect(subscription.id).toBe('subscriptions/abc');
    expect(service.listSubscriptions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'subscriptions/abc',
          spreadsheetId: 'spreadsheet-123',
          notificationEndpoint: 'projects/demo/topics/workspace-events',
        }),
      ])
    );
    service.destroy();
  });

  it('falls back to metadata.subscription.name when operation.response.name is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            name: 'operations/456',
            metadata: {
              subscription: {
                name: 'subscriptions/from-metadata',
                expireTime: '2026-03-16T12:00:00.000Z',
              },
            },
          }),
      })
    );

    const service = new WorkspaceEventsService(makeMockClient(), {
      persistencePath: path.join(persistenceDir, 'subscriptions.json'),
    });
    const subscription = await service.createSubscription(
      'spreadsheet-456',
      'projects/demo/topics/workspace-events'
    );

    expect(subscription.id).toBe('subscriptions/from-metadata');
    service.destroy();
  });

  it('polls long-running operations until the subscription resource is available', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              name: 'operations/create-123',
              done: false,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              name: 'operations/create-123',
              done: true,
              response: {
                name: 'subscriptions/from-operation',
                targetResource: '//drive.googleapis.com/files/spreadsheet-polled',
                notificationEndpoint: {
                  pubsubTopic: 'projects/demo/topics/workspace-events',
                },
                expireTime: '2026-03-16T12:00:00.000Z',
                state: 'ACTIVE',
              },
            }),
        })
    );

    const service = new WorkspaceEventsService(makeMockClient(), {
      persistencePath: path.join(persistenceDir, 'subscriptions.json'),
    });
    const createPromise = service.createSubscription(
      'spreadsheet-polled',
      'projects/demo/topics/workspace-events'
    );

    await vi.advanceTimersByTimeAsync(500);
    const subscription = await createPromise;

    expect(subscription).toMatchObject({
      id: 'subscriptions/from-operation',
      spreadsheetId: 'spreadsheet-polled',
      state: 'ACTIVE',
    });
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://workspaceevents.googleapis.com/v1beta/operations/create-123'
    );
    service.destroy();
  });

  it('rejects invalid Pub/Sub topic names before calling the Workspace Events API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const service = new WorkspaceEventsService(makeMockClient(), {
      persistencePath: path.join(persistenceDir, 'subscriptions.json'),
    });

    await expect(
      service.createSubscription('spreadsheet-invalid', 'https://example.com/not-a-topic')
    ).rejects.toThrow(/projects\/\{project\}\/topics\/\{topic\}/);
    expect(fetchMock).not.toHaveBeenCalled();
    service.destroy();
  });

  it('restores persisted subscriptions and re-schedules renewal timers after restart', async () => {
    const persistencePath = path.join(persistenceDir, 'subscriptions.json');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              response: { name: 'subscriptions/restart-test' },
              metadata: {
                subscription: {
                  name: 'subscriptions/restart-test',
                  expireTime: '2026-03-10T01:00:00.000Z',
                },
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              name: 'operations/renew-1',
              done: false,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              name: 'operations/renew-1',
              done: true,
              response: {
                name: 'subscriptions/restart-test',
                targetResource: '//drive.googleapis.com/files/spreadsheet-789',
                notificationEndpoint: {
                  pubsubTopic: 'projects/demo/topics/workspace-events',
                },
                expireTime: '2026-03-16T12:00:00.000Z',
                state: 'ACTIVE',
              },
            }),
        })
    );

    const original = new WorkspaceEventsService(makeMockClient(), {
      persistencePath,
    });
    await original.createSubscription('spreadsheet-789', 'projects/demo/topics/workspace-events');
    original.destroy();

    const restored = new WorkspaceEventsService(makeMockClient(), {
      persistencePath,
    });

    expect(restored.listSubscriptions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'subscriptions/restart-test',
          spreadsheetId: 'spreadsheet-789',
        }),
      ])
    );

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 500);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://workspaceevents.googleapis.com/v1beta/subscriptions/restart-test?updateMask=ttl'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'https://workspaceevents.googleapis.com/v1beta/operations/renew-1'
    );
    restored.destroy();
  });

  it('drops expired persisted subscriptions on restore', async () => {
    const persistencePath = path.join(persistenceDir, 'subscriptions.json');
    const service = new WorkspaceEventsService(makeMockClient(), {
      persistencePath,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response: { name: 'subscriptions/expired-test' },
            metadata: {
              subscription: {
                name: 'subscriptions/expired-test',
                expireTime: '2026-03-09T12:30:00.000Z',
              },
            },
          }),
      })
    );

    await service.createSubscription('spreadsheet-expired', 'projects/demo/topics/workspace-events');
    service.destroy();

    vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'));

    const restored = new WorkspaceEventsService(makeMockClient(), {
      persistencePath,
    });
    expect(restored.listSubscriptions()).toEqual([]);
    restored.destroy();
  });

  it('restores suspended subscriptions without re-scheduling renewal timers', async () => {
    const persistencePath = path.join(persistenceDir, 'subscriptions.json');
    const service = new WorkspaceEventsService(makeMockClient(), {
      persistencePath,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response: {
              name: 'subscriptions/suspended-test',
              targetResource: '//drive.googleapis.com/files/spreadsheet-suspended',
              notificationEndpoint: {
                pubsubTopic: 'projects/demo/topics/workspace-events',
              },
              expireTime: '2026-03-10T01:00:00.000Z',
              state: 'SUSPENDED',
              suspensionReason: 'RESOURCE_DELETED',
            },
          }),
      })
    );

    await service.createSubscription(
      'spreadsheet-suspended',
      'projects/demo/topics/workspace-events'
    );
    service.destroy();

    const restored = new WorkspaceEventsService(makeMockClient(), {
      persistencePath,
    });

    expect(restored.listSubscriptions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'subscriptions/suspended-test',
          state: 'SUSPENDED',
          suspensionReason: 'RESOURCE_DELETED',
        }),
      ])
    );

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    restored.destroy();
  });

  it('reactivates a suspended subscription and resumes renewal scheduling', async () => {
    const persistencePath = path.join(persistenceDir, 'subscriptions.json');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              response: {
                name: 'subscriptions/reactivate-test',
                targetResource: '//drive.googleapis.com/files/spreadsheet-reactivate',
                notificationEndpoint: {
                  pubsubTopic: 'projects/demo/topics/workspace-events',
                },
                expireTime: '2026-03-10T01:00:00.000Z',
                state: 'SUSPENDED',
                suspensionReason: 'USER_SCOPE_REVOKED',
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              name: 'operations/reactivate-1',
              done: true,
              response: {
                name: 'subscriptions/reactivate-test',
                targetResource: '//drive.googleapis.com/files/spreadsheet-reactivate',
                notificationEndpoint: {
                  pubsubTopic: 'projects/demo/topics/workspace-events',
                },
                expireTime: '2026-03-16T12:00:00.000Z',
                state: 'ACTIVE',
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              name: 'operations/renew-reactivated',
              done: true,
              response: {
                name: 'subscriptions/reactivate-test',
                targetResource: '//drive.googleapis.com/files/spreadsheet-reactivate',
                notificationEndpoint: {
                  pubsubTopic: 'projects/demo/topics/workspace-events',
                },
                expireTime: '2026-03-23T12:00:00.000Z',
                state: 'ACTIVE',
              },
            }),
        })
    );

    const service = new WorkspaceEventsService(makeMockClient(), {
      persistencePath,
    });
    await service.createSubscription(
      'spreadsheet-reactivate',
      'projects/demo/topics/workspace-events'
    );

    const reactivated = await service.reactivateSubscription('subscriptions/reactivate-test');

    expect(reactivated.state).toBe('ACTIVE');
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe(
      'https://workspaceevents.googleapis.com/v1beta/subscriptions/reactivate-test:reactivate'
    );

    await vi.advanceTimersByTimeAsync(7 * 24 * 60 * 60 * 1000);
    expect(vi.mocked(fetch).mock.calls[2]?.[0]).toBe(
      'https://workspaceevents.googleapis.com/v1beta/subscriptions/reactivate-test?updateMask=ttl'
    );
    service.destroy();
  });

  it('keeps local state when remote delete fails with a non-404 error', async () => {
    const persistencePath = path.join(persistenceDir, 'subscriptions.json');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              response: { name: 'subscriptions/delete-test' },
              metadata: {
                subscription: {
                  name: 'subscriptions/delete-test',
                  expireTime: '2026-03-16T12:00:00.000Z',
                },
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve('invalid delete request'),
        })
    );

    const service = new WorkspaceEventsService(makeMockClient(), {
      persistencePath,
    });
    await service.createSubscription('spreadsheet-delete', 'projects/demo/topics/workspace-events');

    const deletePromise = service.deleteSubscription('subscriptions/delete-test');
    const deleteAssertion = expect(deletePromise).rejects.toThrow(
      /Failed to delete Workspace Events subscription/
    );
    await vi.runAllTimersAsync();
    await deleteAssertion;
    expect(service.listSubscriptions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'subscriptions/delete-test',
        }),
      ])
    );
    service.destroy();
  });

  it('drops local state when renewal returns 404 for a deleted remote subscription', async () => {
    const persistencePath = path.join(persistenceDir, 'subscriptions.json');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              response: {
                name: 'subscriptions/missing-on-renew',
                targetResource: '//drive.googleapis.com/files/spreadsheet-missing',
                notificationEndpoint: {
                  pubsubTopic: 'projects/demo/topics/workspace-events',
                },
                expireTime: '2026-03-10T01:00:00.000Z',
                state: 'ACTIVE',
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: () => Promise.resolve('not found'),
        })
    );

    const service = new WorkspaceEventsService(makeMockClient(), {
      persistencePath,
    });
    await service.createSubscription(
      'spreadsheet-missing',
      'projects/demo/topics/workspace-events'
    );

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(service.listSubscriptions()).toEqual([]);
    service.destroy();
  });

  it('prunes local state when reactivation returns 404 for a deleted remote subscription', async () => {
    const persistencePath = path.join(persistenceDir, 'subscriptions.json');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              response: {
                name: 'subscriptions/missing-reactivate',
                targetResource: '//drive.googleapis.com/files/spreadsheet-missing-reactivate',
                notificationEndpoint: {
                  pubsubTopic: 'projects/demo/topics/workspace-events',
                },
                expireTime: '2026-03-16T12:00:00.000Z',
                state: 'SUSPENDED',
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: () => Promise.resolve('not found'),
        })
    );

    const service = new WorkspaceEventsService(makeMockClient(), {
      persistencePath,
    });
    await service.createSubscription(
      'spreadsheet-missing-reactivate',
      'projects/demo/topics/workspace-events'
    );

    await expect(
      service.reactivateSubscription('subscriptions/missing-reactivate')
    ).rejects.toThrow(/no longer exists remotely/);
    expect(service.listSubscriptions()).toEqual([]);
    service.destroy();
  });
});
