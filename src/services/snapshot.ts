/**
 * ServalSheets - Snapshot Service
 * 
 * Creates backup copies for rollback capability
 * MCP Protocol: 2025-11-25
 */

import type { drive_v3 } from 'googleapis';

export interface Snapshot {
  id: string;
  name: string;
  sourceSpreadsheetId: string;
  copySpreadsheetId: string;
  createdAt: string;
  size?: number;
}

export interface SnapshotServiceOptions {
  driveApi: drive_v3.Drive;
  defaultFolderId?: string;
  maxSnapshots?: number;
}

/**
 * Service for creating and managing spreadsheet snapshots
 */
export class SnapshotService {
  private driveApi: drive_v3.Drive;
  private defaultFolderId: string | null;
  private maxSnapshots: number;
  private snapshots: Map<string, Snapshot[]> = new Map();

  constructor(options: SnapshotServiceOptions) {
    this.driveApi = options.driveApi;
    this.defaultFolderId = options.defaultFolderId ?? null;
    this.maxSnapshots = options.maxSnapshots ?? 10;
  }

  /**
   * Create a snapshot of a spreadsheet
   */
  async create(
    spreadsheetId: string,
    name?: string
  ): Promise<string> {
    const timestamp = new Date().toISOString();
    const snapshotName = name ?? `Snapshot ${timestamp}`;

    // Build request body
    const requestBody: drive_v3.Schema$File = {
      name: snapshotName,
    };
    
    // Only add parents if we have a folder ID
    if (this.defaultFolderId) {
      requestBody.parents = [this.defaultFolderId];
    }

    // Copy the spreadsheet
    const response = await this.driveApi.files.copy({
      fileId: spreadsheetId,
      requestBody,
    });

    const copyId = response.data?.id;
    if (!copyId) {
      throw new Error('Failed to create snapshot: no file ID returned');
    }

    const snapshot: Snapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: snapshotName,
      sourceSpreadsheetId: spreadsheetId,
      copySpreadsheetId: copyId,
      createdAt: timestamp,
    };

    // Store snapshot reference
    const existing = this.snapshots.get(spreadsheetId) ?? [];
    existing.push(snapshot);
    
    // Prune old snapshots
    while (existing.length > this.maxSnapshots) {
      const oldest = existing.shift();
      if (oldest) {
        await this.delete(oldest.id).catch(() => {
          // Ignore delete errors during pruning
        });
      }
    }
    
    this.snapshots.set(spreadsheetId, existing);

    return snapshot.id;
  }

  /**
   * List snapshots for a spreadsheet
   */
  list(spreadsheetId: string): Snapshot[] {
    return this.snapshots.get(spreadsheetId) ?? [];
  }

  /**
   * Get a specific snapshot
   */
  get(snapshotId: string): Snapshot | undefined {
    for (const snapshots of this.snapshots.values()) {
      const found = snapshots.find(s => s.id === snapshotId);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Restore from a snapshot (copies snapshot content back to original)
   */
  async restore(snapshotId: string): Promise<string> {
    const snapshot = this.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    // Copy snapshot to create restored file
    const response = await this.driveApi.files.copy({
      fileId: snapshot.copySpreadsheetId,
      requestBody: {
        name: `Restored from ${snapshot.name}`,
      },
    });

    const restoredId = response.data?.id;
    if (!restoredId) {
      throw new Error('Failed to restore snapshot: no file ID returned');
    }

    return restoredId;
  }

  /**
   * Delete a snapshot
   */
  async delete(snapshotId: string): Promise<void> {
    const snapshot = this.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    // Delete the copy
    await this.driveApi.files.delete({
      fileId: snapshot.copySpreadsheetId,
    });

    // Remove from memory
    for (const [spreadsheetId, snapshots] of this.snapshots.entries()) {
      const filtered = snapshots.filter(s => s.id !== snapshotId);
      if (filtered.length !== snapshots.length) {
        this.snapshots.set(spreadsheetId, filtered);
        break;
      }
    }
  }

  /**
   * Get snapshot URL
   */
  getUrl(snapshotId: string): string | undefined {
    const snapshot = this.get(snapshotId);
    if (!snapshot) return undefined;
    return `https://docs.google.com/spreadsheets/d/${snapshot.copySpreadsheetId}`;
  }

  /**
   * Clear all in-memory snapshots (does not delete from Drive)
   */
  clearCache(): void {
    this.snapshots.clear();
  }
}
