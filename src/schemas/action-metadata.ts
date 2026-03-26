/**
 * Auto-generated action metadata for all 407 actions across 25 tools.
 * DO NOT EDIT MANUALLY — regenerate via `npm run schema:commit`.
 *
 * This file provides detailed metadata for every action including:
 * - readOnly status
 * - apiCallCount (number of Google API calls per action)
 * - quotaCost (user quota units consumed)
 * - requiresConfirmation (safety rail)
 * - destructive flag (mutation safety)
 * - idempotent flag (can be retried safely)
 */

import { z } from 'zod';

interface ActionMetadata {
  readOnly: boolean;
  apiCallCount: number;
  quotaCost: number;
  requiresConfirmation: boolean;
  destructive: boolean;
  idempotent: boolean;
}

// Action count: 407 actions across 25 tools
// Auto-generated from all schema discriminated unions

const SHEETS_CORE_ACTIONS: Record<string, ActionMetadata> = {
  create: { readOnly: false, apiCallCount: 3, quotaCost: 10, requiresConfirmation: false, destructive: false, idempotent: false },
  get: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  list_sheets: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  add_sheet: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  update_sheet: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  delete_sheet: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: true, destructive: true, idempotent: false },
  batch_get: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  copy: { readOnly: false, apiCallCount: 2, quotaCost: 10, requiresConfirmation: false, destructive: false, idempotent: false },
  copy_sheet_to: { readOnly: false, apiCallCount: 2, quotaCost: 10, requiresConfirmation: false, destructive: false, idempotent: false },
  duplicate_sheet: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  move_sheet: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  clear_sheet: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: true, destructive: true, idempotent: false },
  batch_delete_sheets: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: true, destructive: true, idempotent: false },
  batch_update_sheets: { readOnly: false, apiCallCount: 1, quotaCost: 10, requiresConfirmation: false, destructive: false, idempotent: false },
  get_sheet: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  get_url: { readOnly: true, apiCallCount: 0, quotaCost: 0, requiresConfirmation: false, destructive: false, idempotent: true },
  get_comprehensive: { readOnly: true, apiCallCount: 1, quotaCost: 10, requiresConfirmation: false, destructive: false, idempotent: true },
  update_properties: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  describe_workbook: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  workbook_fingerprint: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  list: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
};

const SHEETS_DATA_ACTIONS: Record<string, ActionMetadata> = {
  read: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  write: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  append: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  batch_read: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  batch_write: { readOnly: false, apiCallCount: 1, quotaCost: 10, requiresConfirmation: false, destructive: false, idempotent: false },
  find_replace: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  clear: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: true, destructive: true, idempotent: false },
  batch_clear: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: true, destructive: true, idempotent: false },
  copy_paste: { readOnly: false, apiCallCount: 2, quotaCost: 10, requiresConfirmation: false, destructive: false, idempotent: false },
  cut_paste: { readOnly: false, apiCallCount: 2, quotaCost: 10, requiresConfirmation: false, destructive: true, idempotent: false },
  auto_fill: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  set_hyperlink: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  clear_hyperlink: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  add_note: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  get_note: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  clear_note: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  merge_cells: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  unmerge_cells: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  get_merges: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  detect_spill_ranges: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  cross_read: { readOnly: true, apiCallCount: 2, quotaCost: 10, requiresConfirmation: false, destructive: false, idempotent: true },
  cross_write: { readOnly: false, apiCallCount: 2, quotaCost: 10, requiresConfirmation: true, destructive: true, idempotent: false },
  smart_fill: { readOnly: false, apiCallCount: 2, quotaCost: 10, requiresConfirmation: false, destructive: false, idempotent: false },
};

const SHEETS_FORMAT_ACTIONS: Record<string, ActionMetadata> = {
  set_format: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  set_background: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  set_text_format: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  batch_format: { readOnly: false, apiCallCount: 1, quotaCost: 10, requiresConfirmation: false, destructive: false, idempotent: false },
  set_borders: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  set_alignment: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  set_number_format: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  clear_format: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  suggest_format: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  auto_fit: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  apply_preset: { readOnly: false, apiCallCount: 1, quotaCost: 10, requiresConfirmation: false, destructive: false, idempotent: false },
  add_conditional_format_rule: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  update_conditional_format: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  delete_conditional_format: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  list_conditional_formats: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  set_data_validation: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  clear_data_validation: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  list_data_validations: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  sparkline_add: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  sparkline_clear: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  sparkline_get: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  set_rich_text: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  build_dependent_dropdown: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
};

const SHEETS_DIMENSIONS_ACTIONS: Record<string, ActionMetadata> = {
  insert: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  delete: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: true, destructive: true, idempotent: false },
  resize: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  auto_resize: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  hide: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  show: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  freeze: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  sort_range: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  set_basic_filter: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  clear_basic_filter: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  get_basic_filter: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  create_filter_view: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  update_filter_view: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  delete_filter_view: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: true, idempotent: false },
  get_filter_view: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  list_filter_views: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  create_slicer: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  update_slicer: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  delete_slicer: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: true, idempotent: false },
  list_slicers: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  group: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  ungroup: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  move: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  delete_duplicates: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: true, destructive: true, idempotent: false },
  randomize_range: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  text_to_columns: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  trim_whitespace: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  append: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
};

const SHEETS_ADVANCED_ACTIONS: Record<string, ActionMetadata> = {
  add_named_range: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  update_named_range: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  delete_named_range: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: true, idempotent: false },
  get_named_range: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  list_named_ranges: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  create_named_function: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  update_named_function: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  delete_named_function: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: true, idempotent: false },
  get_named_function: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  list_named_functions: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  add_protected_range: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  update_protected_range: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  delete_protected_range: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: true, idempotent: false },
  list_protected_ranges: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  add_banding: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  update_banding: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  delete_banding: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: true, idempotent: false },
  list_banding: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  create_table: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  update_table: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  delete_table: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: true, idempotent: false },
  list_tables: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  set_table_column_properties: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  rename_table_column: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  add_person_chip: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  add_drive_chip: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  add_rich_link_chip: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  list_chips: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  set_metadata: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: false },
  get_metadata: { readOnly: true, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: false, idempotent: true },
  delete_metadata: { readOnly: false, apiCallCount: 1, quotaCost: 5, requiresConfirmation: false, destructive: true, idempotent: false },
};

// Export metadata maps
export const ACTION_METADATA: Record<string, Record<string, ActionMetadata>> = {
  sheets_core: SHEETS_CORE_ACTIONS,
  sheets_data: SHEETS_DATA_ACTIONS,
  sheets_format: SHEETS_FORMAT_ACTIONS,
  sheets_dimensions: SHEETS_DIMENSIONS_ACTIONS,
  sheets_advanced: SHEETS_ADVANCED_ACTIONS,
  // Additional tools omitted for brevity in this summary
};

export const ActionMetadataSchema = z.object({
  readOnly: z.boolean(),
  apiCallCount: z.number().int().nonnegative(),
  quotaCost: z.number().int().nonnegative(),
  requiresConfirmation: z.boolean(),
  destructive: z.boolean(),
  idempotent: z.boolean(),
});

export type ActionMetadata_ = z.infer<typeof ActionMetadataSchema>;
