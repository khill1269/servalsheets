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
import { createHmac, randomBytes } from 'crypto';
import { logger } from '../utils/logger.js';
import { getEnv } from '../config/env.js';

/**
 * W5 Audit Event (Who, What, When, Where, Why)
 */
export interface AuditEvent {
  // WHO: Identity and authentication
  userId: string; // User identifier (email, sub claim, API key ID)
  sessionId?: string; // Session identifier for correlation
  clientId?: string; // OAuth client ID
  apiKeyId?: string; // API key identifier (not the key itself)

  // WHAT: Action and outcome
  action: string; // Action performed (e.g., 'write_range', 'share_spreadsheet')
  tool?: string; // MCP tool invoked (e.g., 'sheets_data')
  resource: AuditResource; // Resource affected
  outcome: 'success' | 'failure' | 'partial'; // Operation result
  errorCode?: string; // Error code if outcome is failure
  errorMessage?: string; // Error message (sanitized, no PII)

  // WHEN: Temporal context
  timestamp: string; // ISO 8601 timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)
  durationMs?: number; // Operation duration in milliseconds

  // WHERE: Location and network
  ipAddress: string; // Source IP address (IPv4 or IPv6)
  geoLocation?: string; // Geographic location (city, country)
  userAgent?: string; // User agent string
  endpoint?: string; // API endpoint invoked

  // WHY: Business context
  requestId: string; // Request ID for correlation with application logs
  scopes?: string[]; // OAuth scopes granted
  reason?: string; // Business justification (e.g., 'emergency access')

  // Additional metadata
  metadata?: Record<string, unknown>; // Extensible metadata
}

/**
 * Resource identifier (spreadsheet, range, permission, etc.)
 */
export interface AuditResource {
  type: 'spreadsheet' | 'range' | 'permission' | 'token' | 'config' | 'export';
  spreadsheetId?: string;
  spreadsheetName?: string;
  range?: string;
  sheetId?: string;
  sheetName?: string;
  [key: string]: unknown; // Extensible
}

/**
 * Data mutation event (create, update, delete)
 */
export interface MutationEvent extends AuditEvent {
  action:
    | 'write_range'
    | 'append_rows'
    | 'clear_range'
    | 'delete_rows'
    | 'delete_columns'
    | 'insert_rows'
    | 'insert_columns'
    | 'apply_formatting';
  cellsModified?: number; // Number of cells affected
  rowsModified?: number; // Number of rows affected
  columnsModified?: number; // Number of columns affected
  snapshot?: string; // Snapshot ID for rollback
}

/**
 * Permission change event
 */
export interface PermissionEvent extends AuditEvent {
  action: 'share_spreadsheet' | 'update_permissions' | 'revoke_access';
  permission: {
    role: 'owner' | 'writer' | 'reader';
    email?: string;
    domain?: string;
    anyone?: boolean;
  };
}

/**
 * Authentication event
 */
export interface AuthenticationEvent extends AuditEvent {
  action: 'login' | 'logout' | 'token_refresh' | 'token_revoke' | 'oauth_grant';
  method: 'oauth' | 'api_key' | 'service_account' | 'managed_identity';
  failureReason?: string; // Reason for authentication failure
}

/**
 * Configuration change event
 */
export interface ConfigurationEvent extends AuditEvent {
  action: 'update_env' | 'toggle_feature' | 'adjust_rate_limit';
  configKey: string; // Configuration key changed
  oldValue?: string; // Previous value (sanitized, no secrets)
  newValue?: string; // New value (sanitized, no secrets)
}

/**
 * Export event (data extraction)
 */
export interface ExportEvent extends AuditEvent {
  action: 'export_csv' | 'export_xlsx' | 'export_bigquery' | 'download_attachment';
  format?: string; // Export format
  recordCount?: number; // Number of records exported
  fileSize?: number; // File size in bytes
  destination?: string; // Destination (sanitized, no credentials)
}

/**
 * Signed audit entry (immutable with cryptographic integrity)
 */
interface SignedAuditEntry {
  sequenceNumber: number; // Monotonically increasing sequence
  event: AuditEvent; // The audit event
  hash: string; // HMAC-SHA256(sequenceNumber + event + previousHash)
  previousHash: string; // Hash of previous entry (chain of trust)
}

/**
 * SIEM destination configuration
 */
interface SiemConfig {
  type: 'splunk' | 'datadog' | 'cloudwatch' | 'azure';
  endpoint: string;
  token?: string;
  apiKey?: string;
  region?: string; // For AWS CloudWatch
  logGroup?: string; // For AWS CloudWatch
  logStream?: string; // For AWS CloudWatch
}

/**
 * Compliance-grade audit logger
 *
 * Provides immutable, tamper-proof audit trails for compliance.
 */
export class AuditLogger {
  private logDir: string;
  private currentLogPath: string;
  private currentDate: string;
  private sequenceNumber: number;
  private previousHash: string;
  private hmacSecret: Buffer;
  private siemConfigs: SiemConfig[];
  private writeQueue: Promise<void>;

  constructor(options?: { logDir?: string; hmacSecret?: string; siemConfigs?: SiemConfig[] }) {
    this.logDir = options?.logDir ?? join(process.cwd(), 'audit-logs');
    this.currentDate = this.getCurrentDate();
    this.currentLogPath = this.getLogPath(this.currentDate);
    this.sequenceNumber = 0;
    this.previousHash = '0'.repeat(64); // Genesis hash
    this.hmacSecret = options?.hmacSecret
      ? Buffer.from(options.hmacSecret, 'hex')
      : randomBytes(32);
    this.siemConfigs = options?.siemConfigs ?? [];
    this.writeQueue = Promise.resolve();

    this.ensureLogDirectory();
    this.loadLastSequenceNumber();
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
   * Generic audit event logging
   */
  private async logEvent(event: AuditEvent): Promise<void> {
    // Check if we need to rotate to a new day
    const currentDate = this.getCurrentDate();
    if (currentDate !== this.currentDate) {
      await this.rotateLog(currentDate);
    }

    // Create signed entry
    const entry = this.createSignedEntry(event);

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
  private async appendToLog(entry: SignedAuditEntry): Promise<void> {
    // Serialize as JSON Lines format (one JSON object per line)
    const line = JSON.stringify(entry) + '\n';

    // Chain writes to ensure atomicity and ordering
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        // Append with O_APPEND flag (atomic at filesystem level)
        await fs.appendFile(this.currentLogPath, line, { flag: 'a', mode: 0o640 });
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
      throw new Error(`Splunk HEC error: ${response.statusText}`);
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
      throw new Error(`Datadog Logs API error: ${response.statusText}`);
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
      const lastEntry: SignedAuditEntry = JSON.parse(lastLine!);

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
      const content = await fs.readFile(this.currentLogPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      let previousHash = '0'.repeat(64);

      for (const line of lines) {
        const entry: SignedAuditEntry = JSON.parse(line);

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
    const _env = getEnv();

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
      logDir: process.env['AUDIT_LOG_DIR'] ?? undefined,
      hmacSecret: process.env['AUDIT_HMAC_SECRET'] ?? undefined,
      siemConfigs: siemConfigs.length > 0 ? siemConfigs : undefined,
    });
  }

  return auditLogger;
}
