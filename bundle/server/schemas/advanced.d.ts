/**
 * Tool 15: sheets_advanced
 * Advanced features: named ranges, protected ranges, metadata, banding, tables, and smart chips
 *
 * 23 Actions:
 * Named Ranges (5): add_named_range, update_named_range, delete_named_range, list_named_ranges, get_named_range
 * Protected Ranges (4): add_protected_range, update_protected_range, delete_protected_range, list_protected_ranges
 * Metadata (3): set_metadata, get_metadata, delete_metadata
 * Banding (4): add_banding, update_banding, delete_banding, list_banding
 * Tables (3): create_table, delete_table, list_tables
 * Smart Chips (4): add_person_chip, add_drive_chip, add_rich_link_chip, list_chips
 */
import { z } from 'zod';
import { RangeInputSchema, type ToolAnnotations } from './shared.js';
/**
 * All advanced operation inputs (23 actions)
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export declare const SheetsAdvancedInputSchema: z.ZodObject<{
    request: z.ZodDiscriminatedUnion<[z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"add_named_range">;
        name: z.ZodString;
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
        action: z.ZodLiteral<"update_named_range">;
        namedRangeId: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
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
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"delete_named_range">;
        namedRangeId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"list_named_ranges">;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"get_named_range">;
        name: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"add_protected_range">;
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
        description: z.ZodOptional<z.ZodString>;
        warningOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        editors: z.ZodOptional<z.ZodObject<{
            users: z.ZodOptional<z.ZodArray<z.ZodString>>;
            groups: z.ZodOptional<z.ZodArray<z.ZodString>>;
            domainUsersCanEdit: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"update_protected_range">;
        protectedRangeId: z.ZodCoercedNumber<unknown>;
        description: z.ZodOptional<z.ZodString>;
        warningOnly: z.ZodOptional<z.ZodBoolean>;
        editors: z.ZodOptional<z.ZodObject<{
            users: z.ZodOptional<z.ZodArray<z.ZodString>>;
            groups: z.ZodOptional<z.ZodArray<z.ZodString>>;
            domainUsersCanEdit: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
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
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"delete_protected_range">;
        protectedRangeId: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"list_protected_ranges">;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"set_metadata">;
        metadataKey: z.ZodString;
        metadataValue: z.ZodString;
        visibility: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            DOCUMENT: "DOCUMENT";
            PROJECT: "PROJECT";
        }>>>;
        location: z.ZodOptional<z.ZodObject<{
            sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
            dimensionRange: z.ZodOptional<z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                dimension: z.ZodEnum<{
                    ROWS: "ROWS";
                    COLUMNS: "COLUMNS";
                }>;
                startIndex: z.ZodCoercedNumber<unknown>;
                endIndex: z.ZodCoercedNumber<unknown>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"get_metadata">;
        metadataId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        metadataKey: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"delete_metadata">;
        metadataId: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"add_banding">;
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
        rowProperties: z.ZodOptional<z.ZodObject<{
            headerColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            firstBandColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            secondBandColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            footerColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        columnProperties: z.ZodOptional<z.ZodObject<{
            headerColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            firstBandColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            secondBandColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            footerColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"update_banding">;
        bandedRangeId: z.ZodCoercedNumber<unknown>;
        rowProperties: z.ZodOptional<z.ZodObject<{
            headerColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            firstBandColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            secondBandColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            footerColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        columnProperties: z.ZodOptional<z.ZodObject<{
            headerColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            firstBandColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            secondBandColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            footerColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"delete_banding">;
        bandedRangeId: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"list_banding">;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"create_table">;
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
        hasHeaders: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"delete_table">;
        tableId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"list_tables">;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"add_person_chip">;
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
        email: z.ZodString;
        displayFormat: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            SHORT: "SHORT";
            FULL: "FULL";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"add_drive_chip">;
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
        fileId: z.ZodString;
        displayText: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"add_rich_link_chip">;
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
        uri: z.ZodString;
        displayText: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
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
        action: z.ZodLiteral<"list_chips">;
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
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        chipType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            person: "person";
            drive: "drive";
            rich_link: "rich_link";
            all: "all";
        }>>>;
    }, z.core.$strip>], "action">;
}, z.core.$strip>;
declare const AdvancedResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    action: z.ZodString;
    namedRange: z.ZodOptional<z.ZodObject<{
        namedRangeId: z.ZodString;
        name: z.ZodString;
        range: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    namedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
        namedRangeId: z.ZodString;
        name: z.ZodString;
        range: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>>>;
    protectedRange: z.ZodOptional<z.ZodObject<{
        protectedRangeId: z.ZodCoercedNumber<unknown>;
        range: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        description: z.ZodOptional<z.ZodString>;
        warningOnly: z.ZodBoolean;
        requestingUserCanEdit: z.ZodBoolean;
        editors: z.ZodOptional<z.ZodObject<{
            users: z.ZodOptional<z.ZodArray<z.ZodString>>;
            groups: z.ZodOptional<z.ZodArray<z.ZodString>>;
            domainUsersCanEdit: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    protectedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
        protectedRangeId: z.ZodCoercedNumber<unknown>;
        range: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        description: z.ZodOptional<z.ZodString>;
        warningOnly: z.ZodBoolean;
        requestingUserCanEdit: z.ZodBoolean;
        editors: z.ZodOptional<z.ZodObject<{
            users: z.ZodOptional<z.ZodArray<z.ZodString>>;
            groups: z.ZodOptional<z.ZodArray<z.ZodString>>;
            domainUsersCanEdit: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    metadata: z.ZodOptional<z.ZodObject<{
        metadataId: z.ZodCoercedNumber<unknown>;
        metadataKey: z.ZodString;
        metadataValue: z.ZodString;
        visibility: z.ZodEnum<{
            DOCUMENT: "DOCUMENT";
            PROJECT: "PROJECT";
        }>;
        location: z.ZodOptional<z.ZodObject<{
            sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
            dimensionRange: z.ZodOptional<z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                dimension: z.ZodEnum<{
                    ROWS: "ROWS";
                    COLUMNS: "COLUMNS";
                }>;
                startIndex: z.ZodCoercedNumber<unknown>;
                endIndex: z.ZodCoercedNumber<unknown>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    metadataList: z.ZodOptional<z.ZodArray<z.ZodObject<{
        metadataId: z.ZodCoercedNumber<unknown>;
        metadataKey: z.ZodString;
        metadataValue: z.ZodString;
    }, z.core.$strip>>>;
    bandedRange: z.ZodOptional<z.ZodObject<{
        bandedRangeId: z.ZodCoercedNumber<unknown>;
        range: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        rowProperties: z.ZodOptional<z.ZodObject<{
            headerColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            firstBandColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            secondBandColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            footerColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        columnProperties: z.ZodOptional<z.ZodObject<{
            headerColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            firstBandColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            secondBandColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            footerColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    bandedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
        bandedRangeId: z.ZodCoercedNumber<unknown>;
        range: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>>>;
    table: z.ZodOptional<z.ZodObject<{
        tableId: z.ZodString;
        range: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        hasHeaders: z.ZodBoolean;
    }, z.core.$strip>>;
    tables: z.ZodOptional<z.ZodArray<z.ZodObject<{
        tableId: z.ZodString;
        range: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>>>;
    chip: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<{
            person: "person";
            drive: "drive";
            rich_link: "rich_link";
        }>;
        cell: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
        fileId: z.ZodOptional<z.ZodString>;
        uri: z.ZodOptional<z.ZodString>;
        displayText: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    chips: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            person: "person";
            drive: "drive";
            rich_link: "rich_link";
        }>;
        cell: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
        fileId: z.ZodOptional<z.ZodString>;
        uri: z.ZodOptional<z.ZodString>;
        displayText: z.ZodOptional<z.ZodString>;
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
            PARSE_ERROR: "PARSE_ERROR";
            INVALID_REQUEST: "INVALID_REQUEST";
            METHOD_NOT_FOUND: "METHOD_NOT_FOUND";
            INVALID_PARAMS: "INVALID_PARAMS";
            INTERNAL_ERROR: "INTERNAL_ERROR";
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
            AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED";
            AUTH_ERROR: "AUTH_ERROR";
            CONFIG_ERROR: "CONFIG_ERROR";
            VALIDATION_ERROR: "VALIDATION_ERROR";
            NOT_FOUND: "NOT_FOUND";
            NOT_IMPLEMENTED: "NOT_IMPLEMENTED";
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
export declare const SheetsAdvancedOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodString;
        namedRange: z.ZodOptional<z.ZodObject<{
            namedRangeId: z.ZodString;
            name: z.ZodString;
            range: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>>;
        namedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            namedRangeId: z.ZodString;
            name: z.ZodString;
            range: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>>>;
        protectedRange: z.ZodOptional<z.ZodObject<{
            protectedRangeId: z.ZodCoercedNumber<unknown>;
            range: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
            description: z.ZodOptional<z.ZodString>;
            warningOnly: z.ZodBoolean;
            requestingUserCanEdit: z.ZodBoolean;
            editors: z.ZodOptional<z.ZodObject<{
                users: z.ZodOptional<z.ZodArray<z.ZodString>>;
                groups: z.ZodOptional<z.ZodArray<z.ZodString>>;
                domainUsersCanEdit: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        protectedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            protectedRangeId: z.ZodCoercedNumber<unknown>;
            range: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
            description: z.ZodOptional<z.ZodString>;
            warningOnly: z.ZodBoolean;
            requestingUserCanEdit: z.ZodBoolean;
            editors: z.ZodOptional<z.ZodObject<{
                users: z.ZodOptional<z.ZodArray<z.ZodString>>;
                groups: z.ZodOptional<z.ZodArray<z.ZodString>>;
                domainUsersCanEdit: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        metadata: z.ZodOptional<z.ZodObject<{
            metadataId: z.ZodCoercedNumber<unknown>;
            metadataKey: z.ZodString;
            metadataValue: z.ZodString;
            visibility: z.ZodEnum<{
                DOCUMENT: "DOCUMENT";
                PROJECT: "PROJECT";
            }>;
            location: z.ZodOptional<z.ZodObject<{
                sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                dimensionRange: z.ZodOptional<z.ZodObject<{
                    sheetId: z.ZodCoercedNumber<unknown>;
                    dimension: z.ZodEnum<{
                        ROWS: "ROWS";
                        COLUMNS: "COLUMNS";
                    }>;
                    startIndex: z.ZodCoercedNumber<unknown>;
                    endIndex: z.ZodCoercedNumber<unknown>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        metadataList: z.ZodOptional<z.ZodArray<z.ZodObject<{
            metadataId: z.ZodCoercedNumber<unknown>;
            metadataKey: z.ZodString;
            metadataValue: z.ZodString;
        }, z.core.$strip>>>;
        bandedRange: z.ZodOptional<z.ZodObject<{
            bandedRangeId: z.ZodCoercedNumber<unknown>;
            range: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
            rowProperties: z.ZodOptional<z.ZodObject<{
                headerColor: z.ZodOptional<z.ZodObject<{
                    red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                }, z.core.$strip>>;
                firstBandColor: z.ZodOptional<z.ZodObject<{
                    red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                }, z.core.$strip>>;
                secondBandColor: z.ZodOptional<z.ZodObject<{
                    red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                }, z.core.$strip>>;
                footerColor: z.ZodOptional<z.ZodObject<{
                    red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            columnProperties: z.ZodOptional<z.ZodObject<{
                headerColor: z.ZodOptional<z.ZodObject<{
                    red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                }, z.core.$strip>>;
                firstBandColor: z.ZodOptional<z.ZodObject<{
                    red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                }, z.core.$strip>>;
                secondBandColor: z.ZodOptional<z.ZodObject<{
                    red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                }, z.core.$strip>>;
                footerColor: z.ZodOptional<z.ZodObject<{
                    red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        bandedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            bandedRangeId: z.ZodCoercedNumber<unknown>;
            range: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>>>;
        table: z.ZodOptional<z.ZodObject<{
            tableId: z.ZodString;
            range: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
            hasHeaders: z.ZodBoolean;
        }, z.core.$strip>>;
        tables: z.ZodOptional<z.ZodArray<z.ZodObject<{
            tableId: z.ZodString;
            range: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
        }, z.core.$strip>>>;
        chip: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                person: "person";
                drive: "drive";
                rich_link: "rich_link";
            }>;
            cell: z.ZodString;
            email: z.ZodOptional<z.ZodString>;
            fileId: z.ZodOptional<z.ZodString>;
            uri: z.ZodOptional<z.ZodString>;
            displayText: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        chips: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                person: "person";
                drive: "drive";
                rich_link: "rich_link";
            }>;
            cell: z.ZodString;
            email: z.ZodOptional<z.ZodString>;
            fileId: z.ZodOptional<z.ZodString>;
            uri: z.ZodOptional<z.ZodString>;
            displayText: z.ZodOptional<z.ZodString>;
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
                PARSE_ERROR: "PARSE_ERROR";
                INVALID_REQUEST: "INVALID_REQUEST";
                METHOD_NOT_FOUND: "METHOD_NOT_FOUND";
                INVALID_PARAMS: "INVALID_PARAMS";
                INTERNAL_ERROR: "INTERNAL_ERROR";
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
                AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED";
                AUTH_ERROR: "AUTH_ERROR";
                CONFIG_ERROR: "CONFIG_ERROR";
                VALIDATION_ERROR: "VALIDATION_ERROR";
                NOT_FOUND: "NOT_FOUND";
                NOT_IMPLEMENTED: "NOT_IMPLEMENTED";
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
export declare const SHEETS_ADVANCED_ANNOTATIONS: ToolAnnotations;
export type SheetsAdvancedInput = z.infer<typeof SheetsAdvancedInputSchema>;
export type SheetsAdvancedOutput = z.infer<typeof SheetsAdvancedOutputSchema>;
export type AdvancedResponse = z.infer<typeof AdvancedResponseSchema>;
/** The unwrapped request type (the discriminated union of actions) */
export type AdvancedRequest = SheetsAdvancedInput['request'];
export type AdvancedAddNamedRangeInput = SheetsAdvancedInput['request'] & {
    action: 'add_named_range';
    spreadsheetId: string;
    name: string;
    range: z.infer<typeof RangeInputSchema>;
};
export type AdvancedUpdateNamedRangeInput = SheetsAdvancedInput['request'] & {
    action: 'update_named_range';
    spreadsheetId: string;
    namedRangeId: string;
};
export type AdvancedDeleteNamedRangeInput = SheetsAdvancedInput['request'] & {
    action: 'delete_named_range';
    spreadsheetId: string;
    namedRangeId: string;
};
export type AdvancedListNamedRangesInput = SheetsAdvancedInput['request'] & {
    action: 'list_named_ranges';
    spreadsheetId: string;
};
export type AdvancedGetNamedRangeInput = SheetsAdvancedInput['request'] & {
    action: 'get_named_range';
    spreadsheetId: string;
    name: string;
};
export type AdvancedAddProtectedRangeInput = SheetsAdvancedInput['request'] & {
    action: 'add_protected_range';
    spreadsheetId: string;
    range: z.infer<typeof RangeInputSchema>;
};
export type AdvancedUpdateProtectedRangeInput = SheetsAdvancedInput['request'] & {
    action: 'update_protected_range';
    spreadsheetId: string;
    protectedRangeId: number;
};
export type AdvancedDeleteProtectedRangeInput = SheetsAdvancedInput['request'] & {
    action: 'delete_protected_range';
    spreadsheetId: string;
    protectedRangeId: number;
};
export type AdvancedListProtectedRangesInput = SheetsAdvancedInput['request'] & {
    action: 'list_protected_ranges';
    spreadsheetId: string;
};
export type AdvancedSetMetadataInput = SheetsAdvancedInput['request'] & {
    action: 'set_metadata';
    spreadsheetId: string;
    metadataKey: string;
    metadataValue: string;
};
export type AdvancedGetMetadataInput = SheetsAdvancedInput['request'] & {
    action: 'get_metadata';
    spreadsheetId: string;
};
export type AdvancedDeleteMetadataInput = SheetsAdvancedInput['request'] & {
    action: 'delete_metadata';
    spreadsheetId: string;
    metadataId: number;
};
export type AdvancedAddBandingInput = SheetsAdvancedInput['request'] & {
    action: 'add_banding';
    spreadsheetId: string;
    range: z.infer<typeof RangeInputSchema>;
};
export type AdvancedUpdateBandingInput = SheetsAdvancedInput['request'] & {
    action: 'update_banding';
    spreadsheetId: string;
    bandedRangeId: number;
};
export type AdvancedDeleteBandingInput = SheetsAdvancedInput['request'] & {
    action: 'delete_banding';
    spreadsheetId: string;
    bandedRangeId: number;
};
export type AdvancedListBandingInput = SheetsAdvancedInput['request'] & {
    action: 'list_banding';
    spreadsheetId: string;
};
export type AdvancedCreateTableInput = SheetsAdvancedInput['request'] & {
    action: 'create_table';
    spreadsheetId: string;
    range: z.infer<typeof RangeInputSchema>;
};
export type AdvancedDeleteTableInput = SheetsAdvancedInput['request'] & {
    action: 'delete_table';
    spreadsheetId: string;
    tableId: string;
};
export type AdvancedListTablesInput = SheetsAdvancedInput['request'] & {
    action: 'list_tables';
    spreadsheetId: string;
};
export type AdvancedAddPersonChipInput = SheetsAdvancedInput['request'] & {
    action: 'add_person_chip';
    spreadsheetId: string;
    range: z.infer<typeof RangeInputSchema>;
    email: string;
};
export type AdvancedAddDriveChipInput = SheetsAdvancedInput['request'] & {
    action: 'add_drive_chip';
    spreadsheetId: string;
    range: z.infer<typeof RangeInputSchema>;
    fileId: string;
};
export type AdvancedAddRichLinkChipInput = SheetsAdvancedInput['request'] & {
    action: 'add_rich_link_chip';
    spreadsheetId: string;
    range: z.infer<typeof RangeInputSchema>;
    uri: string;
};
export type AdvancedListChipsInput = SheetsAdvancedInput['request'] & {
    action: 'list_chips';
    spreadsheetId: string;
};
export {};
//# sourceMappingURL=advanced.d.ts.map