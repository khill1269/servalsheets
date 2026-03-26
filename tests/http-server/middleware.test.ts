import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const middlewareMocks = vi.hoisted(() => ({
  responseRedactionMiddleware: vi.fn(),
  getRequestRecorder: vi.fn(),
  getEnv: vi.fn(),
  extractVersionFromRequest: vi.fn(),
  addDeprecationHeaders: vi.fn(),
  extractTrustedClientIp: vi.fn(),
  createHttpProtocolVersionMiddleware: vi.fn(),
  createHostValidationMiddleware: vi.fn(),
  createHttpsEnforcementMiddleware: vi.fn(),
  createOriginValidationMiddleware: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
  },
}));

vi.mock('../../src/middleware/redaction.js', () => ({
  responseRedactionMiddleware: middlewareMocks.responseRedactionMiddleware,
}));

vi.mock('../../src/services/request-recorder.js', () => ({
  getRequestRecorder: middlewareMocks.getRequestRecorder,
}));

vi.mock('../../src/config/env.js', () => ({
  getEnv: middlewareMocks.getEnv,
}));

vi.mock('../../src/versioning/schema-manager.js', () => ({
  extractVersionFromRequest: middlewareMocks.extractVersionFromRequest,
  addDeprecationHeaders: middlewareMocks.addDeprecationHeaders,
}));

vi.mock('../../src/http-server/client-ip.js', () => ({
  extractTrustedClientIp: middlewareMocks.extractTrustedClientIp,
}));

vi.mock('../../src/http-server/protocol-version-middleware.js', () => ({
  createHttpProtocolVersionMiddleware: middlewareMocks.createHttpProtocolVersionMiddleware,
}));

vi.mock('../../src/http-server/request-validation-middleware.js', () => ({
  createHostValidationMiddleware: middlewareMocks.createHostValidationMiddleware,
  createHttpsEnforcementMiddleware: middlewareMocks.createHttpsEnforcementMiddleware,
  createOriginValidationMiddleware: middlewareMocks.createOriginValidationMiddleware,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: middlewareMocks.logger,
}));

import { registerHttpFoundationMiddleware } from '../../src/http-server/middleware.js';

describe('http foundation middleware', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  const originalAllowedHosts = process.env['SERVAL_ALLOWED_HOSTS'];

  beforeEach(() => {
    middlewareMocks.responseRedactionMiddleware.mockReset();
    middlewareMocks.getRequestRecorder.mockReset();
    middlewareMocks.getEnv.mockReset();
    middlewareMocks.extractVersionFromRequest.mockReset();
    middlewareMocks.addDeprecationHeaders.mockReset();
    middlewareMocks.extractTrustedClientIp.mockReset();
    middlewareMocks.createHttpProtocolVersionMiddleware.mockReset();
    middlewareMocks.createHostValidationMiddleware.mockReset();
    middlewareMocks.createHttpsEnforcementMiddleware.mockReset();
    middlewareMocks.createOriginValidationMiddleware.mockReset();
    middlewareMocks.logger.info.mockReset();
    middlewareMocks.logger.warn.mockReset();
    middlewareMocks.logger.error.mockReset();
    middlewareMocks.logger.debug.mockReset();
    middlewareMocks.logger.log.mockReset();

    middlewareMocks.responseRedactionMiddleware.mockReturnValue(vi.fn());
    middlewareMocks.getRequestRecorder.mockReturnValue({ record: vi.fn() });
    middlewareMocks.getEnv.mockReturnValue({
      OAUTH_ISSUER: 'https://issuer.example',
      STRICT_MCP_PROTOCOL_VERSION: true,
    });
    middlewareMocks.extractVersionFromRequest.mockReturnValue({
      selectedVersion: 'v2',
      isDeprecated: false,
    });
    middlewareMocks.extractTrustedClientIp.mockReturnValue('127.0.0.1');
    middlewareMocks.createHttpProtocolVersionMiddleware.mockReturnValue(vi.fn());
    middlewareMocks.createHostValidationMiddleware.mockReturnValue(vi.fn());
    middlewareMocks.createHttpsEnforcementMiddleware.mockReturnValue(vi.fn());
    middlewareMocks.createOriginValidationMiddleware.mockReturnValue(vi.fn());

    process.env['NODE_ENV'] = 'production';
    process.env['SERVAL_ALLOWED_HOSTS'] = 'api.example.com, connect.example.com ';
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv;
    process.env['SERVAL_ALLOWED_HOSTS'] = originalAllowedHosts;
    vi.restoreAllMocks();
  });

  it('wires validation and protocol middleware with env-backed settings', () => {
    const app = {
      use: vi.fn(),
      set: vi.fn(),
    };

    registerHttpFoundationMiddleware({
      app: app as never,
      corsOrigins: ['https://client.example'],
      trustProxy: true,
      rateLimitWindowMs: 60_000,
      rateLimitMax: 100,
    });

    expect(app.set).toHaveBeenCalledWith('trust proxy', 1);
    expect(middlewareMocks.createHttpsEnforcementMiddleware).toHaveBeenCalledWith({
      enabled: true,
      log: middlewareMocks.logger,
    });
    expect(middlewareMocks.createOriginValidationMiddleware).toHaveBeenCalledWith({
      corsOrigins: ['https://client.example'],
      log: middlewareMocks.logger,
    });
    expect(middlewareMocks.createHostValidationMiddleware).toHaveBeenCalledWith({
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '::1',
        'issuer.example',
        'api.example.com',
        'connect.example.com',
      ],
      log: middlewareMocks.logger,
    });
    expect(middlewareMocks.createHttpProtocolVersionMiddleware).toHaveBeenCalledWith({
      strictProtocolVersion: true,
      log: middlewareMocks.logger,
    });
  });

  it('records request/response pairs and stamps schema version metadata', () => {
    const recorder = { record: vi.fn() };
    const app = {
      use: vi.fn(),
      set: vi.fn(),
    };

    middlewareMocks.getRequestRecorder.mockReturnValue(recorder);
    middlewareMocks.extractVersionFromRequest.mockReturnValue({
      selectedVersion: 'v2',
      isDeprecated: true,
      deprecationWarning: 'deprecated',
    });

    registerHttpFoundationMiddleware({
      app: app as never,
      corsOrigins: ['https://client.example'],
      trustProxy: false,
      rateLimitWindowMs: 60_000,
      rateLimitMax: 100,
    });

    const versioningMiddleware = app.use.mock.calls[3]?.[0];
    const recordingMiddleware = app.use.mock.calls[4]?.[0];

    const req = {
      query: { version: 'v2' },
      headers: {},
      body: {
        tool: 'sheets_data',
        action: 'read',
        spreadsheetId: 'sheet-123',
      },
    };
    const res = {
      statusCode: 201,
      setHeader: vi.fn(),
      json: vi.fn((data) => data),
    };
    const next = vi.fn();

    versioningMiddleware(req, res, next);
    expect(middlewareMocks.addDeprecationHeaders).toHaveBeenCalledWith(res, {
      selectedVersion: 'v2',
      isDeprecated: true,
      deprecationWarning: 'deprecated',
    });
    expect(req.schemaVersion).toBe('v2');
    expect(next).toHaveBeenCalledOnce();

    next.mockReset();
    vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(1_025);

    recordingMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();

    res.json({ ok: true });

    expect(recorder.record).toHaveBeenCalledWith({
      timestamp: 1_000,
      tool_name: 'sheets_data',
      action: 'read',
      spreadsheet_id: 'sheet-123',
      request_body: JSON.stringify(req.body),
      response_body: JSON.stringify({ ok: true }),
      status_code: 201,
      duration_ms: 25,
      error_message: null,
    });
  });
});
