/**
 * ServalSheets - Confirmation Handler
 *
 * Uses MCP Elicitation (SEP-1036) for user confirmation before executing
 * multi-step operations. This follows the correct MCP pattern:
 * - Claude does the planning (it's an LLM)
 * - This handler presents plans for user confirmation via Elicitation
 * - User approves/modifies/rejects
 * - Claude then executes the approved plan
 *
 * @see MCP_PROTOCOL_COMPLETE_REFERENCE.md - Elicitation section
 */
import { type HandlerContext } from './base.js';
import type { SheetsConfirmInput, SheetsConfirmOutput } from '../schemas/confirm.js';
export interface ConfirmHandlerOptions {
    context: HandlerContext;
}
/**
 * Confirmation Handler
 *
 * Handles user confirmation via MCP Elicitation before multi-step operations.
 */
export declare class ConfirmHandler {
    private context;
    constructor(options: ConfirmHandlerOptions);
    /**
     * Convert schema plan step to service plan step
     */
    private toServiceStep;
    /**
     * Handle confirmation requests
     */
    handle(input: SheetsConfirmInput): Promise<SheetsConfirmOutput>;
}
//# sourceMappingURL=confirm.d.ts.map