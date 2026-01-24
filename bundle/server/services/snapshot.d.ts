/**
 * SnapshotService
 *
 * @purpose Creates backup copies of spreadsheets via Drive API for rollback capability in transactions
 * @category Core
 * @usage Use before destructive operations or transactions; creates Drive copy, tracks snapshot metadata, supports restore operations
 * @dependencies drive_v3, CircuitBreaker, ServiceError
 * @stateful No - stateless service; snapshot metadata stored in Drive file properties
 * @singleton No - can be instantiated per request
 *
 * @example
 * const service = new SnapshotService({ driveApi, defaultFolderId: 'folder123', maxSnapshots: 10 });
 * const snapshot = await service.create(spreadsheetId, 'Pre-transaction backup');
 * await service.restore(snapshot.copySpreadsheetId, spreadsheetId); // Rollback
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
export declare class SnapshotService {
    private driveApi;
    private defaultFolderId;
    private maxSnapshots;
    private snapshots;
    private driveCircuit;
    constructor(options: SnapshotServiceOptions);
    /**
     * Create a snapshot of a spreadsheet
     */
    create(spreadsheetId: string, name?: string): Promise<string>;
    /**
     * List snapshots for a spreadsheet
     */
    list(spreadsheetId: string): Snapshot[];
    /**
     * Get a specific snapshot
     */
    get(snapshotId: string): Snapshot | undefined;
    /**
     * Restore from a snapshot (copies snapshot content back to original)
     */
    restore(snapshotId: string): Promise<string>;
    /**
     * Delete a snapshot
     */
    delete(snapshotId: string): Promise<void>;
    /**
     * Get snapshot URL
     */
    getUrl(snapshotId: string): string | undefined;
    /**
     * Clear all in-memory snapshots (does not delete from Drive)
     */
    clearCache(): void;
}
//# sourceMappingURL=snapshot.d.ts.map