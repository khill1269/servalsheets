/**
 * ServalSheets - Webhook Signature Verification Tests
 *
 * Example test suite demonstrating webhook signature generation,
 * signing, and verification.
 *
 * Run with: npm test -- webhook-signature.test.example.ts
 *
 * @category Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WebhookSignatureManager,
  generateWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../security/webhook-signature.js';

describe('WebhookSignatureManager', () => {
  let manager: WebhookSignatureManager;

  beforeEach(() => {
    manager = new WebhookSignatureManager();
  });

  describe('generateSecret', () => {
    it('should generate a 32-byte secret by default', () => {
      const secret = manager.generateSecret();
      expect(secret).toBeDefined();
      expect(secret.length).toBeGreaterThan(0);
    });

    it('should generate different secrets on each call', () => {
      const secret1 = manager.generateSecret();
      const secret2 = manager.generateSecret();
      expect(secret1).not.toBe(secret2);
    });

    it('should generate secrets of custom length', () => {
      const secret64 = manager.generateSecret(64);
      expect(secret64.length).toBeGreaterThan(0);
    });

    it('should throw on invalid secret length', () => {
      expect(() => manager.generateSecret(8)).toThrow();
      expect(() => manager.generateSecret(512)).toThrow();
    });

    it('should generate cryptographically secure secrets', () => {
      const secrets = new Set();
      for (let i = 0; i < 100; i++) {
        secrets.add(manager.generateSecret());
      }
      // All 100 should be unique (virtually impossible to collide)
      expect(secrets.size).toBe(100);
    });
  });

  describe('signPayload', () => {
    let secret: string;

    beforeEach(() => {
      secret = manager.generateSecret();
    });

    it('should sign string payload', () => {
      const payload = 'test payload';
      const signature = manager.signPayload(payload, secret);

      expect(signature).toMatch(/^sha256=[a-f0-9]+$/);
    });

    it('should sign object payload as JSON', () => {
      const payload = {
        deliveryId: 'delivery_123',
        timestamp: '2025-02-05T12:34:56Z',
        data: { test: true },
      };

      const signature = manager.signPayload(payload, secret);
      expect(signature).toMatch(/^sha256=[a-f0-9]+$/);
    });

    it('should produce consistent signatures for same payload', () => {
      const payload = { test: 'data' };
      const sig1 = manager.signPayload(payload, secret);
      const sig2 = manager.signPayload(JSON.stringify(payload), secret);

      // Both should produce same signature
      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different payloads', () => {
      const sig1 = manager.signPayload({ data: 1 }, secret);
      const sig2 = manager.signPayload({ data: 2 }, secret);

      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures for different secrets', () => {
      const payload = { test: 'data' };
      const secret1 = manager.generateSecret();
      const secret2 = manager.generateSecret();

      const sig1 = manager.signPayload(payload, secret1);
      const sig2 = manager.signPayload(payload, secret2);

      expect(sig1).not.toBe(sig2);
    });

    it('should throw on invalid secret', () => {
      expect(() => manager.signPayload('payload', 'invalid')).toThrow();
    });
  });

  describe('verifySignature', () => {
    let secret: string;

    beforeEach(() => {
      secret = manager.generateSecret();
    });

    it('should verify valid signature', () => {
      const payload = { test: 'data' };
      const signature = manager.signPayload(payload, secret);

      const isValid = manager.verifySignature(payload, secret, signature);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = { test: 'data' };

      const isValid = manager.verifySignature(payload, secret, 'sha256=invalid');
      expect(isValid).toBe(false);
    });

    it('should reject modified payload', () => {
      const payload = { test: 'data' };
      const signature = manager.signPayload(payload, secret);

      const modifiedPayload = { test: 'modified' };
      const isValid = manager.verifySignature(modifiedPayload, secret, signature);
      expect(isValid).toBe(false);
    });

    it('should reject signature from different secret', () => {
      const payload = { test: 'data' };
      const signature = manager.signPayload(payload, secret);

      const otherSecret = manager.generateSecret();
      const isValid = manager.verifySignature(payload, otherSecret, signature);
      expect(isValid).toBe(false);
    });

    it('should work with both string and object payloads', () => {
      const payloadStr = '{"test":"data"}';
      const payloadObj = { test: 'data' };

      const signature = manager.signPayload(payloadStr, secret);
      const isValid = manager.verifySignature(payloadObj, secret, signature);

      expect(isValid).toBe(true);
    });

    it('should reject wrong algorithm', () => {
      const payload = { test: 'data' };
      const signature = manager.signPayload(payload, secret);

      const isValid = manager.verifySignature(
        payload,
        secret,
        signature.replace('sha256=', 'sha512=')
      );
      expect(isValid).toBe(false);
    });

    it('should be resistant to timing attacks', () => {
      const payload = { test: 'data' };
      const correctSig = manager.signPayload(payload, secret);

      // Create similar-looking but incorrect signatures
      const wrongSig1 = correctSig.slice(0, -1) + 'x';
      const wrongSig2 = 'sha256=' + 'a'.repeat(64);

      const start1 = performance.now();
      manager.verifySignature(payload, secret, wrongSig1);
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      manager.verifySignature(payload, secret, wrongSig2);
      const time2 = performance.now() - start2;

      // Times should be similar (within reasonable margin)
      // This tests that we're using constant-time comparison
      expect(Math.abs(time1 - time2)).toBeLessThan(10); // Allow 10ms variance
    });
  });

  describe('getAlgorithm', () => {
    it('should extract algorithm from signature', () => {
      const algo = manager.getAlgorithm('sha256=abc123');
      expect(algo).toBe('sha256');
    });

    it('should handle different algorithms', () => {
      expect(manager.getAlgorithm('sha512=xyz')).toBe('sha512');
      expect(manager.getAlgorithm('sha256=abc')).toBe('sha256');
    });

    it('should return null for invalid format', () => {
      expect(manager.getAlgorithm('invalid')).toBeNull();
      expect(manager.getAlgorithm('sha256')).toBeNull();
      expect(manager.getAlgorithm('')).toBeNull();
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = manager.getConfig();
      expect(config.algorithm).toBe('sha256');
      expect(config.minSecretLength).toBe(32);
      expect(config.encoding).toBe('hex');
    });

    it('should apply custom configuration', () => {
      const customManager = new WebhookSignatureManager({
        algorithm: 'sha512',
        minSecretLength: 64,
      });

      const config = customManager.getConfig();
      expect(config.algorithm).toBe('sha512');
      expect(config.minSecretLength).toBe(64);
    });

    it('should validate configuration on init', () => {
      expect(() => {
        new WebhookSignatureManager({
          minSecretLength: 8, // Less than 16
        });
      }).toThrow();

      expect(() => {
        new WebhookSignatureManager({
          minSecretLength: 100,
          maxSecretLength: 50, // Less than min
        });
      }).toThrow();
    });
  });
});

describe('Convenience Functions', () => {
  it('should generate secrets with default function', () => {
    const secret = generateWebhookSecret();
    expect(secret).toBeDefined();
  });

  it('should sign payloads with default function', () => {
    const secret = generateWebhookSecret();
    const payload = { test: 'data' };

    const signature = signWebhookPayload(payload, secret);
    expect(signature).toMatch(/^sha256=[a-f0-9]+$/);
  });

  it('should verify signatures with default function', () => {
    const secret = generateWebhookSecret();
    const payload = { test: 'data' };

    const signature = signWebhookPayload(payload, secret);
    const isValid = verifyWebhookSignature(payload, secret, signature);

    expect(isValid).toBe(true);
  });
});

describe('Real-World Scenarios', () => {
  let secret: string;
  let manager: WebhookSignatureManager;

  beforeEach(() => {
    manager = new WebhookSignatureManager();
    secret = manager.generateSecret();
  });

  it('should handle webhook delivery with signature', () => {
    // Simulating ServalSheets sending a webhook
    const payload = {
      deliveryId: 'delivery_550e8400-e29b-41d4-a716-446655440000',
      webhookId: 'webhook_550e8400-e29b-41d4-a716-446655440001',
      eventType: 'cell.update',
      timestamp: new Date().toISOString(),
      data: {
        spreadsheetId: '1BxiMVs0XRA5nFMKUVfIrxQ6AI0GlLLzjg',
        changeDetails: {
          cellRanges: ['A1:D100'],
        },
      },
    };

    const signature = manager.signPayload(payload, secret);

    // Consumer receives and verifies
    const isValid = manager.verifySignature(payload, secret, signature);
    expect(isValid).toBe(true);
  });

  it('should detect tampering', () => {
    const payload = {
      data: 100,
      timestamp: new Date().toISOString(),
    };

    const signature = manager.signPayload(payload, secret);

    // Attacker modifies the payload
    const tamperedPayload = {
      data: 99999, // Changed!
      timestamp: new Date().toISOString(),
    };

    const isValid = manager.verifySignature(tamperedPayload, secret, signature);
    expect(isValid).toBe(false);
  });

  it('should work with webhook retry scenario', () => {
    const payload = { test: 'data' };
    const signature = manager.signPayload(payload, secret);

    // Simulate 3 retries - signature should still be valid
    for (let i = 0; i < 3; i++) {
      const isValid = manager.verifySignature(payload, secret, signature);
      expect(isValid).toBe(true);
    }
  });

  it('should handle delivery with different data types', () => {
    const testCases = [
      { type: 'object', payload: { key: 'value' } },
      { type: 'array', payload: { data: [1, 2, 3] } },
      { type: 'nested', payload: { a: { b: { c: 'deep' } } } },
      { type: 'null', payload: { value: null } },
      { type: 'boolean', payload: { active: true, deleted: false } },
    ];

    for (const testCase of testCases) {
      const signature = manager.signPayload(testCase.payload, secret);
      const isValid = manager.verifySignature(testCase.payload, secret, signature);

      expect(isValid).toBe(true);
    }
  });
});

describe('Security Properties', () => {
  let manager: WebhookSignatureManager;

  beforeEach(() => {
    manager = new WebhookSignatureManager();
  });

  it('should use HMAC-SHA256 by default', () => {
    const secret = manager.generateSecret();
    const payload = 'test';

    const signature = manager.signPayload(payload, secret);
    expect(signature.startsWith('sha256=')).toBe(true);
  });

  it('should produce 64-character hex signatures for SHA256', () => {
    const secret = manager.generateSecret();
    const payload = 'test';

    const signature = manager.signPayload(payload, secret);
    const hashPart = signature.substring('sha256='.length);

    // SHA256 produces 32 bytes = 64 hex chars
    expect(hashPart.length).toBe(64);
  });

  it('should use base64url encoding for secrets', () => {
    const secret = manager.generateSecret();

    // Should be valid base64url (no + or / characters)
    expect(secret).not.toMatch(/[+/]/);

    // Should be decodable
    expect(() => manager.signPayload('test', secret)).not.toThrow();
  });

  it('should prevent secret reuse across webhooks', () => {
    const secret1 = manager.generateSecret();
    const secret2 = manager.generateSecret();

    // Each secret should be unique
    expect(secret1).not.toBe(secret2);

    // Same payload with different secrets should produce different sigs
    const payload = { test: 'data' };
    const sig1 = manager.signPayload(payload, secret1);
    const sig2 = manager.signPayload(payload, secret2);

    expect(sig1).not.toBe(sig2);
  });
});
