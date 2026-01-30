/**
 * ServalSheets - Session Handler
 *
 * Handles session context management operations.
 *
 * @module handlers/session
 */
import type { SheetsSessionInput, SheetsSessionOutput } from '../schemas/session.js';
/**
 * Session handler class for lazy loading
 */
export declare class SessionHandler {
    /**
     * Apply verbosity filtering to optimize token usage (LLM optimization)
     */
    private applyVerbosityFilter;
    handle(input: SheetsSessionInput): Promise<SheetsSessionOutput>;
}
/**
 * Handle session context operations
 */
export declare function handleSheetsSession(input: SheetsSessionInput): Promise<SheetsSessionOutput>;
//# sourceMappingURL=session.d.ts.map