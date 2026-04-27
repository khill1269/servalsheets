/**
 * ETag Cache Cross-Tenant Isolation Tests
 *
 * Verifies that cached spreadsheet data is scoped to individual users and cannot
 * leak between tenants in multi-user HTTP deployments.
 *
 * Root cause of the bug this tests: read-write.ts constructed the cache key
 * without userId, causing all users to share "anon:spreadsheetId:values:range".
 * Fix: userId is now passed from ha.context.sessionContext?.getUserId().
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ETagCache } from '../../src/services/etag-cache.js';
import type { CacheKey } from '../../src/services/etag-cache.js';

const SPREADSHEET_ID = 'test-spreadsheet-isolation-123';
const RANGE = 'Sheet1!A1:D10';

function makeKey(userId: string | undefined): CacheKey {
  return {
    spreadsheetId: SPREADSHEET_ID,
    endpoint: 'values',
    range: RANGE,
    userId,
  };
}

describe('ETag Cache: cross-tenant isolation', () => {
  let cache: ETagCache;

  beforeEach(() => {
    cache = new ETagCache({ maxSize: 100, maxAge: 60_000 });
  });

  it('user A data is not returned to user B', async () => {
    const userAKey = makeKey('user-alice');
    const userBKey = makeKey('user-bob');
    const userAData = { values: [['Alice private data']] };

    cache.setETag(userAKey, 'etag-alice-1', userAData);

    const userBResult = await cache.getCachedData(userBKey);
    expect(userBResult).toBeNull();
  });

  it('user A and user B each receive their own cached data', async () => {
    const userAKey = makeKey('user-alice');
    const userBKey = makeKey('user-bob');
    const userAData = { values: [['Alice data']] };
    const userBData = { values: [['Bob data']] };

    cache.setETag(userAKey, 'etag-alice', userAData);
    cache.setETag(userBKey, 'etag-bob', userBData);

    const aliceResult = await cache.getCachedData(userAKey);
    const bobResult = await cache.getCachedData(userBKey);

    expect(aliceResult).toEqual(userAData);
    expect(bobResult).toEqual(userBData);
  });

  it('anon key does not collide with authenticated user key for same spreadsheet', async () => {
    const anonKey = makeKey(undefined);
    const authKey = makeKey('user-carol');
    const anonData = { values: [['Public data']] };

    cache.setETag(anonKey, 'etag-anon', anonData);

    const authResult = await cache.getCachedData(authKey);
    expect(authResult).toBeNull();
  });

  it('invalidating by spreadsheetId without userId sweeps all user caches', async () => {
    const userAKey = makeKey('user-alice');
    const userBKey = makeKey('user-bob');
    const anonKey = makeKey(undefined);

    cache.setETag(userAKey, 'etag-a', { values: [['a']] });
    cache.setETag(userBKey, 'etag-b', { values: [['b']] });
    cache.setETag(anonKey, 'etag-anon', { values: [['c']] });

    await cache.invalidateSpreadsheet(SPREADSHEET_ID);

    expect(await cache.getCachedData(userAKey)).toBeNull();
    expect(await cache.getCachedData(userBKey)).toBeNull();
    expect(await cache.getCachedData(anonKey)).toBeNull();
  });

  it('invalidating by spreadsheetId + userId only sweeps that user cache', async () => {
    const userAKey = makeKey('user-alice');
    const userBKey = makeKey('user-bob');

    cache.setETag(userAKey, 'etag-a', { values: [['a']] });
    cache.setETag(userBKey, 'etag-b', { values: [['b']] });

    await cache.invalidateSpreadsheet(SPREADSHEET_ID, 'user-alice');

    expect(await cache.getCachedData(userAKey)).toBeNull();
    expect(await cache.getCachedData(userBKey)).toEqual({ values: [['b']] });
  });
});
