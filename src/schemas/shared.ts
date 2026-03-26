/**
 * ServalSheets - Shared Schemas
 *
 * MCP Protocol: 2025-11-25
 * Google Sheets API: v4
 */

import { z } from 'zod';
import {
  SPREADSHEET_ID_REGEX,
  A1_NOTATION_REGEX,
  A1_NOTATION_MAX_LENGTH,
  SHEET_NAME_REGEX,
  SHEET_NAME_MAX_LENGTH,
  URL_REGEX,
} from '../config/google-limits.js';

// ============================================================================
// PROTOCOL CONSTANTS
// ============================================================================

export { MCP_PROTOCOL_VERSION } from '../config/protocol.js';
export const SHEETS_API_VERSION = 'v4';
export const DRIVE_API_VERSION = 'v3';