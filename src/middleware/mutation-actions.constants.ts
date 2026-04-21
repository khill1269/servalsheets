/**
 * Mutation Action Names — Single Source of Truth
 *
 * This is the **canonical** list of handler action names that are considered
 * data/structure/format mutations and therefore:
 *   - trigger audit logging (`src/middleware/audit-middleware.ts:MUTATION_ACTIONS`)
 *   - require per-spreadsheet write-lock serialization (`src/middleware/write-lock-middleware.ts:MUTATION_ACTIONS`)
 *
 * Both middleware files derive their `MUTATION_ACTIONS` Set from this array,
 * so drift between the two is **impossible by construction**. The historical
 * duplication that existed in audit-middleware.ts and write-lock-middleware.ts
 * has been eliminated (was ISSUE-231 / fix-plan C1-B1).
 *
 * ## Why a readonly tuple, not a Set?
 *
 * - Keeps the source text literal-only (scripts that regex-parse the names
 *   still work without an AST), and avoids a runtime side effect at module load.
 * - Allows TypeScript to enforce that every entry is a valid `MutationEvent['action']`
 *   literal, catching typos at compile time instead of at runtime.
 *
 * ## When adding a new mutating action
 *
 * 1. Add the new action to `MutationEvent['action']` in `src/services/audit-logger-types.ts`.
 * 2. Add it to the array below.
 * 3. Add a matching cache-invalidation rule in `src/services/cache-invalidation-graph.ts`.
 * 4. Run `npm run check:mutation-actions` and `npm run check:integration-wiring` to verify.
 *
 * @see src/middleware/audit-middleware.ts
 * @see src/middleware/write-lock-middleware.ts
 * @see scripts/check-mutation-actions.mjs
 */

import type { MutationEvent } from '../services/audit-logger-types.js';

/**
 * Canonical list of mutation action names.
 *
 * Kept as a typed array (not a Set) so the source text preserves the literal
 * names for regex-based CI checks, and so the TypeScript compiler verifies
 * every entry is a valid `MutationEvent['action']` literal.
 */
export const MUTATION_ACTION_NAMES: readonly MutationEvent['action'][] = [
  // sheets_data — direct data writes
  'write',
  'append',
  'clear',
  'batch_write',
  'batch_clear',
  'cross_write',
  'import_csv',
  'import_xlsx',
  'smart_append',
  'smart_fill',
  // sheets_fix — mutating fixes
  'clean',
  'standardize_formats',
  'fill_missing',
  // sheets_composite — bulk write operations
  'bulk_update',
  'deduplicate',
  'setup_sheet',
  'import_and_format',
  'clone_structure',
  'generate_sheet',
  'generate_template',
  'batch_operations',
  'data_pipeline',
  'instantiate_template',
  'migrate_spreadsheet',
  'cut_paste',
  'copy_paste',
  'find_replace',
  'merge_cells',
  'unmerge_cells',
  'set_hyperlink',
  'clear_hyperlink',
  'add_note',
  'clear_note',
  // sheets_dimensions — structural changes
  'delete_sheet',
  'batch_delete_sheets',
  'clear_sheet',
  'insert',
  'delete',
  'move',
  'resize',
  'hide',
  'show',
  'freeze',
  'group',
  'ungroup',
  'trim_whitespace',
  'text_to_columns',
  'randomize_range',
  'set_basic_filter',
  'clear_basic_filter',
  'sort_range',
  'create_filter_view',
  'update_filter_view',
  'delete_filter_view',
  'create_slicer',
  'update_slicer',
  'delete_slicer',
  'auto_fill',
  // sheets_format — formatting mutations
  'set_format',
  'set_background',
  'set_text_format',
  'set_number_format',
  'set_alignment',
  'set_borders',
  'clear_format',
  'apply_preset',
  'batch_format',
  'set_data_validation',
  'clear_data_validation',
  'add_conditional_format_rule',
  'rule_add_conditional_format',
  'rule_update_conditional_format',
  'rule_delete_conditional_format',
  'set_rich_text',
  'sparkline_add',
  'sparkline_clear',
] as const;
