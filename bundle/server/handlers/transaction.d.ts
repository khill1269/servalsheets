/**
 * ServalSheets - Transaction Handler
 *
 * Handles multi-operation transactions with atomicity and auto-rollback.
 */
import type { SheetsTransactionInput, SheetsTransactionOutput } from '../schemas/transaction.js';
export interface TransactionHandlerOptions {
}
export declare class TransactionHandler {
    constructor(_options?: TransactionHandlerOptions);
    /**
     * Apply verbosity filtering to optimize token usage (LLM optimization)
     */
    private applyVerbosityFilter;
    handle(input: SheetsTransactionInput): Promise<SheetsTransactionOutput>;
}
//# sourceMappingURL=transaction.d.ts.map