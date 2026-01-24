/**
 * ServalSheets - Safety Helpers
 *
 * Unified safety patterns for all handlers:
 * - Dry-run support
 * - Snapshot creation
 * - Confirmation requirements
 * - Safety warnings and suggestions
 */
import type { SnapshotService } from '../services/snapshot.js';
export interface SafetyOptions {
    dryRun?: boolean;
    createSnapshot?: boolean;
    requireConfirmation?: boolean;
}
export interface SafetyContext {
    affectedCells?: number;
    affectedRows?: number;
    affectedColumns?: number;
    isDestructive: boolean;
    operationType: string;
    spreadsheetId?: string;
}
export interface SafetyWarning {
    type: 'snapshot_recommended' | 'confirmation_recommended' | 'dry_run_recommended' | 'large_operation';
    message: string;
    suggestion: string;
}
export interface SnapshotResult {
    snapshotId: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
}
/**
 * Determine if operation requires confirmation based on size/risk
 */
export declare function requiresConfirmation(context: SafetyContext): boolean;
/**
 * Generate safety warnings and suggestions for operation
 */
export declare function generateSafetyWarnings(context: SafetyContext, safetyOptions?: SafetyOptions): SafetyWarning[];
/**
 * Create snapshot if requested and operation is destructive
 */
export declare function createSnapshotIfNeeded(snapshotService: SnapshotService | undefined, context: SafetyContext, safetyOptions?: SafetyOptions): Promise<SnapshotResult | null>;
/**
 * Calculate affected cells from range
 */
export declare function calculateAffectedCells(range?: string): number;
/**
 * Extract affected rows from dimension operations
 */
export declare function calculateAffectedRows(startIndex: number, count: number): number;
/**
 * Format safety warnings for response
 */
export declare function formatSafetyWarnings(warnings: SafetyWarning[]): string[];
/**
 * Check if dry-run mode should return preview
 */
export declare function shouldReturnPreview(safetyOptions?: SafetyOptions): boolean;
/**
 * Build snapshot info for response
 */
export declare function buildSnapshotInfo(snapshot: SnapshotResult | null): Record<string, unknown> | undefined;
//# sourceMappingURL=safety-helpers.d.ts.map