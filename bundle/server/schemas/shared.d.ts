/**
 * ServalSheets - Shared Schemas
 *
 * MCP Protocol: 2025-11-25
 * Google Sheets API: v4
 */
import { z } from 'zod';
export declare const MCP_PROTOCOL_VERSION = "2025-11-25";
export declare const SHEETS_API_VERSION = "v4";
export declare const DRIVE_API_VERSION = "v3";
/** Google Sheets API color format (0-1 scale) */
export declare const ColorSchema: z.ZodObject<{
    red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
/** Cell value types */
export declare const CellValueSchema: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
/** 2D array of values */
export declare const ValuesArraySchema: z.ZodArray<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
/** Spreadsheet ID */
export declare const SpreadsheetIdSchema: z.ZodString;
/** Sheet ID (numeric) - coerces strings from MCP clients */
export declare const SheetIdSchema: z.ZodCoercedNumber<unknown>;
/** A1 Notation */
export declare const A1NotationSchema: z.ZodString;
/** Sheet name */
export declare const SheetNameSchema: z.ZodString;
export declare const ValueRenderOptionSchema: z.ZodDefault<z.ZodEnum<{
    FORMATTED_VALUE: "FORMATTED_VALUE";
    UNFORMATTED_VALUE: "UNFORMATTED_VALUE";
    FORMULA: "FORMULA";
}>>;
export declare const ValueInputOptionSchema: z.ZodDefault<z.ZodEnum<{
    RAW: "RAW";
    USER_ENTERED: "USER_ENTERED";
}>>;
export declare const InsertDataOptionSchema: z.ZodDefault<z.ZodEnum<{
    OVERWRITE: "OVERWRITE";
    INSERT_ROWS: "INSERT_ROWS";
}>>;
export declare const MajorDimensionSchema: z.ZodDefault<z.ZodEnum<{
    ROWS: "ROWS";
    COLUMNS: "COLUMNS";
}>>;
export declare const DimensionSchema: z.ZodEnum<{
    ROWS: "ROWS";
    COLUMNS: "COLUMNS";
}>;
export declare const HorizontalAlignSchema: z.ZodEnum<{
    LEFT: "LEFT";
    CENTER: "CENTER";
    RIGHT: "RIGHT";
}>;
export declare const VerticalAlignSchema: z.ZodEnum<{
    TOP: "TOP";
    MIDDLE: "MIDDLE";
    BOTTOM: "BOTTOM";
}>;
export declare const WrapStrategySchema: z.ZodEnum<{
    OVERFLOW_CELL: "OVERFLOW_CELL";
    LEGACY_WRAP: "LEGACY_WRAP";
    CLIP: "CLIP";
    WRAP: "WRAP";
}>;
export declare const BorderStyleSchema: z.ZodEnum<{
    NONE: "NONE";
    DOTTED: "DOTTED";
    DASHED: "DASHED";
    SOLID: "SOLID";
    SOLID_MEDIUM: "SOLID_MEDIUM";
    SOLID_THICK: "SOLID_THICK";
    DOUBLE: "DOUBLE";
}>;
export declare const MergeTypeSchema: z.ZodEnum<{
    MERGE_ALL: "MERGE_ALL";
    MERGE_COLUMNS: "MERGE_COLUMNS";
    MERGE_ROWS: "MERGE_ROWS";
}>;
export declare const PasteTypeSchema: z.ZodEnum<{
    PASTE_NORMAL: "PASTE_NORMAL";
    PASTE_VALUES: "PASTE_VALUES";
    PASTE_FORMAT: "PASTE_FORMAT";
    PASTE_NO_BORDERS: "PASTE_NO_BORDERS";
    PASTE_FORMULA: "PASTE_FORMULA";
    PASTE_DATA_VALIDATION: "PASTE_DATA_VALIDATION";
    PASTE_CONDITIONAL_FORMATTING: "PASTE_CONDITIONAL_FORMATTING";
}>;
export declare const ChartTypeSchema: z.ZodEnum<{
    BAR: "BAR";
    LINE: "LINE";
    AREA: "AREA";
    COLUMN: "COLUMN";
    SCATTER: "SCATTER";
    COMBO: "COMBO";
    STEPPED_AREA: "STEPPED_AREA";
    PIE: "PIE";
    DOUGHNUT: "DOUGHNUT";
    TREEMAP: "TREEMAP";
    WATERFALL: "WATERFALL";
    HISTOGRAM: "HISTOGRAM";
    CANDLESTICK: "CANDLESTICK";
    ORG: "ORG";
    RADAR: "RADAR";
    SCORECARD: "SCORECARD";
    BUBBLE: "BUBBLE";
}>;
export declare const LegendPositionSchema: z.ZodEnum<{
    BOTTOM_LEGEND: "BOTTOM_LEGEND";
    LEFT_LEGEND: "LEFT_LEGEND";
    RIGHT_LEGEND: "RIGHT_LEGEND";
    TOP_LEGEND: "TOP_LEGEND";
    NO_LEGEND: "NO_LEGEND";
}>;
export declare const SummarizeFunctionSchema: z.ZodEnum<{
    SUM: "SUM";
    COUNTA: "COUNTA";
    COUNT: "COUNT";
    COUNTUNIQUE: "COUNTUNIQUE";
    AVERAGE: "AVERAGE";
    MAX: "MAX";
    MIN: "MIN";
    MEDIAN: "MEDIAN";
    PRODUCT: "PRODUCT";
    STDEV: "STDEV";
    STDEVP: "STDEVP";
    VAR: "VAR";
    VARP: "VARP";
    CUSTOM: "CUSTOM";
}>;
export declare const SortOrderSchema: z.ZodEnum<{
    ASCENDING: "ASCENDING";
    DESCENDING: "DESCENDING";
}>;
export declare const PermissionRoleSchema: z.ZodEnum<{
    owner: "owner";
    organizer: "organizer";
    fileOrganizer: "fileOrganizer";
    writer: "writer";
    commenter: "commenter";
    reader: "reader";
}>;
export declare const PermissionTypeSchema: z.ZodEnum<{
    user: "user";
    group: "group";
    domain: "domain";
    anyone: "anyone";
}>;
export declare const ConditionTypeSchema: z.ZodEnum<{
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
export declare const ErrorCodeSchema: z.ZodEnum<{
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
/** Border specification */
export declare const BorderSchema: z.ZodObject<{
    style: z.ZodEnum<{
        NONE: "NONE";
        DOTTED: "DOTTED";
        DASHED: "DASHED";
        SOLID: "SOLID";
        SOLID_MEDIUM: "SOLID_MEDIUM";
        SOLID_THICK: "SOLID_THICK";
        DOUBLE: "DOUBLE";
    }>;
    color: z.ZodOptional<z.ZodObject<{
        red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** Text format */
export declare const TextFormatSchema: z.ZodObject<{
    foregroundColor: z.ZodOptional<z.ZodObject<{
        red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>;
    fontFamily: z.ZodOptional<z.ZodString>;
    fontSize: z.ZodOptional<z.ZodNumber>;
    bold: z.ZodOptional<z.ZodBoolean>;
    italic: z.ZodOptional<z.ZodBoolean>;
    underline: z.ZodOptional<z.ZodBoolean>;
    strikethrough: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
/** Number format */
export declare const NumberFormatSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<{
        TEXT: "TEXT";
        NUMBER: "NUMBER";
        PERCENT: "PERCENT";
        CURRENCY: "CURRENCY";
        DATE: "DATE";
        TIME: "TIME";
        DATE_TIME: "DATE_TIME";
        SCIENTIFIC: "SCIENTIFIC";
    }>>;
    pattern: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Cell format */
export declare const CellFormatSchema: z.ZodObject<{
    backgroundColor: z.ZodOptional<z.ZodObject<{
        red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>;
    textFormat: z.ZodOptional<z.ZodObject<{
        foregroundColor: z.ZodOptional<z.ZodObject<{
            red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>>;
        fontFamily: z.ZodOptional<z.ZodString>;
        fontSize: z.ZodOptional<z.ZodNumber>;
        bold: z.ZodOptional<z.ZodBoolean>;
        italic: z.ZodOptional<z.ZodBoolean>;
        underline: z.ZodOptional<z.ZodBoolean>;
        strikethrough: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    horizontalAlignment: z.ZodOptional<z.ZodEnum<{
        LEFT: "LEFT";
        CENTER: "CENTER";
        RIGHT: "RIGHT";
    }>>;
    verticalAlignment: z.ZodOptional<z.ZodEnum<{
        TOP: "TOP";
        MIDDLE: "MIDDLE";
        BOTTOM: "BOTTOM";
    }>>;
    wrapStrategy: z.ZodOptional<z.ZodEnum<{
        OVERFLOW_CELL: "OVERFLOW_CELL";
        LEGACY_WRAP: "LEGACY_WRAP";
        CLIP: "CLIP";
        WRAP: "WRAP";
    }>>;
    numberFormat: z.ZodOptional<z.ZodObject<{
        type: z.ZodOptional<z.ZodEnum<{
            TEXT: "TEXT";
            NUMBER: "NUMBER";
            PERCENT: "PERCENT";
            CURRENCY: "CURRENCY";
            DATE: "DATE";
            TIME: "TIME";
            DATE_TIME: "DATE_TIME";
            SCIENTIFIC: "SCIENTIFIC";
        }>>;
        pattern: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    borders: z.ZodOptional<z.ZodObject<{
        top: z.ZodOptional<z.ZodObject<{
            style: z.ZodEnum<{
                NONE: "NONE";
                DOTTED: "DOTTED";
                DASHED: "DASHED";
                SOLID: "SOLID";
                SOLID_MEDIUM: "SOLID_MEDIUM";
                SOLID_THICK: "SOLID_THICK";
                DOUBLE: "DOUBLE";
            }>;
            color: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        bottom: z.ZodOptional<z.ZodObject<{
            style: z.ZodEnum<{
                NONE: "NONE";
                DOTTED: "DOTTED";
                DASHED: "DASHED";
                SOLID: "SOLID";
                SOLID_MEDIUM: "SOLID_MEDIUM";
                SOLID_THICK: "SOLID_THICK";
                DOUBLE: "DOUBLE";
            }>;
            color: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        left: z.ZodOptional<z.ZodObject<{
            style: z.ZodEnum<{
                NONE: "NONE";
                DOTTED: "DOTTED";
                DASHED: "DASHED";
                SOLID: "SOLID";
                SOLID_MEDIUM: "SOLID_MEDIUM";
                SOLID_THICK: "SOLID_THICK";
                DOUBLE: "DOUBLE";
            }>;
            color: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        right: z.ZodOptional<z.ZodObject<{
            style: z.ZodEnum<{
                NONE: "NONE";
                DOTTED: "DOTTED";
                DASHED: "DASHED";
                SOLID: "SOLID";
                SOLID_MEDIUM: "SOLID_MEDIUM";
                SOLID_THICK: "SOLID_THICK";
                DOUBLE: "DOUBLE";
            }>;
            color: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** Grid range (numeric coordinates) */
export declare const GridRangeSchema: z.ZodObject<{
    sheetId: z.ZodCoercedNumber<unknown>;
    startRowIndex: z.ZodOptional<z.ZodNumber>;
    endRowIndex: z.ZodOptional<z.ZodNumber>;
    startColumnIndex: z.ZodOptional<z.ZodNumber>;
    endColumnIndex: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/** Condition for rules */
export declare const ConditionSchema: z.ZodObject<{
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
/** Chart position */
export declare const ChartPositionSchema: z.ZodObject<{
    anchorCell: z.ZodString;
    offsetX: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    offsetY: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    width: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    height: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
/** Sort specification */
export declare const SortSpecSchema: z.ZodObject<{
    columnIndex: z.ZodNumber;
    ascending: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
/** Effect scope limits */
export declare const EffectScopeSchema: z.ZodObject<{
    maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    maxRowsAffected: z.ZodOptional<z.ZodNumber>;
    maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
    requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
/** Expected state for optimistic locking */
export declare const ExpectedStateSchema: z.ZodObject<{
    version: z.ZodOptional<z.ZodString>;
    rowCount: z.ZodOptional<z.ZodNumber>;
    columnCount: z.ZodOptional<z.ZodNumber>;
    sheetTitle: z.ZodOptional<z.ZodString>;
    checksum: z.ZodOptional<z.ZodString>;
    checksumRange: z.ZodOptional<z.ZodString>;
    firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/** Safety options for destructive actions */
export declare const SafetyOptionsSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const DiffTierSchema: z.ZodDefault<z.ZodEnum<{
    METADATA: "METADATA";
    SAMPLE: "SAMPLE";
    FULL: "FULL";
}>>;
export declare const DiffOptionsSchema: z.ZodObject<{
    tier: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        METADATA: "METADATA";
        SAMPLE: "SAMPLE";
        FULL: "FULL";
    }>>>;
    sampleSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    maxFullDiffCells: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export declare const CellChangeSchema: z.ZodObject<{
    cell: z.ZodString;
    before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
    after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
    type: z.ZodEnum<{
        value: "value";
        format: "format";
        formula: "formula";
        note: "note";
    }>;
}, z.core.$strip>;
export declare const MetadataDiffSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const SampleDiffSchema: z.ZodObject<{
    tier: z.ZodLiteral<"SAMPLE">;
    samples: z.ZodObject<{
        firstRows: z.ZodArray<z.ZodObject<{
            cell: z.ZodString;
            before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
            after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
            type: z.ZodEnum<{
                value: "value";
                format: "format";
                formula: "formula";
                note: "note";
            }>;
        }, z.core.$strip>>;
        lastRows: z.ZodArray<z.ZodObject<{
            cell: z.ZodString;
            before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
            after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
            type: z.ZodEnum<{
                value: "value";
                format: "format";
                formula: "formula";
                note: "note";
            }>;
        }, z.core.$strip>>;
        randomRows: z.ZodArray<z.ZodObject<{
            cell: z.ZodString;
            before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
            after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
            type: z.ZodEnum<{
                value: "value";
                format: "format";
                formula: "formula";
                note: "note";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    summary: z.ZodObject<{
        rowsChanged: z.ZodNumber;
        cellsSampled: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const FullDiffSchema: z.ZodObject<{
    tier: z.ZodLiteral<"FULL">;
    changes: z.ZodArray<z.ZodObject<{
        cell: z.ZodString;
        before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
        after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
        type: z.ZodEnum<{
            value: "value";
            format: "format";
            formula: "formula";
            note: "note";
        }>;
    }, z.core.$strip>>;
    summary: z.ZodObject<{
        cellsChanged: z.ZodNumber;
        cellsAdded: z.ZodNumber;
        cellsRemoved: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const DiffResultSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
                value: "value";
                format: "format";
                formula: "formula";
                note: "note";
            }>;
        }, z.core.$strip>>;
        lastRows: z.ZodArray<z.ZodObject<{
            cell: z.ZodString;
            before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
            after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
            type: z.ZodEnum<{
                value: "value";
                format: "format";
                formula: "formula";
                note: "note";
            }>;
        }, z.core.$strip>>;
        randomRows: z.ZodArray<z.ZodObject<{
            cell: z.ZodString;
            before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
            after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
            type: z.ZodEnum<{
                value: "value";
                format: "format";
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
            value: "value";
            format: "format";
            formula: "formula";
            note: "note";
        }>;
    }, z.core.$strip>>;
    summary: z.ZodObject<{
        cellsChanged: z.ZodNumber;
        cellsAdded: z.ZodNumber;
        cellsRemoved: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>], "tier">;
export declare const ResolutionMethodSchema: z.ZodEnum<{
    a1_direct: "a1_direct";
    named_range: "named_range";
    semantic_header: "semantic_header";
    semantic_search: "semantic_search";
}>;
export declare const ResolvedRangeSchema: z.ZodObject<{
    sheetId: z.ZodCoercedNumber<unknown>;
    sheetName: z.ZodString;
    a1Notation: z.ZodString;
    gridRange: z.ZodObject<{
        sheetId: z.ZodCoercedNumber<unknown>;
        startRowIndex: z.ZodOptional<z.ZodNumber>;
        endRowIndex: z.ZodOptional<z.ZodNumber>;
        startColumnIndex: z.ZodOptional<z.ZodNumber>;
        endColumnIndex: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    resolution: z.ZodObject<{
        method: z.ZodEnum<{
            a1_direct: "a1_direct";
            named_range: "named_range";
            semantic_header: "semantic_header";
            semantic_search: "semantic_search";
        }>;
        confidence: z.ZodNumber;
        path: z.ZodString;
        alternatives: z.ZodOptional<z.ZodArray<z.ZodObject<{
            a1Notation: z.ZodString;
            reason: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const SemanticRangeQuerySchema: z.ZodObject<{
    sheet: z.ZodString;
    column: z.ZodString;
    includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    rowStart: z.ZodOptional<z.ZodNumber>;
    rowEnd: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Range input schema that accepts:
 * - Plain string (A1 notation) - transformed to { a1: string }
 * - Object with a1 key: { a1: "Sheet1!A1:B10" }
 * - Object with namedRange key: { namedRange: "MyRange" }
 * - Object with semantic key: { semantic: { sheet: "Sheet1", column: "Name" } }
 * - Object with grid key: { grid: { sheetId: 0, startRowIndex: 0, ... } }
 */
export declare const RangeInputSchema: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
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
/** Error detail */
export declare const ErrorDetailSchema: z.ZodObject<{
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
/** Mutation summary */
export declare const MutationSummarySchema: z.ZodObject<{
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
                    value: "value";
                    format: "format";
                    formula: "formula";
                    note: "note";
                }>;
            }, z.core.$strip>>;
            lastRows: z.ZodArray<z.ZodObject<{
                cell: z.ZodString;
                before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                type: z.ZodEnum<{
                    value: "value";
                    format: "format";
                    formula: "formula";
                    note: "note";
                }>;
            }, z.core.$strip>>;
            randomRows: z.ZodArray<z.ZodObject<{
                cell: z.ZodString;
                before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                type: z.ZodEnum<{
                    value: "value";
                    format: "format";
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
                value: "value";
                format: "format";
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
}, z.core.$strip>;
/** Sheet info */
export declare const SheetInfoSchema: z.ZodObject<{
    sheetId: z.ZodNumber;
    title: z.ZodString;
    index: z.ZodNumber;
    rowCount: z.ZodNumber;
    columnCount: z.ZodNumber;
    hidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    tabColor: z.ZodOptional<z.ZodObject<{
        red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** Spreadsheet info */
export declare const SpreadsheetInfoSchema: z.ZodObject<{
    spreadsheetId: z.ZodString;
    title: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    locale: z.ZodOptional<z.ZodString>;
    timeZone: z.ZodOptional<z.ZodString>;
    sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        sheetId: z.ZodNumber;
        title: z.ZodString;
        index: z.ZodNumber;
        rowCount: z.ZodNumber;
        columnCount: z.ZodNumber;
        hidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        tabColor: z.ZodOptional<z.ZodObject<{
            red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    createdTime: z.ZodOptional<z.ZodString>;
    modifiedTime: z.ZodOptional<z.ZodString>;
    owners: z.ZodOptional<z.ZodArray<z.ZodObject<{
        email: z.ZodOptional<z.ZodString>;
        displayName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    lastModifiedBy: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Tool suggestion for follow-up or optimization */
export declare const ToolSuggestionSchema: z.ZodObject<{
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
}, z.core.$strip>;
/** Cost estimation for the operation */
export declare const CostEstimateSchema: z.ZodObject<{
    apiCalls: z.ZodNumber;
    estimatedLatencyMs: z.ZodNumber;
    cellsAffected: z.ZodOptional<z.ZodNumber>;
    quotaImpact: z.ZodOptional<z.ZodObject<{
        current: z.ZodNumber;
        limit: z.ZodNumber;
        remaining: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** Response metadata with suggestions and cost info */
export declare const ResponseMetaSchema: z.ZodObject<{
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
}, z.core.$strip>;
export interface ToolAnnotations {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
}
export interface ToolExecution {
    taskSupport?: 'forbidden' | 'optional' | 'required';
}
export type Color = z.infer<typeof ColorSchema>;
export type CellValue = z.infer<typeof CellValueSchema>;
export type ValuesArray = z.infer<typeof ValuesArraySchema>;
export type GridRange = z.infer<typeof GridRangeSchema>;
export type CellFormat = z.infer<typeof CellFormatSchema>;
export type SafetyOptions = z.infer<typeof SafetyOptionsSchema>;
export type EffectScope = z.infer<typeof EffectScopeSchema>;
export type ExpectedState = z.infer<typeof ExpectedStateSchema>;
export type DiffResult = z.infer<typeof DiffResultSchema>;
export type DiffOptions = z.infer<typeof DiffOptionsSchema>;
export type RangeInput = z.infer<typeof RangeInputSchema>;
export type ResolvedRange = z.infer<typeof ResolvedRangeSchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type MutationSummary = z.infer<typeof MutationSummarySchema>;
export type SheetInfo = z.infer<typeof SheetInfoSchema>;
export type SpreadsheetInfo = z.infer<typeof SpreadsheetInfoSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type ToolSuggestion = z.infer<typeof ToolSuggestionSchema>;
export type CostEstimate = z.infer<typeof CostEstimateSchema>;
export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;
//# sourceMappingURL=shared.d.ts.map