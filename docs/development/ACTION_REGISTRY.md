# ServalSheets — Action Registry (391 Actions, 25 Tools)

> Complete action list by tool. Source of truth for counts: `src/schemas/action-counts.ts`.
> Load this file only when working on actions, adding features, or verifying action names.
> Updated: Session 52, 2026-03-02.

## sheets_auth (4) — Standalone

`status`, `login`, `callback`, `logout`

## sheets_core (19) — BaseHandler

`get`, `create`, `copy`, `update_properties`, `get_url`, `batch_get`, `get_comprehensive`,
`list`, `add_sheet`, `delete_sheet`, `duplicate_sheet`, `update_sheet`, `copy_sheet_to`,
`list_sheets`, `get_sheet`, `batch_delete_sheets`, `batch_update_sheets`, `clear_sheet`, `move_sheet`

## sheets_data (23) — BaseHandler

`read`, `write`, `append`, `clear`, `batch_read`, `batch_write`, `batch_clear`, `find_replace`,
`add_note`, `get_note`, `clear_note`, `set_hyperlink`, `clear_hyperlink`, `merge_cells`,
`unmerge_cells`, `get_merges`, `cut_paste`, `copy_paste`, `detect_spill_ranges`,
`cross_read`, `cross_query`, `cross_write`, `cross_compare`

## sheets_format (24) — BaseHandler

`set_format`, `set_background`, `set_text_format`, `set_number_format`, `set_alignment`,
`set_borders`, `clear_format`, `apply_preset`, `auto_fit`, `batch_format`,
`rule_add_conditional_format`, `add_conditional_format_rule`, `rule_update_conditional_format`,
`rule_delete_conditional_format`, `rule_list_conditional_formats`, `set_data_validation`,
`clear_data_validation`, `list_data_validations`, `generate_conditional_format`,
`sparkline_add`, `sparkline_get`, `sparkline_clear`, `suggest_format`, `set_rich_text`

## sheets_dimensions (29) — BaseHandler

`insert`, `delete`, `move`, `resize`, `hide`, `show`, `append`, `freeze`, `group`, `ungroup`,
`trim_whitespace`, `text_to_columns`, `randomize_range`, `set_basic_filter`, `clear_basic_filter`,
`get_basic_filter`, `sort_range`, `create_filter_view`, `duplicate_filter_view`, `update_filter_view`,
`delete_filter_view`, `list_filter_views`, `get_filter_view`, `create_slicer`, `update_slicer`,
`delete_slicer`, `list_slicers`, `auto_fill`, `auto_resize`

## sheets_advanced (31) — BaseHandler

`add_named_range`, `update_named_range`, `delete_named_range`, `list_named_ranges`,
`get_named_range`, `add_protected_range`, `update_protected_range`, `delete_protected_range`,
`list_protected_ranges`, `set_metadata`, `get_metadata`, `delete_metadata`, `add_banding`,
`update_banding`, `delete_banding`, `list_banding`, `create_table`, `delete_table`,
`list_tables`, `update_table`, `rename_table_column`, `add_person_chip`, `add_drive_chip`,
`add_rich_link_chip`, `list_chips`, `list_named_functions`, `get_named_function`,
`create_named_function`, `update_named_function`, `delete_named_function`,
`set_table_column_properties`

## sheets_visualize (18) — BaseHandler

`chart_create`, `chart_update`, `chart_delete`, `chart_list`, `chart_get`, `chart_move`,
`chart_resize`, `chart_update_data_range`, `chart_add_trendline`, `chart_remove_trendline`,
`pivot_create`, `pivot_update`, `pivot_delete`, `pivot_list`, `pivot_get`, `pivot_refresh`,
`suggest_chart`, `suggest_pivot`

## sheets_collaborate (40) — BaseHandler

`share_add`, `share_update`, `share_remove`, `share_list`, `share_get`,
`share_transfer_ownership`, `share_set_link`, `share_get_link`, `comment_add`,
`comment_update`, `comment_delete`, `comment_list`, `comment_get`, `comment_resolve`,
`comment_reopen`, `comment_add_reply`, `comment_update_reply`, `comment_delete_reply`,
`version_list_revisions`, `version_get_revision`, `version_restore_revision`,
`version_keep_revision`, `version_create_snapshot`, `version_list_snapshots`,
`version_restore_snapshot`, `version_delete_snapshot`, `version_compare`, `version_export`,
`approval_create`, `approval_approve`, `approval_reject`, `approval_get_status`,
`approval_list_pending`, `approval_delegate`, `approval_cancel`,
`list_access_proposals`, `resolve_access_proposal`, `label_list`, `label_apply`, `label_remove`

## sheets_composite (20) — BaseHandler

`import_csv`, `import_xlsx`, `smart_append`, `bulk_update`, `deduplicate`, `export_xlsx`,
`get_form_responses`, `setup_sheet`, `import_and_format`, `clone_structure`,
`export_large_dataset`, `generate_sheet`, `generate_template`, `preview_generation`,
`audit_sheet`, `publish_report`, `data_pipeline`, `instantiate_template`, `migrate_spreadsheet`,
`batch_operations`

## sheets_analyze (19) — BaseHandler

`comprehensive`, `analyze_data`, `analyze_formulas`, `analyze_structure`,
`analyze_performance`, `analyze_quality`, `detect_patterns`, `drill_down`,
`explain_analysis`, `generate_actions`, `generate_formula`, `plan`, `execute_plan`,
`query_natural_language`, `suggest_visualization`, `scout`,
`suggest_next_actions`, `auto_enhance`, `discover_action`

## sheets_confirm (5) — Standalone

`request`, `get_stats`, `wizard_start`, `wizard_step`, `wizard_complete`

## sheets_dependencies (10) — Standalone

`build`, `analyze_impact`, `detect_cycles`, `get_dependencies`, `get_dependents`,
`get_stats`, `export_dot`, `model_scenario`, `compare_scenarios`, `create_scenario_sheet`

## sheets_fix (6) — BaseHandler

`fix`, `clean`, `standardize_formats`, `fill_missing`, `detect_anomalies`, `suggest_cleaning`

## sheets_quality (4) — Standalone

`validate`, `detect_conflicts`, `resolve_conflict`, `analyze_impact`

## sheets_history (10) — Standalone

`list`, `get`, `stats`, `undo`, `redo`, `revert_to`, `clear`,
`timeline`, `diff_revisions`, `restore_cells`

## sheets_session (31) — Standalone

`set_active`, `get_active`, `get_context`, `record_operation`, `get_last_operation`,
`get_history`, `find_by_reference`, `update_preferences`, `get_preferences`,
`update_profile_preferences`, `set_pending`, `get_pending`, `clear_pending`,
`save_checkpoint`, `load_checkpoint`, `list_checkpoints`, `delete_checkpoint`, `reset`,
`acknowledge_alert`, `clear_alerts`, `get_alerts`, `set_user_id`, `get_profile`,
`record_successful_formula`, `reject_suggestion`, `get_top_formulas`, `execute_pipeline`,
`subscribe_workspace_events`, `unsubscribe_workspace_events`, `list_workspace_subscriptions`,
`schedule_create`

## sheets_templates (8) — BaseHandler

`list`, `get`, `create`, `apply`, `update`, `delete`, `preview`, `import_builtin`

## sheets_transaction (6) — Standalone

`begin`, `queue`, `commit`, `rollback`, `status`, `list`

## sheets_federation (4) — Standalone

`call_remote`, `list_servers`, `get_server_tools`, `validate_connection`

## sheets_webhook (10) — Standalone

`register`, `unregister`, `list`, `get`, `test`, `get_stats`, `watch_changes`,
`pause`, `resume`, `get_delivery_history`

## sheets_agent (8) — Standalone

`plan`, `execute`, `execute_step`, `observe`, `rollback`, `get_status`, `list_plans`, `resume`

## sheets_compute (16) — Standalone

`evaluate`, `aggregate`, `statistical`, `regression`, `forecast`,
`matrix_op`, `pivot_compute`, `custom_function`, `batch_compute`, `explain_formula`,
`sql_query`, `sql_join`, `python_eval`, `pandas_profile`, `sklearn_model`, `matplotlib_chart`

## sheets_connectors (10) — Standalone

`list_connectors`, `configure`, `query`, `batch_query`, `subscribe`, `unsubscribe`,
`list_subscriptions`, `transform`, `status`, `discover`

## sheets_bigquery (17) — BaseHandler

`connect`, `connect_looker`, `disconnect`, `list_connections`, `get_connection`,
`cancel_refresh`, `query`, `preview`, `refresh`, `list_datasets`, `list_tables`,
`get_table_schema`, `export_to_bigquery`, `import_from_bigquery`,
`create_scheduled_query`, `list_scheduled_queries`, `delete_scheduled_query`

## sheets_appsscript (19) — BaseHandler

`create`, `get`, `get_content`, `update_content`, `create_version`, `list_versions`,
`get_version`, `deploy`, `list_deployments`, `get_deployment`, `undeploy`, `run`,
`list_processes`, `get_metrics`, `create_trigger`, `list_triggers`, `delete_trigger`,
`update_trigger`, `install_serval_function`
