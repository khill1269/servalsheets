/**
 * Tool 19: sheets_appsscript
 * Google Apps Script API integration for script automation
 *
 * 14 Actions:
 * Project Management (4): create, get, get_content, update_content
 * Version Management (3): create_version, list_versions, get_version
 * Deployment Management (4): deploy, list_deployments, get_deployment, undeploy
 * Execution (3): run, list_processes, get_metrics
 *
 * MCP Protocol: 2025-11-25
 *
 * Note: Uses Google Apps Script API (script.googleapis.com)
 * IMPORTANT: Does NOT work with service accounts - requires OAuth user auth
 */
import { z } from 'zod';
import { type ToolAnnotations } from './shared.js';
export declare const SheetsAppsScriptInputSchema: z.ZodObject<{
    request: z.ZodDiscriminatedUnion<[z.ZodObject<{
        action: z.ZodLiteral<"create">;
        title: z.ZodString;
        parentId: z.ZodOptional<z.ZodString>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"get">;
        scriptId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"get_content">;
        scriptId: z.ZodString;
        versionNumber: z.ZodOptional<z.ZodNumber>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"update_content">;
        scriptId: z.ZodString;
        files: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodEnum<{
                SERVER_JS: "SERVER_JS";
                HTML: "HTML";
                JSON: "JSON";
            }>;
            source: z.ZodString;
            lastModifyUser: z.ZodOptional<z.ZodObject<{
                email: z.ZodOptional<z.ZodString>;
                name: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            createTime: z.ZodOptional<z.ZodString>;
            updateTime: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"create_version">;
        scriptId: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"list_versions">;
        scriptId: z.ZodString;
        pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        pageToken: z.ZodOptional<z.ZodString>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"get_version">;
        scriptId: z.ZodString;
        versionNumber: z.ZodNumber;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"deploy">;
        scriptId: z.ZodString;
        versionNumber: z.ZodOptional<z.ZodNumber>;
        description: z.ZodOptional<z.ZodString>;
        deploymentType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            WEB_APP: "WEB_APP";
            EXECUTION_API: "EXECUTION_API";
        }>>>;
        access: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            MYSELF: "MYSELF";
            DOMAIN: "DOMAIN";
            ANYONE: "ANYONE";
            ANYONE_ANONYMOUS: "ANYONE_ANONYMOUS";
        }>>>;
        executeAs: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            USER_ACCESSING: "USER_ACCESSING";
            USER_DEPLOYING: "USER_DEPLOYING";
        }>>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"list_deployments">;
        scriptId: z.ZodString;
        pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        pageToken: z.ZodOptional<z.ZodString>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"get_deployment">;
        scriptId: z.ZodString;
        deploymentId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"undeploy">;
        scriptId: z.ZodString;
        deploymentId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"run">;
        scriptId: z.ZodString;
        functionName: z.ZodString;
        parameters: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
        devMode: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"list_processes">;
        scriptId: z.ZodOptional<z.ZodString>;
        functionName: z.ZodOptional<z.ZodString>;
        processType: z.ZodOptional<z.ZodEnum<{
            EDITOR: "EDITOR";
            SIMPLE_TRIGGER: "SIMPLE_TRIGGER";
            TRIGGER: "TRIGGER";
            WEBAPP: "WEBAPP";
            API_EXECUTABLE: "API_EXECUTABLE";
            ADD_ON: "ADD_ON";
            TIME_DRIVEN: "TIME_DRIVEN";
        }>>;
        processStatus: z.ZodOptional<z.ZodEnum<{
            COMPLETED: "COMPLETED";
            FAILED: "FAILED";
            RUNNING: "RUNNING";
            CANCELED: "CANCELED";
            TIMED_OUT: "TIMED_OUT";
        }>>;
        pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        pageToken: z.ZodOptional<z.ZodString>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"get_metrics">;
        scriptId: z.ZodString;
        granularity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            DAILY: "DAILY";
            WEEKLY: "WEEKLY";
        }>>>;
        deploymentId: z.ZodOptional<z.ZodString>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>], "action">;
}, z.core.$strip>;
declare const AppsScriptResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    action: z.ZodString;
    project: z.ZodOptional<z.ZodObject<{
        scriptId: z.ZodString;
        title: z.ZodString;
        parentId: z.ZodOptional<z.ZodString>;
        createTime: z.ZodOptional<z.ZodString>;
        updateTime: z.ZodOptional<z.ZodString>;
        creator: z.ZodOptional<z.ZodObject<{
            email: z.ZodOptional<z.ZodString>;
            name: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    files: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<{
            SERVER_JS: "SERVER_JS";
            HTML: "HTML";
            JSON: "JSON";
        }>;
        source: z.ZodString;
        lastModifyUser: z.ZodOptional<z.ZodObject<{
            email: z.ZodOptional<z.ZodString>;
            name: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        createTime: z.ZodOptional<z.ZodString>;
        updateTime: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    version: z.ZodOptional<z.ZodObject<{
        versionNumber: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        createTime: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    versions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        versionNumber: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        createTime: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    deployment: z.ZodOptional<z.ZodObject<{
        deploymentId: z.ZodString;
        versionNumber: z.ZodOptional<z.ZodNumber>;
        deploymentConfig: z.ZodOptional<z.ZodObject<{
            description: z.ZodOptional<z.ZodString>;
            manifestFileName: z.ZodOptional<z.ZodString>;
            versionNumber: z.ZodOptional<z.ZodNumber>;
            scriptId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        entryPoints: z.ZodOptional<z.ZodArray<z.ZodObject<{
            entryPointType: z.ZodOptional<z.ZodEnum<{
                WEB_APP: "WEB_APP";
                EXECUTION_API: "EXECUTION_API";
                ADD_ON: "ADD_ON";
            }>>;
            webApp: z.ZodOptional<z.ZodObject<{
                url: z.ZodOptional<z.ZodString>;
                entryPointConfig: z.ZodOptional<z.ZodObject<{
                    access: z.ZodOptional<z.ZodEnum<{
                        MYSELF: "MYSELF";
                        DOMAIN: "DOMAIN";
                        ANYONE: "ANYONE";
                        ANYONE_ANONYMOUS: "ANYONE_ANONYMOUS";
                    }>>;
                    executeAs: z.ZodOptional<z.ZodEnum<{
                        USER_ACCESSING: "USER_ACCESSING";
                        USER_DEPLOYING: "USER_DEPLOYING";
                    }>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            executionApi: z.ZodOptional<z.ZodObject<{
                entryPointConfig: z.ZodOptional<z.ZodObject<{
                    access: z.ZodOptional<z.ZodEnum<{
                        MYSELF: "MYSELF";
                        DOMAIN: "DOMAIN";
                        ANYONE: "ANYONE";
                        ANYONE_ANONYMOUS: "ANYONE_ANONYMOUS";
                    }>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        updateTime: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    deployments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        deploymentId: z.ZodString;
        versionNumber: z.ZodOptional<z.ZodNumber>;
        deploymentConfig: z.ZodOptional<z.ZodObject<{
            description: z.ZodOptional<z.ZodString>;
            manifestFileName: z.ZodOptional<z.ZodString>;
            versionNumber: z.ZodOptional<z.ZodNumber>;
            scriptId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        entryPoints: z.ZodOptional<z.ZodArray<z.ZodObject<{
            entryPointType: z.ZodOptional<z.ZodEnum<{
                WEB_APP: "WEB_APP";
                EXECUTION_API: "EXECUTION_API";
                ADD_ON: "ADD_ON";
            }>>;
            webApp: z.ZodOptional<z.ZodObject<{
                url: z.ZodOptional<z.ZodString>;
                entryPointConfig: z.ZodOptional<z.ZodObject<{
                    access: z.ZodOptional<z.ZodEnum<{
                        MYSELF: "MYSELF";
                        DOMAIN: "DOMAIN";
                        ANYONE: "ANYONE";
                        ANYONE_ANONYMOUS: "ANYONE_ANONYMOUS";
                    }>>;
                    executeAs: z.ZodOptional<z.ZodEnum<{
                        USER_ACCESSING: "USER_ACCESSING";
                        USER_DEPLOYING: "USER_DEPLOYING";
                    }>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            executionApi: z.ZodOptional<z.ZodObject<{
                entryPointConfig: z.ZodOptional<z.ZodObject<{
                    access: z.ZodOptional<z.ZodEnum<{
                        MYSELF: "MYSELF";
                        DOMAIN: "DOMAIN";
                        ANYONE: "ANYONE";
                        ANYONE_ANONYMOUS: "ANYONE_ANONYMOUS";
                    }>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        updateTime: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    webAppUrl: z.ZodOptional<z.ZodString>;
    result: z.ZodOptional<z.ZodUnknown>;
    executionError: z.ZodOptional<z.ZodObject<{
        errorMessage: z.ZodOptional<z.ZodString>;
        errorType: z.ZodOptional<z.ZodString>;
        scriptStackTraceElements: z.ZodOptional<z.ZodArray<z.ZodObject<{
            function: z.ZodOptional<z.ZodString>;
            lineNumber: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    processes: z.ZodOptional<z.ZodArray<z.ZodObject<{
        processId: z.ZodOptional<z.ZodString>;
        projectName: z.ZodOptional<z.ZodString>;
        functionName: z.ZodOptional<z.ZodString>;
        processType: z.ZodOptional<z.ZodEnum<{
            EDITOR: "EDITOR";
            SIMPLE_TRIGGER: "SIMPLE_TRIGGER";
            TRIGGER: "TRIGGER";
            WEBAPP: "WEBAPP";
            API_EXECUTABLE: "API_EXECUTABLE";
            ADD_ON: "ADD_ON";
            TIME_DRIVEN: "TIME_DRIVEN";
        }>>;
        processStatus: z.ZodOptional<z.ZodEnum<{
            COMPLETED: "COMPLETED";
            FAILED: "FAILED";
            RUNNING: "RUNNING";
            CANCELED: "CANCELED";
            TIMED_OUT: "TIMED_OUT";
            UNKNOWN: "UNKNOWN";
            DELAYED: "DELAYED";
            PENDING: "PENDING";
        }>>;
        startTime: z.ZodOptional<z.ZodString>;
        duration: z.ZodOptional<z.ZodString>;
        userAccessLevel: z.ZodOptional<z.ZodEnum<{
            OWNER: "OWNER";
            READ: "READ";
            WRITE: "WRITE";
            NONE: "NONE";
        }>>;
    }, z.core.$strip>>>;
    metrics: z.ZodOptional<z.ZodObject<{
        activeUsers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            value: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        totalExecutions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            value: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        failedExecutions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            value: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    nextPageToken: z.ZodOptional<z.ZodString>;
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
            UNKNOWN: "UNKNOWN";
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
export declare const SheetsAppsScriptOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodString;
        project: z.ZodOptional<z.ZodObject<{
            scriptId: z.ZodString;
            title: z.ZodString;
            parentId: z.ZodOptional<z.ZodString>;
            createTime: z.ZodOptional<z.ZodString>;
            updateTime: z.ZodOptional<z.ZodString>;
            creator: z.ZodOptional<z.ZodObject<{
                email: z.ZodOptional<z.ZodString>;
                name: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        files: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodEnum<{
                SERVER_JS: "SERVER_JS";
                HTML: "HTML";
                JSON: "JSON";
            }>;
            source: z.ZodString;
            lastModifyUser: z.ZodOptional<z.ZodObject<{
                email: z.ZodOptional<z.ZodString>;
                name: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            createTime: z.ZodOptional<z.ZodString>;
            updateTime: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        version: z.ZodOptional<z.ZodObject<{
            versionNumber: z.ZodNumber;
            description: z.ZodOptional<z.ZodString>;
            createTime: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        versions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            versionNumber: z.ZodNumber;
            description: z.ZodOptional<z.ZodString>;
            createTime: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        deployment: z.ZodOptional<z.ZodObject<{
            deploymentId: z.ZodString;
            versionNumber: z.ZodOptional<z.ZodNumber>;
            deploymentConfig: z.ZodOptional<z.ZodObject<{
                description: z.ZodOptional<z.ZodString>;
                manifestFileName: z.ZodOptional<z.ZodString>;
                versionNumber: z.ZodOptional<z.ZodNumber>;
                scriptId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            entryPoints: z.ZodOptional<z.ZodArray<z.ZodObject<{
                entryPointType: z.ZodOptional<z.ZodEnum<{
                    WEB_APP: "WEB_APP";
                    EXECUTION_API: "EXECUTION_API";
                    ADD_ON: "ADD_ON";
                }>>;
                webApp: z.ZodOptional<z.ZodObject<{
                    url: z.ZodOptional<z.ZodString>;
                    entryPointConfig: z.ZodOptional<z.ZodObject<{
                        access: z.ZodOptional<z.ZodEnum<{
                            MYSELF: "MYSELF";
                            DOMAIN: "DOMAIN";
                            ANYONE: "ANYONE";
                            ANYONE_ANONYMOUS: "ANYONE_ANONYMOUS";
                        }>>;
                        executeAs: z.ZodOptional<z.ZodEnum<{
                            USER_ACCESSING: "USER_ACCESSING";
                            USER_DEPLOYING: "USER_DEPLOYING";
                        }>>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                executionApi: z.ZodOptional<z.ZodObject<{
                    entryPointConfig: z.ZodOptional<z.ZodObject<{
                        access: z.ZodOptional<z.ZodEnum<{
                            MYSELF: "MYSELF";
                            DOMAIN: "DOMAIN";
                            ANYONE: "ANYONE";
                            ANYONE_ANONYMOUS: "ANYONE_ANONYMOUS";
                        }>>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>>;
            updateTime: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        deployments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            deploymentId: z.ZodString;
            versionNumber: z.ZodOptional<z.ZodNumber>;
            deploymentConfig: z.ZodOptional<z.ZodObject<{
                description: z.ZodOptional<z.ZodString>;
                manifestFileName: z.ZodOptional<z.ZodString>;
                versionNumber: z.ZodOptional<z.ZodNumber>;
                scriptId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            entryPoints: z.ZodOptional<z.ZodArray<z.ZodObject<{
                entryPointType: z.ZodOptional<z.ZodEnum<{
                    WEB_APP: "WEB_APP";
                    EXECUTION_API: "EXECUTION_API";
                    ADD_ON: "ADD_ON";
                }>>;
                webApp: z.ZodOptional<z.ZodObject<{
                    url: z.ZodOptional<z.ZodString>;
                    entryPointConfig: z.ZodOptional<z.ZodObject<{
                        access: z.ZodOptional<z.ZodEnum<{
                            MYSELF: "MYSELF";
                            DOMAIN: "DOMAIN";
                            ANYONE: "ANYONE";
                            ANYONE_ANONYMOUS: "ANYONE_ANONYMOUS";
                        }>>;
                        executeAs: z.ZodOptional<z.ZodEnum<{
                            USER_ACCESSING: "USER_ACCESSING";
                            USER_DEPLOYING: "USER_DEPLOYING";
                        }>>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                executionApi: z.ZodOptional<z.ZodObject<{
                    entryPointConfig: z.ZodOptional<z.ZodObject<{
                        access: z.ZodOptional<z.ZodEnum<{
                            MYSELF: "MYSELF";
                            DOMAIN: "DOMAIN";
                            ANYONE: "ANYONE";
                            ANYONE_ANONYMOUS: "ANYONE_ANONYMOUS";
                        }>>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>>;
            updateTime: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        webAppUrl: z.ZodOptional<z.ZodString>;
        result: z.ZodOptional<z.ZodUnknown>;
        executionError: z.ZodOptional<z.ZodObject<{
            errorMessage: z.ZodOptional<z.ZodString>;
            errorType: z.ZodOptional<z.ZodString>;
            scriptStackTraceElements: z.ZodOptional<z.ZodArray<z.ZodObject<{
                function: z.ZodOptional<z.ZodString>;
                lineNumber: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        processes: z.ZodOptional<z.ZodArray<z.ZodObject<{
            processId: z.ZodOptional<z.ZodString>;
            projectName: z.ZodOptional<z.ZodString>;
            functionName: z.ZodOptional<z.ZodString>;
            processType: z.ZodOptional<z.ZodEnum<{
                EDITOR: "EDITOR";
                SIMPLE_TRIGGER: "SIMPLE_TRIGGER";
                TRIGGER: "TRIGGER";
                WEBAPP: "WEBAPP";
                API_EXECUTABLE: "API_EXECUTABLE";
                ADD_ON: "ADD_ON";
                TIME_DRIVEN: "TIME_DRIVEN";
            }>>;
            processStatus: z.ZodOptional<z.ZodEnum<{
                COMPLETED: "COMPLETED";
                FAILED: "FAILED";
                RUNNING: "RUNNING";
                CANCELED: "CANCELED";
                TIMED_OUT: "TIMED_OUT";
                UNKNOWN: "UNKNOWN";
                DELAYED: "DELAYED";
                PENDING: "PENDING";
            }>>;
            startTime: z.ZodOptional<z.ZodString>;
            duration: z.ZodOptional<z.ZodString>;
            userAccessLevel: z.ZodOptional<z.ZodEnum<{
                OWNER: "OWNER";
                READ: "READ";
                WRITE: "WRITE";
                NONE: "NONE";
            }>>;
        }, z.core.$strip>>>;
        metrics: z.ZodOptional<z.ZodObject<{
            activeUsers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                value: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
            totalExecutions: z.ZodOptional<z.ZodArray<z.ZodObject<{
                value: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
            failedExecutions: z.ZodOptional<z.ZodArray<z.ZodObject<{
                value: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        nextPageToken: z.ZodOptional<z.ZodString>;
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
                UNKNOWN: "UNKNOWN";
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
export declare const SHEETS_APPSSCRIPT_ANNOTATIONS: ToolAnnotations;
export type SheetsAppsScriptInput = z.infer<typeof SheetsAppsScriptInputSchema>;
export type SheetsAppsScriptOutput = z.infer<typeof SheetsAppsScriptOutputSchema>;
export type AppsScriptResponse = z.infer<typeof AppsScriptResponseSchema>;
export type AppsScriptRequest = SheetsAppsScriptInput['request'];
export type AppsScriptCreateInput = SheetsAppsScriptInput['request'] & {
    action: 'create';
};
export type AppsScriptGetInput = SheetsAppsScriptInput['request'] & {
    action: 'get';
};
export type AppsScriptGetContentInput = SheetsAppsScriptInput['request'] & {
    action: 'get_content';
};
export type AppsScriptUpdateContentInput = SheetsAppsScriptInput['request'] & {
    action: 'update_content';
};
export type AppsScriptCreateVersionInput = SheetsAppsScriptInput['request'] & {
    action: 'create_version';
};
export type AppsScriptListVersionsInput = SheetsAppsScriptInput['request'] & {
    action: 'list_versions';
};
export type AppsScriptGetVersionInput = SheetsAppsScriptInput['request'] & {
    action: 'get_version';
};
export type AppsScriptDeployInput = SheetsAppsScriptInput['request'] & {
    action: 'deploy';
};
export type AppsScriptListDeploymentsInput = SheetsAppsScriptInput['request'] & {
    action: 'list_deployments';
};
export type AppsScriptGetDeploymentInput = SheetsAppsScriptInput['request'] & {
    action: 'get_deployment';
};
export type AppsScriptUndeployInput = SheetsAppsScriptInput['request'] & {
    action: 'undeploy';
};
export type AppsScriptRunInput = SheetsAppsScriptInput['request'] & {
    action: 'run';
};
export type AppsScriptListProcessesInput = SheetsAppsScriptInput['request'] & {
    action: 'list_processes';
};
export type AppsScriptGetMetricsInput = SheetsAppsScriptInput['request'] & {
    action: 'get_metrics';
};
export {};
//# sourceMappingURL=appsscript.d.ts.map