import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectorsHandler } from '../../src/handlers/connectors.js';
import { connectorManager } from '../../src/connectors/connector-manager.js';

const baseResult = {
  headers: ['symbol', 'price'],
  rows: [['AAPL', 190.23]],
  metadata: {
    source: 'finnhub',
    endpoint: 'stock/quote',
    fetchedAt: '2026-01-01T00:00:00.000Z',
    rowCount: 1,
    cached: false,
    quotaUsed: 1,
  },
};

describe('ConnectorsHandler', () => {
  let handler: ConnectorsHandler;

  beforeEach(() => {
    vi.restoreAllMocks();
    handler = new ConnectorsHandler();
  });

  it('routes list_connectors', async () => {
    const spy = vi.spyOn(connectorManager, 'listConnectors').mockReturnValue({
      connectors: [{ id: 'finnhub', name: 'Finnhub', description: 'Market data', authType: 'api_key', configured: false }],
    });

    const result = await handler.handle({ request: { action: 'list_connectors' } });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.response.success).toBe(true);
    expect(result.response.action).toBe('list_connectors');
    expect(result.response.connectors).toHaveLength(1);
  });

  it('routes configure, query, and batch_query', async () => {
    const configureSpy = vi
      .spyOn(connectorManager, 'configure')
      .mockResolvedValue({ success: true, message: 'configured' });
    const querySpy = vi.spyOn(connectorManager, 'query').mockResolvedValue(baseResult);
    const batchSpy = vi
      .spyOn(connectorManager, 'batchQuery')
      .mockResolvedValue({ results: [baseResult] });

    const configureResult = await handler.handle({
      request: {
        action: 'configure',
        connectorId: 'finnhub',
        credentials: { type: 'api_key', apiKey: 'test-key' },
      },
    });
    const queryResult = await handler.handle({
      request: {
        action: 'query',
        connectorId: 'finnhub',
        endpoint: 'stock/quote',
        params: { symbol: 'AAPL' },
        useCache: false,
      },
    });
    const batchResult = await handler.handle({
      request: {
        action: 'batch_query',
        queries: [
          {
            connectorId: 'finnhub',
            endpoint: 'stock/quote',
            params: { symbol: 'AAPL' },
          },
        ],
      },
    });

    expect(configureSpy).toHaveBeenCalledWith('finnhub', { type: 'api_key', apiKey: 'test-key' });
    expect(querySpy).toHaveBeenCalledWith(
      'finnhub',
      'stock/quote',
      { symbol: 'AAPL' },
      undefined,
      false
    );
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(configureResult.response.action).toBe('configure');
    expect(queryResult.response.action).toBe('query');
    expect(batchResult.response.action).toBe('batch_query');
  });

  it('routes subscribe, unsubscribe, and list_subscriptions', async () => {
    const subscribeSpy = vi.spyOn(connectorManager, 'subscribe').mockReturnValue({
      id: 'sub_1',
      connectorId: 'finnhub',
      endpoint: 'stock/quote',
      params: { symbol: 'AAPL' },
      schedule: { interval: 'hourly' },
      destination: { spreadsheetId: 'spreadsheet-id', range: 'Sheet1!A1' },
      status: 'active',
      nextRefresh: '2026-01-01T01:00:00.000Z',
    });
    const unsubscribeSpy = vi.spyOn(connectorManager, 'unsubscribe').mockReturnValue(true);
    const listSpy = vi.spyOn(connectorManager, 'listSubscriptions').mockReturnValue([
      {
        id: 'sub_1',
        connectorId: 'finnhub',
        endpoint: 'stock/quote',
        params: { symbol: 'AAPL' },
        schedule: { interval: 'hourly' },
        destination: { spreadsheetId: 'spreadsheet-id', range: 'Sheet1!A1' },
        status: 'active',
      },
    ]);

    const subscribeResult = await handler.handle({
      request: {
        action: 'subscribe',
        connectorId: 'finnhub',
        endpoint: 'stock/quote',
        params: { symbol: 'AAPL' },
        schedule: { interval: 'hourly' },
        destination: { spreadsheetId: 'spreadsheet-id', range: 'Sheet1!A1' },
      },
    });
    const unsubscribeResult = await handler.handle({
      request: { action: 'unsubscribe', subscriptionId: 'sub_1' },
    });
    const listResult = await handler.handle({
      request: { action: 'list_subscriptions' },
    });

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith('sub_1');
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(subscribeResult.response.action).toBe('subscribe');
    expect(unsubscribeResult.response.action).toBe('unsubscribe');
    expect(listResult.response.action).toBe('list_subscriptions');
  });

  it('routes transform, status, and discover', async () => {
    const querySpy = vi.spyOn(connectorManager, 'query').mockResolvedValue(baseResult);
    const statusSpy = vi.spyOn(connectorManager, 'status').mockResolvedValue({
      id: 'finnhub',
      name: 'Finnhub',
      configured: true,
      health: null,
      quota: { used: 1, limit: 60 },
    });
    const discoverSpy = vi
      .spyOn(connectorManager, 'discover')
      .mockResolvedValue({ endpoints: [{ id: 'stock/quote', name: 'Stock Quote', description: 'Quote endpoint', category: 'stocks', params: [] }] });
    const schemaSpy = vi.spyOn(connectorManager, 'getEndpointSchema').mockResolvedValue({
      endpoint: 'stock/quote',
      columns: [{ name: 'symbol', type: 'string' }],
    });

    const transformResult = await handler.handle({
      request: {
        action: 'transform',
        connectorId: 'finnhub',
        endpoint: 'stock/quote',
        params: { symbol: 'AAPL' },
        transform: { limit: 1 },
      },
    });
    const statusResult = await handler.handle({
      request: { action: 'status', connectorId: 'finnhub' },
    });
    const discoverResult = await handler.handle({
      request: { action: 'discover', connectorId: 'finnhub' },
    });
    const discoverSchemaResult = await handler.handle({
      request: { action: 'discover', connectorId: 'finnhub', endpoint: 'stock/quote' },
    });

    expect(querySpy).toHaveBeenCalledWith('finnhub', 'stock/quote', { symbol: 'AAPL' }, { limit: 1 }, true);
    expect(statusSpy).toHaveBeenCalledWith('finnhub');
    expect(discoverSpy).toHaveBeenCalledTimes(2);
    expect(discoverSpy).toHaveBeenNthCalledWith(1, 'finnhub');
    expect(discoverSpy).toHaveBeenNthCalledWith(2, 'finnhub');
    expect(schemaSpy).toHaveBeenCalledWith('finnhub', 'stock/quote');
    expect(transformResult.response.action).toBe('transform');
    expect(statusResult.response.action).toBe('status');
    expect(discoverResult.response.action).toBe('discover');
    expect(discoverSchemaResult.response.action).toBe('discover');
  });

  it('rejects discover schema requests for unknown endpoints', async () => {
    vi.spyOn(connectorManager, 'discover').mockResolvedValue({
      endpoints: [
        {
          id: 'stock/quote',
          name: 'Stock Quote',
          description: 'Quote endpoint',
          category: 'stocks',
          params: [],
        },
      ],
    });
    const schemaSpy = vi.spyOn(connectorManager, 'getEndpointSchema');

    const result = await handler.handle({
      request: { action: 'discover', connectorId: 'finnhub', endpoint: 'unknown/endpoint' },
    });

    expect(result.response.success).toBe(false);
    expect(result.response.action).toBe('discover');
    if (!result.response.success) {
      expect(result.response.error.code).toBe('INVALID_PARAMS');
      expect(result.response.error.message).toContain('Unknown endpoint');
    }
    expect(schemaSpy).not.toHaveBeenCalled();
  });
});
