/**
 * ServalSheets - History Handler
 *
 * Handles operation history tracking, undo/redo functionality, and debugging.
 */
import { SnapshotService } from '../services/snapshot.js';
import type { SheetsHistoryInput, SheetsHistoryOutput } from '../schemas/history.js';
export interface HistoryHandlerOptions {
    snapshotService?: SnapshotService;
}
export declare class HistoryHandler {
    private snapshotService?;
    constructor(options?: HistoryHandlerOptions);
    /**
     * Apply verbosity filtering to optimize token usage (LLM optimization)
     */
    private applyVerbosityFilter;
    handle(input: SheetsHistoryInput): Promise<SheetsHistoryOutput>;
}
//# sourceMappingURL=history.d.ts.map