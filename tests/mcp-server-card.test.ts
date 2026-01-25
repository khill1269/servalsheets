/**
 * Tests for MCP Server Card (SEP-1649)
 */

import { describe, it, expect } from 'vitest';
import { getMcpServerCard } from '../src/server/well-known.js';

describe('MCP Server Card (SEP-1649)', () => {
  describe('getMcpServerCard', () => {
    it('should return valid server card structure', () => {
      const card = getMcpServerCard();

      // Required fields per SEP-1649
      expect(card.mcp_version).toBe('2025-11-25');
      expect(card.server_name).toBe('servalsheets');
      expect(card.server_version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(card.description).toBeTruthy();
    });

    it('should include endpoints configuration', () => {
      const card = getMcpServerCard('https://api.example.com');

      expect(card.endpoints).toBeDefined();
      expect(card.endpoints.streamable_http).toBe('https://api.example.com/mcp');
      expect(card.endpoints.sse).toBe('https://api.example.com/sse');
      expect(card.endpoints.stdio).toBe(true);
    });

    it('should include capabilities summary', () => {
      const card = getMcpServerCard();

      expect(card.capabilities).toBeDefined();
      expect(card.capabilities.tools).toEqual({
        count: expect.any(Number),
        actions: expect.any(Number),
      });
      expect(card.capabilities.tasks).toBe(true);
      expect(card.capabilities.elicitation).toEqual({
        form: true,
        url: true,
      });
    });

    it('should include OAuth2 authentication requirements', () => {
      const card = getMcpServerCard();

      expect(card.authentication).toBeDefined();
      expect(card.authentication?.required).toBe(true);
      expect(card.authentication?.methods).toContain('oauth2');
      expect(card.authentication?.oauth2).toBeDefined();
      expect(card.authentication?.oauth2?.pkce_required).toBe(true);
      expect(card.authentication?.oauth2?.authorization_endpoint).toContain('google.com');
    });

    it('should include security configuration', () => {
      const card = getMcpServerCard();

      expect(card.security).toBeDefined();
      expect(card.security?.tls_required).toBe(true);
      expect(card.security?.min_tls_version).toBe('1.2');
    });

    it('should include discovery metadata', () => {
      const card = getMcpServerCard();

      expect(card.links).toBeDefined();
      expect(card.links?.repository).toContain('github.com');
      expect(card.keywords).toBeInstanceOf(Array);
      expect(card.keywords).toContain('google-sheets');
      expect(card.license).toBe('MIT');
    });

    it('should include publisher information', () => {
      const card = getMcpServerCard();

      expect(card.publisher).toBeDefined();
      expect(card.publisher?.name).toBeTruthy();
    });

    it('should use relative paths without serverUrl', () => {
      const card = getMcpServerCard();

      expect(card.endpoints.streamable_http).toBe('/mcp');
      expect(card.endpoints.sse).toBe('/sse');
    });

    it('should include schema reference', () => {
      const card = getMcpServerCard();

      expect(card.$schema).toBe('https://modelcontextprotocol.io/schemas/mcp-server-card.json');
    });
  });
});
