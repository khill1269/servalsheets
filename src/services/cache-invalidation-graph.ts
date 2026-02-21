/**
 * Cache Invalidation Graph
 *
 * Implements operation-based cache invalidation rules to achieve 40-60% cache hit rate.
 * Provides selective invalidation based on the specific operation performed.
 *
 * Architecture:
 * - Read operations: No invalidation
 * - Write operations: Invalidate values:* only
 * - Format operations: Invalidate metadata:* only
 * - Structural operations: Invalidate both or all
 *
 * Pattern Syntax:
 * - '*' = Invalidate all cache entries for the spreadsheet
 * - 'metadata:*' = Invalidate all metadata cache entries
 * - 'values:*' = Invalidate all values cache entries
 * - 'properties:*' = Invalidate all properties cache entries
 *
 * @purpose Reduce cache invalidation to improve hit rate
 * @category Performance
 */

import { logger } from '../utils/logger.js';
import { TOOL_ACTIONS } from '../mcp/completions.js';

/**
 * Cache invalidation rule
 */
export interface InvalidationRule {
  /**
   * Cache key patterns to invalidate (supports wildcards)
   */
  invalidates: string[];

  /**
   * Whether to cascade invalidation to related operations
   * Used for destructive operations like delete_sheet
   */
  cascade?: boolean;
}

/**
 * Cache invalidation rules by tool.action
 */
export type InvalidationRules = Record<string, InvalidationRule>;

/**
 * Cache Invalidation Graph
 *
 * Maintains a graph of cache invalidation rules for all actions.
 * Provides methods to determine which cache keys to invalidate for a given operation.
 */
export class CacheInvalidationGraph {
  private rules: InvalidationRules;

  constructor() {
    this.rules = this.buildInvalidationRules();
  }

  /**
   * Build invalidation rules for all actions
   */
  private buildInvalidationRules(): InvalidationRules {
    const rules: InvalidationRules = {};

    // ========================================================================
    // sheets_auth (4 actions) - No cache invalidation
    // ========================================================================
    rules['sheets_auth.authorize'] = { invalidates: [] };
    rules['sheets_auth.status'] = { invalidates: [] };
    rules['sheets_auth.revoke'] = { invalidates: [] };
    rules['sheets_auth.refresh'] = { invalidates: [] };

    // ========================================================================
    // sheets_core (19 actions)
    // ========================================================================
    // Read operations
    rules['sheets_core.get'] = { invalidates: [] };
    rules['sheets_core.list'] = { invalidates: [] };
    rules['sheets_core.get_sheet'] = { invalidates: [] };
    rules['sheets_core.list_sheets'] = { invalidates: [] };

    // Write operations
    rules['sheets_core.create'] = { invalidates: [] }; // New spreadsheet, no cache yet
    rules['sheets_core.copy'] = { invalidates: [] }; // New spreadsheet, no cache yet
    rules['sheets_core.rename'] = { invalidates: ['metadata:*'] };
    rules['sheets_core.update_properties'] = { invalidates: ['metadata:*'] };

    // Sheet/tab operations
    rules['sheets_core.add_sheet'] = { invalidates: ['metadata:*'] };
    rules['sheets_core.rename_sheet'] = { invalidates: ['metadata:*'] };
    rules['sheets_core.copy_sheet'] = { invalidates: ['metadata:*'] };
    rules['sheets_core.duplicate_sheet'] = { invalidates: ['metadata:*'] };
    rules['sheets_core.move_sheet'] = { invalidates: ['metadata:*'] };
    rules['sheets_core.delete_sheet'] = { invalidates: ['*'], cascade: true };
    rules['sheets_core.update_sheet_properties'] = { invalidates: ['metadata:*'] };
    rules['sheets_core.set_tab_color'] = { invalidates: ['metadata:*'] };
    rules['sheets_core.hide_sheet'] = { invalidates: ['metadata:*'] };
    rules['sheets_core.show_sheet'] = { invalidates: ['metadata:*'] };
    rules['sheets_core.freeze_rows'] = { invalidates: ['metadata:*'] };

    // ========================================================================
    // sheets_data (18 actions)
    // ========================================================================
    // Read operations
    rules['sheets_data.read'] = { invalidates: [] };
    rules['sheets_data.batch_read'] = { invalidates: [] };
    rules['sheets_data.read_metadata'] = { invalidates: [] };
    rules['sheets_data.search'] = { invalidates: [] };

    // Write operations
    rules['sheets_data.write'] = { invalidates: ['values:*'] };
    rules['sheets_data.batch_write'] = { invalidates: ['values:*'] };
    rules['sheets_data.append'] = { invalidates: ['values:*'] };
    rules['sheets_data.update'] = { invalidates: ['values:*'] };
    rules['sheets_data.clear'] = { invalidates: ['values:*'] };
    rules['sheets_data.batch_clear'] = { invalidates: ['values:*'] };

    // Cell operations
    rules['sheets_data.set_note'] = { invalidates: ['metadata:*'] }; // Notes are metadata
    rules['sheets_data.clear_note'] = { invalidates: ['metadata:*'] };
    rules['sheets_data.set_hyperlink'] = { invalidates: ['values:*'] }; // Hyperlinks affect cell values
    rules['sheets_data.clear_hyperlink'] = { invalidates: ['values:*'] };

    // Find/replace operations
    rules['sheets_data.find_replace'] = { invalidates: ['values:*'] };

    // Clipboard operations
    rules['sheets_data.cut'] = { invalidates: ['values:*', 'metadata:*'] };
    rules['sheets_data.copy_range'] = { invalidates: [] }; // Read-only
    rules['sheets_data.paste'] = { invalidates: ['values:*', 'metadata:*'] };

    // ========================================================================
    // sheets_format (22 actions)
    // ========================================================================
    // Format operations
    rules['sheets_format.update_format'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.set_format'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.clear_format'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.batch_format'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.set_background'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.set_text_color'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.set_bold'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.set_italic'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.set_borders'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.set_number_format'] = { invalidates: ['metadata:*'] };

    // Sparklines
    rules['sheets_format.create_sparkline'] = { invalidates: ['values:*', 'metadata:*'] };
    rules['sheets_format.update_sparkline'] = { invalidates: ['values:*', 'metadata:*'] };
    rules['sheets_format.delete_sparkline'] = { invalidates: ['values:*', 'metadata:*'] };

    // Conditional formatting rules
    rules['sheets_format.add_rule'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.update_rule'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.delete_rule'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.list_rules'] = { invalidates: [] }; // Read-only
    rules['sheets_format.clear_rules'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.reorder_rules'] = { invalidates: ['metadata:*'] };

    // Data validation
    rules['sheets_format.set_validation'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.clear_validation'] = { invalidates: ['metadata:*'] };
    rules['sheets_format.get_validation'] = { invalidates: [] }; // Read-only

    // ========================================================================
    // sheets_dimensions (28 actions)
    // ========================================================================
    // Read operations
    rules['sheets_dimensions.get_dimensions'] = { invalidates: [] };
    rules['sheets_dimensions.get_row_count'] = { invalidates: [] };
    rules['sheets_dimensions.get_column_count'] = { invalidates: [] };

    // Row operations
    rules['sheets_dimensions.insert_rows'] = { invalidates: ['values:*', 'metadata:*'] };
    rules['sheets_dimensions.delete_rows'] = {
      invalidates: ['values:*', 'metadata:*'],
      cascade: true,
    };
    rules['sheets_dimensions.append_rows'] = { invalidates: ['values:*', 'metadata:*'] };
    rules['sheets_dimensions.resize_rows'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.auto_resize_rows'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.hide_rows'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.show_rows'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.set_row_height'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.get_row_height'] = { invalidates: [] };

    // Column operations
    rules['sheets_dimensions.insert_columns'] = { invalidates: ['values:*', 'metadata:*'] };
    rules['sheets_dimensions.delete_columns'] = {
      invalidates: ['values:*', 'metadata:*'],
      cascade: true,
    };
    rules['sheets_dimensions.append_columns'] = { invalidates: ['values:*', 'metadata:*'] };
    rules['sheets_dimensions.resize_columns'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.auto_resize_columns'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.hide_columns'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.show_columns'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.set_column_width'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.get_column_width'] = { invalidates: [] };

    // Group operations
    rules['sheets_dimensions.group_rows'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.group_columns'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.ungroup_rows'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.ungroup_columns'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.collapse_group'] = { invalidates: ['metadata:*'] };
    rules['sheets_dimensions.expand_group'] = { invalidates: ['metadata:*'] };

    // Move operations
    rules['sheets_dimensions.move_rows'] = { invalidates: ['values:*', 'metadata:*'] };
    rules['sheets_dimensions.move_columns'] = { invalidates: ['values:*', 'metadata:*'] };

    // ========================================================================
    // sheets_visualize (18 actions)
    // ========================================================================
    // Chart operations
    rules['sheets_visualize.create_chart'] = { invalidates: ['metadata:*'] };
    rules['sheets_visualize.update_chart'] = { invalidates: ['metadata:*'] };
    rules['sheets_visualize.delete_chart'] = { invalidates: ['metadata:*'] };
    rules['sheets_visualize.list_charts'] = { invalidates: [] };
    rules['sheets_visualize.get_chart'] = { invalidates: [] };
    rules['sheets_visualize.move_chart'] = { invalidates: ['metadata:*'] };
    rules['sheets_visualize.resize_chart'] = { invalidates: ['metadata:*'] };

    // Pivot table operations
    rules['sheets_visualize.create_pivot'] = { invalidates: ['metadata:*'] };
    rules['sheets_visualize.update_pivot'] = { invalidates: ['metadata:*'] };
    rules['sheets_visualize.delete_pivot'] = { invalidates: ['metadata:*'] };
    rules['sheets_visualize.list_pivots'] = { invalidates: [] };
    rules['sheets_visualize.get_pivot'] = { invalidates: [] };
    rules['sheets_visualize.refresh_pivot'] = { invalidates: ['values:*'] }; // Refreshes computed values

    // Slicer operations
    rules['sheets_visualize.create_slicer'] = { invalidates: ['metadata:*'] };
    rules['sheets_visualize.update_slicer'] = { invalidates: ['metadata:*'] };
    rules['sheets_visualize.delete_slicer'] = { invalidates: ['metadata:*'] };
    rules['sheets_visualize.list_slicers'] = { invalidates: [] };
    rules['sheets_visualize.get_slicer'] = { invalidates: [] };

    // ========================================================================
    // sheets_collaborate (35 actions)
    // ========================================================================
    // Sharing operations (don't affect cache)
    rules['sheets_collaborate.share'] = { invalidates: [] };
    rules['sheets_collaborate.unshare'] = { invalidates: [] };
    rules['sheets_collaborate.list_permissions'] = { invalidates: [] };
    rules['sheets_collaborate.update_permission'] = { invalidates: [] };
    rules['sheets_collaborate.delete_permission'] = { invalidates: [] };

    // Comment operations (separate from spreadsheet data)
    rules['sheets_collaborate.add_comment'] = { invalidates: [] };
    rules['sheets_collaborate.update_comment'] = { invalidates: [] };
    rules['sheets_collaborate.delete_comment'] = { invalidates: [] };
    rules['sheets_collaborate.list_comments'] = { invalidates: [] };
    rules['sheets_collaborate.reply_comment'] = { invalidates: [] };
    rules['sheets_collaborate.resolve_comment'] = { invalidates: [] };
    rules['sheets_collaborate.unresolve_comment'] = { invalidates: [] };

    // Version operations (read-only)
    rules['sheets_collaborate.list_versions'] = { invalidates: [] };
    rules['sheets_collaborate.get_version'] = { invalidates: [] };
    rules['sheets_collaborate.restore_version'] = { invalidates: ['*'], cascade: true };

    // Protection operations
    rules['sheets_collaborate.protect_range'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.unprotect_range'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.protect_sheet'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.unprotect_sheet'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.list_protected_ranges'] = { invalidates: [] };

    // Named range operations
    rules['sheets_collaborate.create_named_range'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.update_named_range'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.delete_named_range'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.list_named_ranges'] = { invalidates: [] };

    // Developer metadata operations
    rules['sheets_collaborate.set_metadata'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.get_metadata'] = { invalidates: [] };
    rules['sheets_collaborate.delete_metadata'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.search_metadata'] = { invalidates: [] };

    // Filter view operations
    rules['sheets_collaborate.create_filter_view'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.update_filter_view'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.delete_filter_view'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.list_filter_views'] = { invalidates: [] };

    // Banding operations
    rules['sheets_collaborate.add_banding'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.update_banding'] = { invalidates: ['metadata:*'] };
    rules['sheets_collaborate.delete_banding'] = { invalidates: ['metadata:*'] };

    // ========================================================================
    // sheets_advanced (26 actions)
    // ========================================================================
    // Sort operations
    rules['sheets_advanced.sort_range'] = { invalidates: ['values:*'] };
    rules['sheets_advanced.sort_sheet'] = { invalidates: ['values:*'] };

    // Filter operations (read-only)
    rules['sheets_advanced.filter'] = { invalidates: [] };
    rules['sheets_advanced.create_filter'] = { invalidates: ['metadata:*'] };
    rules['sheets_advanced.update_filter'] = { invalidates: ['metadata:*'] };
    rules['sheets_advanced.delete_filter'] = { invalidates: ['metadata:*'] };

    // Merge operations
    rules['sheets_advanced.merge_cells'] = { invalidates: ['values:*', 'metadata:*'] };
    rules['sheets_advanced.unmerge_cells'] = { invalidates: ['values:*', 'metadata:*'] };

    // Text operations
    rules['sheets_advanced.trim_whitespace'] = { invalidates: ['values:*'] };
    rules['sheets_advanced.remove_duplicates'] = { invalidates: ['values:*'] };

    // Formula operations
    rules['sheets_advanced.array_formula'] = { invalidates: ['values:*'] };
    rules['sheets_advanced.named_formula'] = { invalidates: ['metadata:*'] };
    rules['sheets_advanced.evaluate_formula'] = { invalidates: [] }; // Read-only

    // Data source operations
    rules['sheets_advanced.create_data_source'] = { invalidates: ['metadata:*'] };
    rules['sheets_advanced.update_data_source'] = { invalidates: ['metadata:*'] };
    rules['sheets_advanced.delete_data_source'] = { invalidates: ['metadata:*'] };
    rules['sheets_advanced.refresh_data_source'] = { invalidates: ['values:*'] };

    // Import operations
    rules['sheets_advanced.import_range'] = { invalidates: ['values:*'] };
    rules['sheets_advanced.import_data'] = { invalidates: ['values:*'] };

    // Randomize operations
    rules['sheets_advanced.randomize_range'] = { invalidates: ['values:*'] };

    // Text to columns
    rules['sheets_advanced.text_to_columns'] = { invalidates: ['values:*', 'metadata:*'] };

    // Auto-fill
    rules['sheets_advanced.auto_fill'] = { invalidates: ['values:*'] };

    // Unique values
    rules['sheets_advanced.unique_values'] = { invalidates: [] }; // Read-only

    // Custom functions
    rules['sheets_advanced.register_function'] = { invalidates: ['metadata:*'] };
    rules['sheets_advanced.unregister_function'] = { invalidates: ['metadata:*'] };
    rules['sheets_advanced.list_functions'] = { invalidates: [] };

    // New table/chips actions added in Wave 5 consolidation (sheets_advanced: 26→31)
    rules['sheets_advanced.create_table'] = { invalidates: ['metadata:*'] };
    rules['sheets_advanced.delete_table'] = { invalidates: ['metadata:*'] };
    rules['sheets_advanced.update_table'] = { invalidates: ['metadata:*'] };
    rules['sheets_advanced.rename_table_column'] = { invalidates: ['metadata:*'] };
    rules['sheets_advanced.set_table_column_properties'] = { invalidates: ['metadata:*'] };

    // New dynamic array action added to sheets_data (sheets_data: 18→19)
    rules['sheets_data.detect_spill_ranges'] = { invalidates: [] }; // Read-only

    // ========================================================================
    // sheets_transaction (6 actions)
    // ========================================================================
    rules['sheets_transaction.begin'] = { invalidates: [] };
    rules['sheets_transaction.commit'] = { invalidates: ['*'], cascade: true }; // Safe invalidation
    rules['sheets_transaction.rollback'] = { invalidates: [] }; // No changes applied
    rules['sheets_transaction.get_status'] = { invalidates: [] };
    rules['sheets_transaction.list_active'] = { invalidates: [] };
    rules['sheets_transaction.cancel'] = { invalidates: [] };

    // ========================================================================
    // sheets_quality (4 actions)
    // ========================================================================
    rules['sheets_quality.validate'] = { invalidates: [] }; // Read-only
    rules['sheets_quality.check_errors'] = { invalidates: [] }; // Read-only
    rules['sheets_quality.get_stats'] = { invalidates: [] }; // Read-only
    rules['sheets_quality.optimize'] = { invalidates: ['values:*', 'metadata:*'] }; // Can modify data

    // ========================================================================
    // sheets_history (7 actions)
    // ========================================================================
    rules['sheets_history.get_history'] = { invalidates: [] };
    rules['sheets_history.list_operations'] = { invalidates: [] };
    rules['sheets_history.undo'] = { invalidates: ['*'], cascade: true };
    rules['sheets_history.redo'] = { invalidates: ['*'], cascade: true };
    rules['sheets_history.clear_history'] = { invalidates: [] }; // Only affects history, not data
    rules['sheets_history.get_checkpoint'] = { invalidates: [] };
    rules['sheets_history.restore_checkpoint'] = { invalidates: ['*'], cascade: true };

    // ========================================================================
    // sheets_confirm (5 actions) - Read-only
    // ========================================================================
    rules['sheets_confirm.confirm'] = { invalidates: [] };
    rules['sheets_confirm.preview'] = { invalidates: [] };
    rules['sheets_confirm.validate_input'] = { invalidates: [] };
    rules['sheets_confirm.show_options'] = { invalidates: [] };
    rules['sheets_confirm.get_confirmation_status'] = { invalidates: [] };

    // ========================================================================
    // sheets_analyze (16 actions) - Read-only
    // ========================================================================
    rules['sheets_analyze.summarize'] = { invalidates: [] };
    rules['sheets_analyze.detect_patterns'] = { invalidates: [] };
    rules['sheets_analyze.suggest_formula'] = { invalidates: [] };
    rules['sheets_analyze.explain_formula'] = { invalidates: [] };
    rules['sheets_analyze.calculate_stats'] = { invalidates: [] };
    rules['sheets_analyze.detect_anomalies'] = { invalidates: [] };
    rules['sheets_analyze.suggest_chart'] = { invalidates: [] };
    rules['sheets_analyze.suggest_pivot'] = { invalidates: [] };
    rules['sheets_analyze.detect_duplicates'] = { invalidates: [] };
    rules['sheets_analyze.suggest_cleanup'] = { invalidates: [] };
    rules['sheets_analyze.detect_trends'] = { invalidates: [] };
    rules['sheets_analyze.forecast'] = { invalidates: [] };
    rules['sheets_analyze.correlation_analysis'] = { invalidates: [] };
    rules['sheets_analyze.outlier_detection'] = { invalidates: [] };
    rules['sheets_analyze.suggest_formatting'] = { invalidates: [] };
    rules['sheets_analyze.data_quality_report'] = { invalidates: [] };

    // ========================================================================
    // sheets_fix (1 action)
    // ========================================================================
    rules['sheets_fix.auto_fix'] = { invalidates: ['*'], cascade: true }; // Can fix any issue

    // ========================================================================
    // sheets_composite (10 actions)
    // ========================================================================
    rules['sheets_composite.create_dashboard'] = { invalidates: ['*'] }; // Creates multiple elements
    rules['sheets_composite.create_report'] = { invalidates: ['*'] };
    rules['sheets_composite.create_form'] = { invalidates: ['*'] };
    rules['sheets_composite.bulk_import'] = { invalidates: ['values:*', 'metadata:*'] };
    rules['sheets_composite.bulk_export'] = { invalidates: [] }; // Read-only
    rules['sheets_composite.batch_operations'] = { invalidates: ['*'], cascade: true }; // Multiple operations
    rules['sheets_composite.clone_structure'] = { invalidates: ['metadata:*'] };
    rules['sheets_composite.apply_template'] = { invalidates: ['*'] };
    rules['sheets_composite.migrate_data'] = { invalidates: ['values:*', 'metadata:*'] };
    rules['sheets_composite.sync_sheets'] = { invalidates: ['values:*', 'metadata:*'] };

    // ========================================================================
    // sheets_session (26 actions) - No cache invalidation
    // ========================================================================
    rules['sheets_session.init'] = { invalidates: [] };
    rules['sheets_session.set_context'] = { invalidates: [] };
    rules['sheets_session.get_context'] = { invalidates: [] };
    rules['sheets_session.clear_context'] = { invalidates: [] };
    rules['sheets_session.set_preferences'] = { invalidates: [] };
    rules['sheets_session.get_preferences'] = { invalidates: [] };
    rules['sheets_session.add_to_history'] = { invalidates: [] };
    rules['sheets_session.get_history'] = { invalidates: [] };
    rules['sheets_session.clear_history'] = { invalidates: [] };
    rules['sheets_session.set_goal'] = { invalidates: [] };
    rules['sheets_session.get_goal'] = { invalidates: [] };
    rules['sheets_session.update_state'] = { invalidates: [] };
    rules['sheets_session.get_state'] = { invalidates: [] };
    rules['sheets_session.add_memory'] = { invalidates: [] };
    rules['sheets_session.get_memory'] = { invalidates: [] };
    rules['sheets_session.clear_memory'] = { invalidates: [] };
    rules['sheets_session.set_active_sheet'] = { invalidates: [] };
    rules['sheets_session.get_active_sheet'] = { invalidates: [] };
    rules['sheets_session.add_bookmark'] = { invalidates: [] };
    rules['sheets_session.list_bookmarks'] = { invalidates: [] };
    rules['sheets_session.delete_bookmark'] = { invalidates: [] };
    rules['sheets_session.set_variable'] = { invalidates: [] };
    rules['sheets_session.get_variable'] = { invalidates: [] };
    rules['sheets_session.list_variables'] = { invalidates: [] };
    rules['sheets_session.delete_variable'] = { invalidates: [] };
    rules['sheets_session.end'] = { invalidates: [] };

    // ========================================================================
    // sheets_templates (8 actions)
    // ========================================================================
    rules['sheets_templates.list'] = { invalidates: [] };
    rules['sheets_templates.get'] = { invalidates: [] };
    rules['sheets_templates.apply'] = { invalidates: ['*'] }; // Applies template to spreadsheet
    rules['sheets_templates.create'] = { invalidates: [] }; // Creates new template, doesn't affect spreadsheet
    rules['sheets_templates.update'] = { invalidates: [] }; // Updates template, doesn't affect spreadsheet
    rules['sheets_templates.delete'] = { invalidates: [] }; // Deletes template, doesn't affect spreadsheet
    rules['sheets_templates.preview'] = { invalidates: [] };
    rules['sheets_templates.validate'] = { invalidates: [] };

    // ========================================================================
    // sheets_bigquery (14 actions)
    // ========================================================================
    rules['sheets_bigquery.connect'] = { invalidates: ['metadata:*'] };
    rules['sheets_bigquery.disconnect'] = { invalidates: ['metadata:*'] };
    rules['sheets_bigquery.list_connections'] = { invalidates: [] };
    rules['sheets_bigquery.query'] = { invalidates: ['values:*'] }; // Populates sheet with results
    rules['sheets_bigquery.refresh'] = { invalidates: ['values:*'] };
    rules['sheets_bigquery.schedule_refresh'] = { invalidates: ['metadata:*'] };
    rules['sheets_bigquery.cancel_refresh'] = { invalidates: ['metadata:*'] };
    rules['sheets_bigquery.get_schema'] = { invalidates: [] };
    rules['sheets_bigquery.list_tables'] = { invalidates: [] };
    rules['sheets_bigquery.list_datasets'] = { invalidates: [] };
    rules['sheets_bigquery.export_to_bigquery'] = { invalidates: [] }; // Exports to BQ, doesn't affect sheet
    rules['sheets_bigquery.sync_with_bigquery'] = { invalidates: ['values:*'] };
    rules['sheets_bigquery.get_sync_status'] = { invalidates: [] };
    rules['sheets_bigquery.configure_sync'] = { invalidates: ['metadata:*'] };

    // ========================================================================
    // sheets_appsscript (14 actions)
    // ========================================================================
    rules['sheets_appsscript.create'] = { invalidates: ['metadata:*'] };
    rules['sheets_appsscript.get'] = { invalidates: [] };
    rules['sheets_appsscript.get_content'] = { invalidates: [] };
    rules['sheets_appsscript.update_content'] = { invalidates: ['metadata:*', 'values:*'] };
    rules['sheets_appsscript.create_version'] = { invalidates: ['metadata:*'] };
    rules['sheets_appsscript.list_versions'] = { invalidates: [] };
    rules['sheets_appsscript.get_version'] = { invalidates: [] };
    rules['sheets_appsscript.deploy'] = { invalidates: ['metadata:*'] };
    rules['sheets_appsscript.list_deployments'] = { invalidates: [] };
    rules['sheets_appsscript.get_deployment'] = { invalidates: [] };
    rules['sheets_appsscript.undeploy'] = { invalidates: ['metadata:*'] };
    rules['sheets_appsscript.run'] = { invalidates: ['*'], cascade: true }; // Can modify anything
    rules['sheets_appsscript.list_processes'] = { invalidates: [] };
    rules['sheets_appsscript.get_metrics'] = { invalidates: [] };

    // ========================================================================
    // sheets_webhook (6 actions)
    // ========================================================================
    rules['sheets_webhook.register'] = { invalidates: [] }; // External registration
    rules['sheets_webhook.unregister'] = { invalidates: [] };
    rules['sheets_webhook.list'] = { invalidates: [] };
    rules['sheets_webhook.get'] = { invalidates: [] };
    rules['sheets_webhook.test'] = { invalidates: [] };
    rules['sheets_webhook.get_events'] = { invalidates: [] };

    // ========================================================================
    // sheets_dependencies (7 actions) - Read-only
    // ========================================================================
    rules['sheets_dependencies.analyze'] = { invalidates: [] };
    rules['sheets_dependencies.get_dependents'] = { invalidates: [] };
    rules['sheets_dependencies.get_precedents'] = { invalidates: [] };
    rules['sheets_dependencies.trace_formula'] = { invalidates: [] };
    rules['sheets_dependencies.detect_circular'] = { invalidates: [] };
    rules['sheets_dependencies.get_calculation_order'] = { invalidates: [] };
    rules['sheets_dependencies.export_graph'] = { invalidates: [] };

    // ========================================================================
    // sheets_federation (4 actions) - No cache invalidation
    // ========================================================================
    rules['sheets_federation.register_server'] = { invalidates: [] };
    rules['sheets_federation.unregister_server'] = { invalidates: [] };
    rules['sheets_federation.list_servers'] = { invalidates: [] };
    rules['sheets_federation.call_remote'] = { invalidates: [] };

    // ========================================================================
    // Auto-generate rules for any schema actions not manually defined above.
    // This ensures the graph stays in sync as new actions are added to schemas.
    // Default: read-like actions (get/list/status/check) → no invalidation,
    //          write-like actions → invalidate values and metadata.
    // ========================================================================
    const READ_PREFIXES = [
      'get',
      'list',
      'read',
      'search',
      'detect',
      'analyze',
      'check',
      'suggest',
      'explain',
      'status',
      'preview',
      'validate',
      'find',
      'query',
      'export',
      'scout',
      'forecast',
      'comprehensive',
      'drill',
    ];

    for (const [tool, actions] of Object.entries(TOOL_ACTIONS)) {
      for (const action of actions) {
        const key = `${tool}.${action}`;
        if (!rules[key]) {
          // Determine if this is a read or write operation based on action name prefix
          const isRead = READ_PREFIXES.some(
            (prefix) => action === prefix || action.startsWith(`${prefix}_`)
          );
          rules[key] = { invalidates: isRead ? [] : ['values:*', 'metadata:*'] };
        }
      }
    }

    return rules;
  }

  /**
   * Get invalidation patterns for a specific operation
   *
   * @param tool - Tool name (e.g., 'sheets_data')
   * @param action - Action name (e.g., 'write')
   * @returns Array of cache key patterns to invalidate
   */
  getInvalidationKeys(tool: string, action: string): string[] {
    const key = `${tool}.${action}`;
    const rule = this.rules[key];

    if (!rule) {
      // Unknown operation - invalidate everything to be safe
      logger.warn('Unknown operation, invalidating all cache', { tool, action });
      return ['*'];
    }

    return rule.invalidates;
  }

  /**
   * Check if operation should cascade invalidation
   *
   * @param tool - Tool name
   * @param action - Action name
   * @returns True if cascade is enabled
   */
  shouldCascade(tool: string, action: string): boolean {
    const key = `${tool}.${action}`;
    const rule = this.rules[key];
    return rule?.cascade ?? false;
  }

  /**
   * Get all cache keys that match the invalidation patterns
   *
   * @param tool - Tool name
   * @param action - Action name
   * @param allKeys - All cache keys for the spreadsheet
   * @returns Array of cache keys to invalidate
   */
  getKeysToInvalidate(tool: string, action: string, allKeys: string[]): string[] {
    const patterns = this.getInvalidationKeys(tool, action);

    if (patterns.length === 0) {
      return [];
    }

    // Full wildcard - invalidate everything
    if (patterns.includes('*')) {
      return allKeys;
    }

    const keysToInvalidate: string[] = [];

    for (const key of allKeys) {
      for (const pattern of patterns) {
        if (this.matchesPattern(key, pattern)) {
          keysToInvalidate.push(key);
          break; // Key matched, no need to check other patterns
        }
      }
    }

    return keysToInvalidate;
  }

  /**
   * Check if a cache key matches an invalidation pattern
   *
   * @param key - Cache key (e.g., 'spreadsheet123:values:Sheet1!A1:B10')
   * @param pattern - Invalidation pattern (e.g., 'values:*')
   * @returns True if key matches pattern
   */
  private matchesPattern(key: string, pattern: string): boolean {
    // Full wildcard
    if (pattern === '*') {
      return true;
    }

    // Extract endpoint from cache key (format: spreadsheetId:endpoint[:...])
    const parts = key.split(':');
    if (parts.length < 2) {
      return false;
    }

    const endpoint = parts[1];

    // Pattern format: 'endpoint:*' or 'endpoint'
    if (pattern.endsWith(':*')) {
      const patternEndpoint = pattern.substring(0, pattern.length - 2);
      return endpoint === patternEndpoint;
    }

    // Exact match
    return key === pattern;
  }

  /**
   * Get all invalidation rules
   *
   * @returns All invalidation rules
   */
  getAllRules(): InvalidationRules {
    return this.rules;
  }
}

// Singleton instance
let instance: CacheInvalidationGraph | null = null;

/**
 * Get cache invalidation graph singleton
 */
export function getCacheInvalidationGraph(): CacheInvalidationGraph {
  if (!instance) {
    instance = new CacheInvalidationGraph();
  }
  return instance;
}

/**
 * Reset cache invalidation graph (for testing)
 */
export function resetCacheInvalidationGraph(): void {
  instance = null;
}
