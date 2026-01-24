/**
 * EncryptedFileTokenStore
 *
 * @purpose Encrypted file-based persistence for OAuth tokens using AES-256-GCM; prevents token theft with key-based encryption
 * @category Infrastructure
 * @usage Use with GoogleApiClient for secure token storage; encrypts access/refresh tokens, stores in ~/.servalsheets/tokens/
 * @dependencies crypto (node), fs (node:fs), path
 * @stateful Yes - maintains file-based token storage with encryption keys (hex format, 64 chars)
 * @singleton Yes - one instance per token store path to prevent concurrent access issues
 *
 * @example
 * const store = new EncryptedFileTokenStore({ path: '~/.servalsheets/tokens/', encryptionKey: 'hex...' });
 * await store.save({ access_token: '...', refresh_token: '...', expiry_date: Date.now() + 3600000 });
 * const tokens = await store.load(); // Decrypts and returns tokens
 * await store.delete(); // Securely removes token file
 */
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
export declare class EncryptedFileTokenStore implements TokenStore {
    private filePath;
    private key;
    constructor(filePath: string, secretKeyHex: string);
    load(): Promise<StoredTokens | null>;
    save(tokens: StoredTokens): Promise<void>;
    clear(): Promise<void>;
}
//# sourceMappingURL=token-store.d.ts.map