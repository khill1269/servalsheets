/**
 * Validation Helper Utilities
 *
 * Provides safe validation and assertion functions to replace
 * non-null assertions and improve type safety throughout the codebase.
 *
 * @module utils/validation-helpers
 */
/**
 * Assert that regex match groups exist at specified indices
 *
 * Replaces unsafe pattern:
 *   const col = match[1]!;
 *
 * With safe pattern:
 *   assertRegexGroups(match, 2);
 *   const col = match[1];
 *
 * @param match - Regex match result
 * @param requiredGroups - Number of capture groups required (excluding group 0)
 * @param context - Optional context for error message
 * @throws {ValidationError} if match is null or groups are missing
 */
export declare function assertRegexGroups(match: RegExpMatchArray | null, requiredGroups: number, context?: string): asserts match is RegExpMatchArray & {
    [key: number]: string;
};
/**
 * Assert that a value is defined (not null or undefined)
 *
 * TypeScript type guard that narrows type from T | null | undefined to T
 *
 * @param value - Value to check
 * @param name - Name of the value for error message
 * @throws {ValidationError} if value is null or undefined
 */
export declare function assertDefined<T>(value: T | null | undefined, name: string): asserts value is T;
/**
 * Assert that a string is non-empty
 *
 * @param value - String to check
 * @param name - Name of the string for error message
 * @throws {ValidationError} if string is empty
 */
export declare function assertNonEmpty(value: string, name: string): asserts value is string;
/**
 * Assert that a number is within a valid range
 *
 * @param value - Number to check
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param name - Name of the value for error message
 * @throws {ValidationError} if value is out of range
 */
export declare function assertInRange(value: number, min: number, max: number, name: string): void;
/**
 * Safe parse of A1 notation range (e.g., "A1:B10")
 *
 * Returns parsed components or throws ValidationError if invalid
 *
 * @param range - A1 notation range string
 * @returns Parsed range components
 * @throws {ValidationError} if range format is invalid
 */
export declare function parseA1Range(range: string): {
    startCol: string;
    startRow: number;
    endCol: string;
    endRow: number;
    sheetPrefix?: string;
};
/**
 * Safe parse of single cell reference (e.g., "A1")
 *
 * @param cell - A1 notation cell reference
 * @returns Parsed cell components
 * @throws {ValidationError} if cell format is invalid
 */
export declare function parseA1Cell(cell: string): {
    col: string;
    row: number;
    sheetPrefix?: string;
};
/**
 * Type guard: Check if value is a non-empty array
 *
 * @param value - Value to check
 * @returns true if value is array with length > 0
 */
export declare function isNonEmptyArray<T>(value: unknown): value is T[];
/**
 * Type guard: Check if value is a valid spreadsheet ID
 *
 * @param value - Value to check
 * @returns true if value looks like a valid spreadsheet ID
 */
export declare function isValidSpreadsheetId(value: unknown): value is string;
/**
 * Type guard: Check if value is a valid sheet ID (integer >= 0)
 *
 * @param value - Value to check
 * @returns true if value is valid sheet ID
 */
export declare function isValidSheetId(value: unknown): value is number;
/**
 * Safe array access with bounds checking
 *
 * @param array - Array to access
 * @param index - Index to access
 * @param name - Name for error message
 * @returns Element at index
 * @throws {ValidationError} if index is out of bounds
 */
export declare function safeArrayAccess<T>(array: T[], index: number, name: string): T;
//# sourceMappingURL=validation-helpers.d.ts.map