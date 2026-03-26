/**
 * ServalSheets - Connector Manager
 *
 * Central orchestration layer for all data connectors.
 * Handles registration, auth, quota tracking, caching, and subscriptions.
 */

import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { ConfigError, NotFoundError, ServiceError, ValidationError } from '../core/errors.js';
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type {
  SpreadsheetConnector,
  ConnectorCredentials,
  ConnectorRegistryEntry,
  HealthStatus,
  DataResult,
  QueryParams,
  Subscription,
  RefreshSchedule,
  TransformSpec,
  DataEndpoint,
  DataSchema,
} from './types.js';
import { FinnhubConnector } from './finnhub.js';
import { FredConnector } from './fred.js';
import { AlphaVantageConnector } from './alpha-vantage.js';
import { FmpConnector } from './fmp.js';
import { PolygonConnector } from './polygon.js';
import { GmailConnector } from './gmail-connector.js';
import { DriveConnector } from './drive-connector.js';
import { DocsConnector } from './docs-connector.js';
import { GenericRestConnector } from './rest-generic.js';
import { SecEdgarConnector } from './sec-edgar-connector.js';
import { WorldBankConnector } from './world-bank-connector.js';
import { OpenFigiConnector } from './openfigi-connector.js';

// ============================================================================
// Persistent Configuration Store
// ============================================================================

const CONNECTOR_CONFIG_DIR =
  process.env['CONNECTOR_CONFIG_DIR'] || path.join(process.cwd(), '.serval', 'connectors');

interface EncryptedConfigRecord {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
}

function getSaltFile(configDir: string = CONNECTOR_CONFIG_DIR): string {
  return path.join(configDir, '.salt');
}

function getOrCreateSalt(configDir: string = CONNECTOR_CONFIG_DIR): Buffer {
  const saltFile = getSaltFile(configDir);
  try {
    return fs.readFileSync(saltFile);
  } catch {
    const salt = randomBytes(32);
    try {
      fs.mkdirSync(path.dirname(saltFile), { recursive: true });
      fs.writeFileSync(saltFile, salt, { flag: 'wx', mode: 0o600 });
      return salt;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return fs.readFileSync(saltFile);
      }
      // If we can't persist the salt, use it for this session only
    }
    return salt;
  }
}

// Memoize derived key per password+salt to avoid 800ms scryptSync on every call.
// Key is derived once per process lifetime; invalidated if env var or salt changes.
let _cachedDerivedKey: { password: string; salt: string; key: Buffer } | null = null;

function deriveKey(configDir: string = CONNECTOR_CONFIG_DIR): Buffer | null {
  const password = process.env['CONNECTOR_ENCRYPTION_KEY'];
  if (!password) return null;
  const salt = getOrCreateSalt(configDir);
  const saltHex = salt.toString('hex');

  // Return cached key if password and salt are unchanged
  if (_cachedDerivedKey && _cachedDerivedKey.password === password && _cachedDerivedKey.salt === saltHex) {
    return _cachedDerivedKey.key;
  }

  // OWASP-recommended scrypt parameters: N=131072 (2^17), r=8, p=1
  // Node.js defaults (N=16384) are insufficient for credential encryption.
  // Explicit maxmem is required for these stronger parameters; Node's default limit is too low.
  const key = scryptSync(password, salt, 32, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  _cachedDerivedKey = { password, salt: saltHex, key };
  return key;
}

function encryptConfig(plaintext: string, configDir: string = CONNECTOR_CONFIG_DIR): string {
  const key = deriveKey(configDir);
  if (!key) {
    throw new ConfigError(
      'Cannot save connector credentials: CONNECTOR_ENCRYPTION_KEY is not set. ' +
        'Set this environment variable to enable encrypted credential storage.',
      'CONNECTOR_ENCRYPTION_KEY'
    );
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();

  const record: EncryptedConfigRecord = {
    version: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
  return JSON.stringify(record);
}

function decryptConfig(content: string, configDir: string = CONNECTOR_CONFIG_DIR): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return content;
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as Record<string, unknown>)['version'] !== 1 ||
    !(parsed as Record<string, unknown>)['ciphertext']
  ) {
    // Content is not encrypted — log a security warning if it looks like credentials JSON
    const keys = Object.keys(parsed as object);
    if (keys.some((k) => ['apiKey', 'token', 'secret', 'password', 'credentials'].includes(k))) {
      logger.warn(
        '[SECURITY] Connector config loaded from plaintext storage — re-save with CONNECTOR_ENCRYPTION_KEY set'
      );
    }
    return content;
  }

  const key = deriveKey(configDir);
  if (!key) {
    logger.warn(
      '[SECURITY] Encrypted connector config found but CONNECTOR_ENCRYPTION_KEY is not set — cannot decrypt'
    );
    return content;
  }

  const record = parsed as EncryptedConfigRecord;
  const iv = Buffer.from(record.iv, 'base64');
  const tag = Buffer.from(record.tag, 'base64');
  const ciphertext = Buffer.from(record.ciphertext, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

interface PersistedConnectorConfig {
  connectorId: string;
  credentials: ConnectorCredentials;
  configuredAt: string;
}

interface PersistedSubscription {
  id: string;
  connectorId: string;
  endpoint: string;
  params: QueryParams;
  schedule: RefreshSchedule;
  destination: { spreadsheetId: string; range: string };
  createdAt: string;
}

class ConnectorConfigStore {
  private configDir: string;

  constructor(configDir: string = CONNECTOR_CONFIG_DIR) {
    this.configDir = configDir;
  }

  async saveConfig(connectorId: string, credentials: ConnectorCredentials): Promise<void> {
    try {
      await fs.promises.mkdir(this.configDir, { recursive: true });
      const config: PersistedConnectorConfig = {
        connectorId,
        credentials,
        configuredAt: new Date().toISOString(),
      };
      const filePath = path.join(this.configDir, `${connectorId}.json`);
      const content = encryptConfig(JSON.stringify(config, null, 2), this.configDir);
      await fs.promises.writeFile(filePath, content, { encoding: 'utf-8', mode: 0o600 });
      logger.info('Connector config persisted', { connectorId });
    } catch (err) {
      logger.warn('Failed to persist connector config', {
        connectorId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async loadAll(): Promise<PersistedConnectorConfig[]> {
    try {
      await fs.promises.mkdir(this.configDir, { recursive: true });
      const files = await fs.promises.readdir(this.configDir);
      const configs: PersistedConnectorConfig[] = [];
      for (const file of files) {
        if (!file.endsWith('.json') || file.startsWith('sub_')) continue;
        try {
          const raw = await fs.promises.readFile(path.join(this.configDir, file), 'utf-8');
          const content = decryptConfig(raw, this.configDir);
          configs.push(JSON.parse(content) as PersistedConnectorConfig);
        } catch {
          // Skip corrupted config files
        }
      }
      return configs;
    } catch {
      return [];
    }
  }

  async deleteConfig(connectorId: string): Promise<void> {
    try {
      const filePath = path.join(this.configDir, `${connectorId}.json`);
      await fs.promises.unlink(filePath);
    } catch {
      // File may not exist — OK
    }
  }
}