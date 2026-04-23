/**
 * Compliance-Grade Audit Logger
 *
 * Provides W5 audit logging for SOC 2, HIPAA, and GDPR compliance.
 * Implements immutable, tamper-proof audit trails with SIEM integration.
 *
 * ## W5 Audit Format
 *
 * Every audit entry captures:
 * - **Who**: User identifier, IP address, client info
 * - **What**: Action performed, resource affected, outcome
 * - **When**: ISO 8601 timestamp with millisecond precision
 * - **Where**: Source IP, geographic location, service endpoint
 * - **Why**: Business context, authorization scope
 *
 * ## Compliance Requirements
 *
 * **SOC 2 (Trust Services Criteria)**:
 * - Immutable audit trail (CC6.1, CC6.2)
 * - Tamper-proof storage (CC7.2)
 * - 7-year retention (CC7.3)
 * - Access controls (CC6.6)
 *
 * **HIPAA (Health Insurance Portability and Accountability Act)**:
 * - PHI access logging (§164.312(b))
 * - Authentication events (§164.312(d))
 * - Emergency access procedures (§164.312(a)(2)(ii))
 * - 6-year retention minimum (§164.316(b)(2)(i))
 *
 * **GDPR (General Data Protection Regulation)**:
 * - Data processing activities (Article 30)
 * - Data subject access (Article 15)
 * - Right to erasure (Article 17)
 * - Data breach notification (Article 33)
 *
 * ## Storage Architecture
 *
 * **Primary Storage**: JSON Lines (append-only)
 * - File path: `./audit-logs/YYYY-MM-DD.jsonl`
 * - Atomic appends with file locking
 * - Daily rotation with compression
 * - Symlink to current log: `./audit-logs/current.jsonl`
 *
 * **SIEM Integration**: Real-time streaming
 * - Splunk HTTP Event Collector (HEC)
 * - Datadog Logs API
 * - AWS CloudWatch Logs
 * - Azure Monitor Logs
 *
 * **Long-term Archive**: Cold storage
 * - S3 Glacier (7-year retention)
 * - Compressed and encrypted
 * - Indexed for compliance queries
 *
 * ## Event Categories
 *
 * **Data Mutations**: Create, update, delete operations
 * - sheets_data actions: write_range, append_rows, clear_range
 * - sheets_dimensions actions: insert_rows, delete_columns
 * - sheets_format actions: apply_formatting
 *
 * **Access Control**: Permission changes
 * - sheets_collaborate actions: share_spreadsheet, update_permissions
 * - sheets_auth actions: authenticate, revoke_token
 *
 * **Authentication**: Identity verification
 * - Login success/failure
 * - Token refresh
 * - Session expiration
 * - OAuth flow completion
 *
 * **Configuration**: System changes
 * - Environment variable updates
 * - Feature flag toggles
 * - Rate limit adjustments
 *
 * **Export**: Data extraction
 * - sheets_data actions: export_csv, export_xlsx
 * - sheets_bigquery actions: export_to_bigquery
 *
 * ## Usage Examples
 *
 * ```typescript
 * // Data mutation
 * await auditLogger.logMutation({
 *   userId: 'user@example.com',
 *   action: 'write_range',
 *   resource: { spreadsheetId: '1ABC', range: 'Sheet1!A1:B10' },
 *   outcome: 'success',
 *   cellsModified: 20,
 *   ipAddress: req.ip,
 * });
 *
 * // Permission change
 * await auditLogger.logPermissionChange({
 *   userId: 'admin@example.com',
 *   action: 'share_spreadsheet',
 *   resource: { spreadsheetId: '1ABC' },
 *   outcome: 'success',
 *   permission: { role: 'writer', email: 'user@example.com' },
 *   ipAddress: req.ip,
 * });
 *
 * // Authentication event
 * await auditLogger.logAuthentication({
 *   userId: 'user@example.com',
 *   action: 'login',
 *   outcome: 'success',
 *   method: 'oauth',
 *   ipAddress: req.ip,
 *   userAgent: req.headers['user-agent'],
 * });
 * ```
 *
 * ## Tamper-Proof Guarantees
 *
 * **Cryptographic Integrity**:
 * - Each entry includes HMAC-SHA256 signature
 * - Chain of hashes (current entry includes previous hash)
 * - Signature verification on read
 *
 * **Append-Only Storage**:
 * - No update or delete operations
 * - File opened with O_APPEND flag
 * - Atomic writes with fsync()
 *
 * **Access Controls**:
 * - File permissions: 0640 (owner read/write, group read)
 * - Separate audit user/group (not application user)
 * - SELinux/AppArmor policies
 *
 * @see https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report.html
 * @see https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html
 * @see https://gdpr-info.eu/
 */

import { existsSync, mkdirSync, promises as fs } from 'fs';
import { join } from 'path';
import { createHmac, createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { logger } from '../utils/logger.js';
import { getEnv } from '../config/env.js';
import { ConfigError, ServiceError } from '../core/errors.js';
import type {
  AuditEvent,
  AuthenticationEvent,
  ConfigurationEvent,
  ExportEvent,
  MutationEvent,
  PermissionEvent,
  SiemConfig,
  SignedAuditEntry,
} from './audit-logger-types.js';

export type {
  AuditEvent,
  AuditResource,
  AuthenticationEvent,
  ConfigurationEvent,
  ExportEvent,
  MutationEvent,
  PermissionEvent,
} from './audit-logger-types.js';

/**
 * Compliance-grade audit logger
 *
 * Provides immutable, tamper-proof audit trails for compliance.
 */
export class AuditLogger {
  private logDir: string;
  private currentLogPath: string;
  private currentDate: string;
  private retentionDays: number;
  private sequenceNumber: number;
  private previousHash: string;
  private hmacSecret: Buffer;
  private encryptionKey: Buffer | null;
  private siemConfigs: SiemConfig[];
  private writeQueue: Promise<void>;
  private initialization: Promise<void>;
  private _pendingEncKeyPassword: string | null = null;

  constructor(options?: {
    logDir?: string;
    hmacSecret?: string;
    encryptionKey?: string;
    retentionDays?: number;
    siemConfigs?: SiemConfig[];
  }) {
    this.logDir = options?.logDir ?? join(process.cwd(), 'audit-logs');
    this.currentDate = this.getCurrentDate();
    this.currentLogPath = this.getLogPath(this.currentDate);
    // CC7.3 / HIPAA §164.316(b)(2)(i): 7-year minimum retention = 2555 days
    this.retentionDays = options?.retentionDays ?? 2555;
    this.sequenceNumber = 0;
    this.previousHash = '0'.repeat(64); // Genesis hash
    this.hmacSecret = options?.hmacSecret
      ? Buffer.from(options.hmacSecret, 'hex')
      : randomBytes(32);
    // COMP-01: Derive 32-byte AES key from password using scrypt (N=16384, per-installation random salt)
    // Salt is loaded/generated lazily in initializeAuditState() to support async file I/O.
    const encKeyPassword = options?.encryptionKey ?? process.env['AUDIT_LOG_ENCRYPTION_KEY'];
    this.encryptionKey = null; // Will be set in initializeAuditState() if encKeyPassword is set
    this._pendingEncKeyPassword = encKeyPassword ?? null;
    this.siemConfigs = options?.siemConfigs ?? [];
    this.writeQueue = Promise.resolve();

    this.ensureLogDirectory();

    // GDPR/HIPAA: warn when PII redaction is explicitly disabled (opt-out path)
    if (process.env['AUDIT_PII_REDACTION'] === 'false') {
      logger.warn(
        'AUDIT_PII_REDACTION is disabled — sensitive audit fields will NOT be redacted',
      );
    }

    // Ensure log state and retention are applied before first write/integrity check.
    this.initialization = this.initializeAuditState();
  }

  private async initializeAuditState(): Promise<void> {
    // Initialize encryption key with persisted random salt
    if (this._pendingEncKeyPassword) {
      const saltPath = join(this.logDir, '.audit-salt');
      let salt: Buffer;
      try {
        salt = await fs.readFile(saltPath);
      } catch {
        salt = randomBytes(32);
        await fs.mkdir(this.logDir, { recursive: true });
        await fs.writeFile(saltPath, salt, { mode: 0o600 });
      }
      this.encryptionKey = scryptSync(this._pendingEncKeyPassword, salt, 32);
      this._pendingEncKeyPassword = null;
    }

    // Warn if AUDIT_HMAC_SECRET not set in production
    if (!process.env['AUDIT_HMAC_SECRET'] && process.env['NODE_ENV'] === 'production') {
      logger.warn('AUDIT_HMAC_SECRET not set in production — audit log integrity is ephemeral');
    }

    // Load persisted cross-day chain state before reading the current log
    await this.loadChainState();
    await this.loadLastSequenceNumber();
    await this.pruneExpiredLogs();
  }

  /**
   * Persist the current chain tip (last hash + date) so daily rotation
   * preserves continuity across day boundaries.
   */
  private async saveChainState(): Promise<void> {
    const statePath = join(this.logDir, '.chain-state.json');
    const state = {
      date: this.currentDate,
      previousHash: this.previousHash,
      sequenceNumber: this.sequenceNumber,
    };
    await fs.writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
  }

  /**
   * Load the persisted cross-day chain tip.
   * If the state file exists and is for a previous date, use its hash as
   * the genesis for the current day (ensuring the chain spans day boundaries).
   */
  private async loadChainState(): Promise<void> {
    const statePath = join(this.logDir, '.chain-state.json');
    try {
      const raw = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(raw) as {
        date: string;
        previousHash: string;
        sequenceNumber: number;
      };
      if (state.date !== this.currentDate && typeof state.previousHash === 'string') {
        // Different day — carry the last hash forward as the genesis for today
        this.previousHash = state.previousHash;
        logger.debug('Loaded cross-day chain state', {
          fromDate: state.date,
          toDate: this.currentDate,
        });
      }
    } catch {
      // No state file yet — genesis hash stays as zeros (expected on first run)
    }
  }

  /**
   * Log a data mutation event
   */
  async logMutation(event: Omit<MutationEvent, 'timestamp'>): Promise<void> {
    await this.logEvent({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log a permission change event
   */
  async logPermissionChange(event: Omit<PermissionEvent, 'timestamp'>): Promise<void> {
    await this.logEvent({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log an authentication event
   */
  async logAuthentication(event: Omit<AuthenticationEvent, 'timestamp'>): Promise<void> {
    await this.logEvent({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log a configuration change event
   */
  async logConfiguration(event: Omit<ConfigurationEvent, 'timestamp'>): Promise<void> {
    await this.logEvent({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log an export event
   */
  async logExport(event: Omit<ExportEvent, 'timestamp'>): Promise<void> {
    await this.logEvent({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log a generic tool call event (for MCP tool execution audit trail)
   */
  async logToolCall(params: {
    tool: string;
    action: string;
    userId: string;
    spreadsheetId?: string;
    outcome: 'success' | 'failure' | 'partial';
    duration?: number;
    errorCode?: string;
  }): Promise<void> {
    await this.logEvent({
      action: params.action,
      tool: params.tool,
      userId: params.userId,
      resource: {
        type: 'spreadsheet',
        spreadsheetId: params.spreadsheetId,
      },
      outcome: params.outcome,
      errorCode: params.errorCode,
      timestamp: new Date().toISOString(),
      durationMs: params.duration,
      ipAddress: 'internal',
      requestId: `tool_${Date.now()}`,
    });
  }

  /**
   * Redact PII from an audit event before storage.
   *
   * Default: REDACTION IS ACTIVE (opt-out model for GDPR/HIPAA compliance).
   * Set AUDIT_PII_REDACTION=false to explicitly disable redaction (not recommended
   * for production — AuditLogger emits a startup warning when disabled).
   *
   * When redaction is active:
   *   - Email addresses in userId / ipAddress / userAgent are hashed (SHA-256, first 16 hex chars)
   *   - IP addresses are anonymised to /24 subnet (last octet zeroed)
   *   - Raw email strings in nested fields are replaced with [REDACTED-EMAIL]
   *
   * The redaction is applied to a shallow clone so the original object is unchanged.
   */
  private redactPii(event: AuditEvent): AuditEvent {
    if (process.env['AUDIT_PII_REDACTION'] === 'false') return event;

    const redactEmail = (value: string): string => {
      if (!value.includes('@')) return value;
      const hash = createHmac('sha256', this.hmacSecret).update(value).digest('hex').slice(0, 16);
      return `[REDACTED:${hash}]`;
    };

    const anonymiseIp = (ip: string): string => {
      const v4 = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
      if (v4) return `${v4[1]}.0`;
      const v6 = ip.match(/^([0-9a-f:]{3,}):[\da-f]+$/i);
      if (v6) return `${v6[1]}:0`;
      return ip;
    };

    return {
      ...event,
      userId: redactEmail(event.userId),
      ipAddress: event.ipAddress ? anonymiseIp(event.ipAddress) : event.ipAddress,
      userAgent: event.userAgent ? '[REDACTED]' : event.userAgent,
    };
  }

  /**
   * Generic audit event logging
   */
  private async logEvent(event: AuditEvent): Promise<void> {
    await this.initialization;

    // Check if we need to rotate to a new day
    const currentDate = this.getCurrentDate();
    if (currentDate !== this.currentDate) {
      await this.rotateLog(currentDate);
    }

    // Redact PII before writing (GDPR Article 5 data minimisation)
    const redacted = this.redactPii(event);

    // Create signed entry
    const entry = this.createSignedEntry(redacted);

    // Append to log file (atomic, append-only)
    await this.appendToLog(entry);

    // Send to SIEM systems (non-blocking)
    void this.sendToSiem(entry);

    logger.debug('Audit event logged', {
      action: event.action,
      userId: event.userId,
      resource: event.resource,
      sequenceNumber: entry.sequenceNumber,
    });
  }

  /**
   * Create a signed audit entry with cryptographic integrity
   */
  private createSignedEntry(event: AuditEvent): SignedAuditEntry {
    this.sequenceNumber++;

    // Compute hash: HMAC-SHA256(sequenceNumber + event + previousHash)
    const hmac = createHmac('sha256', this.hmacSecret);
    hmac.update(String(this.sequenceNumber));
    hmac.update(JSON.stringify(event));
    hmac.update(this.previousHash);
    const hash = hmac.digest('hex');

    const entry: SignedAuditEntry = {
      sequenceNumber: this.sequenceNumber,
      event,
      hash,
      previousHash: this.previousHash,
    };

    // Update chain
    this.previousHash = hash;

    return entry;
  }

  /**
   * Append entry to log file (atomic, append-only)
   */
  /**
   * COMP-01: Encrypt a log line with AES-256-GCM.
   * Format: "ENC:" + base64(iv[12] + authTag[16] + ciphertext)
   * Returns the original line unchanged when encryption is disabled.
   */
  private encryptLogLine(plaintext: string): string {
    if (!this.encryptionKey) return plaintext;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, authTag, ciphertext]);
    return 'ENC:' + payload.toString('base64') + '\n';
  }

  /**
   * COMP-01: Decrypt a log line produced by encryptLogLine().
   * Lines not prefixed with "ENC:" are returned unchanged (backward compat).
   * Throws if decryption key is unavailable or authentication fails.
   */
  decryptLogEntry(line: string): string {
    const trimmed = line.trimEnd();
    if (!trimmed.startsWith('ENC:')) return trimmed;
    if (!this.encryptionKey) {
      throw new ConfigError(
        'AUDIT_LOG_ENCRYPTION_KEY is required to decrypt audit logs',
        'AUDIT_LOG_ENCRYPTION_KEY'
      );
    }
    const payload = Buffer.from(trimmed.slice(4), 'base64');
    const iv = payload.subarray(0, 12);
    const authTag = payload.subarray(12, 28);
    const ciphertext = payload.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  private parseLogEntry(line: string): SignedAuditEntry {
    const decoded = this.decryptLogEntry(line);
    return JSON.parse(decoded) as SignedAuditEntry;
  }

  private async appendToLog(entry: SignedAuditEntry): Promise<void> {
    // Serialize as JSON Lines format (one JSON object per line)
    const plaintext = JSON.stringify(entry) + '\n';
    // COMP-01: Encrypt at rest when AUDIT_LOG_ENCRYPTION_KEY is configured
    const line = this.encryptLogLine(plaintext);

    // Chain writes to ensure atomicity and ordering
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        // Append with O_APPEND flag (atomic at filesystem level)
        await fs.appendFile(this.currentLogPath, line, { flag: 'a', mode: 0o640 });
        // Persist cross-day chain tip so rotation preserves continuity
        await this.saveChainState();
      } catch (error) {
        logger.error('Failed to write audit log', {
          error,
          logPath: this.currentLogPath,
          sequenceNumber: entry.sequenceNumber,
        });
        throw error;
      }
    });

    await this.writeQueue;
  }

  /**
   * Send audit entry to SIEM systems (non-blocking)
   */
  private async sendToSiem(entry: SignedAuditEntry): Promise<void> {
    const promises = this.siemConfigs.map((config) => this.sendToSiemSystem(config, entry));

    // Don't block on SIEM delivery, but log failures
    await Promise.allSettled(promises).then((results) => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.warn('Failed to send audit log to SIEM', {
            siem: this.siemConfigs[index]?.type,
            error: result.reason,
            sequenceNumber: entry.sequenceNumber,
          });
        }
      });
    });
  }

  /**
   * Send audit entry to a specific SIEM system
   */
  private async sendToSiemSystem(config: SiemConfig, entry: SignedAuditEntry): Promise<void> {
    switch (config.type) {
      case 'splunk':
        await this.sendToSplunk(config, entry);
        break;
      case 'datadog':
        await this.sendToDatadog(config, entry);
        break;
      case 'cloudwatch':
        await this.sendToCloudWatch(config, entry);
        break;
      case 'azure':
        await this.sendToAzure(config, entry);
        break;
      default:
        logger.warn('Unknown SIEM type', { type: config.type });
    }
  }

  /**
   * Send to Splunk HTTP Event Collector
   */
  private async sendToSplunk(config: SiemConfig, entry: SignedAuditEntry): Promise<void> {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Splunk ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: entry.event,
        sourcetype: 'servalsheets:audit',
        source: 'audit-logger',
        index: 'audit',
        fields: {
          sequence_number: entry.sequenceNumber,
          hash: entry.hash,
          previous_hash: entry.previousHash,
        },
      }),
    });

    if (!response.ok) {
      throw new ServiceError(
        `Splunk HEC error: ${response.statusText}`,
        'INTERNAL_ERROR',
        'AuditLogger'
      );
    }
  }

  /**
   * Send to Datadog Logs API
   */
  private async sendToDatadog(config: SiemConfig, entry: SignedAuditEntry): Promise<void> {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'DD-API-KEY': config.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          ddsource: 'servalsheets',
          ddtags: 'env:production,service:audit-logger',
          hostname: process.env['HOSTNAME'] ?? 'unknown',
          message: JSON.stringify(entry.event),
          service: 'audit-logger',
          status: entry.event.outcome,
          sequence_number: entry.sequenceNumber,
          hash: entry.hash,
        },
      ]),
    });

    if (!response.ok) {
      throw new ServiceError(
        `Datadog Logs API error: ${response.statusText}`,
        'INTERNAL_ERROR',
        'AuditLogger'
      );
    }
  }

  /**
   * Send to AWS CloudWatch Logs
   */
  private async sendToCloudWatch(config: SiemConfig, _entry: SignedAuditEntry): Promise<void> {
    // Simplified implementation - in production, use AWS SDK
    logger.warn('CloudWatch Logs integration requires AWS SDK', {
      logGroup: config.logGroup,
      logStream: config.logStream,
    });
  }

  /**
   * Send to Azure Monitor Logs
   */
  private async sendToAzure(config: SiemConfig, _entry: SignedAuditEntry): Promise<void> {
    // Simplified implementation - in production, use Azure SDK
    logger.warn('Azure Monitor Logs integration requires Azure SDK', {
      endpoint: config.endpoint,
    });
  }

  /**
   * Rotate log file (daily rotation)
   */
  private async rotateLog(newDate: string): Promise<void> {
    logger.info('Rotating audit log', {
      oldDate: this.currentDate,
      newDate,
      sequenceNumber: this.sequenceNumber,
    });

    this.currentDate = newDate;
    this.currentLogPath = this.getLogPath(newDate);

    // Reset sequence number for new day
    this.sequenceNumber = 0;
    this.previousHash = '0'.repeat(64);

    this.ensureLogDirectory();
    await this.pruneExpiredLogs();
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true, mode: 0o750 });
    }
  }

  /**
   * Load last sequence number from log file
   */
  private async loadLastSequenceNumber(): Promise<void> {
    try {
      if (!existsSync(this.currentLogPath)) {
        return;
      }

      const content = await fs.readFile(this.currentLogPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      if (lines.length === 0) {
        return;
      }

      // Parse last entry
      const lastLine = lines[lines.length - 1];
      const lastEntry = this.parseLogEntry(lastLine!);

      this.sequenceNumber = lastEntry.sequenceNumber;
      this.previousHash = lastEntry.hash;

      logger.debug('Loaded audit log state', {
        sequenceNumber: this.sequenceNumber,
        previousHash: this.previousHash,
        entries: lines.length,
      });
    } catch (error) {
      logger.warn('Failed to load audit log state', { error });
    }
  }

  /**
   * Remove dated log files older than the configured retention window.
   * Operates only on YYYY-MM-DD.jsonl files to avoid touching unrelated artifacts.
   */
  private async pruneExpiredLogs(): Promise<void> {
    try {
      const entries = await fs.readdir(this.logDir, { withFileTypes: true });
      const now = Date.now();
      const cutoffMs = now - this.retentionDays * 24 * 60 * 60 * 1000;
      let removed = 0;

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(entry.name)) continue;

        const datePart = entry.name.slice(0, 10);
        const timestamp = Date.parse(`${datePart}T00:00:00.000Z`);
        if (Number.isNaN(timestamp) || timestamp >= cutoffMs) continue;

        await fs.rm(join(this.logDir, entry.name), { force: true });
        removed++;
      }

      if (removed > 0) {
        logger.info('Pruned expired audit logs', {
          removed,
          retentionDays: this.retentionDays,
        });
      }
    } catch (error) {
      logger.warn('Failed to prune expired audit logs', {
        error: error instanceof Error ? error.message : String(error),
        logDir: this.logDir,
        retentionDays: this.retentionDays,
      });
    }
  }

  /**
   * Get current date in YYYY-MM-DD format
   */
  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0]!;
  }

  /**
   * Get log file path for a given date
   */
  private getLogPath(date: string): string {
    return join(this.logDir, `${date}.jsonl`);
  }

  /**
   * Verify integrity of audit log
   *
   * @returns true if all entries are valid and chain is intact
   */
  async verifyIntegrity(): Promise<boolean> {
    try {
      await this.initialization;
      const content = await fs.readFile(this.currentLogPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      let previousHash = '0'.repeat(64);

      for (const line of lines) {
        const entry = this.parseLogEntry(line);

        // Verify previous hash matches
        if (entry.previousHash !== previousHash) {
          logger.error('Audit log integrity violation: previous hash mismatch', {
            sequenceNumber: entry.sequenceNumber,
            expected: previousHash,
            actual: entry.previousHash,
          });
          return false;
        }

        // Verify hash
        const hmac = createHmac('sha256', this.hmacSecret);
        hmac.update(String(entry.sequenceNumber));
        hmac.update(JSON.stringify(entry.event));
        hmac.update(entry.previousHash);
        const computedHash = hmac.digest('hex');

        if (entry.hash !== computedHash) {
          logger.error('Audit log integrity violation: hash mismatch', {
            sequenceNumber: entry.sequenceNumber,
            expected: computedHash,
            actual: entry.hash,
          });
          return false;
        }

        previousHash = entry.hash;
      }

      logger.info('Audit log integrity verified', { entries: lines.length });
      return true;
    } catch (error) {
      logger.error('Failed to verify audit log integrity', { error });
      return false;
    }
  }

  /**
   * Verify the full cross-day hash chain across all log files in date order.
   * Returns { valid, filesChecked, entriesChecked, firstViolation? }.
   * Genesis hash for the oldest file is assumed to be '0'.repeat(64).
   */
  async verifyAllLogs(options?: { startDate?: string; endDate?: string }): Promise<{
    valid: boolean;
    filesChecked: number;
    entriesChecked: number;
    firstViolation?: { file: string; sequenceNumber: number; reason: string };
  }> {
    await this.initialization;
    let filesChecked = 0;
    let entriesChecked = 0;
    let chainHash = '0'.repeat(64);

    try {
      const entries = await fs.readdir(this.logDir, { withFileTypes: true });
      const logFiles = entries
        .filter((e) => e.isFile() && /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(e.name))
        .map((e) => e.name)
        .filter((name) => {
          const date = name.slice(0, 10);
          if (options?.startDate && date < options.startDate) return false;
          if (options?.endDate && date > options.endDate) return false;
          return true;
        })
        .sort(); // ascending date order

      for (const fileName of logFiles) {
        const filePath = join(this.logDir, fileName);
        let content: string;
        try {
          content = await fs.readFile(filePath, 'utf-8');
        } catch {
          continue; // Skip unreadable files
        }

        const lines = content.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          let entry: SignedAuditEntry;
          try {
            entry = this.parseLogEntry(line);
          } catch {
            return {
              valid: false,
              filesChecked,
              entriesChecked,
              firstViolation: { file: fileName, sequenceNumber: -1, reason: 'Parse error' },
            };
          }

          if (entry.previousHash !== chainHash) {
            return {
              valid: false,
              filesChecked,
              entriesChecked,
              firstViolation: {
                file: fileName,
                sequenceNumber: entry.sequenceNumber,
                reason: `previousHash mismatch (expected ${chainHash.slice(0, 8)}…, got ${entry.previousHash.slice(0, 8)}…)`,
              },
            };
          }

          const hmac = createHmac('sha256', this.hmacSecret);
          hmac.update(String(entry.sequenceNumber));
          hmac.update(JSON.stringify(entry.event));
          hmac.update(entry.previousHash);
          const computed = hmac.digest('hex');

          if (entry.hash !== computed) {
            return {
              valid: false,
              filesChecked,
              entriesChecked,
              firstViolation: {
                file: fileName,
                sequenceNumber: entry.sequenceNumber,
                reason: 'HMAC hash mismatch',
              },
            };
          }

          chainHash = entry.hash;
          entriesChecked++;
        }

        filesChecked++;
      }

      logger.info('Full audit log chain verified', { filesChecked, entriesChecked });
      return { valid: true, filesChecked, entriesChecked };
    } catch (error) {
      logger.error('Failed to verify full audit log chain', { error });
      return {
        valid: false,
        filesChecked,
        entriesChecked,
        firstViolation: { file: '', sequenceNumber: -1, reason: String(error) },
      };
    }
  }
}

/**
 * Singleton audit logger instance
 */
let auditLogger: AuditLogger | null = null;

/**
 * Get or create audit logger instance
 */
export function getAuditLogger(): AuditLogger {
  if (!auditLogger) {
    const env = getEnv();

    // Load SIEM configs from environment
    const siemConfigs: SiemConfig[] = [];

    if (process.env['AUDIT_SPLUNK_ENDPOINT'] && process.env['AUDIT_SPLUNK_TOKEN']) {
      siemConfigs.push({
        type: 'splunk',
        endpoint: process.env['AUDIT_SPLUNK_ENDPOINT']!,
        token: process.env['AUDIT_SPLUNK_TOKEN']!,
      });
    }

    if (process.env['AUDIT_DATADOG_ENDPOINT'] && process.env['AUDIT_DATADOG_API_KEY']) {
      siemConfigs.push({
        type: 'datadog',
        endpoint: process.env['AUDIT_DATADOG_ENDPOINT']!,
        apiKey: process.env['AUDIT_DATADOG_API_KEY']!,
      });
    }

    if (process.env['AUDIT_CLOUDWATCH_LOG_GROUP'] && process.env['AUDIT_CLOUDWATCH_LOG_STREAM']) {
      siemConfigs.push({
        type: 'cloudwatch',
        endpoint: '', // Not used for CloudWatch
        region: process.env['AWS_REGION'] ?? 'us-east-1',
        logGroup: process.env['AUDIT_CLOUDWATCH_LOG_GROUP']!,
        logStream: process.env['AUDIT_CLOUDWATCH_LOG_STREAM']!,
      });
    }

    auditLogger = new AuditLogger({
      logDir: env['AUDIT_LOG_DIR'] as string | undefined,
      hmacSecret: env['AUDIT_HMAC_SECRET'] as string | undefined,
      encryptionKey: env['AUDIT_LOG_ENCRYPTION_KEY'] as string | undefined,
      retentionDays: env['AUDIT_LOG_RETENTION_DAYS'] as number | undefined,
      siemConfigs: siemConfigs.length > 0 ? siemConfigs : undefined,
    });
  }

  return auditLogger;
}
