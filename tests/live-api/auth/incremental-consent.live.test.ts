/**
 * OAuth Incremental Consent Integration Tests
 *
 * Tests the incremental authorization flow where users grant minimal scopes
 * initially, then grant additional scopes as needed for specific operations.
 *
 * @see https://developers.google.com/identity/protocols/oauth2/web-server#incrementalAuth
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createGoogleApiClient } from '../../../src/services/google-api.js';
import { TemplatesHandler } from '../../../src/handlers/templates.js';
import { CollaborateHandler } from '../../../src/handlers/collaborate.js';
import type { HandlerContext } from '../../../src/handlers/base.js';
import { IncrementalScopeRequiredError } from '../../../src/security/incremental-scope.js';
import {
  DEFAULT_SCOPES,
  ELEVATED_SCOPES as FULL_SCOPES,
} from '../../../src/services/google-api.js';
import { shouldRunIntegrationTests } from '../../helpers/credential-loader.js';

// Skip all tests if not running against real API
const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('OAuth Incremental Consent', () => {
  const testSpreadsheetId = process.env['TEST_SPREADSHEET_ID'];

  beforeAll(() => {
    if (!testSpreadsheetId) {
      throw new Error('TEST_SPREADSHEET_ID environment variable is required');
    }
  });

  it('should use minimal scopes by default', () => {
    const googleApi = createGoogleApiClient({
      credentials: {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        scope: DEFAULT_SCOPES.join(' '),
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000,
      },
    });

    // Verify default scopes are minimal
    expect(DEFAULT_SCOPES).toEqual([
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ]);

    // Verify FULL_SCOPES include additional Drive scopes
    expect(FULL_SCOPES).toContain('https://www.googleapis.com/auth/drive');
    expect(FULL_SCOPES).toContain('https://www.googleapis.com/auth/drive.appdata');
  });

  it('should throw IncrementalScopeRequiredError when templates require drive.appdata', async () => {
    const googleApi = createGoogleApiClient({
      credentials: {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        scope: DEFAULT_SCOPES.join(' '), // Only minimal scopes
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000,
      },
    });

    const context: HandlerContext = {
      logger: console,
      metrics: undefined,
      snapshotService: undefined,
      taskStore: undefined,
      sessionContext: undefined,
      batchingSystem: undefined,
      featureFlags: {},
      auth: {
        scopes: DEFAULT_SCOPES,
      },
    };

    const handler = new TemplatesHandler(context);

    // Attempt to create a template without drive.appdata scope
    const result = await handler.execute({
      tool: 'sheets_templates',
      request: {
        action: 'create',
        spreadsheetId: testSpreadsheetId,
        name: 'Test Template',
        description: 'Test incremental consent',
      },
    });

    // Should return error response with INCREMENTAL_SCOPE_REQUIRED
    expect(result.response.success).toBe(false);
    if (!result.response.success) {
      expect(result.response.error?.code).toBe('INCREMENTAL_SCOPE_REQUIRED');
      expect(result.response.error?.message).toContain('additional permissions');
      expect(result.response.error?.details).toHaveProperty('authorizationUrl');
      expect(result.response.error?.details).toHaveProperty('missingScopes');
      expect(result.response.error?.details?.missingScopes).toContain(
        'https://www.googleapis.com/auth/drive.appdata'
      );
    }
  });

  it('should succeed when all required scopes are granted', async () => {
    const googleApi = createGoogleApiClient({
      credentials: {
        access_token: process.env['GOOGLE_ACCESS_TOKEN'] ?? 'test-token',
        refresh_token: process.env['GOOGLE_REFRESH_TOKEN'] ?? 'test-refresh',
        scope: FULL_SCOPES.join(' '), // All scopes granted
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000,
      },
    });

    const context: HandlerContext = {
      logger: console,
      metrics: undefined,
      snapshotService: undefined,
      taskStore: undefined,
      sessionContext: undefined,
      batchingSystem: undefined,
      featureFlags: {},
      auth: {
        scopes: FULL_SCOPES,
      },
    };

    const handler = new TemplatesHandler(context);

    // Should succeed with full scopes
    const result = await handler.execute({
      tool: 'sheets_templates',
      request: {
        action: 'list',
      },
    });

    // Should return success (list templates may return empty array)
    expect(result.response.success).toBe(true);
  });

  it('should throw IncrementalScopeRequiredError when comments require drive scope', async () => {
    const googleApi = createGoogleApiClient({
      credentials: {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        scope: DEFAULT_SCOPES.join(' '), // Only minimal scopes
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000,
      },
    });

    const context: HandlerContext = {
      logger: console,
      metrics: undefined,
      snapshotService: undefined,
      taskStore: undefined,
      sessionContext: undefined,
      batchingSystem: undefined,
      featureFlags: {},
      auth: {
        scopes: DEFAULT_SCOPES,
      },
    };

    const handler = new CollaborateHandler(context);

    // Attempt to add comment without drive scope
    const result = await handler.execute({
      tool: 'sheets_collaborate',
      request: {
        action: 'comment_add',
        spreadsheetId: testSpreadsheetId,
        range: 'A1',
        comment: 'Test comment',
      },
    });

    // Should return error response with INCREMENTAL_SCOPE_REQUIRED
    expect(result.response.success).toBe(false);
    if (!result.response.success) {
      expect(result.response.error?.code).toBe('INCREMENTAL_SCOPE_REQUIRED');
      expect(result.response.error?.details?.missingScopes).toContain(
        'https://www.googleapis.com/auth/drive'
      );
    }
  });

  it('should include authorization URL with include_granted_scopes=true', async () => {
    const googleApi = createGoogleApiClient({
      credentials: {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        scope: DEFAULT_SCOPES.join(' '),
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000,
      },
    });

    const context: HandlerContext = {
      logger: console,
      metrics: undefined,
      snapshotService: undefined,
      taskStore: undefined,
      sessionContext: undefined,
      batchingSystem: undefined,
      featureFlags: {},
      auth: {
        scopes: DEFAULT_SCOPES,
      },
    };

    const handler = new TemplatesHandler(context);

    const result = await handler.execute({
      tool: 'sheets_templates',
      request: {
        action: 'create',
        spreadsheetId: testSpreadsheetId,
        name: 'Test Template',
        description: 'Test incremental consent',
      },
    });

    // Should return error with authorization URL
    expect(result.response.success).toBe(false);
    if (!result.response.success) {
      const authUrl = result.response.error?.details?.authorizationUrl as string;
      expect(authUrl).toBeDefined();
      expect(authUrl).toContain('include_granted_scopes=true');
      expect(authUrl).toContain('scope=');
    }
  });
});
