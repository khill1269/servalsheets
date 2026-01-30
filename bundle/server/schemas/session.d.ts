/**
 * ServalSheets - Session Tool Schema
 *
 * Tool for managing conversation-level context.
 * Enables natural language references like "the spreadsheet", "undo that", etc.
 *
 * @module schemas/session
 */
import { z } from 'zod';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/**
 * All session context operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export declare const SheetsSessionInputSchema: z.ZodObject<{
    request: z.ZodDiscriminatedUnion<[z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"set_active">;
        spreadsheetId: z.ZodString;
        title: z.ZodString;
        sheetNames: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"get_active">;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"get_context">;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"record_operation">;
        tool: z.ZodString;
        toolAction: z.ZodString;
        spreadsheetId: z.ZodString;
        description: z.ZodString;
        undoable: z.ZodBoolean;
        range: z.ZodOptional<z.ZodString>;
        snapshotId: z.ZodOptional<z.ZodString>;
        cellsAffected: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"get_last_operation">;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"get_history">;
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"find_by_reference">;
        reference: z.ZodString;
        referenceType: z.ZodEnum<{
            spreadsheet: "spreadsheet";
            operation: "operation";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"update_preferences">;
        confirmationLevel: z.ZodOptional<z.ZodEnum<{
            never: "never";
            always: "always";
            destructive: "destructive";
        }>>;
        dryRunDefault: z.ZodOptional<z.ZodBoolean>;
        snapshotDefault: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"get_preferences">;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"set_pending">;
        type: z.ZodString;
        step: z.ZodCoercedNumber<unknown>;
        totalSteps: z.ZodCoercedNumber<unknown>;
        context: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"get_pending">;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"clear_pending">;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"reset">;
    }, z.core.$strip>], "action">;
}, z.core.$strip>;
export type SheetsSessionInput = z.infer<typeof SheetsSessionInputSchema>;
/** The unwrapped request type (the discriminated union of actions) */
export type SessionRequest = SheetsSessionInput['request'];
export declare const SheetsSessionOutputSchema: z.ZodObject<{
    response: z.ZodUnion<readonly [z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodLiteral<"set_active">;
        spreadsheet: z.ZodObject<{
            spreadsheetId: z.ZodString;
            title: z.ZodString;
            activatedAt: z.ZodCoercedNumber<unknown>;
            sheetNames: z.ZodArray<z.ZodString>;
            lastRange: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodLiteral<"get_active">;
        spreadsheet: z.ZodNullable<z.ZodObject<{
            spreadsheetId: z.ZodString;
            title: z.ZodString;
            activatedAt: z.ZodCoercedNumber<unknown>;
            sheetNames: z.ZodArray<z.ZodString>;
            lastRange: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        recentSpreadsheets: z.ZodArray<z.ZodObject<{
            spreadsheetId: z.ZodString;
            title: z.ZodString;
            activatedAt: z.ZodCoercedNumber<unknown>;
            sheetNames: z.ZodArray<z.ZodString>;
            lastRange: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodLiteral<"get_context">;
        summary: z.ZodString;
        activeSpreadsheet: z.ZodNullable<z.ZodObject<{
            spreadsheetId: z.ZodString;
            title: z.ZodString;
            activatedAt: z.ZodCoercedNumber<unknown>;
            sheetNames: z.ZodArray<z.ZodString>;
            lastRange: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        lastOperation: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            tool: z.ZodString;
            action: z.ZodString;
            spreadsheetId: z.ZodString;
            range: z.ZodOptional<z.ZodString>;
            description: z.ZodString;
            timestamp: z.ZodCoercedNumber<unknown>;
            undoable: z.ZodBoolean;
            snapshotId: z.ZodOptional<z.ZodString>;
            cellsAffected: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        }, z.core.$strip>>;
        pendingOperation: z.ZodNullable<z.ZodObject<{
            type: z.ZodString;
            step: z.ZodCoercedNumber<unknown>;
            totalSteps: z.ZodCoercedNumber<unknown>;
            context: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>>;
        suggestedActions: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodLiteral<"record_operation">;
        operationId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodLiteral<"get_last_operation">;
        operation: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            tool: z.ZodString;
            action: z.ZodString;
            spreadsheetId: z.ZodString;
            range: z.ZodOptional<z.ZodString>;
            description: z.ZodString;
            timestamp: z.ZodCoercedNumber<unknown>;
            undoable: z.ZodBoolean;
            snapshotId: z.ZodOptional<z.ZodString>;
            cellsAffected: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodLiteral<"get_history">;
        operations: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            tool: z.ZodString;
            action: z.ZodString;
            spreadsheetId: z.ZodString;
            range: z.ZodOptional<z.ZodString>;
            description: z.ZodString;
            timestamp: z.ZodCoercedNumber<unknown>;
            undoable: z.ZodBoolean;
            snapshotId: z.ZodOptional<z.ZodString>;
            cellsAffected: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodLiteral<"find_by_reference">;
        found: z.ZodBoolean;
        spreadsheet: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            spreadsheetId: z.ZodString;
            title: z.ZodString;
            activatedAt: z.ZodCoercedNumber<unknown>;
            sheetNames: z.ZodArray<z.ZodString>;
            lastRange: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        operation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            tool: z.ZodString;
            action: z.ZodString;
            spreadsheetId: z.ZodString;
            range: z.ZodOptional<z.ZodString>;
            description: z.ZodString;
            timestamp: z.ZodCoercedNumber<unknown>;
            undoable: z.ZodBoolean;
            snapshotId: z.ZodOptional<z.ZodString>;
            cellsAffected: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodEnum<{
            update_preferences: "update_preferences";
            get_preferences: "get_preferences";
        }>;
        preferences: z.ZodObject<{
            confirmationLevel: z.ZodEnum<{
                never: "never";
                always: "always";
                destructive: "destructive";
            }>;
            defaultSafety: z.ZodObject<{
                dryRun: z.ZodBoolean;
                createSnapshot: z.ZodBoolean;
            }, z.core.$strip>;
            formatting: z.ZodObject<{
                headerStyle: z.ZodEnum<{
                    minimal: "minimal";
                    bold: "bold";
                    "bold-colored": "bold-colored";
                }>;
                dateFormat: z.ZodString;
                currencyFormat: z.ZodString;
            }, z.core.$strip>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodEnum<{
            set_pending: "set_pending";
            get_pending: "get_pending";
            clear_pending: "clear_pending";
        }>;
        pending: z.ZodNullable<z.ZodObject<{
            type: z.ZodString;
            step: z.ZodCoercedNumber<unknown>;
            totalSteps: z.ZodCoercedNumber<unknown>;
            context: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodLiteral<"reset">;
        message: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<false>;
        error: z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            retryable: z.ZodBoolean;
        }, z.core.$strip>;
    }, z.core.$strip>]>;
}, z.core.$strip>;
export type SheetsSessionOutput = z.infer<typeof SheetsSessionOutputSchema>;
export declare const SHEETS_SESSION_ANNOTATIONS: ToolAnnotations;
export declare const SHEETS_SESSION_DESCRIPTION = "\uD83E\uDDE0 Manage conversation context for natural language interactions. Enables references like \"the spreadsheet\", \"undo that\", \"continue\".\n\n**Why This Tool Matters:**\nUsers don't say \"spreadsheet ID 1ABC...\" - they say \"the spreadsheet\" or \"my budget\".\nThis tool tracks what we're working with so Claude can understand natural references.\n\n**Quick Examples:**\n\u2022 Set active: {\"action\":\"set_active\",\"spreadsheetId\":\"1ABC...\",\"title\":\"Q4 Budget\",\"sheetNames\":[\"Data\",\"Summary\"]}\n\u2022 Get context: {\"action\":\"get_context\"} \u2192 Returns summary + suggestions\n\u2022 Find reference: {\"action\":\"find_by_reference\",\"reference\":\"that\",\"type\":\"operation\"} \u2192 Finds last operation\n\u2022 Record op: {\"action\":\"record_operation\",\"tool\":\"sheets_data\",\"toolAction\":\"write\",...}\n\n**Natural Language Support:**\n\u2022 \"the spreadsheet\" \u2192 get_active returns current spreadsheet\n\u2022 \"undo that\" \u2192 find_by_reference finds last undoable operation\n\u2022 \"switch to the budget\" \u2192 find_by_reference finds by title\n\u2022 \"continue\" \u2192 get_pending returns multi-step operation state\n\n**When to Use:**\n1. ALWAYS call get_context at conversation start\n2. Call set_active after opening/creating a spreadsheet\n3. Call record_operation after any write operation\n4. Call find_by_reference when user uses natural references\n\n**Common Workflows:**\n1. Start: get_context \u2192 Understand current state\n2. After open: set_active \u2192 Remember which spreadsheet\n3. After write: record_operation \u2192 Enable undo\n4. User says \"undo\": find_by_reference \u2192 Find operation to undo\n\n**Best Practice:**\nCall get_context when unsure what user means - it provides suggestions!";
//# sourceMappingURL=session.d.ts.map