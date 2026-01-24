/**
 * Google Sheets API v4 Limits and Constants
 *
 * Official limits from Google Sheets API documentation.
 * These constants are used for input validation across all schemas.
 *
 * References:
 * - https://developers.google.com/sheets/api/limits
 * - https://support.google.com/drive/answer/37603
 *
 * @module config/google-limits
 */
/**
 * Maximum length for spreadsheet title
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const SPREADSHEET_TITLE_MAX_LENGTH = 255;
/**
 * Maximum length for sheet name
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const SHEET_NAME_MAX_LENGTH = 255;
/**
 * Maximum number of sheets per spreadsheet
 * @see https://support.google.com/drive/answer/37603
 */
export declare const MAX_SHEETS_PER_SPREADSHEET = 200;
/**
 * Maximum cells per spreadsheet (10 million)
 * @see https://support.google.com/drive/answer/37603
 */
export declare const MAX_CELLS_PER_SPREADSHEET = 10000000;
/**
 * Maximum length for cell note/comment
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const CELL_NOTE_MAX_LENGTH = 50000;
/**
 * Maximum length for formula
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const FORMULA_MAX_LENGTH = 50000;
/**
 * Maximum length for hyperlink URL
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const HYPERLINK_URL_MAX_LENGTH = 50000;
/**
 * Maximum characters per cell
 * @see https://support.google.com/drive/answer/37603
 */
export declare const MAX_CHARACTERS_PER_CELL = 50000;
/**
 * Maximum length for A1 notation string
 * Conservative limit for A1 notation including sheet name and range
 * Example: "Very Long Sheet Name!A1:ZZZ999999"
 */
export declare const A1_NOTATION_MAX_LENGTH = 500;
/**
 * Maximum length for named range name
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const NAMED_RANGE_NAME_MAX_LENGTH = 255;
/**
 * Maximum number of named ranges per spreadsheet
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const MAX_NAMED_RANGES = 500;
/**
 * Maximum number of requests in a single batchUpdate call
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const BATCH_REQUEST_LIMIT = 100;
/**
 * Maximum number of rows to read/write in a single operation
 * Not a hard API limit, but practical limit for performance
 */
export declare const BATCH_ROW_LIMIT = 10000;
/**
 * Maximum number of conditional format rules per sheet
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const MAX_CONDITIONAL_FORMAT_RULES = 500;
/**
 * Maximum number of filter views per sheet
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const MAX_FILTER_VIEWS = 200;
/**
 * Maximum number of sort specs per request
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const MAX_SORT_SPECS = 255;
/**
 * Read requests per minute per user
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const READ_REQUESTS_PER_MINUTE = 300;
/**
 * Write requests per minute per user
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const WRITE_REQUESTS_PER_MINUTE = 300;
/**
 * Read requests per 100 seconds per user (alternate quota)
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const READ_REQUESTS_PER_100_SECONDS = 500;
/**
 * Write requests per 100 seconds per user (alternate quota)
 * @see https://developers.google.com/sheets/api/limits
 */
export declare const WRITE_REQUESTS_PER_100_SECONDS = 500;
/**
 * Maximum columns per sheet
 * @see https://support.google.com/drive/answer/37603
 */
export declare const MAX_COLUMNS_PER_SHEET = 18278;
/**
 * Maximum rows per sheet
 * @see https://support.google.com/drive/answer/37603
 */
export declare const MAX_ROWS_PER_SHEET = 10000000;
/**
 * Regular expression for valid A1 notation
 * Matches: A1, Sheet1!A1, Sheet1!A1:B10, A:A, 1:1, Sheet1!A:B, etc.
 */
export declare const A1_NOTATION_REGEX: RegExp;
/**
 * Regular expression for valid sheet name
 * Sheet names cannot contain: \ / ? * [ ]
 * Also cannot be empty or exceed 255 characters
 */
export declare const SHEET_NAME_REGEX: RegExp;
/**
 * Regular expression for valid spreadsheet ID
 * Format: alphanumeric, hyphens, underscores (44 characters typical)
 */
export declare const SPREADSHEET_ID_REGEX: RegExp;
/**
 * Regular expression for valid URL (HTTP/HTTPS)
 * Supports standard URL format with protocol, domain, and optional path/query/fragment
 */
export declare const URL_REGEX: RegExp;
/**
 * All Google Sheets API limits in a single object for easy reference
 */
export declare const GOOGLE_SHEETS_LIMITS: {
    readonly spreadsheetTitleMaxLength: 255;
    readonly sheetNameMaxLength: 255;
    readonly maxSheetsPerSpreadsheet: 200;
    readonly maxCellsPerSpreadsheet: 10000000;
    readonly cellNoteMaxLength: 50000;
    readonly formulaMaxLength: 50000;
    readonly hyperlinkUrlMaxLength: 50000;
    readonly maxCharactersPerCell: 50000;
    readonly a1NotationMaxLength: 500;
    readonly namedRangeNameMaxLength: 255;
    readonly maxNamedRanges: 500;
    readonly batchRequestLimit: 100;
    readonly batchRowLimit: 10000;
    readonly maxConditionalFormatRules: 500;
    readonly maxFilterViews: 200;
    readonly maxSortSpecs: 255;
    readonly readRequestsPerMinute: 300;
    readonly writeRequestsPerMinute: 300;
    readonly readRequestsPer100Seconds: 500;
    readonly writeRequestsPer100Seconds: 500;
    readonly maxColumnsPerSheet: 18278;
    readonly maxRowsPerSheet: 10000000;
    readonly a1NotationRegex: RegExp;
    readonly sheetNameRegex: RegExp;
    readonly spreadsheetIdRegex: RegExp;
    readonly urlRegex: RegExp;
};
/**
 * Type for Google Sheets API limits
 */
export type GoogleSheetsLimits = typeof GOOGLE_SHEETS_LIMITS;
//# sourceMappingURL=google-limits.d.ts.map