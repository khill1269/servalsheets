import { describe, expect, it, vi } from 'vitest';

import { wrapGoogleApi, type GoogleApiClient } from '../../src/services/google-api.js';
import { createRequestContext, runWithRequestContext } from '../../src/utils/request-context.js';

function createWrappedSheetsApi(options?: {
  existenceChecker?: (spreadsheetId: string) => Promise<boolean>;
}) {
  const rawApi = {
    spreadsheets: {
      get: vi.fn().mockResolvedValue({ data: { spreadsheetId: 'sheet-1' } }),
      values: {
        get: vi.fn().mockResolvedValue({ data: { values: [['A1']] } }),
        update: vi.fn().mockResolvedValue({ data: { updatedCells: 1 } }),
      },
    },
  };

  const fakeClient = {
    recordCallResult: vi.fn(),
    isSharedDriveFile: vi.fn().mockResolvedValue(false),
  } as unknown as GoogleApiClient;

  const wrappedApi = wrapGoogleApi(rawApi, {
    client: fakeClient,
    existenceChecker: options?.existenceChecker,
  });

  return { rawApi, wrappedApi, fakeClient };
}

describe('Google API request-context accounting', () => {
  it('counts one apiCallsMade entry for a wrapped read call', async () => {
    const { wrappedApi, fakeClient } = createWrappedSheetsApi();
    const requestContext = createRequestContext({ requestId: 'read-count' });

    await runWithRequestContext(requestContext, async () => {
      await wrappedApi.spreadsheets.values.get({
        spreadsheetId: 'sheet-1',
        range: 'Sheet1!A1',
      });
    });

    expect(requestContext.apiCallsMade).toBe(1);
    expect(fakeClient.recordCallResult).toHaveBeenCalledTimes(1);
    expect(fakeClient.recordCallResult).toHaveBeenCalledWith(true);
  });

  it('counts raw existence precheck plus wrapped write for fresh write calls', async () => {
    const existenceChecker = vi.fn().mockResolvedValue(true);
    const { wrappedApi, fakeClient } = createWrappedSheetsApi({ existenceChecker });
    const requestContext = createRequestContext({ requestId: 'write-count-fresh' });

    await runWithRequestContext(requestContext, async () => {
      await wrappedApi.spreadsheets.values.update({
        spreadsheetId: 'sheet-1',
        range: 'Sheet1!A1',
        values: [['updated']],
      });
    });

    expect(existenceChecker).toHaveBeenCalledWith('sheet-1');
    expect(requestContext.apiCallsMade).toBe(2);
    expect(fakeClient.recordCallResult).toHaveBeenCalledTimes(2);
    expect(fakeClient.recordCallResult).toHaveBeenNthCalledWith(1, true);
    expect(fakeClient.recordCallResult).toHaveBeenNthCalledWith(2, true);
  });

  it('does not count cached existence prechecks as API calls', async () => {
    const existenceChecker = vi.fn().mockResolvedValue(false);
    const { wrappedApi, fakeClient } = createWrappedSheetsApi({ existenceChecker });
    const requestContext = createRequestContext({ requestId: 'write-count-cached' });

    await runWithRequestContext(requestContext, async () => {
      await wrappedApi.spreadsheets.values.update({
        spreadsheetId: 'sheet-1',
        range: 'Sheet1!A1',
        values: [['updated']],
      });
    });

    expect(existenceChecker).toHaveBeenCalledWith('sheet-1');
    expect(requestContext.apiCallsMade).toBe(1);
    expect(fakeClient.recordCallResult).toHaveBeenCalledTimes(1);
    expect(fakeClient.recordCallResult).toHaveBeenCalledWith(true);
  });
});
