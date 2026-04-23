/**
 * AuditLogger PII redaction tests
 *
 * Verifies the opt-out model for AUDIT_PII_REDACTION:
 *   - env unset  → redaction active (default)
 *   - env=false  → redaction bypassed + startup warning
 *   - env=true   → redaction active (explicit, same as default)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

import { AuditLogger } from '../../src/services/audit-logger.js';
import { logger } from '../../src/utils/logger.js';

describe('AuditLogger PII redaction defaults', () => {
  let logDir: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    logDir = join(tmpdir(), `audit-logs-${randomBytes(8).toString('hex')}`);
    await fs.mkdir(logDir, { recursive: true });
    originalEnv = process.env['AUDIT_PII_REDACTION'];
    delete process.env['AUDIT_PII_REDACTION'];
  });

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env['AUDIT_PII_REDACTION'];
    } else {
      process.env['AUDIT_PII_REDACTION'] = originalEnv;
    }
    await fs.rm(logDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const readFirstEntry = async (): Promise<Record<string, unknown>> => {
    const logPath = join(logDir, `${new Date().toISOString().split('T')[0]}.jsonl`);
    const content = await fs.readFile(logPath, 'utf-8');
    return JSON.parse(content.trim()) as Record<string, unknown>;
  };

  it('redacts PII by default when AUDIT_PII_REDACTION is unset', async () => {
    const auditLogger = new AuditLogger({ logDir });

    await auditLogger.logMutation({
      userId: 'user@example.com',
      action: 'write_range',
      resource: { type: 'spreadsheet', spreadsheetId: '1ABC' },
      outcome: 'success',
      ipAddress: '192.168.1.42',
      requestId: 'req-redact-default',
    });

    const entry = await readFirstEntry();
    const event = (entry as { event: { userId: string; ipAddress: string } }).event;
    // userId should be hashed, not contain raw email
    expect(event.userId).not.toBe('user@example.com');
    expect(event.userId.startsWith('[REDACTED:')).toBe(true);
    // IP should be anonymised to /24
    expect(event.ipAddress).toBe('192.168.1.0');
  });

  it('bypasses redaction when AUDIT_PII_REDACTION=false (explicit opt-out)', async () => {
    process.env['AUDIT_PII_REDACTION'] = 'false';
    const auditLogger = new AuditLogger({ logDir });

    await auditLogger.logMutation({
      userId: 'user@example.com',
      action: 'write_range',
      resource: { type: 'spreadsheet', spreadsheetId: '1ABC' },
      outcome: 'success',
      ipAddress: '192.168.1.42',
      requestId: 'req-redact-bypass',
    });

    const entry = await readFirstEntry();
    const event = (entry as { event: { userId: string; ipAddress: string } }).event;
    expect(event.userId).toBe('user@example.com');
    expect(event.ipAddress).toBe('192.168.1.42');
  });

  it('emits startup warning when AUDIT_PII_REDACTION=false', () => {
    process.env['AUDIT_PII_REDACTION'] = 'false';
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    // eslint-disable-next-line no-new
    new AuditLogger({ logDir });

    const matching = warnSpy.mock.calls.find((call) =>
      typeof call[0] === 'string' && call[0].includes('AUDIT_PII_REDACTION is disabled'),
    );
    expect(matching).toBeDefined();
  });

  it('does NOT emit the warning when env unset (default path)', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    // eslint-disable-next-line no-new
    new AuditLogger({ logDir });

    const matching = warnSpy.mock.calls.find((call) =>
      typeof call[0] === 'string' && call[0].includes('AUDIT_PII_REDACTION is disabled'),
    );
    expect(matching).toBeUndefined();
  });
});
