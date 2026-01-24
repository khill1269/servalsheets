/**
 * ServalSheets - Fast Validators
 *
 * Pre-compiled validators for ALL 16 tools (after Wave 5 consolidation).
 * These perform FAST validation (action + required fields only).
 * Full Zod validation happens in handlers for type safety.
 *
 * Purpose: Catch obvious errors early with minimal overhead.
 * Pattern: Return raw input after basic checks (handlers do full parsing)
 */
// ============================================================================
// VALIDATION ERROR
// ============================================================================
export class FastValidationError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.name = 'FastValidationError';
        this.code = code;
        this.details = details;
    }
    toErrorDetail() {
        return {
            code: 'INVALID_PARAMS',
            message: this.message,
            details: { validationCode: this.code, ...this.details },
            retryable: false,
        };
    }
}
// ============================================================================
// COMMON VALIDATORS
// ============================================================================
const SPREADSHEET_ID_REGEX = /^[a-zA-Z0-9_-]{20,100}$/;
function assertString(value, field) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new FastValidationError('MISSING_FIELD', `${field} is required and must be a non-empty string`);
    }
}
function assertSpreadsheetId(value) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new FastValidationError('MISSING_FIELD', 'spreadsheetId is required');
    }
    if (!SPREADSHEET_ID_REGEX.test(value)) {
        throw new FastValidationError('INVALID_SPREADSHEET_ID', 'Invalid spreadsheetId format', {
            hint: 'Found in URL: docs.google.com/spreadsheets/d/{ID}',
        });
    }
}
function assertArray(value, field) {
    if (!Array.isArray(value)) {
        throw new FastValidationError('MISSING_FIELD', `${field} must be an array`);
    }
}
/**
 * Assert range is provided in any valid format:
 * - String: "Sheet1!A1:B10" (A1 notation)
 * - Object: { a1: "..." } | { namedRange: "..." } | { semantic: {...} } | { grid: {...} }
 *
 * This allows both formats as documented in RangeInputSchema (shared.ts:534-538)
 */
function assertRange(value, field) {
    if (value === undefined || value === null) {
        throw new FastValidationError('MISSING_FIELD', `${field} is required`);
    }
    // Accept string format (A1 notation)
    if (typeof value === 'string') {
        if (value.length === 0) {
            throw new FastValidationError('INVALID_RANGE', `${field} must be a non-empty string or valid range object`);
        }
        return; // Valid string range
    }
    // Accept object format (a1, namedRange, semantic, grid)
    if (typeof value === 'object' && !Array.isArray(value)) {
        const obj = value;
        const hasValidKey = 'a1' in obj || 'namedRange' in obj || 'semantic' in obj || 'grid' in obj;
        if (hasValidKey) {
            return; // Valid object range - full validation happens in Zod
        }
        throw new FastValidationError('INVALID_RANGE', `${field} object must have one of: a1, namedRange, semantic, or grid`, {
            hint: 'Examples: {a1: "Sheet1!A1:B10"}, {namedRange: "MyRange"}, {semantic: {...}}, {grid: {...}}',
        });
    }
    throw new FastValidationError('INVALID_RANGE', `${field} must be a string or range object`, {
        hint: 'Examples: "Sheet1!A1:B10" or {a1: "Sheet1!A1:B10"}',
    });
}
function assertAction(value, validActions) {
    if (typeof value !== 'string') {
        throw new FastValidationError('MISSING_FIELD', 'action is required');
    }
    if (!validActions.has(value)) {
        throw new FastValidationError('INVALID_ACTION', `Unknown action: ${value}`, {
            validActions: Array.from(validActions),
        });
    }
}
// ============================================================================
// TOOL VALIDATORS
// All validators return void (assertions) - input passes through unchanged
// ============================================================================
// 1. sheets_auth
const AUTH_ACTIONS = new Set(['status', 'login', 'callback', 'logout']);
export function fastValidateAuth(input) {
    assertAction(input['action'], AUTH_ACTIONS);
    if (input['action'] === 'callback') {
        assertString(input['code'], 'code');
    }
}
// 2. sheets_core (consolidated spreadsheet + sheet)
const CORE_ACTIONS = new Set([
    'get',
    'create',
    'copy',
    'update_properties',
    'get_url',
    'batch_get',
    'get_comprehensive',
    'list',
    'add_sheet',
    'delete_sheet',
    'duplicate_sheet',
    'update_sheet',
    'copy_sheet_to',
    'list_sheets',
    'get_sheet',
]);
export function fastValidateCore(input) {
    assertAction(input['action'], CORE_ACTIONS);
    // Spreadsheet actions
    if (input['action'] === 'create') {
        // title is required
        assertString(input['title'], 'title');
        return;
    }
    if (input['action'] === 'batch_get') {
        assertArray(input['spreadsheetIds'], 'spreadsheetIds');
        return;
    }
    if (input['action'] === 'list') {
        // No required fields beyond action
        return;
    }
    // All other actions require spreadsheetId
    assertSpreadsheetId(input['spreadsheetId']);
    // Sheet actions that require sheetId
    const needsSheetId = input['action'] === 'delete_sheet' ||
        input['action'] === 'duplicate_sheet' ||
        input['action'] === 'update_sheet' ||
        input['action'] === 'copy_sheet_to' ||
        input['action'] === 'get_sheet';
    if (needsSheetId && typeof input['sheetId'] !== 'number') {
        throw new FastValidationError('MISSING_FIELD', 'sheetId is required for this action');
    }
    // add_sheet requires title
    if (input['action'] === 'add_sheet') {
        assertString(input['title'], 'title');
    }
    // copy_sheet_to requires destinationSpreadsheetId
    if (input['action'] === 'copy_sheet_to') {
        assertString(input['destinationSpreadsheetId'], 'destinationSpreadsheetId');
    }
}
// 4. sheets_data (consolidated values + cells - Wave 4)
const DATA_ACTIONS = new Set([
    'read',
    'write',
    'append',
    'clear',
    'batch_read',
    'batch_write',
    'batch_clear',
    'find_replace',
    'add_note',
    'get_note',
    'clear_note',
    'set_validation',
    'clear_validation',
    'set_hyperlink',
    'clear_hyperlink',
    'merge_cells',
    'unmerge_cells',
    'get_merges',
    'cut_paste',
    'copy_paste',
]);
export function fastValidateData(input) {
    assertAction(input['action'], DATA_ACTIONS);
    assertSpreadsheetId(input['spreadsheetId']);
    // Values actions validation
    switch (input['action']) {
        case 'read':
        case 'clear':
            assertRange(input['range'], 'range');
            break;
        case 'write':
        case 'append':
            assertRange(input['range'], 'range');
            assertArray(input['values'], 'values');
            break;
        case 'batch_read':
        case 'batch_clear':
            assertArray(input['ranges'], 'ranges');
            break;
        case 'batch_write':
            assertArray(input['data'], 'data');
            break;
        case 'find_replace':
            assertString(input['find'], 'find');
            if (input['replacement'] !== undefined) {
                assertString(input['replacement'], 'replacement');
            }
            break;
        // Cells actions validation
        case 'add_note':
        case 'get_note':
        case 'clear_note':
        case 'set_hyperlink':
        case 'clear_hyperlink':
            assertString(input['cell'], 'cell');
            break;
        case 'set_validation':
        case 'clear_validation':
            assertRange(input['range'], 'range');
            if (input['action'] === 'set_validation' && !input['validation']) {
                throw new FastValidationError('MISSING_FIELD', 'validation is required');
            }
            break;
        case 'merge_cells':
        case 'unmerge_cells':
            assertRange(input['range'], 'range');
            break;
        case 'get_merges':
            if (typeof input['sheetId'] !== 'number') {
                throw new FastValidationError('MISSING_FIELD', 'sheetId is required');
            }
            break;
        case 'cut_paste':
        case 'copy_paste':
            assertRange(input['source'], 'source');
            assertString(input['destination'], 'destination');
            break;
    }
}
// 5. sheets_format (18 actions: 10 format + 8 rules)
const FORMAT_ACTIONS = new Set([
    // Format actions (10)
    'set_format',
    'suggest_format',
    'set_background',
    'set_text_format',
    'set_number_format',
    'set_alignment',
    'set_borders',
    'clear_format',
    'apply_preset',
    'auto_fit',
    // Rules actions (8)
    'rule_add_conditional_format',
    'rule_update_conditional_format',
    'rule_delete_conditional_format',
    'rule_list_conditional_formats',
    'set_data_validation',
    'clear_data_validation',
    'list_data_validations',
    'add_conditional_format_rule',
]);
const FORMAT_ACTIONS_REQUIRE_SHEET_ID = new Set([
    'rule_add_conditional_format',
    'rule_update_conditional_format',
    'rule_delete_conditional_format',
    'rule_list_conditional_formats',
    'list_data_validations',
    'add_conditional_format_rule',
]);
const FORMAT_ACTIONS_NO_RANGE = new Set([
    'rule_update_conditional_format',
    'rule_delete_conditional_format',
    'rule_list_conditional_formats',
    'list_data_validations',
]);
export function fastValidateFormat(input) {
    assertAction(input['action'], FORMAT_ACTIONS);
    assertSpreadsheetId(input['spreadsheetId']);
    const action = input['action'];
    if (FORMAT_ACTIONS_REQUIRE_SHEET_ID.has(action) && typeof input['sheetId'] !== 'number') {
        throw new FastValidationError('MISSING_FIELD', 'sheetId is required');
    }
    if (!FORMAT_ACTIONS_NO_RANGE.has(action)) {
        assertRange(input['range'], 'range');
    }
}
// 6. sheets_dimensions (39 actions: 21 dimension + 18 filter/sort)
const DIMENSIONS_ACTIONS = new Set([
    // Dimension actions (21)
    'insert_rows',
    'insert_columns',
    'delete_rows',
    'delete_columns',
    'move_rows',
    'move_columns',
    'resize_rows',
    'resize_columns',
    'auto_resize',
    'hide_rows',
    'hide_columns',
    'show_rows',
    'show_columns',
    'freeze_rows',
    'freeze_columns',
    'group_rows',
    'group_columns',
    'ungroup_rows',
    'ungroup_columns',
    'append_rows',
    'append_columns',
    // Filter and sort actions (18)
    'set_basic_filter',
    'clear_basic_filter',
    'get_basic_filter',
    'filter_update_filter_criteria',
    'sort_range',
    'trim_whitespace',
    'randomize_range',
    'text_to_columns',
    'auto_fill',
    'create_filter_view',
    'update_filter_view',
    'delete_filter_view',
    'list_filter_views',
    'get_filter_view',
    'create_slicer',
    'update_slicer',
    'delete_slicer',
    'list_slicers',
]);
const DIMENSIONS_ACTIONS_REQUIRE_SHEET_ID = new Set([
    'insert_rows',
    'insert_columns',
    'delete_rows',
    'delete_columns',
    'move_rows',
    'move_columns',
    'resize_rows',
    'resize_columns',
    'auto_resize',
    'hide_rows',
    'hide_columns',
    'show_rows',
    'show_columns',
    'freeze_rows',
    'freeze_columns',
    'group_rows',
    'group_columns',
    'ungroup_rows',
    'ungroup_columns',
    'append_rows',
    'append_columns',
    'set_basic_filter',
    'clear_basic_filter',
    'get_basic_filter',
    'filter_update_filter_criteria',
    'create_filter_view',
    'create_slicer',
]);
export function fastValidateDimensions(input) {
    assertAction(input['action'], DIMENSIONS_ACTIONS);
    assertSpreadsheetId(input['spreadsheetId']);
    const action = input['action'];
    if (DIMENSIONS_ACTIONS_REQUIRE_SHEET_ID.has(action) && typeof input['sheetId'] !== 'number') {
        throw new FastValidationError('MISSING_FIELD', 'sheetId is required');
    }
}
// 7. sheets_visualize (consolidated charts + pivot)
const VISUALIZE_ACTIONS = new Set([
    'chart_create',
    'suggest_chart',
    'chart_update',
    'chart_delete',
    'chart_list',
    'chart_get',
    'chart_move',
    'chart_resize',
    'chart_update_data_range',
    'pivot_create',
    'suggest_pivot',
    'pivot_update',
    'pivot_delete',
    'pivot_list',
    'pivot_get',
    'pivot_refresh',
]);
export function fastValidateVisualize(input) {
    assertAction(input['action'], VISUALIZE_ACTIONS);
    assertSpreadsheetId(input['spreadsheetId']);
    // Chart actions requiring chartId
    const needsChartId = input['action'] === 'chart_update' ||
        input['action'] === 'chart_delete' ||
        input['action'] === 'chart_get' ||
        input['action'] === 'chart_move' ||
        input['action'] === 'chart_resize' ||
        input['action'] === 'chart_update_data_range';
    if (needsChartId && typeof input['chartId'] !== 'number') {
        throw new FastValidationError('MISSING_FIELD', 'chartId is required for this action');
    }
    // Pivot actions requiring sheetId
    const needsSheetId = input['action'] === 'pivot_update' ||
        input['action'] === 'pivot_delete' ||
        input['action'] === 'pivot_get' ||
        input['action'] === 'pivot_refresh';
    if (needsSheetId && typeof input['sheetId'] !== 'number') {
        throw new FastValidationError('MISSING_FIELD', 'sheetId is required for this action');
    }
    // chart_create requires specific fields
    if (input['action'] === 'chart_create') {
        if (typeof input['sheetId'] !== 'number') {
            throw new FastValidationError('MISSING_FIELD', 'sheetId is required for chart_create');
        }
        if (!input['chartType']) {
            throw new FastValidationError('MISSING_FIELD', 'chartType is required for chart_create');
        }
    }
    // pivot_create requires values array
    if (input['action'] === 'pivot_create') {
        assertArray(input['values'], 'values');
    }
}
// 8. sheets_collaborate (consolidated sharing + comments + versions)
const COLLABORATE_ACTIONS = new Set([
    'share_add',
    'share_update',
    'share_remove',
    'share_list',
    'share_get',
    'share_transfer_ownership',
    'share_set_link',
    'share_get_link',
    'comment_add',
    'comment_update',
    'comment_delete',
    'comment_list',
    'comment_get',
    'comment_resolve',
    'comment_reopen',
    'comment_add_reply',
    'comment_update_reply',
    'comment_delete_reply',
    'version_list_revisions',
    'version_get_revision',
    'version_restore_revision',
    'version_keep_revision',
    'version_create_snapshot',
    'version_list_snapshots',
    'version_restore_snapshot',
    'version_delete_snapshot',
    'version_compare',
    'version_export',
]);
export function fastValidateCollaborate(input) {
    assertAction(input['action'], COLLABORATE_ACTIONS);
    assertSpreadsheetId(input['spreadsheetId']);
    // Share actions requiring specific fields
    if (input['action'] === 'share_add') {
        assertString(input['type'], 'type');
        assertString(input['role'], 'role');
    }
    if (input['action'] === 'share_update' ||
        input['action'] === 'share_remove' ||
        input['action'] === 'share_get') {
        assertString(input['permissionId'], 'permissionId');
    }
    if (input['action'] === 'share_transfer_ownership') {
        assertString(input['newOwnerEmail'], 'newOwnerEmail');
    }
    // Comment actions requiring content or commentId
    if (input['action'] === 'comment_add') {
        assertString(input['content'], 'content');
    }
    if (input['action'] === 'comment_update' ||
        input['action'] === 'comment_delete' ||
        input['action'] === 'comment_get' ||
        input['action'] === 'comment_resolve' ||
        input['action'] === 'comment_reopen' ||
        input['action'] === 'comment_add_reply') {
        assertString(input['commentId'], 'commentId');
    }
    if (input['action'] === 'comment_update_reply' || input['action'] === 'comment_delete_reply') {
        assertString(input['commentId'], 'commentId');
        assertString(input['replyId'], 'replyId');
    }
    // Version actions requiring revisionId or snapshotId
    if (input['action'] === 'version_get_revision' ||
        input['action'] === 'version_restore_revision' ||
        input['action'] === 'version_keep_revision') {
        assertString(input['revisionId'], 'revisionId');
    }
    if (input['action'] === 'version_restore_snapshot' ||
        input['action'] === 'version_delete_snapshot') {
        assertString(input['snapshotId'], 'snapshotId');
    }
}
// 9. sheets_advanced (named ranges, protection, metadata, banding, tables)
const ADVANCED_ACTIONS = new Set([
    'add_named_range',
    'update_named_range',
    'delete_named_range',
    'list_named_ranges',
    'get_named_range',
    'add_protected_range',
    'update_protected_range',
    'delete_protected_range',
    'list_protected_ranges',
    'set_metadata',
    'get_metadata',
    'delete_metadata',
    'add_banding',
    'update_banding',
    'delete_banding',
    'list_banding',
    'create_table',
    'delete_table',
    'list_tables',
]);
export function fastValidateAdvanced(input) {
    assertAction(input['action'], ADVANCED_ACTIONS);
    assertSpreadsheetId(input['spreadsheetId']);
}
// 10. sheets_transaction
const TRANSACTION_ACTIONS = new Set(['begin', 'queue', 'commit', 'rollback', 'status', 'list']);
export function fastValidateTransaction(input) {
    assertAction(input['action'], TRANSACTION_ACTIONS);
    if (input['action'] === 'begin') {
        assertSpreadsheetId(input['spreadsheetId']);
    }
    else if (input['action'] !== 'list') {
        assertString(input['transactionId'], 'transactionId');
    }
}
// 11. sheets_quality (consolidated validation + conflict + impact)
const QUALITY_ACTIONS = new Set([
    'validate',
    'detect_conflicts',
    'resolve_conflict',
    'analyze_impact',
]);
export function fastValidateQuality(input) {
    assertAction(input['action'], QUALITY_ACTIONS);
    // Action-specific validation
    if (input['action'] === 'validate') {
        // Validate requires value
        if (input['value'] === undefined) {
            throw new FastValidationError('MISSING_FIELD', 'value is required for validate action');
        }
    }
    else if (input['action'] === 'detect_conflicts') {
        // detect_conflicts requires spreadsheetId
        assertSpreadsheetId(input['spreadsheetId']);
    }
    else if (input['action'] === 'resolve_conflict') {
        // resolve_conflict requires conflictId and strategy
        assertString(input['conflictId'], 'conflictId');
        assertString(input['strategy'], 'strategy');
    }
    else if (input['action'] === 'analyze_impact') {
        // analyze_impact requires spreadsheetId and operation
        assertSpreadsheetId(input['spreadsheetId']);
        if (!input['operation'] || typeof input['operation'] !== 'object') {
            throw new FastValidationError('MISSING_FIELD', 'operation is required for analyze_impact action');
        }
    }
}
// 12. sheets_history
const HISTORY_ACTIONS = new Set(['list', 'get', 'stats', 'undo', 'redo', 'revert_to', 'clear']);
export function fastValidateHistory(input) {
    assertAction(input['action'], HISTORY_ACTIONS);
}
// 13. sheets_confirm
const CONFIRM_ACTIONS = new Set(['request', 'get_stats']);
export function fastValidateConfirm(input) {
    assertAction(input['action'], CONFIRM_ACTIONS);
    if (input['action'] === 'request' && !input['plan']) {
        throw new FastValidationError('MISSING_FIELD', 'plan is required for request action');
    }
}
// 14. sheets_analyze (11 actions)
const ANALYZE_ACTIONS = new Set([
    'comprehensive',
    'analyze_data',
    'suggest_visualization',
    'generate_formula',
    'detect_patterns',
    'analyze_structure',
    'analyze_quality',
    'analyze_performance',
    'analyze_formulas',
    'query_natural_language',
    'explain_analysis',
]);
export function fastValidateAnalyze(input) {
    assertAction(input['action'], ANALYZE_ACTIONS);
    if (input['action'] !== 'explain_analysis') {
        assertSpreadsheetId(input['spreadsheetId']);
    }
}
// 15. sheets_fix
const FIX_ACTIONS = new Set(['fix']);
export function fastValidateFix(input) {
    assertAction(input['action'], FIX_ACTIONS);
    assertSpreadsheetId(input['spreadsheetId']);
    assertArray(input['issues'], 'issues');
}
// 16. sheets_composite
const COMPOSITE_ACTIONS = new Set(['import_csv', 'smart_append', 'bulk_update', 'deduplicate']);
export function fastValidateComposite(input) {
    assertAction(input['action'], COMPOSITE_ACTIONS);
    assertSpreadsheetId(input['spreadsheetId']);
}
// 17. sheets_session
const SESSION_ACTIONS = new Set([
    'set_active',
    'get_active',
    'get_context',
    'record_operation',
    'get_last_operation',
    'get_history',
    'find_by_reference',
    'update_preferences',
    'get_preferences',
    'set_pending',
    'get_pending',
    'clear_pending',
    'reset',
]);
export function fastValidateSession(input) {
    assertAction(input['action'], SESSION_ACTIONS);
}
// 18. sheets_templates (Tier 7 Enterprise)
const TEMPLATES_ACTIONS = new Set([
    'list',
    'get',
    'create',
    'apply',
    'update',
    'delete',
    'preview',
    'import_builtin',
]);
export function fastValidateTemplates(input) {
    assertAction(input['action'], TEMPLATES_ACTIONS);
    // Action-specific validation
    switch (input['action']) {
        case 'get':
        case 'delete':
        case 'preview':
            assertString(input['templateId'], 'templateId');
            break;
        case 'create':
            assertSpreadsheetId(input['spreadsheetId']);
            assertString(input['name'], 'name');
            break;
        case 'apply':
            assertString(input['templateId'], 'templateId');
            assertString(input['title'], 'title');
            break;
        case 'update':
            assertString(input['templateId'], 'templateId');
            break;
        case 'import_builtin':
            assertString(input['builtinName'], 'builtinName');
            break;
        // 'list' has no required fields
    }
}
// 19. sheets_bigquery (Tier 7 Enterprise)
const BIGQUERY_ACTIONS = new Set([
    'connect',
    'disconnect',
    'list_connections',
    'get_connection',
    'query',
    'preview',
    'refresh',
    'list_datasets',
    'list_tables',
    'get_table_schema',
    'export_to_bigquery',
    'import_from_bigquery',
]);
export function fastValidateBigQuery(input) {
    assertAction(input['action'], BIGQUERY_ACTIONS);
    // Action-specific validation
    switch (input['action']) {
        case 'connect':
        case 'list_connections':
            assertSpreadsheetId(input['spreadsheetId']);
            break;
        case 'disconnect':
        case 'get_connection':
        case 'refresh':
            assertSpreadsheetId(input['spreadsheetId']);
            assertString(input['dataSourceId'], 'dataSourceId');
            break;
        case 'query':
            assertString(input['projectId'], 'projectId');
            assertString(input['query'], 'query');
            break;
        case 'preview':
            assertString(input['projectId'], 'projectId');
            assertString(input['query'], 'query');
            break;
        case 'list_datasets':
            assertString(input['projectId'], 'projectId');
            break;
        case 'list_tables':
        case 'get_table_schema':
            assertString(input['projectId'], 'projectId');
            assertString(input['datasetId'], 'datasetId');
            break;
        case 'export_to_bigquery':
            assertSpreadsheetId(input['spreadsheetId']);
            assertRange(input['range'], 'range');
            // destination is a complex object, validated by Zod
            break;
        case 'import_from_bigquery':
            assertSpreadsheetId(input['spreadsheetId']);
            assertString(input['projectId'], 'projectId');
            assertString(input['query'], 'query');
            break;
    }
}
// 20. sheets_appsscript (Tier 7 Enterprise)
const APPSSCRIPT_ACTIONS = new Set([
    'create',
    'get',
    'get_content',
    'update_content',
    'create_version',
    'list_versions',
    'get_version',
    'deploy',
    'list_deployments',
    'get_deployment',
    'undeploy',
    'run',
    'list_processes',
    'get_metrics',
]);
export function fastValidateAppsScript(input) {
    assertAction(input['action'], APPSSCRIPT_ACTIONS);
    // Action-specific validation
    switch (input['action']) {
        case 'create':
            assertString(input['title'], 'title');
            break;
        case 'get':
        case 'get_content':
        case 'create_version':
        case 'list_versions':
        case 'get_metrics':
            assertString(input['scriptId'], 'scriptId');
            break;
        case 'update_content':
            assertString(input['scriptId'], 'scriptId');
            // files array validated by Zod
            break;
        case 'get_version':
            assertString(input['scriptId'], 'scriptId');
            // versionNumber validated by Zod
            break;
        case 'deploy':
        case 'list_deployments':
            assertString(input['scriptId'], 'scriptId');
            break;
        case 'get_deployment':
        case 'undeploy':
            assertString(input['scriptId'], 'scriptId');
            assertString(input['deploymentId'], 'deploymentId');
            break;
        case 'run':
            assertString(input['scriptId'], 'scriptId');
            assertString(input['functionName'], 'functionName');
            break;
        case 'list_processes':
            // scriptId is optional for list_processes
            break;
    }
}
const FAST_VALIDATORS = {
    sheets_auth: fastValidateAuth,
    sheets_core: fastValidateCore,
    sheets_data: fastValidateData,
    sheets_format: fastValidateFormat,
    sheets_dimensions: fastValidateDimensions,
    sheets_visualize: fastValidateVisualize,
    sheets_collaborate: fastValidateCollaborate,
    sheets_advanced: fastValidateAdvanced,
    sheets_transaction: fastValidateTransaction,
    sheets_quality: fastValidateQuality,
    sheets_history: fastValidateHistory,
    sheets_confirm: fastValidateConfirm,
    sheets_analyze: fastValidateAnalyze,
    sheets_fix: fastValidateFix,
    sheets_composite: fastValidateComposite,
    sheets_session: fastValidateSession,
    sheets_templates: fastValidateTemplates,
    sheets_bigquery: fastValidateBigQuery,
    sheets_appsscript: fastValidateAppsScript,
};
/**
 * Get fast validator for a tool
 */
export function getFastValidator(toolName) {
    return FAST_VALIDATORS[toolName];
}
/**
 * Fast validate input - throws FastValidationError on failure
 */
export function fastValidate(toolName, input) {
    if (!input || typeof input !== 'object') {
        throw new FastValidationError('INVALID_INPUT', 'Input must be an object');
    }
    const validator = FAST_VALIDATORS[toolName];
    if (!validator) {
        throw new FastValidationError('UNKNOWN_TOOL', `No validator for tool: ${toolName}`);
    }
    validator(input);
}
/**
 * Check if fast validator exists
 */
export function hasFastValidator(toolName) {
    return toolName in FAST_VALIDATORS;
}
//# sourceMappingURL=fast-validators.js.map