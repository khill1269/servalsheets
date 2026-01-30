/**
 * Tool: sheets_collaborate
 * Consolidated collaboration operations: sharing, comments, and version control
 * Merges: sharing.ts (8 actions) + comments.ts (10 actions) + versions.ts (10 actions) = 28 actions
 */
import { z } from 'zod';
import { type ToolAnnotations } from './shared.js';
export declare const SheetsCollaborateInputSchema: z.ZodObject<{
    request: z.ZodObject<{
        action: z.ZodEnum<{
            share_add: "share_add";
            share_update: "share_update";
            share_remove: "share_remove";
            share_list: "share_list";
            share_get: "share_get";
            share_transfer_ownership: "share_transfer_ownership";
            share_set_link: "share_set_link";
            share_get_link: "share_get_link";
            comment_add: "comment_add";
            comment_update: "comment_update";
            comment_delete: "comment_delete";
            comment_list: "comment_list";
            comment_get: "comment_get";
            comment_resolve: "comment_resolve";
            comment_reopen: "comment_reopen";
            comment_add_reply: "comment_add_reply";
            comment_update_reply: "comment_update_reply";
            comment_delete_reply: "comment_delete_reply";
            version_list_revisions: "version_list_revisions";
            version_get_revision: "version_get_revision";
            version_restore_revision: "version_restore_revision";
            version_keep_revision: "version_keep_revision";
            version_create_snapshot: "version_create_snapshot";
            version_list_snapshots: "version_list_snapshots";
            version_restore_snapshot: "version_restore_snapshot";
            version_delete_snapshot: "version_delete_snapshot";
            version_compare: "version_compare";
            version_export: "version_export";
        }>;
        spreadsheetId: z.ZodOptional<z.ZodString>;
        emailAddress: z.ZodOptional<z.ZodString>;
        domain: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodEnum<{
            domain: "domain";
            user: "user";
            group: "group";
            anyone: "anyone";
        }>>;
        role: z.ZodOptional<z.ZodEnum<{
            owner: "owner";
            organizer: "organizer";
            fileOrganizer: "fileOrganizer";
            writer: "writer";
            commenter: "commenter";
            reader: "reader";
        }>>;
        sendNotification: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        emailMessage: z.ZodOptional<z.ZodString>;
        expirationTime: z.ZodOptional<z.ZodString>;
        permissionId: z.ZodOptional<z.ZodString>;
        newOwnerEmail: z.ZodOptional<z.ZodString>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        content: z.ZodOptional<z.ZodString>;
        anchor: z.ZodOptional<z.ZodString>;
        commentId: z.ZodOptional<z.ZodString>;
        replyId: z.ZodOptional<z.ZodString>;
        includeDeleted: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        startIndex: z.ZodOptional<z.ZodNumber>;
        maxResults: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        pageToken: z.ZodOptional<z.ZodString>;
        revisionId: z.ZodOptional<z.ZodString>;
        keepForever: z.ZodOptional<z.ZodBoolean>;
        name: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        destinationFolderId: z.ZodOptional<z.ZodString>;
        snapshotId: z.ZodOptional<z.ZodString>;
        revisionId1: z.ZodOptional<z.ZodString>;
        revisionId2: z.ZodOptional<z.ZodString>;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        format: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            xlsx: "xlsx";
            csv: "csv";
            pdf: "pdf";
            ods: "ods";
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
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
declare const CollaborateResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    action: z.ZodString;
    permission: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
            domain: "domain";
            user: "user";
            group: "group";
            anyone: "anyone";
        }>;
        role: z.ZodEnum<{
            owner: "owner";
            organizer: "organizer";
            fileOrganizer: "fileOrganizer";
            writer: "writer";
            commenter: "commenter";
            reader: "reader";
        }>;
        emailAddress: z.ZodOptional<z.ZodString>;
        domain: z.ZodOptional<z.ZodString>;
        displayName: z.ZodOptional<z.ZodString>;
        expirationTime: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    permissions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
            domain: "domain";
            user: "user";
            group: "group";
            anyone: "anyone";
        }>;
        role: z.ZodEnum<{
            owner: "owner";
            organizer: "organizer";
            fileOrganizer: "fileOrganizer";
            writer: "writer";
            commenter: "commenter";
            reader: "reader";
        }>;
        emailAddress: z.ZodOptional<z.ZodString>;
        domain: z.ZodOptional<z.ZodString>;
        displayName: z.ZodOptional<z.ZodString>;
        expirationTime: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    sharingLink: z.ZodOptional<z.ZodString>;
    comment: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        content: z.ZodString;
        author: z.ZodObject<{
            displayName: z.ZodString;
            emailAddress: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        createdTime: z.ZodString;
        modifiedTime: z.ZodString;
        resolved: z.ZodBoolean;
        anchor: z.ZodOptional<z.ZodString>;
        replies: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            content: z.ZodString;
            author: z.ZodObject<{
                displayName: z.ZodString;
            }, z.core.$strip>;
            createdTime: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    comments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        content: z.ZodString;
        author: z.ZodObject<{
            displayName: z.ZodString;
            emailAddress: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        createdTime: z.ZodString;
        modifiedTime: z.ZodString;
        resolved: z.ZodBoolean;
        anchor: z.ZodOptional<z.ZodString>;
        replies: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            content: z.ZodString;
            author: z.ZodObject<{
                displayName: z.ZodString;
            }, z.core.$strip>;
            createdTime: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    replyId: z.ZodOptional<z.ZodString>;
    revision: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        modifiedTime: z.ZodString;
        lastModifyingUser: z.ZodOptional<z.ZodObject<{
            displayName: z.ZodString;
            emailAddress: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        size: z.ZodOptional<z.ZodString>;
        keepForever: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    revisions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        modifiedTime: z.ZodString;
        lastModifyingUser: z.ZodOptional<z.ZodObject<{
            displayName: z.ZodString;
            emailAddress: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        size: z.ZodOptional<z.ZodString>;
        keepForever: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
    nextPageToken: z.ZodOptional<z.ZodString>;
    snapshot: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        createdAt: z.ZodString;
        spreadsheetId: z.ZodString;
        copyId: z.ZodOptional<z.ZodString>;
        size: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>>;
    snapshots: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        createdAt: z.ZodString;
        spreadsheetId: z.ZodString;
        copyId: z.ZodOptional<z.ZodString>;
        size: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>>>;
    comparison: z.ZodOptional<z.ZodObject<{
        sheetsAdded: z.ZodOptional<z.ZodArray<z.ZodString>>;
        sheetsRemoved: z.ZodOptional<z.ZodArray<z.ZodString>>;
        sheetsModified: z.ZodOptional<z.ZodArray<z.ZodString>>;
        cellChanges: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>>;
    exportUrl: z.ZodOptional<z.ZodString>;
    exportData: z.ZodOptional<z.ZodString>;
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
export declare const SheetsCollaborateOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodString;
        permission: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodEnum<{
                domain: "domain";
                user: "user";
                group: "group";
                anyone: "anyone";
            }>;
            role: z.ZodEnum<{
                owner: "owner";
                organizer: "organizer";
                fileOrganizer: "fileOrganizer";
                writer: "writer";
                commenter: "commenter";
                reader: "reader";
            }>;
            emailAddress: z.ZodOptional<z.ZodString>;
            domain: z.ZodOptional<z.ZodString>;
            displayName: z.ZodOptional<z.ZodString>;
            expirationTime: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        permissions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodEnum<{
                domain: "domain";
                user: "user";
                group: "group";
                anyone: "anyone";
            }>;
            role: z.ZodEnum<{
                owner: "owner";
                organizer: "organizer";
                fileOrganizer: "fileOrganizer";
                writer: "writer";
                commenter: "commenter";
                reader: "reader";
            }>;
            emailAddress: z.ZodOptional<z.ZodString>;
            domain: z.ZodOptional<z.ZodString>;
            displayName: z.ZodOptional<z.ZodString>;
            expirationTime: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        sharingLink: z.ZodOptional<z.ZodString>;
        comment: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            content: z.ZodString;
            author: z.ZodObject<{
                displayName: z.ZodString;
                emailAddress: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
            createdTime: z.ZodString;
            modifiedTime: z.ZodString;
            resolved: z.ZodBoolean;
            anchor: z.ZodOptional<z.ZodString>;
            replies: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                content: z.ZodString;
                author: z.ZodObject<{
                    displayName: z.ZodString;
                }, z.core.$strip>;
                createdTime: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        comments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            content: z.ZodString;
            author: z.ZodObject<{
                displayName: z.ZodString;
                emailAddress: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
            createdTime: z.ZodString;
            modifiedTime: z.ZodString;
            resolved: z.ZodBoolean;
            anchor: z.ZodOptional<z.ZodString>;
            replies: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                content: z.ZodString;
                author: z.ZodObject<{
                    displayName: z.ZodString;
                }, z.core.$strip>;
                createdTime: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
        replyId: z.ZodOptional<z.ZodString>;
        revision: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            modifiedTime: z.ZodString;
            lastModifyingUser: z.ZodOptional<z.ZodObject<{
                displayName: z.ZodString;
                emailAddress: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            size: z.ZodOptional<z.ZodString>;
            keepForever: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        revisions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            modifiedTime: z.ZodString;
            lastModifyingUser: z.ZodOptional<z.ZodObject<{
                displayName: z.ZodString;
                emailAddress: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            size: z.ZodOptional<z.ZodString>;
            keepForever: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>;
        nextPageToken: z.ZodOptional<z.ZodString>;
        snapshot: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            createdAt: z.ZodString;
            spreadsheetId: z.ZodString;
            copyId: z.ZodOptional<z.ZodString>;
            size: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        }, z.core.$strip>>;
        snapshots: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            createdAt: z.ZodString;
            spreadsheetId: z.ZodString;
            copyId: z.ZodOptional<z.ZodString>;
            size: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        }, z.core.$strip>>>;
        comparison: z.ZodOptional<z.ZodObject<{
            sheetsAdded: z.ZodOptional<z.ZodArray<z.ZodString>>;
            sheetsRemoved: z.ZodOptional<z.ZodArray<z.ZodString>>;
            sheetsModified: z.ZodOptional<z.ZodArray<z.ZodString>>;
            cellChanges: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        }, z.core.$strip>>;
        exportUrl: z.ZodOptional<z.ZodString>;
        exportData: z.ZodOptional<z.ZodString>;
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
export declare const SHEETS_COLLABORATE_ANNOTATIONS: ToolAnnotations;
export type SheetsCollaborateInput = z.infer<typeof SheetsCollaborateInputSchema>;
export type SheetsCollaborateOutput = z.infer<typeof SheetsCollaborateOutputSchema>;
export type CollaborateResponse = z.infer<typeof CollaborateResponseSchema>;
/** The unwrapped request type (the discriminated union of actions) */
export type CollaborateRequest = SheetsCollaborateInput['request'];
export type CollaborateShareAddInput = SheetsCollaborateInput['request'] & {
    action: 'share_add';
    spreadsheetId: string;
    type: string;
    role: string;
};
export type CollaborateShareUpdateInput = SheetsCollaborateInput['request'] & {
    action: 'share_update';
    spreadsheetId: string;
    permissionId: string;
    role: string;
};
export type CollaborateShareRemoveInput = SheetsCollaborateInput['request'] & {
    action: 'share_remove';
    spreadsheetId: string;
    permissionId: string;
};
export type CollaborateShareListInput = SheetsCollaborateInput['request'] & {
    action: 'share_list';
    spreadsheetId: string;
};
export type CollaborateShareGetInput = SheetsCollaborateInput['request'] & {
    action: 'share_get';
    spreadsheetId: string;
    permissionId: string;
};
export type CollaborateShareTransferOwnershipInput = SheetsCollaborateInput['request'] & {
    action: 'share_transfer_ownership';
    spreadsheetId: string;
    newOwnerEmail: string;
};
export type CollaborateShareSetLinkInput = SheetsCollaborateInput['request'] & {
    action: 'share_set_link';
    spreadsheetId: string;
    enabled: boolean;
};
export type CollaborateShareGetLinkInput = SheetsCollaborateInput['request'] & {
    action: 'share_get_link';
    spreadsheetId: string;
};
export type CollaborateCommentAddInput = SheetsCollaborateInput['request'] & {
    action: 'comment_add';
    spreadsheetId: string;
    content: string;
};
export type CollaborateCommentUpdateInput = SheetsCollaborateInput['request'] & {
    action: 'comment_update';
    spreadsheetId: string;
    commentId: string;
    content: string;
};
export type CollaborateCommentDeleteInput = SheetsCollaborateInput['request'] & {
    action: 'comment_delete';
    spreadsheetId: string;
    commentId: string;
};
export type CollaborateCommentListInput = SheetsCollaborateInput['request'] & {
    action: 'comment_list';
    spreadsheetId: string;
};
export type CollaborateCommentGetInput = SheetsCollaborateInput['request'] & {
    action: 'comment_get';
    spreadsheetId: string;
    commentId: string;
};
export type CollaborateCommentResolveInput = SheetsCollaborateInput['request'] & {
    action: 'comment_resolve';
    spreadsheetId: string;
    commentId: string;
};
export type CollaborateCommentReopenInput = SheetsCollaborateInput['request'] & {
    action: 'comment_reopen';
    spreadsheetId: string;
    commentId: string;
};
export type CollaborateCommentAddReplyInput = SheetsCollaborateInput['request'] & {
    action: 'comment_add_reply';
    spreadsheetId: string;
    commentId: string;
    content: string;
};
export type CollaborateCommentUpdateReplyInput = SheetsCollaborateInput['request'] & {
    action: 'comment_update_reply';
    spreadsheetId: string;
    commentId: string;
    replyId: string;
    content: string;
};
export type CollaborateCommentDeleteReplyInput = SheetsCollaborateInput['request'] & {
    action: 'comment_delete_reply';
    spreadsheetId: string;
    commentId: string;
    replyId: string;
};
export type CollaborateVersionListRevisionsInput = SheetsCollaborateInput['request'] & {
    action: 'version_list_revisions';
    spreadsheetId: string;
};
export type CollaborateVersionGetRevisionInput = SheetsCollaborateInput['request'] & {
    action: 'version_get_revision';
    spreadsheetId: string;
    revisionId: string;
};
export type CollaborateVersionRestoreRevisionInput = SheetsCollaborateInput['request'] & {
    action: 'version_restore_revision';
    spreadsheetId: string;
    revisionId: string;
};
export type CollaborateVersionKeepRevisionInput = SheetsCollaborateInput['request'] & {
    action: 'version_keep_revision';
    spreadsheetId: string;
    revisionId: string;
    keepForever: boolean;
};
export type CollaborateVersionCreateSnapshotInput = SheetsCollaborateInput['request'] & {
    action: 'version_create_snapshot';
    spreadsheetId: string;
};
export type CollaborateVersionListSnapshotsInput = SheetsCollaborateInput['request'] & {
    action: 'version_list_snapshots';
    spreadsheetId: string;
};
export type CollaborateVersionRestoreSnapshotInput = SheetsCollaborateInput['request'] & {
    action: 'version_restore_snapshot';
    spreadsheetId: string;
    snapshotId: string;
};
export type CollaborateVersionDeleteSnapshotInput = SheetsCollaborateInput['request'] & {
    action: 'version_delete_snapshot';
    spreadsheetId: string;
    snapshotId: string;
};
export type CollaborateVersionCompareInput = SheetsCollaborateInput['request'] & {
    action: 'version_compare';
    spreadsheetId: string;
};
export type CollaborateVersionExportInput = SheetsCollaborateInput['request'] & {
    action: 'version_export';
    spreadsheetId: string;
};
export {};
//# sourceMappingURL=collaborate.d.ts.map