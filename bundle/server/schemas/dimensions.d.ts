/**
 * Tool 6: sheets_dimensions
 * Row and column operations, filtering, and sorting
 */
import { z } from 'zod';
import { RangeInputSchema, type ToolAnnotations } from './shared.js';
declare const FilterCriteriaSchema: z.ZodObject<{
    hiddenValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
    condition: z.ZodOptional<z.ZodObject<{
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
    }, z.core.$strip>>;
    visibleBackgroundColor: z.ZodOptional<z.ZodObject<{
        red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>;
    visibleForegroundColor: z.ZodOptional<z.ZodObject<{
        red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const SortSpecSchema: z.ZodObject<{
    columnIndex: z.ZodCoercedNumber<unknown>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        ASCENDING: "ASCENDING";
        DESCENDING: "DESCENDING";
    }>>>;
    foregroundColor: z.ZodOptional<z.ZodObject<{
        red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>;
    backgroundColor: z.ZodOptional<z.ZodObject<{
        red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const SlicerPositionSchema: z.ZodObject<{
    anchorCell: z.ZodString;
    offsetX: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    offsetY: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    width: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    height: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
/**
 * All dimension, filter, and sort operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export declare const SheetsDimensionsInputSchema: z.ZodObject<{
    request: z.ZodDiscriminatedUnion<[z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"insert_rows">;
        startIndex: z.ZodCoercedNumber<unknown>;
        count: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
        inheritFromBefore: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"insert_columns">;
        startIndex: z.ZodCoercedNumber<unknown>;
        count: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
        inheritFromBefore: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"delete_rows">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
        allowMissing: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"delete_columns">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
        allowMissing: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"move_rows">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
        destinationIndex: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"move_columns">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
        destinationIndex: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"resize_rows">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
        pixelSize: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"resize_columns">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
        pixelSize: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"auto_resize">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
        dimension: z.ZodEnum<{
            ROWS: "ROWS";
            COLUMNS: "COLUMNS";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"hide_rows">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"hide_columns">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"show_rows">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"show_columns">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"freeze_rows">;
        frozenRowCount: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"freeze_columns">;
        frozenColumnCount: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"group_rows">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
        depth: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"group_columns">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
        depth: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"ungroup_rows">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"ungroup_columns">;
        startIndex: z.ZodCoercedNumber<unknown>;
        endIndex: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"append_rows">;
        count: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"append_columns">;
        count: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"set_basic_filter">;
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
        criteria: z.ZodOptional<z.ZodRecord<z.ZodCoercedNumber<unknown>, z.ZodObject<{
            hiddenValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            condition: z.ZodOptional<z.ZodObject<{
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
            }, z.core.$strip>>;
            visibleBackgroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            visibleForegroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"clear_basic_filter">;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"get_basic_filter">;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"filter_update_filter_criteria">;
        columnIndex: z.ZodCoercedNumber<unknown>;
        criteria: z.ZodRecord<z.ZodCoercedNumber<unknown>, z.ZodObject<{
            hiddenValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            condition: z.ZodOptional<z.ZodObject<{
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
            }, z.core.$strip>>;
            visibleBackgroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            visibleForegroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"sort_range">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
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
        sortSpecs: z.ZodArray<z.ZodObject<{
            columnIndex: z.ZodCoercedNumber<unknown>;
            sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                ASCENDING: "ASCENDING";
                DESCENDING: "DESCENDING";
            }>>>;
            foregroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            backgroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"trim_whitespace">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
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
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"randomize_range">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
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
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"text_to_columns">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
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
        delimiterType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            CUSTOM: "CUSTOM";
            DETECT: "DETECT";
            COMMA: "COMMA";
            SEMICOLON: "SEMICOLON";
            PERIOD: "PERIOD";
            SPACE: "SPACE";
        }>>>;
        delimiter: z.ZodOptional<z.ZodString>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"auto_fill">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
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
        sourceRange: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
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
        fillLength: z.ZodOptional<z.ZodNumber>;
        dimension: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            ROWS: "ROWS";
            COLUMNS: "COLUMNS";
        }>>>;
        useAlternateSeries: z.ZodOptional<z.ZodBoolean>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"create_filter_view">;
        title: z.ZodString;
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
        criteria: z.ZodOptional<z.ZodRecord<z.ZodCoercedNumber<unknown>, z.ZodObject<{
            hiddenValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            condition: z.ZodOptional<z.ZodObject<{
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
            }, z.core.$strip>>;
            visibleBackgroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            visibleForegroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        sortSpecs: z.ZodOptional<z.ZodArray<z.ZodObject<{
            columnIndex: z.ZodCoercedNumber<unknown>;
            sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                ASCENDING: "ASCENDING";
                DESCENDING: "DESCENDING";
            }>>>;
            foregroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            backgroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"update_filter_view">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        filterViewId: z.ZodCoercedNumber<unknown>;
        title: z.ZodOptional<z.ZodString>;
        criteria: z.ZodOptional<z.ZodRecord<z.ZodCoercedNumber<unknown>, z.ZodObject<{
            hiddenValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            condition: z.ZodOptional<z.ZodObject<{
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
            }, z.core.$strip>>;
            visibleBackgroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            visibleForegroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        sortSpecs: z.ZodOptional<z.ZodArray<z.ZodObject<{
            columnIndex: z.ZodCoercedNumber<unknown>;
            sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                ASCENDING: "ASCENDING";
                DESCENDING: "DESCENDING";
            }>>>;
            foregroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            backgroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"delete_filter_view">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        filterViewId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"list_filter_views">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"get_filter_view">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        filterViewId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
        action: z.ZodLiteral<"create_slicer">;
        title: z.ZodOptional<z.ZodString>;
        dataRange: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
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
        filterColumn: z.ZodCoercedNumber<unknown>;
        position: z.ZodObject<{
            anchorCell: z.ZodString;
            offsetX: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
            offsetY: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
            width: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
            height: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"update_slicer">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        slicerId: z.ZodCoercedNumber<unknown>;
        title: z.ZodOptional<z.ZodString>;
        filterColumn: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"delete_slicer">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        slicerId: z.ZodCoercedNumber<unknown>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
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
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"list_slicers">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>], "action">;
}, z.core.$strip>;
declare const DimensionsResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    action: z.ZodString;
    rowsAffected: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    columnsAffected: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    newSize: z.ZodOptional<z.ZodObject<{
        rowCount: z.ZodCoercedNumber<unknown>;
        columnCount: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>>;
    alreadyMissing: z.ZodOptional<z.ZodBoolean>;
    filter: z.ZodOptional<z.ZodObject<{
        range: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        criteria: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>>;
    filterViews: z.ZodOptional<z.ZodArray<z.ZodObject<{
        filterViewId: z.ZodCoercedNumber<unknown>;
        title: z.ZodString;
        range: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>>>;
    filterViewId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    slicers: z.ZodOptional<z.ZodArray<z.ZodObject<{
        slicerId: z.ZodCoercedNumber<unknown>;
        sheetId: z.ZodCoercedNumber<unknown>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    slicerId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    cellsChanged: z.ZodOptional<z.ZodNumber>;
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
export declare const SheetsDimensionsOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodString;
        rowsAffected: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        columnsAffected: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        newSize: z.ZodOptional<z.ZodObject<{
            rowCount: z.ZodCoercedNumber<unknown>;
            columnCount: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>;
        alreadyMissing: z.ZodOptional<z.ZodBoolean>;
        filter: z.ZodOptional<z.ZodObject<{
            range: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
            criteria: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>>;
        filterViews: z.ZodOptional<z.ZodArray<z.ZodObject<{
            filterViewId: z.ZodCoercedNumber<unknown>;
            title: z.ZodString;
            range: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>>>;
        filterViewId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        slicers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            slicerId: z.ZodCoercedNumber<unknown>;
            sheetId: z.ZodCoercedNumber<unknown>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        slicerId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        cellsChanged: z.ZodOptional<z.ZodNumber>;
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
export declare const SHEETS_DIMENSIONS_ANNOTATIONS: ToolAnnotations;
export type SheetsDimensionsInput = z.infer<typeof SheetsDimensionsInputSchema>;
export type SheetsDimensionsOutput = z.infer<typeof SheetsDimensionsOutputSchema>;
export type DimensionsResponse = z.infer<typeof DimensionsResponseSchema>;
/** The unwrapped request type (the discriminated union of actions) */
export type DimensionsRequest = SheetsDimensionsInput['request'];
export type DimensionsInsertRowsInput = SheetsDimensionsInput['request'] & {
    action: 'insert_rows';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
};
export type DimensionsInsertColumnsInput = SheetsDimensionsInput['request'] & {
    action: 'insert_columns';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
};
export type DimensionsDeleteRowsInput = SheetsDimensionsInput['request'] & {
    action: 'delete_rows';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
};
export type DimensionsDeleteColumnsInput = SheetsDimensionsInput['request'] & {
    action: 'delete_columns';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
};
export type DimensionsMoveRowsInput = SheetsDimensionsInput['request'] & {
    action: 'move_rows';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
    destinationIndex: number;
};
export type DimensionsMoveColumnsInput = SheetsDimensionsInput['request'] & {
    action: 'move_columns';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
    destinationIndex: number;
};
export type DimensionsResizeRowsInput = SheetsDimensionsInput['request'] & {
    action: 'resize_rows';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
    pixelSize: number;
};
export type DimensionsResizeColumnsInput = SheetsDimensionsInput['request'] & {
    action: 'resize_columns';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
    pixelSize: number;
};
export type DimensionsAutoResizeInput = SheetsDimensionsInput['request'] & {
    action: 'auto_resize';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
    dimension: 'ROWS' | 'COLUMNS';
};
export type DimensionsHideRowsInput = SheetsDimensionsInput['request'] & {
    action: 'hide_rows';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
};
export type DimensionsHideColumnsInput = SheetsDimensionsInput['request'] & {
    action: 'hide_columns';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
};
export type DimensionsShowRowsInput = SheetsDimensionsInput['request'] & {
    action: 'show_rows';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
};
export type DimensionsShowColumnsInput = SheetsDimensionsInput['request'] & {
    action: 'show_columns';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
};
export type DimensionsFreezeRowsInput = SheetsDimensionsInput['request'] & {
    action: 'freeze_rows';
    spreadsheetId: string;
    sheetId: number;
    frozenRowCount: number;
};
export type DimensionsFreezeColumnsInput = SheetsDimensionsInput['request'] & {
    action: 'freeze_columns';
    spreadsheetId: string;
    sheetId: number;
    frozenColumnCount: number;
};
export type DimensionsGroupRowsInput = SheetsDimensionsInput['request'] & {
    action: 'group_rows';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
};
export type DimensionsGroupColumnsInput = SheetsDimensionsInput['request'] & {
    action: 'group_columns';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
};
export type DimensionsUngroupRowsInput = SheetsDimensionsInput['request'] & {
    action: 'ungroup_rows';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
};
export type DimensionsUngroupColumnsInput = SheetsDimensionsInput['request'] & {
    action: 'ungroup_columns';
    spreadsheetId: string;
    sheetId: number;
    startIndex: number;
    endIndex: number;
};
export type DimensionsAppendRowsInput = SheetsDimensionsInput['request'] & {
    action: 'append_rows';
    spreadsheetId: string;
    sheetId: number;
    count: number;
};
export type DimensionsAppendColumnsInput = SheetsDimensionsInput['request'] & {
    action: 'append_columns';
    spreadsheetId: string;
    sheetId: number;
    count: number;
};
export type DimensionsSetBasicFilterInput = SheetsDimensionsInput['request'] & {
    action: 'set_basic_filter';
    spreadsheetId: string;
    sheetId: number;
};
export type DimensionsClearBasicFilterInput = SheetsDimensionsInput['request'] & {
    action: 'clear_basic_filter';
    spreadsheetId: string;
    sheetId: number;
};
export type DimensionsGetBasicFilterInput = SheetsDimensionsInput['request'] & {
    action: 'get_basic_filter';
    spreadsheetId: string;
    sheetId: number;
};
export type DimensionsFilterUpdateFilterCriteriaInput = SheetsDimensionsInput['request'] & {
    action: 'filter_update_filter_criteria';
    spreadsheetId: string;
    sheetId: number;
    columnIndex: number;
    criteria: Record<number, z.infer<typeof FilterCriteriaSchema>>;
};
export type DimensionsSortRangeInput = SheetsDimensionsInput['request'] & {
    action: 'sort_range';
    spreadsheetId: string;
    range: z.infer<typeof RangeInputSchema>;
    sortSpecs: Array<z.infer<typeof SortSpecSchema>>;
};
export type DimensionsTrimWhitespaceInput = SheetsDimensionsInput['request'] & {
    action: 'trim_whitespace';
    spreadsheetId: string;
    range: z.infer<typeof RangeInputSchema>;
};
export type DimensionsRandomizeRangeInput = SheetsDimensionsInput['request'] & {
    action: 'randomize_range';
    spreadsheetId: string;
    range: z.infer<typeof RangeInputSchema>;
};
export type DimensionsTextToColumnsInput = SheetsDimensionsInput['request'] & {
    action: 'text_to_columns';
    spreadsheetId: string;
    source: z.infer<typeof RangeInputSchema>;
    delimiterType?: 'DETECT' | 'COMMA' | 'SEMICOLON' | 'PERIOD' | 'SPACE' | 'CUSTOM';
    delimiter?: string;
};
export type DimensionsAutoFillInput = SheetsDimensionsInput['request'] & {
    action: 'auto_fill';
    spreadsheetId: string;
    range?: z.infer<typeof RangeInputSchema>;
    sourceRange?: z.infer<typeof RangeInputSchema>;
    fillLength?: number;
    dimension?: 'ROWS' | 'COLUMNS';
    useAlternateSeries?: boolean;
};
export type DimensionsCreateFilterViewInput = SheetsDimensionsInput['request'] & {
    action: 'create_filter_view';
    spreadsheetId: string;
    sheetId: number;
    title: string;
};
export type DimensionsUpdateFilterViewInput = SheetsDimensionsInput['request'] & {
    action: 'update_filter_view';
    spreadsheetId: string;
    filterViewId: number;
};
export type DimensionsDeleteFilterViewInput = SheetsDimensionsInput['request'] & {
    action: 'delete_filter_view';
    spreadsheetId: string;
    filterViewId: number;
};
export type DimensionsListFilterViewsInput = SheetsDimensionsInput['request'] & {
    action: 'list_filter_views';
    spreadsheetId: string;
};
export type DimensionsGetFilterViewInput = SheetsDimensionsInput['request'] & {
    action: 'get_filter_view';
    spreadsheetId: string;
    filterViewId: number;
};
export type DimensionsCreateSlicerInput = SheetsDimensionsInput['request'] & {
    action: 'create_slicer';
    spreadsheetId: string;
    sheetId: number;
    dataRange: z.infer<typeof RangeInputSchema>;
    filterColumn: number;
    position: z.infer<typeof SlicerPositionSchema>;
};
export type DimensionsUpdateSlicerInput = SheetsDimensionsInput['request'] & {
    action: 'update_slicer';
    spreadsheetId: string;
    slicerId: number;
};
export type DimensionsDeleteSlicerInput = SheetsDimensionsInput['request'] & {
    action: 'delete_slicer';
    spreadsheetId: string;
    slicerId: number;
};
export type DimensionsListSlicersInput = SheetsDimensionsInput['request'] & {
    action: 'list_slicers';
    spreadsheetId: string;
};
export {};
//# sourceMappingURL=dimensions.d.ts.map