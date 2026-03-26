export const TOOL_ROUTE_MODES = ['local', 'remote', 'prefer_local', 'disabled_on_stdio'] as const;

export type ToolRouteMode = (typeof TOOL_ROUTE_MODES)[number];

export const TOOL_TRANSPORTS = ['stdio', 'streamable-http', 'http'] as const;

export type ToolTransport = (typeof TOOL_TRANSPORTS)[number];

export type ToolName =
  | 'sheets_auth'
  | 'sheets_core'
  | 'sheets_data'
  | 'sheets_format'
  | 'sheets_dimensions'
  | 'sheets_visualize'
  | 'sheets_collaborate'
  | 'sheets_advanced'
  | 'sheets_transaction'
  | 'sheets_quality'
  | 'sheets_history'
  | 'sheets_confirm'
  | 'sheets_analyze'
  | 'sheets_fix'
  | 'sheets_composite'
  | 'sheets_session'
  | 'sheets_templates'
  | 'sheets_bigquery'
  | 'sheets_appsscript'
  | 'sheets_webhook'
  | 'sheets_dependencies'
  | 'sheets_federation'
  | 'sheets_compute'
  | 'sheets_agent'
  | 'sheets_connectors';

export interface ToolRoutePolicy {
  readonly mode: ToolRouteMode;
  readonly reason: string;
  readonly remoteTransport?: Extract<ToolTransport, 'streamable-http' | 'http'>;
}

export interface ToolRouteManifestValidation {
  readonly valid: boolean;
  readonly missingToolNames: readonly string[];
  readonly extraToolNames: readonly string[];
}

export interface ToolRoutingSummary {
  readonly totalToolCount: number;
  readonly localCount: number;
  readonly remoteCount: number;
  readonly preferLocalCount: number;
  readonly disabledOnStdioCount: number;
  readonly stdioExposedCount: number;
}

export type ToolExecutionTarget = 'local' | 'remote';

export interface ResolveExecutionTargetOptions {
  readonly toolName: string;
  readonly transport: ToolTransport;
  readonly hasRemoteExecutor: boolean;
  readonly policy?: ToolRoutePolicy;
}

export interface DispatchToolCallOptions<T> {
  readonly toolName: string;
  readonly transport: ToolTransport;
  readonly localExecute: () => Promise<T>;
  readonly remoteExecute?: () => Promise<T>;
  readonly policy?: ToolRoutePolicy;
}
