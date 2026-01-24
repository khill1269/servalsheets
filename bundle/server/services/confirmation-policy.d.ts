/**
 * ConfirmationPolicy
 *
 * @purpose Defines rules for when Claude must request user confirmation via sheets_confirm (destructive ops, bulk ops, permission changes)
 * @category Quality
 * @usage Read by AI to determine confirmation requirements; provides policy rules, risk assessment, confirmation message templates
 * @dependencies None - pure policy definition
 * @stateful No - stateless policy rules
 * @singleton No - exported as const configuration
 *
 * @example
 * import { CONFIRMATION_POLICY } from './confirmation-policy.js';
 * const requiresConfirmation = CONFIRMATION_POLICY.shouldConfirm(operation);
 * if (requiresConfirmation) await confirmService.request(operation, CONFIRMATION_POLICY.getMessage(operation));
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export interface OperationRisk {
    /** Risk level */
    level: RiskLevel;
    /** Why this risk level */
    reason: string;
    /** Should Claude confirm? */
    requiresConfirmation: boolean;
    /** Specific warning message */
    warning?: string;
}
export interface OperationAnalysis {
    /** Tool being used */
    tool: string;
    /** Action within tool */
    action: string;
    /** Estimated cells affected */
    cellsAffected: number;
    /** Is this destructive? */
    isDestructive: boolean;
    /** Can this be undone? */
    canUndo: boolean;
    /** Risk assessment */
    risk: OperationRisk;
    /** Suggested safety options */
    suggestedSafety: {
        dryRun: boolean;
        createSnapshot: boolean;
    };
}
/**
 * Thresholds that trigger confirmation requirements
 */
export declare const CONFIRMATION_THRESHOLDS: {
    /** Cell count thresholds */
    readonly cells: {
        /** Low risk threshold - below this, no confirmation needed */
        readonly low: 50;
        /** Medium risk - suggest confirmation */
        readonly medium: 100;
        /** High risk - require confirmation */
        readonly high: 500;
        /** Critical - always require confirmation + snapshot */
        readonly critical: 1000;
    };
    /** Row/column thresholds for delete operations */
    readonly delete: {
        /** Rows - always confirm deletion of more than this */
        readonly rows: 10;
        /** Columns - always confirm deletion of more than this */
        readonly columns: 3;
        /** Sheets - always confirm sheet deletion */
        readonly sheets: 1;
    };
    /** Multi-step operation thresholds */
    readonly operations: {
        /** Number of steps that triggers confirmation */
        readonly steps: 3;
        /** Number of API calls that triggers confirmation */
        readonly apiCalls: 5;
    };
};
/**
 * Analyze an operation and determine its risk level
 */
export declare function analyzeOperation(params: {
    tool: string;
    action: string;
    spreadsheetId?: string;
    range?: string;
    cellCount?: number;
    rowCount?: number;
    columnCount?: number;
    values?: unknown[][];
}): OperationAnalysis;
/**
 * Analyze a multi-step operation plan
 */
export declare function analyzeOperationPlan(steps: Array<{
    tool: string;
    action: string;
    cellCount?: number;
}>): {
    totalRisk: RiskLevel;
    requiresConfirmation: boolean;
    highestRiskStep: number;
    summary: string;
};
/**
 * Should Claude confirm this operation?
 *
 * Call this before any write operation to determine if confirmation is needed.
 */
export declare function shouldConfirm(params: {
    tool: string;
    action: string;
    cellCount?: number;
    rowCount?: number;
    columnCount?: number;
    userPreference?: 'always' | 'destructive' | 'never';
}): {
    confirm: boolean;
    reason: string;
    suggestDryRun: boolean;
    suggestSnapshot: boolean;
};
/**
 * Generate guidance text for Claude about when to confirm
 */
export declare function getConfirmationGuidance(): string;
export declare const ConfirmationPolicy: {
    CONFIRMATION_THRESHOLDS: {
        /** Cell count thresholds */
        readonly cells: {
            /** Low risk threshold - below this, no confirmation needed */
            readonly low: 50;
            /** Medium risk - suggest confirmation */
            readonly medium: 100;
            /** High risk - require confirmation */
            readonly high: 500;
            /** Critical - always require confirmation + snapshot */
            readonly critical: 1000;
        };
        /** Row/column thresholds for delete operations */
        readonly delete: {
            /** Rows - always confirm deletion of more than this */
            readonly rows: 10;
            /** Columns - always confirm deletion of more than this */
            readonly columns: 3;
            /** Sheets - always confirm sheet deletion */
            readonly sheets: 1;
        };
        /** Multi-step operation thresholds */
        readonly operations: {
            /** Number of steps that triggers confirmation */
            readonly steps: 3;
            /** Number of API calls that triggers confirmation */
            readonly apiCalls: 5;
        };
    };
    DESTRUCTIVE_OPERATIONS: Set<string>;
    MODIFYING_OPERATIONS: Set<string>;
    READONLY_OPERATIONS: Set<string>;
    analyzeOperation: typeof analyzeOperation;
    analyzeOperationPlan: typeof analyzeOperationPlan;
    shouldConfirm: typeof shouldConfirm;
    getConfirmationGuidance: typeof getConfirmationGuidance;
};
//# sourceMappingURL=confirmation-policy.d.ts.map