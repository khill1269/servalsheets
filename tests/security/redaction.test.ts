/**
 * Redaction Middleware Tests
 *
 * Verifies that sensitive data is properly stripped from responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { redactSensitiveData, responseRedactionMiddleware } from '../../src/middleware/redaction.js';

describe('Response Redaction', () => {
  describe('redactSensitiveData', () => {
    it('should redact Bearer tokens', () => {
      const input = '{"error": "Bearer ya29.a0AXooCgtqR3mPq1234567890abcdefghijklmnopq failed"}';
      const { output, redactionCount } = redactSensitiveData(input);
      expect(output).not.toContain('ya29.');
      expect(output).toContain('Bearer [REDACTED]');
      expect(redactionCount).toBeGreaterThan(0);
    });

    it('should redact Google API keys (AIza prefix)', () => {
      const input = '{"key": "AIzaSyB1234567890abcdefghijklmnopqrstuvwx"}';
      const { output, redactionCount } = redactSensitiveData(input);
      expect(output).not.toContain('AIzaSy');
      expect(output).toContain('[GOOGLE_API_KEY_REDACTED]');
      expect(redactionCount).toBe(1);
    });

    it('should redact Google access tokens (ya29. prefix)', () => {
      const input =
        'Token ya29.a0AXooCgtqR3mPq1234567890abcdefghijklmnopqrstuvwxyz1234567890 expired';
      const { output, redactionCount } = redactSensitiveData(input);
      expect(output).not.toContain('ya29.');
      expect(output).toContain('[GOOGLE_ACCESS_TOKEN_REDACTED]');
      expect(redactionCount).toBeGreaterThan(0);
    });

    it('should redact Google refresh tokens (1// prefix)', () => {
      const input = '{"refresh_token": "1//0gXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"}';
      const { output, redactionCount } = redactSensitiveData(input);
      expect(output).not.toContain('1//0g');
      expect(output).toContain('[GOOGLE_REFRESH_TOKEN_REDACTED]');
      expect(redactionCount).toBeGreaterThan(0);
    });

    it('should not redact normal text', () => {
      const input = '{"success": true, "message": "Operation completed", "data": {"count": 42}}';
      const { output, redactionCount } = redactSensitiveData(input);
      expect(output).toBe(input);
      expect(redactionCount).toBe(0);
    });

    it('should handle multiple sensitive values in one string', () => {
      const input =
        'Bearer ya29.abc123defghijklmnopqrstuvwxyz1234567890abcdef and key AIzaSyB1234567890abcdefghijklmnopqrstuvwx';
      const { output, redactionCount } = redactSensitiveData(input);
      expect(output).not.toContain('ya29.');
      expect(output).not.toContain('AIzaSy');
      expect(redactionCount).toBeGreaterThan(1);
    });

    it('should handle empty strings', () => {
      const { output, redactionCount } = redactSensitiveData('');
      expect(output).toBe('');
      expect(redactionCount).toBe(0);
    });
  });

  describe('responseRedactionMiddleware fail-closed behavior', () => {
    let origEnv: string | undefined;

    beforeEach(() => {
      origEnv = process.env['ENABLE_RESPONSE_REDACTION'];
      process.env['ENABLE_RESPONSE_REDACTION'] = 'true';
    });

    afterEach(() => {
      if (origEnv === undefined) {
        delete process.env['ENABLE_RESPONSE_REDACTION'];
      } else {
        process.env['ENABLE_RESPONSE_REDACTION'] = origEnv;
      }
    });

    function createMockRes() {
      const sentData: { status?: number; body?: unknown } = {};
      const res: Record<string, any> = {};
      res.json = function (body: unknown) {
        sentData.body = body;
        return res;
      };
      res.status = function (code: number) {
        sentData.status = code;
        return res;
      };
      return { res, sentData };
    }

    it('should return 500 on circular reference instead of leaking data', () => {
      const middleware = responseRedactionMiddleware();
      const { res, sentData } = createMockRes();
      const req = { path: '/test', method: 'GET' } as any;
      const next = vi.fn();

      middleware(req, res as any, next);
      expect(next).toHaveBeenCalled();

      const circular: Record<string, unknown> = { secret: 'ya29.a0AXooCgtqR3mPq1234567890abcdefghijklmnopqrstuvwxyz1234567890' };
      circular.self = circular;

      res.json(circular);

      expect(sentData.status).toBe(500);
      expect(sentData.body).toEqual({ error: 'Internal Server Error' });
    });

    it('should return 500 on BigInt serialization instead of leaking data', () => {
      const middleware = responseRedactionMiddleware();
      const { res, sentData } = createMockRes();
      const req = { path: '/test', method: 'GET' } as any;
      const next = vi.fn();

      middleware(req, res as any, next);
      expect(next).toHaveBeenCalled();

      const body = { token: 'ya29.a0AXooCgtqR3mPq1234567890abcdefghijklmnopqrstuvwxyz1234567890', value: BigInt(9007199254740991) };

      res.json(body);

      expect(sentData.status).toBe(500);
      expect(sentData.body).toEqual({ error: 'Internal Server Error' });
    });
  });
});
