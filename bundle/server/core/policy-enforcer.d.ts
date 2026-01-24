/**
 * ServalSheets - Policy Enforcer
 *
 * Validates intents against safety policies
 * Tighten-up #2: Effect scope guards
 */
import type { Intent } from './intent.js';
import type { ErrorDetail } from '../schemas/shared.js';
export interface PolicyConfig {
    maxCellsPerOperation: number;
    maxRowsPerDelete: number;
    maxColumnsPerDelete: number;
    requireExplicitRangeForDelete: boolean;
    allowBatchDestructive: boolean;
    maxIntentsPerBatch: number;
}
export declare class PolicyViolationError extends Error {
    code: string;
    details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, details?: Record<string, unknown> | undefined);
    toErrorDetail(): ErrorDetail;
}
/**
 * Enforces safety policies on intents
 */
export declare class PolicyEnforcer {
    private config;
    constructor(config?: Partial<PolicyConfig>);
    /**
     * Validate all intents against policy
     */
    validateIntents(intents: Intent[]): Promise<void>;
    /**
     * Validate a single intent
     */
    validateIntent(intent: Intent): Promise<void>;
    /**
     * Validate delete dimension operations
     */
    private validateDeleteDimension;
    /**
     * Update policy configuration
     */
    updateConfig(config: Partial<PolicyConfig>): void;
    /**
     * Get current policy configuration
     */
    getConfig(): PolicyConfig;
}
//# sourceMappingURL=policy-enforcer.d.ts.map