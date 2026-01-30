/**
 * Tool: sheets_data
 * Consolidated data operations: cell values, notes, validation, hyperlinks, and clipboard operations
 * Merges: values.ts (8 actions) + cells.ts (12 actions) = 20 actions
 * v2.0: Merged find + replace → find_replace (1 less action than v1)
 */
import { z } from 'zod';
import { type ToolAnnotations, type RangeInput } from './shared.js';
declare const DataValidationSchema: z.ZodObject<{
    condition: z.ZodObject<{
        type: z.ZodEnum<{
            NUMBER_GREATER: "NUMBER_GREATER";
            NUMBER_GREATER_THAN_EQ: "NUMBER_GREATER_THAN_EQ";
            NUMBER_LESS: "NUMBER_LESS";
            NUMBER_LESS_THAN_EQ: "NUMBER_LESS_THAN_EQ";
            NUMBER_EQ: "NUMBER_EQ";
            NUMBER_NOT_EQ: "NUMBER_NOT_EQ";
            NUMBER_BETWEEN: "NUMBER_BETWEEN";
            NUMBER_NOT_BETWEEN: "NUMBER_NOT_BETWEEN";
            TEXT_CONTAINS: "TEXT_CONTAINS";
            TEXT_NOT_CONTAINS: "TEXT_NOT_CONTAINS";
            TEXT_STARTS_WITH: "TEXT_STARTS_WITH";
            TEXT_ENDS_WITH: "TEXT_ENDS_WITH";
            TEXT_EQ: "TEXT_EQ";
            TEXT_IS_EMAIL: "TEXT_IS_EMAIL";
            TEXT_IS_URL: "TEXT_IS_URL";
            DATE_EQ: "DATE_EQ";
            DATE_BEFORE: "DATE_BEFORE";
            DATE_AFTER: "DATE_AFTER";
            DATE_ON_OR_BEFORE: "DATE_ON_OR_BEFORE";
            DATE_ON_OR_AFTER: "DATE_ON_OR_AFTER";
            DATE_BETWEEN: "DATE_BETWEEN";
            DATE_NOT_BETWEEN: "DATE_NOT_BETWEEN";
            DATE_IS_VALID: "DATE_IS_VALID";
            BLANK: "BLANK";
            NOT_BLANK: "NOT_BLANK";
            CUSTOM_FORMULA: "CUSTOM_FORMULA";
            ONE_OF_LIST: "ONE_OF_LIST";
            ONE_OF_RANGE: "ONE_OF_RANGE";
            BOOLEAN: "BOOLEAN";
        }>;
        values: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    inputMessage: z.ZodOptional<z.ZodString>;
    strict: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    showDropdown: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const SheetsDataInputSchema: z.ZodObject<{
    request: z.ZodDiscriminatedUnion<[z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"read">;
        range: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>;
        valueRenderOption: z.ZodDefault<z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            FORMATTED_VALUE: "FORMATTED_VALUE";
            UNFORMATTED_VALUE: "UNFORMATTED_VALUE";
            FORMULA: "FORMULA";
        }>>>>;
        majorDimension: z.ZodDefault<z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            ROWS: "ROWS";
            COLUMNS: "COLUMNS";
        }>>>>;
        streaming: z.ZodOptional<z.ZodBoolean>;
        chunkSize: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        cursor: z.ZodOptional<z.ZodString>;
        pageSize: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"write">;
        range: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>;
        values: z.ZodArray<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
        valueInputOption: z.ZodDefault<z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            RAW: "RAW";
            USER_ENTERED: "USER_ENTERED";
        }>>>>;
        includeValuesInResponse: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        diffOptions: z.ZodOptional<z.ZodObject<{
            tier: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
                METADATA: "METADATA";
                SAMPLE: "SAMPLE";
                FULL: "FULL";
            }>>>;
            sampleSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            maxFullDiffCells: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"append">;
        range: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>;
        values: z.ZodArray<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
        valueInputOption: z.ZodDefault<z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            RAW: "RAW";
            USER_ENTERED: "USER_ENTERED";
        }>>>>;
        insertDataOption: z.ZodDefault<z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            OVERWRITE: "OVERWRITE";
            INSERT_ROWS: "INSERT_ROWS";
        }>>>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"clear">;
        range: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>;
        previewMode: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"batch_read">;
        ranges: z.ZodArray<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>>;
        valueRenderOption: z.ZodDefault<z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            FORMATTED_VALUE: "FORMATTED_VALUE";
            UNFORMATTED_VALUE: "UNFORMATTED_VALUE";
            FORMULA: "FORMULA";
        }>>>>;
        majorDimension: z.ZodDefault<z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            ROWS: "ROWS";
            COLUMNS: "COLUMNS";
        }>>>>;
        cursor: z.ZodOptional<z.ZodString>;
        pageSize: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"batch_write">;
        data: z.ZodArray<z.ZodObject<{
            range: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
                a1: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                namedRange: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                semantic: z.ZodObject<{
                    sheet: z.ZodString;
                    column: z.ZodString;
                    includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                    rowStart: z.ZodOptional<z.ZodNumber>;
                    rowEnd: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>;
            }, z.core.$strip>, z.ZodObject<{
                grid: z.ZodObject<{
                    sheetId: z.ZodCoercedNumber<unknown>;
                    startRowIndex: z.ZodOptional<z.ZodNumber>;
                    endRowIndex: z.ZodOptional<z.ZodNumber>;
                    startColumnIndex: z.ZodOptional<z.ZodNumber>;
                    endColumnIndex: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>;
            }, z.core.$strip>]>>;
            values: z.ZodArray<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
        }, z.core.$strip>>;
        valueInputOption: z.ZodDefault<z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            RAW: "RAW";
            USER_ENTERED: "USER_ENTERED";
        }>>>>;
        includeValuesInResponse: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        diffOptions: z.ZodOptional<z.ZodObject<{
            tier: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
                METADATA: "METADATA";
                SAMPLE: "SAMPLE";
                FULL: "FULL";
            }>>>;
            sampleSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            maxFullDiffCells: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"batch_clear">;
        ranges: z.ZodArray<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>>;
        previewMode: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"find_replace">;
        find: z.ZodString;
        replacement: z.ZodOptional<z.ZodString>;
        range: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>>;
        matchCase: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        matchEntireCell: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        searchByRegex: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        includeFormulas: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        allSheets: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        previewMode: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"add_note">;
        cell: z.ZodString;
        note: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"get_note">;
        cell: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"clear_note">;
        cell: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"set_validation">;
        range: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>;
        validation: z.ZodObject<{
            condition: z.ZodObject<{
                type: z.ZodEnum<{
                    NUMBER_GREATER: "NUMBER_GREATER";
                    NUMBER_GREATER_THAN_EQ: "NUMBER_GREATER_THAN_EQ";
                    NUMBER_LESS: "NUMBER_LESS";
                    NUMBER_LESS_THAN_EQ: "NUMBER_LESS_THAN_EQ";
                    NUMBER_EQ: "NUMBER_EQ";
                    NUMBER_NOT_EQ: "NUMBER_NOT_EQ";
                    NUMBER_BETWEEN: "NUMBER_BETWEEN";
                    NUMBER_NOT_BETWEEN: "NUMBER_NOT_BETWEEN";
                    TEXT_CONTAINS: "TEXT_CONTAINS";
                    TEXT_NOT_CONTAINS: "TEXT_NOT_CONTAINS";
                    TEXT_STARTS_WITH: "TEXT_STARTS_WITH";
                    TEXT_ENDS_WITH: "TEXT_ENDS_WITH";
                    TEXT_EQ: "TEXT_EQ";
                    TEXT_IS_EMAIL: "TEXT_IS_EMAIL";
                    TEXT_IS_URL: "TEXT_IS_URL";
                    DATE_EQ: "DATE_EQ";
                    DATE_BEFORE: "DATE_BEFORE";
                    DATE_AFTER: "DATE_AFTER";
                    DATE_ON_OR_BEFORE: "DATE_ON_OR_BEFORE";
                    DATE_ON_OR_AFTER: "DATE_ON_OR_AFTER";
                    DATE_BETWEEN: "DATE_BETWEEN";
                    DATE_NOT_BETWEEN: "DATE_NOT_BETWEEN";
                    DATE_IS_VALID: "DATE_IS_VALID";
                    BLANK: "BLANK";
                    NOT_BLANK: "NOT_BLANK";
                    CUSTOM_FORMULA: "CUSTOM_FORMULA";
                    ONE_OF_LIST: "ONE_OF_LIST";
                    ONE_OF_RANGE: "ONE_OF_RANGE";
                    BOOLEAN: "BOOLEAN";
                }>;
                values: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>;
            inputMessage: z.ZodOptional<z.ZodString>;
            strict: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            showDropdown: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"clear_validation">;
        range: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"set_hyperlink">;
        cell: z.ZodString;
        url: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"clear_hyperlink">;
        cell: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"merge_cells">;
        range: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>;
        mergeType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            MERGE_ALL: "MERGE_ALL";
            MERGE_COLUMNS: "MERGE_COLUMNS";
            MERGE_ROWS: "MERGE_ROWS";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"unmerge_cells">;
        range: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"get_merges">;
        sheetId: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"cut_paste">;
        source: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>;
        destination: z.ZodString;
        pasteType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            PASTE_NORMAL: "PASTE_NORMAL";
            PASTE_VALUES: "PASTE_VALUES";
            PASTE_FORMAT: "PASTE_FORMAT";
            PASTE_NO_BORDERS: "PASTE_NO_BORDERS";
            PASTE_FORMULA: "PASTE_FORMULA";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"copy_paste">;
        source: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
            a1: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            namedRange: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            semantic: z.ZodObject<{
                sheet: z.ZodString;
                column: z.ZodString;
                includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                rowStart: z.ZodOptional<z.ZodNumber>;
                rowEnd: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            grid: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>;
        destination: z.ZodString;
        pasteType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            PASTE_NORMAL: "PASTE_NORMAL";
            PASTE_VALUES: "PASTE_VALUES";
            PASTE_FORMAT: "PASTE_FORMAT";
            PASTE_NO_BORDERS: "PASTE_NO_BORDERS";
            PASTE_FORMULA: "PASTE_FORMULA";
        }>>>;
    }, z.core.$strip>], "action">;
}, z.core.$strip>;
declare const DataResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    action: z.ZodString;
    values: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>>;
    range: z.ZodOptional<z.ZodString>;
    majorDimension: z.ZodOptional<z.ZodString>;
    nextCursor: z.ZodOptional<z.ZodString>;
    hasMore: z.ZodOptional<z.ZodBoolean>;
    totalRows: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    valueRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
        range: z.ZodString;
        values: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>>;
    }, z.core.$strip>>>;
    updatedCells: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    updatedRows: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    updatedColumns: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    updatedRange: z.ZodOptional<z.ZodString>;
    matches: z.ZodOptional<z.ZodArray<z.ZodObject<{
        cell: z.ZodString;
        value: z.ZodString;
        row: z.ZodCoercedNumber<unknown>;
        column: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>>>;
    replacementsCount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    replacementPreview: z.ZodOptional<z.ZodArray<z.ZodObject<{
        cell: z.ZodString;
        oldValue: z.ZodString;
        newValue: z.ZodString;
        row: z.ZodCoercedNumber<unknown>;
        column: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>>>;
    clearPreview: z.ZodOptional<z.ZodArray<z.ZodObject<{
        cell: z.ZodString;
        currentValue: z.ZodString;
        row: z.ZodCoercedNumber<unknown>;
        column: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>>>;
    clearedCells: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    clearedRanges: z.ZodOptional<z.ZodArray<z.ZodString>>;
    truncated: z.ZodOptional<z.ZodBoolean>;
    resourceUri: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
    merges: z.ZodOptional<z.ZodArray<z.ZodObject<{
        startRow: z.ZodCoercedNumber<unknown>;
        endRow: z.ZodCoercedNumber<unknown>;
        startColumn: z.ZodCoercedNumber<unknown>;
        endColumn: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>>>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
    mutation: z.ZodOptional<z.ZodObject<{
        cellsAffected: z.ZodNumber;
        rowsAffected: z.ZodOptional<z.ZodNumber>;
        columnsAffected: z.ZodOptional<z.ZodNumber>;
        diff: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            tier: z.ZodLiteral<"METADATA">;
            before: z.ZodObject<{
                timestamp: z.ZodString;
                rowCount: z.ZodNumber;
                columnCount: z.ZodNumber;
                checksum: z.ZodString;
            }, z.core.$strip>;
            after: z.ZodObject<{
                timestamp: z.ZodString;
                rowCount: z.ZodNumber;
                columnCount: z.ZodNumber;
                checksum: z.ZodString;
            }, z.core.$strip>;
            summary: z.ZodObject<{
                rowsChanged: z.ZodNumber;
                estimatedCellsChanged: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            tier: z.ZodLiteral<"SAMPLE">;
            samples: z.ZodObject<{
                firstRows: z.ZodArray<z.ZodObject<{
                    cell: z.ZodString;
                    before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    type: z.ZodEnum<{
                        format: "format";
                        value: "value";
                        formula: "formula";
                        note: "note";
                    }>;
                }, z.core.$strip>>;
                lastRows: z.ZodArray<z.ZodObject<{
                    cell: z.ZodString;
                    before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    type: z.ZodEnum<{
                        format: "format";
                        value: "value";
                        formula: "formula";
                        note: "note";
                    }>;
                }, z.core.$strip>>;
                randomRows: z.ZodArray<z.ZodObject<{
                    cell: z.ZodString;
                    before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    type: z.ZodEnum<{
                        format: "format";
                        value: "value";
                        formula: "formula";
                        note: "note";
                    }>;
                }, z.core.$strip>>;
            }, z.core.$strip>;
            summary: z.ZodObject<{
                rowsChanged: z.ZodNumber;
                cellsSampled: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            tier: z.ZodLiteral<"FULL">;
            changes: z.ZodArray<z.ZodObject<{
                cell: z.ZodString;
                before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                type: z.ZodEnum<{
                    format: "format";
                    value: "value";
                    formula: "formula";
                    note: "note";
                }>;
            }, z.core.$strip>>;
            summary: z.ZodObject<{
                cellsChanged: z.ZodNumber;
                cellsAdded: z.ZodNumber;
                cellsRemoved: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>], "tier">>;
        reversible: z.ZodBoolean;
        revertSnapshotId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    snapshotId: z.ZodOptional<z.ZodString>;
    _meta: z.ZodOptional<z.ZodObject<{
        suggestions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                optimization: "optimization";
                alternative: "alternative";
                follow_up: "follow_up";
                warning: "warning";
                related: "related";
            }>;
            message: z.ZodString;
            tool: z.ZodOptional<z.ZodString>;
            action: z.ZodOptional<z.ZodString>;
            reason: z.ZodString;
            priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>>>;
        }, z.core.$strip>>>;
        costEstimate: z.ZodOptional<z.ZodObject<{
            apiCalls: z.ZodNumber;
            estimatedLatencyMs: z.ZodNumber;
            cellsAffected: z.ZodOptional<z.ZodNumber>;
            quotaImpact: z.ZodOptional<z.ZodObject<{
                current: z.ZodNumber;
                limit: z.ZodNumber;
                remaining: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        relatedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
        documentation: z.ZodOptional<z.ZodString>;
        nextSteps: z.ZodOptional<z.ZodArray<z.ZodString>>;
        warnings: z.ZodOptional<z.ZodArray<z.ZodString>>;
        snapshot: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodObject<{
        code: z.ZodEnum<{
            INTERNAL_ERROR: "INTERNAL_ERROR";
            NOT_IMPLEMENTED: "NOT_IMPLEMENTED";
            AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED";
            INVALID_PARAMS: "INVALID_PARAMS";
            PARSE_ERROR: "PARSE_ERROR";
            INVALID_REQUEST: "INVALID_REQUEST";
            METHOD_NOT_FOUND: "METHOD_NOT_FOUND";
            UNAUTHENTICATED: "UNAUTHENTICATED";
            PERMISSION_DENIED: "PERMISSION_DENIED";
            INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
            INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS";
            QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
            RATE_LIMITED: "RATE_LIMITED";
            RESOURCE_EXHAUSTED: "RESOURCE_EXHAUSTED";
            SPREADSHEET_NOT_FOUND: "SPREADSHEET_NOT_FOUND";
            SPREADSHEET_TOO_LARGE: "SPREADSHEET_TOO_LARGE";
            SHEET_NOT_FOUND: "SHEET_NOT_FOUND";
            INVALID_SHEET_ID: "INVALID_SHEET_ID";
            DUPLICATE_SHEET_NAME: "DUPLICATE_SHEET_NAME";
            INVALID_RANGE: "INVALID_RANGE";
            RANGE_NOT_FOUND: "RANGE_NOT_FOUND";
            PROTECTED_RANGE: "PROTECTED_RANGE";
            FORMULA_ERROR: "FORMULA_ERROR";
            CIRCULAR_REFERENCE: "CIRCULAR_REFERENCE";
            INVALID_DATA_VALIDATION: "INVALID_DATA_VALIDATION";
            MERGE_CONFLICT: "MERGE_CONFLICT";
            CONDITIONAL_FORMAT_ERROR: "CONDITIONAL_FORMAT_ERROR";
            PIVOT_TABLE_ERROR: "PIVOT_TABLE_ERROR";
            CHART_ERROR: "CHART_ERROR";
            FILTER_VIEW_ERROR: "FILTER_VIEW_ERROR";
            NAMED_RANGE_ERROR: "NAMED_RANGE_ERROR";
            DEVELOPER_METADATA_ERROR: "DEVELOPER_METADATA_ERROR";
            DIMENSION_ERROR: "DIMENSION_ERROR";
            BATCH_UPDATE_ERROR: "BATCH_UPDATE_ERROR";
            TRANSACTION_ERROR: "TRANSACTION_ERROR";
            ABORTED: "ABORTED";
            DEADLINE_EXCEEDED: "DEADLINE_EXCEEDED";
            CANCELLED: "CANCELLED";
            DATA_LOSS: "DATA_LOSS";
            UNAVAILABLE: "UNAVAILABLE";
            UNIMPLEMENTED: "UNIMPLEMENTED";
            UNKNOWN: "UNKNOWN";
            OUT_OF_RANGE: "OUT_OF_RANGE";
            FAILED_PRECONDITION: "FAILED_PRECONDITION";
            PRECONDITION_FAILED: "PRECONDITION_FAILED";
            EFFECT_SCOPE_EXCEEDED: "EFFECT_SCOPE_EXCEEDED";
            EXPLICIT_RANGE_REQUIRED: "EXPLICIT_RANGE_REQUIRED";
            AMBIGUOUS_RANGE: "AMBIGUOUS_RANGE";
            FEATURE_UNAVAILABLE: "FEATURE_UNAVAILABLE";
            FEATURE_DEGRADED: "FEATURE_DEGRADED";
            AUTH_ERROR: "AUTH_ERROR";
            CONFIG_ERROR: "CONFIG_ERROR";
            VALIDATION_ERROR: "VALIDATION_ERROR";
            NOT_FOUND: "NOT_FOUND";
            HANDLER_LOAD_ERROR: "HANDLER_LOAD_ERROR";
            TOO_MANY_SESSIONS: "TOO_MANY_SESSIONS";
            DATA_ERROR: "DATA_ERROR";
            VERSION_MISMATCH: "VERSION_MISMATCH";
            NO_DATA: "NO_DATA";
            SERVICE_NOT_INITIALIZED: "SERVICE_NOT_INITIALIZED";
            SNAPSHOT_CREATION_FAILED: "SNAPSHOT_CREATION_FAILED";
            SNAPSHOT_RESTORE_FAILED: "SNAPSHOT_RESTORE_FAILED";
            TRANSACTION_CONFLICT: "TRANSACTION_CONFLICT";
            TRANSACTION_EXPIRED: "TRANSACTION_EXPIRED";
            SESSION_NOT_FOUND: "SESSION_NOT_FOUND";
            PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
            ELICITATION_UNAVAILABLE: "ELICITATION_UNAVAILABLE";
            SAMPLING_UNAVAILABLE: "SAMPLING_UNAVAILABLE";
            FORBIDDEN: "FORBIDDEN";
            REPLAY_FAILED: "REPLAY_FAILED";
            UNKNOWN_ERROR: "UNKNOWN_ERROR";
        }>;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        retryable: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        retryAfterMs: z.ZodOptional<z.ZodNumber>;
        suggestedFix: z.ZodOptional<z.ZodString>;
        alternatives: z.ZodOptional<z.ZodArray<z.ZodObject<{
            tool: z.ZodString;
            action: z.ZodString;
            description: z.ZodString;
        }, z.core.$strip>>>;
        resolution: z.ZodOptional<z.ZodString>;
        resolutionSteps: z.ZodOptional<z.ZodArray<z.ZodString>>;
        category: z.ZodOptional<z.ZodEnum<{
            unknown: "unknown";
            client: "client";
            server: "server";
            network: "network";
            auth: "auth";
            quota: "quota";
        }>>;
        severity: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
            critical: "critical";
        }>>;
        retryStrategy: z.ZodOptional<z.ZodEnum<{
            exponential_backoff: "exponential_backoff";
            wait_for_reset: "wait_for_reset";
            manual: "manual";
            none: "none";
        }>>;
        suggestedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>], "success">;
export declare const SheetsDataOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodString;
        values: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>>;
        range: z.ZodOptional<z.ZodString>;
        majorDimension: z.ZodOptional<z.ZodString>;
        nextCursor: z.ZodOptional<z.ZodString>;
        hasMore: z.ZodOptional<z.ZodBoolean>;
        totalRows: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        valueRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            range: z.ZodString;
            values: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>>;
        }, z.core.$strip>>>;
        updatedCells: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        updatedRows: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        updatedColumns: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        updatedRange: z.ZodOptional<z.ZodString>;
        matches: z.ZodOptional<z.ZodArray<z.ZodObject<{
            cell: z.ZodString;
            value: z.ZodString;
            row: z.ZodCoercedNumber<unknown>;
            column: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>>;
        replacementsCount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        replacementPreview: z.ZodOptional<z.ZodArray<z.ZodObject<{
            cell: z.ZodString;
            oldValue: z.ZodString;
            newValue: z.ZodString;
            row: z.ZodCoercedNumber<unknown>;
            column: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>>;
        clearPreview: z.ZodOptional<z.ZodArray<z.ZodObject<{
            cell: z.ZodString;
            currentValue: z.ZodString;
            row: z.ZodCoercedNumber<unknown>;
            column: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>>;
        clearedCells: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        clearedRanges: z.ZodOptional<z.ZodArray<z.ZodString>>;
        truncated: z.ZodOptional<z.ZodBoolean>;
        resourceUri: z.ZodOptional<z.ZodString>;
        note: z.ZodOptional<z.ZodString>;
        merges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            startRow: z.ZodCoercedNumber<unknown>;
            endRow: z.ZodCoercedNumber<unknown>;
            startColumn: z.ZodCoercedNumber<unknown>;
            endColumn: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>>;
        dryRun: z.ZodOptional<z.ZodBoolean>;
        mutation: z.ZodOptional<z.ZodObject<{
            cellsAffected: z.ZodNumber;
            rowsAffected: z.ZodOptional<z.ZodNumber>;
            columnsAffected: z.ZodOptional<z.ZodNumber>;
            diff: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                tier: z.ZodLiteral<"METADATA">;
                before: z.ZodObject<{
                    timestamp: z.ZodString;
                    rowCount: z.ZodNumber;
                    columnCount: z.ZodNumber;
                    checksum: z.ZodString;
                }, z.core.$strip>;
                after: z.ZodObject<{
                    timestamp: z.ZodString;
                    rowCount: z.ZodNumber;
                    columnCount: z.ZodNumber;
                    checksum: z.ZodString;
                }, z.core.$strip>;
                summary: z.ZodObject<{
                    rowsChanged: z.ZodNumber;
                    estimatedCellsChanged: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip>, z.ZodObject<{
                tier: z.ZodLiteral<"SAMPLE">;
                samples: z.ZodObject<{
                    firstRows: z.ZodArray<z.ZodObject<{
                        cell: z.ZodString;
                        before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                        after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                        type: z.ZodEnum<{
                            format: "format";
                            value: "value";
                            formula: "formula";
                            note: "note";
                        }>;
                    }, z.core.$strip>>;
                    lastRows: z.ZodArray<z.ZodObject<{
                        cell: z.ZodString;
                        before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                        after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                        type: z.ZodEnum<{
                            format: "format";
                            value: "value";
                            formula: "formula";
                            note: "note";
                        }>;
                    }, z.core.$strip>>;
                    randomRows: z.ZodArray<z.ZodObject<{
                        cell: z.ZodString;
                        before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                        after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                        type: z.ZodEnum<{
                            format: "format";
                            value: "value";
                            formula: "formula";
                            note: "note";
                        }>;
                    }, z.core.$strip>>;
                }, z.core.$strip>;
                summary: z.ZodObject<{
                    rowsChanged: z.ZodNumber;
                    cellsSampled: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip>, z.ZodObject<{
                tier: z.ZodLiteral<"FULL">;
                changes: z.ZodArray<z.ZodObject<{
                    cell: z.ZodString;
                    before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    type: z.ZodEnum<{
                        format: "format";
                        value: "value";
                        formula: "formula";
                        note: "note";
                    }>;
                }, z.core.$strip>>;
                summary: z.ZodObject<{
                    cellsChanged: z.ZodNumber;
                    cellsAdded: z.ZodNumber;
                    cellsRemoved: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip>], "tier">>;
            reversible: z.ZodBoolean;
            revertSnapshotId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        snapshotId: z.ZodOptional<z.ZodString>;
        _meta: z.ZodOptional<z.ZodObject<{
            suggestions: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    optimization: "optimization";
                    alternative: "alternative";
                    follow_up: "follow_up";
                    warning: "warning";
                    related: "related";
                }>;
                message: z.ZodString;
                tool: z.ZodOptional<z.ZodString>;
                action: z.ZodOptional<z.ZodString>;
                reason: z.ZodString;
                priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    low: "low";
                    medium: "medium";
                    high: "high";
                }>>>;
            }, z.core.$strip>>>;
            costEstimate: z.ZodOptional<z.ZodObject<{
                apiCalls: z.ZodNumber;
                estimatedLatencyMs: z.ZodNumber;
                cellsAffected: z.ZodOptional<z.ZodNumber>;
                quotaImpact: z.ZodOptional<z.ZodObject<{
                    current: z.ZodNumber;
                    limit: z.ZodNumber;
                    remaining: z.ZodNumber;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            relatedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            documentation: z.ZodOptional<z.ZodString>;
            nextSteps: z.ZodOptional<z.ZodArray<z.ZodString>>;
            warnings: z.ZodOptional<z.ZodArray<z.ZodString>>;
            snapshot: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<false>;
        error: z.ZodObject<{
            code: z.ZodEnum<{
                INTERNAL_ERROR: "INTERNAL_ERROR";
                NOT_IMPLEMENTED: "NOT_IMPLEMENTED";
                AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED";
                INVALID_PARAMS: "INVALID_PARAMS";
                PARSE_ERROR: "PARSE_ERROR";
                INVALID_REQUEST: "INVALID_REQUEST";
                METHOD_NOT_FOUND: "METHOD_NOT_FOUND";
                UNAUTHENTICATED: "UNAUTHENTICATED";
                PERMISSION_DENIED: "PERMISSION_DENIED";
                INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
                INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS";
                QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
                RATE_LIMITED: "RATE_LIMITED";
                RESOURCE_EXHAUSTED: "RESOURCE_EXHAUSTED";
                SPREADSHEET_NOT_FOUND: "SPREADSHEET_NOT_FOUND";
                SPREADSHEET_TOO_LARGE: "SPREADSHEET_TOO_LARGE";
                SHEET_NOT_FOUND: "SHEET_NOT_FOUND";
                INVALID_SHEET_ID: "INVALID_SHEET_ID";
                DUPLICATE_SHEET_NAME: "DUPLICATE_SHEET_NAME";
                INVALID_RANGE: "INVALID_RANGE";
                RANGE_NOT_FOUND: "RANGE_NOT_FOUND";
                PROTECTED_RANGE: "PROTECTED_RANGE";
                FORMULA_ERROR: "FORMULA_ERROR";
                CIRCULAR_REFERENCE: "CIRCULAR_REFERENCE";
                INVALID_DATA_VALIDATION: "INVALID_DATA_VALIDATION";
                MERGE_CONFLICT: "MERGE_CONFLICT";
                CONDITIONAL_FORMAT_ERROR: "CONDITIONAL_FORMAT_ERROR";
                PIVOT_TABLE_ERROR: "PIVOT_TABLE_ERROR";
                CHART_ERROR: "CHART_ERROR";
                FILTER_VIEW_ERROR: "FILTER_VIEW_ERROR";
                NAMED_RANGE_ERROR: "NAMED_RANGE_ERROR";
                DEVELOPER_METADATA_ERROR: "DEVELOPER_METADATA_ERROR";
                DIMENSION_ERROR: "DIMENSION_ERROR";
                BATCH_UPDATE_ERROR: "BATCH_UPDATE_ERROR";
                TRANSACTION_ERROR: "TRANSACTION_ERROR";
                ABORTED: "ABORTED";
                DEADLINE_EXCEEDED: "DEADLINE_EXCEEDED";
                CANCELLED: "CANCELLED";
                DATA_LOSS: "DATA_LOSS";
                UNAVAILABLE: "UNAVAILABLE";
                UNIMPLEMENTED: "UNIMPLEMENTED";
                UNKNOWN: "UNKNOWN";
                OUT_OF_RANGE: "OUT_OF_RANGE";
                FAILED_PRECONDITION: "FAILED_PRECONDITION";
                PRECONDITION_FAILED: "PRECONDITION_FAILED";
                EFFECT_SCOPE_EXCEEDED: "EFFECT_SCOPE_EXCEEDED";
                EXPLICIT_RANGE_REQUIRED: "EXPLICIT_RANGE_REQUIRED";
                AMBIGUOUS_RANGE: "AMBIGUOUS_RANGE";
                FEATURE_UNAVAILABLE: "FEATURE_UNAVAILABLE";
                FEATURE_DEGRADED: "FEATURE_DEGRADED";
                AUTH_ERROR: "AUTH_ERROR";
                CONFIG_ERROR: "CONFIG_ERROR";
                VALIDATION_ERROR: "VALIDATION_ERROR";
                NOT_FOUND: "NOT_FOUND";
                HANDLER_LOAD_ERROR: "HANDLER_LOAD_ERROR";
                TOO_MANY_SESSIONS: "TOO_MANY_SESSIONS";
                DATA_ERROR: "DATA_ERROR";
                VERSION_MISMATCH: "VERSION_MISMATCH";
                NO_DATA: "NO_DATA";
                SERVICE_NOT_INITIALIZED: "SERVICE_NOT_INITIALIZED";
                SNAPSHOT_CREATION_FAILED: "SNAPSHOT_CREATION_FAILED";
                SNAPSHOT_RESTORE_FAILED: "SNAPSHOT_RESTORE_FAILED";
                TRANSACTION_CONFLICT: "TRANSACTION_CONFLICT";
                TRANSACTION_EXPIRED: "TRANSACTION_EXPIRED";
                SESSION_NOT_FOUND: "SESSION_NOT_FOUND";
                PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
                ELICITATION_UNAVAILABLE: "ELICITATION_UNAVAILABLE";
                SAMPLING_UNAVAILABLE: "SAMPLING_UNAVAILABLE";
                FORBIDDEN: "FORBIDDEN";
                REPLAY_FAILED: "REPLAY_FAILED";
                UNKNOWN_ERROR: "UNKNOWN_ERROR";
            }>;
            message: z.ZodString;
            details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            retryable: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            retryAfterMs: z.ZodOptional<z.ZodNumber>;
            suggestedFix: z.ZodOptional<z.ZodString>;
            alternatives: z.ZodOptional<z.ZodArray<z.ZodObject<{
                tool: z.ZodString;
                action: z.ZodString;
                description: z.ZodString;
            }, z.core.$strip>>>;
            resolution: z.ZodOptional<z.ZodString>;
            resolutionSteps: z.ZodOptional<z.ZodArray<z.ZodString>>;
            category: z.ZodOptional<z.ZodEnum<{
                unknown: "unknown";
                client: "client";
                server: "server";
                network: "network";
                auth: "auth";
                quota: "quota";
            }>>;
            severity: z.ZodOptional<z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
                critical: "critical";
            }>>;
            retryStrategy: z.ZodOptional<z.ZodEnum<{
                exponential_backoff: "exponential_backoff";
                wait_for_reset: "wait_for_reset";
                manual: "manual";
                none: "none";
            }>>;
            suggestedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>], "success">;
}, z.core.$strip>;
export declare const SHEETS_DATA_ANNOTATIONS: ToolAnnotations;
export type SheetsDataInput = z.infer<typeof SheetsDataInputSchema>;
export type SheetsDataOutput = z.infer<typeof SheetsDataOutputSchema>;
export type DataResponse = z.infer<typeof DataResponseSchema>;
export type DataReadInput = SheetsDataInput['request'] & {
    action: 'read';
    spreadsheetId: string;
    range: RangeInput;
};
export type DataWriteInput = SheetsDataInput['request'] & {
    action: 'write';
    spreadsheetId: string;
    range: RangeInput;
    values: unknown[][];
};
export type DataAppendInput = SheetsDataInput['request'] & {
    action: 'append';
    spreadsheetId: string;
    range: RangeInput;
    values: unknown[][];
};
export type DataClearInput = SheetsDataInput['request'] & {
    action: 'clear';
    spreadsheetId: string;
    range: RangeInput;
};
export type DataBatchReadInput = SheetsDataInput['request'] & {
    action: 'batch_read';
    spreadsheetId: string;
    ranges: RangeInput[];
};
export type DataBatchWriteInput = SheetsDataInput['request'] & {
    action: 'batch_write';
    spreadsheetId: string;
    data: Array<{
        range: RangeInput;
        values: unknown[][];
    }>;
};
export type DataBatchClearInput = SheetsDataInput['request'] & {
    action: 'batch_clear';
    spreadsheetId: string;
    ranges: RangeInput[];
};
export type DataFindReplaceInput = SheetsDataInput['request'] & {
    action: 'find_replace';
    spreadsheetId: string;
    find: string;
};
export type DataAddNoteInput = SheetsDataInput['request'] & {
    action: 'add_note';
    spreadsheetId: string;
    cell: string;
    note: string;
};
export type DataGetNoteInput = SheetsDataInput['request'] & {
    action: 'get_note';
    spreadsheetId: string;
    cell: string;
};
export type DataClearNoteInput = SheetsDataInput['request'] & {
    action: 'clear_note';
    spreadsheetId: string;
    cell: string;
};
export type DataSetValidationInput = SheetsDataInput['request'] & {
    action: 'set_validation';
    spreadsheetId: string;
    range: RangeInput;
    validation: z.infer<typeof DataValidationSchema>;
};
export type DataClearValidationInput = SheetsDataInput['request'] & {
    action: 'clear_validation';
    spreadsheetId: string;
    range: RangeInput;
};
export type DataSetHyperlinkInput = SheetsDataInput['request'] & {
    action: 'set_hyperlink';
    spreadsheetId: string;
    cell: string;
    url: string;
};
export type DataClearHyperlinkInput = SheetsDataInput['request'] & {
    action: 'clear_hyperlink';
    spreadsheetId: string;
    cell: string;
};
export type DataMergeCellsInput = SheetsDataInput['request'] & {
    action: 'merge_cells';
    spreadsheetId: string;
    range: RangeInput;
};
export type DataUnmergeCellsInput = SheetsDataInput['request'] & {
    action: 'unmerge_cells';
    spreadsheetId: string;
    range: RangeInput;
};
export type DataGetMergesInput = SheetsDataInput['request'] & {
    action: 'get_merges';
    spreadsheetId: string;
    sheetId: number;
};
export type DataCutPasteInput = SheetsDataInput['request'] & {
    action: 'cut_paste';
    spreadsheetId: string;
    source: RangeInput;
    destination: string;
};
export type DataCopyPasteInput = SheetsDataInput['request'] & {
    action: 'copy_paste';
    spreadsheetId: string;
    source: RangeInput;
    destination: string;
};
export {};
//# sourceMappingURL=data.d.ts.map