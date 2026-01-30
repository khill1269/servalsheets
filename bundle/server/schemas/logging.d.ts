import { z } from 'zod';
/**
 * MCP LoggingLevel enum
 * Spec: "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency"
 */
export declare const McpLoggingLevelSchema: z.ZodEnum<{
    error: "error";
    critical: "critical";
    warning: "warning";
    info: "info";
    debug: "debug";
    notice: "notice";
    alert: "alert";
    emergency: "emergency";
}>;
export type McpLoggingLevel = z.infer<typeof McpLoggingLevelSchema>;
/**
 * Map MCP log levels to Winston levels
 */
export declare const MCP_TO_WINSTON_LEVEL: Record<McpLoggingLevel, string>;
/**
 * Map Winston levels to MCP levels
 */
export declare const WINSTON_TO_MCP_LEVEL: Record<string, McpLoggingLevel>;
/**
 * logging/setLevel request schema
 */
export declare const LoggingSetLevelRequestSchema: z.ZodObject<{
    level: z.ZodEnum<{
        error: "error";
        critical: "critical";
        warning: "warning";
        info: "info";
        debug: "debug";
        notice: "notice";
        alert: "alert";
        emergency: "emergency";
    }>;
}, z.core.$strip>;
export type LoggingSetLevelRequest = z.infer<typeof LoggingSetLevelRequestSchema>;
/**
 * logging/setLevel response schema
 */
export declare const LoggingSetLevelResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    previousLevel: z.ZodOptional<z.ZodString>;
    newLevel: z.ZodString;
}, z.core.$strip>;
export type LoggingSetLevelResponse = z.infer<typeof LoggingSetLevelResponseSchema>;
//# sourceMappingURL=logging.d.ts.map