/**
 * Google Sheets API Type Extensions
 *
 * Provides additional type definitions for Google Sheets API responses
 * that are not fully typed in the googleapis package.
 *
 * These types help eliminate cascading `any` type inference issues
 * throughout the codebase.
 */
/**
 * Type guard to check if a value is a valid cell value
 */
export function isCellValue(value) {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
/**
 * Type guard for SheetData
 */
export function isSheetData(value) {
    return typeof value === 'object' && value !== null && ('values' in value || 'range' in value);
}
/**
 * Type guard for GridRange
 */
export function isGridRange(value) {
    return (typeof value === 'object' &&
        value !== null &&
        ('sheetId' in value ||
            'startRowIndex' in value ||
            'endRowIndex' in value ||
            'startColumnIndex' in value ||
            'endColumnIndex' in value));
}
/**
 * Safe type cast for Google API responses
 */
export function asGoogleResponse(response) {
    return response;
}
//# sourceMappingURL=google-api-extensions.js.map