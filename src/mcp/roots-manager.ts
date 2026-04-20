/**
 * MCP Roots Manager
 *
 * Implements MCP 2025-11-25 Roots client capability.
 * Servers can request the list of root URIs from the client to understand
 * the workspace context (e.g., which Google Drive folders are in scope).
 *
 * For ServalSheets, Roots enable:
 * - Filtering sheets_core.list to only show spreadsheets in declared folders
 * - Scoping analysis tools to the declared workspace
 * - Context-aware session initialization
 */

import type { Root, RootsListChangedNotification } from '@modelcontextprotocol/sdk/types.js';
import { RootsListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';

export interface RootsCapable {
  server?: {
    listRoots: (params?: Record<string, unknown>) => Promise<{ roots: Root[] }>;
    setNotificationHandler: <T extends object>(
      schema: unknown,
      handler: (notification: T) => void | Promise<void>
    ) => void;
    getClientCapabilities?: () => { roots?: { listChanged?: boolean } } | undefined;
  };
}

export interface ResolvedRoot {
  uri: string;
  name?: string;
  /** Parsed Google Spreadsheet ID if uri is a sheets URL, else undefined */
  spreadsheetId?: string;
  /** Parsed Google Drive folder ID if uri is a Drive folder URL, else undefined */
  driveFolderId?: string;
}

const SHEETS_URL_RE = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;
const DRIVE_FOLDER_RE = /\/drive\/folders\/([a-zA-Z0-9_-]+)/;

function parseRoot(root: Root): ResolvedRoot {
  const resolved: ResolvedRoot = { uri: root.uri, name: root.name };

  const sheetsMatch = SHEETS_URL_RE.exec(root.uri);
  if (sheetsMatch?.[1]) {
    resolved.spreadsheetId = sheetsMatch[1];
    return resolved;
  }

  const folderMatch = DRIVE_FOLDER_RE.exec(root.uri);
  if (folderMatch?.[1]) {
    resolved.driveFolderId = folderMatch[1];
  }

  return resolved;
}

let _cachedRoots: ResolvedRoot[] | null = null;

export function getCachedRoots(): ResolvedRoot[] | null {
  return _cachedRoots;
}

export function clearRootsCache(): void {
  _cachedRoots = null;
}

async function fetchAndCacheRoots(server: RootsCapable['server']): Promise<void> {
  if (!server) return;
  try {
    const result = await server.listRoots();
    _cachedRoots = result.roots.map(parseRoot);
    logger.debug('[RootsManager] Fetched roots from client', {
      count: _cachedRoots.length,
      uris: _cachedRoots.map((r) => r.uri),
    });
  } catch (error) {
    logger.warn('[RootsManager] Failed to fetch roots from client', {
      error: error instanceof Error ? error.message : String(error),
    });
    _cachedRoots = [];
  }
}

/**
 * Register the Roots manager with the MCP server.
 * Call this after the server is connected so client capabilities are known.
 */
export async function initializeRootsManager(mcpServer: RootsCapable): Promise<void> {
  const server = mcpServer.server;
  if (!server) return;

  const clientCapabilities = server.getClientCapabilities?.();
  if (!clientCapabilities?.roots) {
    logger.debug('[RootsManager] Client does not support roots capability — skipping');
    return;
  }

  // Fetch initial roots
  await fetchAndCacheRoots(server);

  // Subscribe to roots/list_changed notifications if client supports them
  if (clientCapabilities.roots.listChanged) {
    server.setNotificationHandler(
      RootsListChangedNotificationSchema,
      (_notification: RootsListChangedNotification) => {
        logger.debug('[RootsManager] Roots list changed — refreshing');
        void fetchAndCacheRoots(server);
      }
    );
    logger.debug('[RootsManager] Subscribed to roots/list_changed notifications');
  }
}

/**
 * Get Drive folder IDs from cached roots, if any.
 * Used by sheets_core.list to scope Drive queries.
 */
export function getRootDriveFolderIds(): string[] {
  if (!_cachedRoots) return [];
  return _cachedRoots.map((r) => r.driveFolderId).filter((id): id is string => !!id);
}

/**
 * Get spreadsheet IDs from cached roots, if any.
 * Used to limit list operations to declared workspace spreadsheets.
 */
export function getRootSpreadsheetIds(): string[] {
  if (!_cachedRoots) return [];
  return _cachedRoots.map((r) => r.spreadsheetId).filter((id): id is string => !!id);
}
