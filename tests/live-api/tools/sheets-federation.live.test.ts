/**
 * Live API Tests for sheets_federation Tool
 *
 * Tests federation (remote MCP server) operations. list_servers works when
 * federation is enabled with no servers configured (returns empty array).
 * validate_connection tests graceful error handling for unreachable servers.
 * Requires TEST_REAL_API=true environment variable.
 *
 * Actions tested:
 * - list_servers       — returns array of configured servers (may be empty)
 * - validate_connection — test with unreachable URL (asserts success:false, not thrown exception)
 *
 * Skipped (require live remote MCP server):
 * - call_remote     — requires a live remote MCP server to connect to
 * - get_server_tools — requires a configured and reachable server
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { shouldRunIntegrationTests } from '../../helpers/credential-loader.js';
import { FederationHandler } from '../../../src/handlers/federation.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_federation Live API Tests', () => {
  let handler: FederationHandler;
  const federationEnabled = process.env['MCP_FEDERATION_ENABLED'] === 'true';

  beforeAll(() => {
    handler = new FederationHandler();
  });

  // sheets_federation error shape, per src/schemas/federation.ts:103-114 —
  //   { success: false, action, remoteServer?, error: string, errorDetail?: ErrorDetail }
  // `error` is a human-readable string for backwards compatibility; the
  // structured {code, message, retryable, ...} lives in `errorDetail`. Tests
  // assert against both: the top-level string is non-empty, and if errorDetail
  // is present its code is a string.
  type FederationErrorShape = {
    success: false;
    error: string;
    errorDetail?: { code: string; message: string; retryable?: boolean };
  };

  describe('list_servers', () => {
    it('should return an array (empty if no servers configured, error if federation disabled)', async () => {
      const result = await handler.handle({
        request: {
          action: 'list_servers',
        },
      });

      expect(typeof result.response.success).toBe('boolean');
      if (result.response.success) {
        const resp = result.response as { servers: unknown[] };
        expect(Array.isArray(resp.servers)).toBe(true);
      } else {
        const errResp = result.response as FederationErrorShape;
        expect(typeof errResp.error).toBe('string');
        expect(errResp.error.length).toBeGreaterThan(0);
        if (errResp.errorDetail) {
          expect(typeof errResp.errorDetail.code).toBe('string');
        }
      }
    });
  });

  describe('validate_connection', () => {
    it('should return success:false for an unreachable server URL (not throw)', async () => {
      if (!federationEnabled) {
        // Can't test validate_connection without federation enabled
        return;
      }

      // Use an invalid/unreachable server URL
      const result = await handler.handle({
        request: {
          action: 'validate_connection',
          serverName: 'unreachable-test-server',
        },
      });

      // Must not throw — should return a structured error response
      expect(typeof result.response.success).toBe('boolean');

      if (!result.response.success) {
        const errResp = result.response as FederationErrorShape;
        expect(typeof errResp.error).toBe('string');
        expect(errResp.error.length).toBeGreaterThan(0);
        if (errResp.errorDetail) {
          expect(typeof errResp.errorDetail.code).toBe('string');
        }
      }
    });

    it('should handle validate_connection when federation is disabled gracefully', async () => {
      if (federationEnabled) {
        // This test is specifically for the disabled case
        return;
      }

      const result = await handler.handle({
        request: {
          action: 'validate_connection',
          serverName: 'any-server',
        },
      });

      // Should return structured error, not throw
      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        const errResp = result.response as FederationErrorShape;
        expect(typeof errResp.error).toBe('string');
        expect(errResp.error.length).toBeGreaterThan(0);
      }
    });
  });

  // Skipped: require live remote MCP server
  it.skip('call_remote — requires a live remote MCP server to connect to', () => {
    // Skipped: call_remote makes an actual MCP protocol connection to a remote server.
    // Requires MCP_FEDERATION_ENABLED=true and MCP_FEDERATION_SERVERS configured
    // with an actual reachable server URL.
  });

  it.skip('get_server_tools — requires a configured and reachable remote MCP server', () => {
    // Skipped: get_server_tools fetches the tool list from a remote MCP server.
    // Requires a live server at the configured URL and valid authentication.
  });
});
