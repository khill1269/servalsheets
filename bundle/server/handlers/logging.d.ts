import { LoggingSetLevelRequest, LoggingSetLevelResponse } from '../schemas/logging.js';
/**
 * Handle logging/setLevel requests
 */
export declare function handleLoggingSetLevel(request: LoggingSetLevelRequest): Promise<LoggingSetLevelResponse>;
/**
 * Get current log level in MCP format
 */
export declare function getCurrentLogLevel(): string;
//# sourceMappingURL=logging.d.ts.map