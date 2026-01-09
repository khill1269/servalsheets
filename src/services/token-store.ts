/**
 * ServalSheets - Token Store
 *
 * Encrypted persistence for OAuth tokens.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { ConfigError, DataError } from "../core/errors.js";

export interface StoredTokens {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
}

export interface TokenStore {
  load(): Promise<StoredTokens | null>;
  save(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
}

interface EncryptedRecord {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
  createdAt: string;
}

export class EncryptedFileTokenStore implements TokenStore {
  private filePath: string;
  private key: Buffer;

  constructor(filePath: string, secretKeyHex: string) {
    if (!secretKeyHex || secretKeyHex.length !== 64) {
      throw new ConfigError(
        "TOKEN_STORE_KEY must be a 64-character hex string (32 bytes)",
        "TOKEN_STORE_KEY",
        {
          received: secretKeyHex
            ? `${secretKeyHex.length} characters`
            : "undefined",
          expected: "64 characters (hex)",
        },
      );
    }
    this.filePath = filePath;
    this.key = Buffer.from(secretKeyHex, "hex");
  }

  async load(): Promise<StoredTokens | null> {
    try {
      const data = await fs.readFile(this.filePath, "utf8");
      const record = JSON.parse(data) as EncryptedRecord;
      if (record.version !== 1) {
        throw new DataError(
          `Unsupported token store version: ${record.version}`,
          "VERSION_MISMATCH",
          false,
          {
            receivedVersion: record.version,
            supportedVersions: [1],
          },
        );
      }
      const iv = Buffer.from(record.iv, "base64");
      const tag = Buffer.from(record.tag, "base64");
      const ciphertext = Buffer.from(record.ciphertext, "base64");

      const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return JSON.parse(decrypted.toString("utf8")) as StoredTokens;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async save(tokens: StoredTokens): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(tokens), "utf8");
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const record: EncryptedRecord = {
      version: 1,
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      createdAt: new Date().toISOString(),
    };

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(record, null, 2), {
      mode: 0o600,
    });
    await fs.rename(tempPath, this.filePath);
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
