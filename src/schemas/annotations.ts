/**
 * ServalSheets - Tool Annotations
 *
 * MCP 2025-11-25 compliant tool annotations
 * Required for Claude Connectors Directory
 */

import type { ToolAnnotations } from './shared.js';

/**
 * All tool annotations with MCP compliance
 */
export const TOOL_ANNOTATIONS: Record<string, ToolAnnotations> = {
  sheets_spreadsheet: {
    title: 'Spreadsheet Operations',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_sheet: {
    title: 'Sheet/Tab Operations',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete sheets
    idempotentHint: true,   // Same operation = same result
    openWorldHint: true,
  },
  sheets_values: {
    title: 'Cell Values',
    readOnlyHint: false,
    destructiveHint: true,  // Can overwrite data
    idempotentHint: false,  // Append is not idempotent
    openWorldHint: true,
  },
  sheets_cells: {
    title: 'Cell Operations',
    readOnlyHint: false,
    destructiveHint: true,  // Can clear notes/validation
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_format: {
    title: 'Cell Formatting',
    readOnlyHint: false,
    destructiveHint: false, // Formatting doesn't destroy data
    idempotentHint: true,   // Same format = same result
    openWorldHint: true,
  },
  sheets_dimensions: {
    title: 'Rows & Columns',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete rows/columns
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_rules: {
    title: 'Formatting & Validation Rules',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete rules
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_charts: {
    title: 'Chart Management',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete charts
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_pivot: {
    title: 'Pivot Tables',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete pivots
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_filter_sort: {
    title: 'Filtering & Sorting',
    readOnlyHint: false,
    destructiveHint: true,  // Can clear filters
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_sharing: {
    title: 'Sharing & Permissions',
    readOnlyHint: false,
    destructiveHint: true,  // Can remove permissions
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_comments: {
    title: 'Comments & Replies',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete comments
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_versions: {
    title: 'Version History',
    readOnlyHint: false,
    destructiveHint: true,  // Can restore (overwrites current)
    idempotentHint: false,
    openWorldHint: true,
  },
  sheets_analysis: {
    title: 'Data Analysis',
    readOnlyHint: true,     // READ-ONLY tool
    destructiveHint: false,
    idempotentHint: true,   // Same input = same output
    openWorldHint: true,
  },
  sheets_advanced: {
    title: 'Advanced Features',
    readOnlyHint: false,
    destructiveHint: true,  // Can delete named/protected ranges
    idempotentHint: false,
    openWorldHint: true,
  },
};

/**
 * Tool descriptions for MCP registration
 */
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  sheets_spreadsheet: 'Manage Google Spreadsheets: create new spreadsheets, get metadata, copy entire spreadsheets, update properties like title and locale.',
  sheets_sheet: 'Manage individual sheets (tabs) within a spreadsheet: add, delete, duplicate, rename, copy to other spreadsheets, and list all sheets.',
  sheets_values: 'Read and write cell values: single reads, batch reads, writes, appends, clears, find text, and find-replace operations.',
  sheets_cells: 'Cell-level operations: add/remove notes, set data validation, add hyperlinks, merge/unmerge cells, cut/copy operations.',
  sheets_format: 'Format cells: set background colors, text formatting (bold, italic, font), number formats, alignment, borders, and apply preset styles.',
  sheets_dimensions: 'Row and column operations: insert, delete, move, resize, auto-fit, hide/show, freeze panes, and group rows/columns.',
  sheets_rules: 'Manage rules: add conditional formatting rules, data validation rules, color scales, and preset rule types.',
  sheets_charts: 'Chart operations: create charts (bar, line, pie, etc.), update chart properties, delete, move, resize, and export as images.',
  sheets_pivot: 'Pivot table management: create pivot tables, update configuration, add calculated fields, refresh data.',
  sheets_filter_sort: 'Filtering and sorting: set basic filters, create filter views, add slicers, sort ranges by column values.',
  sheets_sharing: 'Sharing and permissions: share with users/groups, update permissions, remove access, transfer ownership, configure link sharing.',
  sheets_comments: 'Comment management: add comments to cells, reply to comments, resolve/reopen discussions, delete comments.',
  sheets_versions: 'Version control: list revision history, view specific revisions, restore previous versions, create named snapshots, compare versions.',
  sheets_analysis: 'Data analysis (read-only): check data quality, audit formulas, analyze structure, compute statistics, find correlations.',
  sheets_advanced: 'Advanced features: named ranges, protected ranges, developer metadata, banded ranges (alternating row colors).',
};

/**
 * Action counts per tool
 */
export const ACTION_COUNTS: Record<string, number> = {
  sheets_spreadsheet: 6,
  sheets_sheet: 7,
  sheets_values: 9,
  sheets_cells: 12,
  sheets_format: 9,
  sheets_dimensions: 21,
  sheets_rules: 8,
  sheets_charts: 9,
  sheets_pivot: 8,
  sheets_filter_sort: 14,
  sheets_sharing: 8,
  sheets_comments: 10,
  sheets_versions: 10,
  sheets_analysis: 8,
  sheets_advanced: 19,
};

/**
 * Tool metadata for MCP registration
 */
export interface ToolMetadata {
  name: string;
  description: string;
  annotations: ToolAnnotations;
  actionCount: number;
}

/**
 * Get all tool metadata
 */
export function getToolMetadata(): ToolMetadata[] {
  return Object.keys(TOOL_ANNOTATIONS).map(name => ({
    name,
    description: TOOL_DESCRIPTIONS[name] ?? '',
    annotations: TOOL_ANNOTATIONS[name]!,
    actionCount: ACTION_COUNTS[name] ?? 0,
  }));
}

/**
 * Constants
 */
export const TOOL_COUNT = Object.keys(TOOL_ANNOTATIONS).length;
export const ACTION_COUNT = Object.values(ACTION_COUNTS).reduce((sum, count) => sum + count, 0);
