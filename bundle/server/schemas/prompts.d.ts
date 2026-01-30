/**
 * ServalSheets - Prompt Schemas
 *
 * Typed argument schemas for MCP prompts.
 *
 * Note: Type annotations used to avoid TypeScript TS2589 error
 * ("Type instantiation is excessively deep") caused by MCP SDK's
 * type complexity with completable() schemas. See:
 * https://github.com/modelcontextprotocol/typescript-sdk/issues/494
 */
type PromptArgsShape = Record<string, any>;
export declare const WelcomePromptArgsSchema: PromptArgsShape;
export declare const SetupTestPromptArgsSchema: PromptArgsShape;
export declare const FirstOperationPromptArgsSchema: PromptArgsShape;
export declare const AnalyzeSpreadsheetPromptArgsSchema: PromptArgsShape;
export declare const TransformDataPromptArgsSchema: PromptArgsShape;
export declare const CreateReportPromptArgsSchema: PromptArgsShape;
export declare const CleanDataPromptArgsSchema: PromptArgsShape;
export declare const MigrateDataPromptArgsSchema: PromptArgsShape;
export declare const SetupBudgetPromptArgsSchema: PromptArgsShape;
export declare const ImportDataPromptArgsSchema: PromptArgsShape;
export declare const SetupCollaborationPromptArgsSchema: PromptArgsShape;
export declare const DiagnoseErrorsPromptArgsSchema: PromptArgsShape;
export declare const SafeOperationPromptArgsSchema: PromptArgsShape;
export declare const BulkImportPromptArgsSchema: PromptArgsShape;
export declare const UndoChangesPromptArgsSchema: PromptArgsShape;
export {};
//# sourceMappingURL=prompts.d.ts.map