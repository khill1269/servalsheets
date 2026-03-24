import type {
  ToolName,
  ToolRouteManifestValidation,
  ToolRouteMode,
  ToolRoutePolicy,
  ToolRoutingSummary,
  ToolTransport,
} from './types.js';

export const ALL_TOOL_NAMES: readonly ToolName[] = [
  'sheets_auth',
  'sheets_core',
  'sheets_data',
  'sheets_format',
  'sheets_dimensions',
  'sheets_visualize',
  'sheets_collaborate',
  'sheets_advanced',
  'sheets_transaction',
  'sheets_quality',
  'sheets_history',
  'sheets_confirm',
  'sheets_analyze',
  'sheets_fix',
  'sheets_composite',
  'sheets_session',
  'sheets_templates',
  'sheets_bigquery',
  'sheets_appsscript',
  'sheets_webhook',
  'sheets_dependencies',
  'sheets_federation',
  'sheets_compute',
  'sheets_agent',
  'sheets_connectors',
] as const;

export const DEFAULT_TOOL_ROUTE_POLICY: Readonly<ToolRoutePolicy> = {
  mode: 'local',
  reason: 'Default to in-process execution until an explicit hybrid route is assigned.',
};

export const TOOL_ROUTE_MANIFEST: Readonly<Record<ToolName, ToolRoutePolicy>> = {
  sheets_auth: {
    mode: 'local',
    reason: 'Claude Desktop bootstrap and local auth flows must remain in-process.',
  },
  sheets_core: {
    mode: 'local',
    reason: 'Primary spreadsheet CRUD remains local during the first hybrid extraction phase.',
  },
  sheets_data: {
    mode: 'local',
    reason:
      'Cell reads and writes stay local until delegated auth and mutation tracing are finalized.',
  },
  sheets_format: {
    mode: 'local',
    reason:
      'Formatting mutations stay local for now to preserve deterministic Sheets side effects.',
  },
  sheets_dimensions: {
    mode: 'local',
    reason: 'Row and column mutations stay local during the initial runtime split.',
  },
  sheets_visualize: {
    mode: 'local',
    reason: 'Chart and pivot mutations still rely on the local Sheets execution path.',
  },
  sheets_collaborate: {
    mode: 'local',
    reason: 'Sharing and comments remain local until remote identity delegation is explicit.',
  },
  sheets_advanced: {
    mode: 'local',
    reason: 'Advanced Sheets mutations stay local while the hybrid contract is still stabilizing.',
  },
  sheets_transaction: {
    mode: 'local',
    reason: 'Transaction guarantees and rollback semantics remain local-first.',
  },
  sheets_quality: {
    mode: 'local',
    reason: 'Quality workflows currently depend on local access to Sheets and validation services.',
  },
  sheets_history: {
    mode: 'local',
    reason: 'Undo, restore, and timeline actions are session-bound and remain local.',
  },
  sheets_confirm: {
    mode: 'local',
    reason: 'Confirmation and elicitation state should stay in the local MCP session.',
  },
  sheets_analyze: {
    mode: 'prefer_local',
    reason:
      'Analysis is a good hybrid candidate, but local execution remains the initial preference.',
    remoteTransport: 'streamable-http',
  },
  sheets_fix: {
    mode: 'local',
    reason: 'Fix flows often chain directly into local mutation handlers.',
  },
  sheets_composite: {
    mode: 'local',
    reason: 'Composite workflows stay local until multi-step remote orchestration is proven.',
  },
  sheets_session: {
    mode: 'local',
    reason:
      'Conversation and spreadsheet session state is inherently local to the client connection.',
  },
  sheets_templates: {
    mode: 'local',
    reason: 'Template application still mutates Sheets directly and remains local-first.',
  },
  sheets_bigquery: {
    mode: 'prefer_local',
    reason:
      'BigQuery work is a strong hybrid candidate, but local execution remains the default path.',
    remoteTransport: 'streamable-http',
  },
  sheets_appsscript: {
    mode: 'prefer_local',
    reason:
      'Apps Script integration can move remote later, but stays local while credentials remain local.',
    remoteTransport: 'streamable-http',
  },
  sheets_webhook: {
    mode: 'local',
    reason: 'Webhook registration depends on local deployment state and stays local for now.',
  },
  sheets_dependencies: {
    mode: 'local',
    reason: 'Dependency analysis still expects local spreadsheet context and follow-on mutations.',
  },
  sheets_federation: {
    mode: 'remote',
    reason:
      'Federation is already conceptually remote and should resolve through the hosted MCP surface.',
    remoteTransport: 'streamable-http',
  },
  sheets_compute: {
    mode: 'prefer_local',
    reason:
      'Heavy compute is a strong remote candidate, but local execution remains the safe default.',
    remoteTransport: 'streamable-http',
  },
  sheets_agent: {
    mode: 'prefer_local',
    reason:
      'Agent workflows are likely to move remote, but local orchestration stays authoritative initially.',
    remoteTransport: 'streamable-http',
  },
  sheets_connectors: {
    mode: 'prefer_local',
    reason:
      'Connector execution may move remote later, but local secrets handling still wins today.',
    remoteTransport: 'streamable-http',
  },
} as const;

export function getToolRoutePolicy(toolName: string): Readonly<ToolRoutePolicy> {
  return TOOL_ROUTE_MANIFEST[toolName as ToolName] ?? DEFAULT_TOOL_ROUTE_POLICY;
}

export function listToolsByRouteMode(mode: ToolRouteMode): ToolName[] {
  return ALL_TOOL_NAMES.filter((toolName) => TOOL_ROUTE_MANIFEST[toolName].mode === mode);
}

export function isToolExposedOnTransport(toolName: string, transport: ToolTransport): boolean {
  const policy = getToolRoutePolicy(toolName);
  if (transport === 'stdio') {
    return policy.mode !== 'disabled_on_stdio';
  }

  return true;
}

export function getTransportVisibleToolNames(transport: ToolTransport): ToolName[] {
  return ALL_TOOL_NAMES.filter((toolName) => isToolExposedOnTransport(toolName, transport));
}

export function validateToolRouteManifest(
  toolNames: readonly string[]
): ToolRouteManifestValidation {
  const defined = new Set(toolNames);
  const manifest = new Set(ALL_TOOL_NAMES);

  const missingToolNames = toolNames.filter((toolName) => !manifest.has(toolName as ToolName));
  const extraToolNames = ALL_TOOL_NAMES.filter((toolName) => !defined.has(toolName));

  return {
    valid: missingToolNames.length === 0 && extraToolNames.length === 0,
    missingToolNames,
    extraToolNames,
  };
}

export function getToolRoutingSummary(
  toolNames: readonly string[] = ALL_TOOL_NAMES
): ToolRoutingSummary {
  let localCount = 0;
  let remoteCount = 0;
  let preferLocalCount = 0;
  let disabledOnStdioCount = 0;
  let stdioExposedCount = 0;

  for (const toolName of toolNames) {
    const policy = getToolRoutePolicy(toolName);
    if (policy.mode === 'local') {
      localCount++;
    } else if (policy.mode === 'remote') {
      remoteCount++;
    } else if (policy.mode === 'prefer_local') {
      preferLocalCount++;
    } else if (policy.mode === 'disabled_on_stdio') {
      disabledOnStdioCount++;
    }

    if (isToolExposedOnTransport(toolName, 'stdio')) {
      stdioExposedCount++;
    }
  }

  return {
    totalToolCount: toolNames.length,
    localCount,
    remoteCount,
    preferLocalCount,
    disabledOnStdioCount,
    stdioExposedCount,
  };
}
