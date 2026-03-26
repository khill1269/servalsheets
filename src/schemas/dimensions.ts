/**
 * Tool: sheets_dimensions
 * Row and column dimension management (insert, delete, resize, hide, freeze, sort, filter, group)
 *
 * Actions (30):
 * - insert: Insert rows or columns at a position
 * - delete: Delete rows or columns (destructive)
 * - resize: Set exact height (rows) or width (columns) in pixels
 * - auto_resize: Auto-fit rows/columns to content
 * - hide: Hide rows or columns (not deleted, just hidden)
 * - show: Show hidden rows or columns
 * - freeze: Freeze rows/columns so they stay visible when scrolling
 * - sort_range: Sort a range by one or more columns
 * - set_basic_filter: Apply filter to a range (hide rows by criteria)
 * - clear_basic_filter: Remove basic filter
 * - get_basic_filter: Get current filter criteria
 * - create_filter_view: Create a filter view (non-destructive filtered view)
 * - update_filter_view: Update filter view criteria
 * - delete_filter_view: Delete filter view
 * - get_filter_view: Get filter view configuration
 * - list_filter_views: List all filter views in a sheet (paginated)
 * - create_slicer: Create slicer (interactive filter widget)
 * - update_slicer: Update slicer configuration
 * - delete_slicer: Delete slicer
 * - list_slicers: List all slicers in a sheet
 * - group: Group rows or columns (for collapsible outline)
 * - ungroup: Ungroup rows or columns
 * - move: Move rows or columns to new position
 * - delete_duplicates: Remove duplicate rows (destructive)
 * - randomize_range: Randomly shuffle rows or values
 * - text_to_columns: Split text into columns (delimiter-based)
 * - trim_whitespace: Remove leading/trailing whitespace from all cells
 * - append: Append rows to a sheet
 */

import { z } from 'zod';

// Placeholder for actual dimensions schema
// Full implementation in src/handlers/dimensions.ts

export const DimensionsPlaceholder = z.object({});
