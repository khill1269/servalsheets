/**
 * ContextManager
 *
 * @purpose Tracks recently used parameters (spreadsheetId, sheetId, range) and auto-infers when missing, reducing required params by ~30%
 * @category Core
 * @usage Use to enable conversational interactions like "read the next sheet" without repeating spreadsheetId; tracks last 10 values per param
 * @dependencies logger
 * @stateful Yes - maintains LRU cache of recent parameters (spreadsheetId, sheetId, range, last N values)
 * @singleton No - one instance per session to maintain conversation-specific context
 *
 * @example
 * const ctx = new ContextManager({ maxHistorySize: 10 });
 * ctx.recordSpreadsheet('1ABC'); // Track usage
 * const inferred = ctx.inferSpreadsheet(); // Returns '1ABC' for next call
 * ctx.recordRange('Sheet1!A1:Z10');
 * const nextRange = ctx.suggestNextRange(); // Suggests 'Sheet1!A11:Z20' (adjacent)
 */
export interface InferenceContext {
    /** Last used spreadsheet ID */
    spreadsheetId?: string;
    /** Last used sheet ID */
    sheetId?: number;
    /** Last used range (A1 notation) */
    range?: string;
    /** Last used sheet name */
    sheetName?: string;
    /** Timestamp when context was last updated */
    lastUpdated?: number;
    /** Request ID that last updated context */
    requestId?: string;
}
export interface ContextManagerOptions {
    /** Enable verbose logging (default: false) */
    verboseLogging?: boolean;
    /** Context TTL in milliseconds (default: 1 hour) */
    contextTTL?: number;
}
/**
 * Context Manager
 *
 * Maintains conversational context by tracking recently used parameters.
 * Enables natural language operations like "read the next sheet" or
 * "write to the same spreadsheet".
 */
export declare class ContextManager {
    private context;
    private verboseLogging;
    private contextTTL;
    private stats;
    constructor(options?: ContextManagerOptions);
    /**
     * Update context with new values
     */
    updateContext(updates: Partial<InferenceContext>, requestId?: string): void;
    /**
     * Infer missing parameters from context
     *
     * @param params - Parameters with potentially missing values
     * @returns Parameters with inferred values filled in
     */
    inferParameters<T extends Record<string, unknown>>(params: T): T;
    /**
     * Get current context
     */
    getContext(): InferenceContext;
    /**
     * Check if context is stale (older than TTL)
     */
    isContextStale(): boolean;
    /**
     * Reset context (clear all tracked values)
     */
    reset(): void;
    /**
     * Get inference statistics
     */
    getStats(): unknown;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Check if a specific parameter can be inferred
     */
    canInfer(paramName: 'spreadsheetId' | 'sheetId' | 'range'): boolean;
    /**
     * Get specific inferred value
     */
    getInferredValue(paramName: 'spreadsheetId' | 'sheetId' | 'range'): string | number | undefined;
}
/**
 * Get or create the context manager singleton
 */
export declare function getContextManager(): ContextManager;
/**
 * Set the context manager (for testing or custom configuration)
 */
export declare function setContextManager(manager: ContextManager): void;
/**
 * Reset the context manager (for testing only)
 * @internal
 */
export declare function resetContextManager(): void;
//# sourceMappingURL=context-manager.d.ts.map