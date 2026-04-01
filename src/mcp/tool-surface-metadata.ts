import { getToolAvailabilityMetadata } from './tool-availability.js';

export type ToolSurfaceGroup = 'data-io' | 'appearance' | 'structure' | 'analysis' | 'automation';

export interface ToolTierMeta {
  tier: 1 | 2 | 3;
  group: ToolSurfaceGroup;
  primaryVerbs: string[];
}

export interface ToolScopeRequirement {
  primary: string;
  elevated?: string;
  note?: string;
}

export interface ToolAgencyHint {
  level: 'autonomous' | 'orchestrated' | 'direct';
  reason: string;
}

export interface ToolAuthPolicyLike {
  requiresAuth?: boolean;
  exemptActions?: readonly string[];
}

export interface ToolSurfaceAuthPolicy {
  requiresAuth: boolean;
  exemptActions: string[];
  hasAuthExemptActions: boolean;
  note?: string;
}

export interface ToolSurfaceMetadata {
  tier?: ToolTierMeta['tier'];
  group?: ToolTierMeta['group'];
  primaryVerbs?: string[];
  agencyHint?: ToolAgencyHint;
  requiredScopes?: ToolScopeRequirement;
  availability?: Record<string, unknown>;
  authPolicy: ToolSurfaceAuthPolicy;
}

const EMPTY_ACTION_LIST: readonly string[] = [];

export const TOOL_TIERS: Record<string, ToolTierMeta> = {
  sheets_data: { tier: 1, group: 'data-io', primaryVerbs: ['read', 'write', 'append', 'find'] },
  sheets_core: {
    tier: 1,
    group: 'structure',
    primaryVerbs: ['create', 'list', 'delete', 'duplicate'],
  },
  sheets_format: {
    tier: 1,
    group: 'appearance',
    primaryVerbs: ['format', 'bold', 'color', 'number format'],
  },
  sheets_analyze: {
    tier: 1,
    group: 'analysis',
    primaryVerbs: ['scout', 'analyze', 'generate formula'],
  },
  sheets_auth: { tier: 1, group: 'automation', primaryVerbs: ['login', 'status', 'logout'] },
  sheets_dimensions: {
    tier: 2,
    group: 'appearance',
    primaryVerbs: ['freeze', 'sort', 'filter', 'resize', 'hide'],
  },
  sheets_visualize: {
    tier: 2,
    group: 'appearance',
    primaryVerbs: ['chart', 'sparkline', 'slicer'],
  },
  sheets_composite: { tier: 2, group: 'data-io', primaryVerbs: ['import', 'export', 'generate'] },
  sheets_session: {
    tier: 2,
    group: 'automation',
    primaryVerbs: ['set active', 'preferences', 'pipeline'],
  },
  sheets_fix: {
    tier: 2,
    group: 'analysis',
    primaryVerbs: ['clean', 'standardize', 'fill missing'],
  },
  sheets_compute: { tier: 2, group: 'data-io', primaryVerbs: ['stats', 'regression', 'forecast'] },
  sheets_history: {
    tier: 2,
    group: 'automation',
    primaryVerbs: ['undo', 'timeline', 'diff', 'snapshot'],
  },
  sheets_collaborate: {
    tier: 2,
    group: 'structure',
    primaryVerbs: ['share', 'protect', 'comment', 'versions'],
  },
  sheets_advanced: {
    tier: 3,
    group: 'structure',
    primaryVerbs: ['named range', 'pivot', 'slicer', 'banding'],
  },
  sheets_quality: { tier: 3, group: 'analysis', primaryVerbs: ['validate', 'conflicts'] },
  sheets_dependencies: {
    tier: 3,
    group: 'analysis',
    primaryVerbs: ['dependency graph', 'what-if', 'scenario'],
  },
  sheets_templates: { tier: 3, group: 'structure', primaryVerbs: ['save template', 'instantiate'] },
  sheets_transaction: {
    tier: 3,
    group: 'automation',
    primaryVerbs: ['begin', 'queue', 'commit', 'rollback'],
  },
  sheets_agent: { tier: 3, group: 'automation', primaryVerbs: ['plan', 'execute', 'rollback'] },
  sheets_confirm: { tier: 3, group: 'automation', primaryVerbs: ['confirm', 'wizard'] },
  sheets_webhook: { tier: 3, group: 'automation', primaryVerbs: ['watch', 'subscribe', 'trigger'] },
  sheets_appsscript: {
    tier: 3,
    group: 'automation',
    primaryVerbs: ['run script', 'deploy', 'manage'],
  },
  sheets_bigquery: {
    tier: 3,
    group: 'data-io',
    primaryVerbs: ['query', 'import', 'export', 'dataset'],
  },
  sheets_federation: {
    tier: 3,
    group: 'automation',
    primaryVerbs: ['remote call', 'list servers'],
  },
  sheets_connectors: { tier: 3, group: 'data-io', primaryVerbs: ['discover', 'connect', 'fetch'] },
};

export const TOOL_SCOPE_REQUIREMENTS: Record<string, ToolScopeRequirement> = {
  sheets_auth: { primary: 'none', note: 'No Google API scopes required' },
  sheets_session: { primary: 'none', note: 'Local session state only' },
  sheets_confirm: { primary: 'none', note: 'MCP elicitation only' },
  sheets_core: {
    primary: 'spreadsheets',
    elevated: 'drive.file',
    note: 'create requires drive.file scope',
  },
  sheets_data: { primary: 'spreadsheets' },
  sheets_format: { primary: 'spreadsheets' },
  sheets_dimensions: { primary: 'spreadsheets' },
  sheets_visualize: { primary: 'spreadsheets' },
  sheets_advanced: { primary: 'spreadsheets' },
  sheets_compute: { primary: 'spreadsheets' },
  sheets_fix: { primary: 'spreadsheets' },
  sheets_quality: { primary: 'spreadsheets' },
  sheets_analyze: {
    primary: 'spreadsheets.readonly',
    elevated: 'spreadsheets',
    note: 'Read-only for analysis; full scope for semantic_search indexing',
  },
  sheets_collaborate: {
    primary: 'spreadsheets',
    elevated: 'drive',
    note: 'Sharing/comments/versions require full drive scope',
  },
  sheets_history: {
    primary: 'spreadsheets',
    elevated: 'drive.readonly',
    note: 'timeline/diff need drive revision access',
  },
  sheets_dependencies: { primary: 'spreadsheets' },
  sheets_composite: {
    primary: 'spreadsheets',
    elevated: 'drive.file',
    note: 'generate_sheet/import may create new files',
  },
  sheets_templates: {
    primary: 'drive.appdata',
    elevated: 'drive.file',
    note: 'All actions require appdata scope; apply needs drive.file',
  },
  sheets_transaction: { primary: 'spreadsheets' },
  sheets_bigquery: {
    primary: 'spreadsheets',
    elevated: 'bigquery',
    note: 'Query/import/export need BigQuery scope',
  },
  sheets_appsscript: {
    primary: 'spreadsheets',
    elevated: 'script.projects',
    note: 'Create/execute/deploy need Apps Script scope',
  },
  sheets_webhook: {
    primary: 'spreadsheets',
    elevated: 'drive',
    note: 'Register/unregister need drive scope',
  },
  sheets_federation: { primary: 'none', note: 'Delegates to remote MCP servers' },
  sheets_connectors: {
    primary: 'none',
    elevated: 'spreadsheets',
    note: 'configure needs no scope; query/subscribe need sheets access',
  },
  sheets_agent: {
    primary: 'spreadsheets',
    elevated: 'drive',
    note: 'Agent may invoke any tool — inherits all scope requirements',
  },
};

export const TOOL_AGENCY_HINTS: Record<string, ToolAgencyHint> = {
  sheets_agent: {
    level: 'autonomous',
    reason:
      'Plan/execute/observe loop with rollback — designed for autonomous multi-step workflows',
  },
  sheets_composite: {
    level: 'orchestrated',
    reason: 'Multi-step operations (import, generate, setup) that chain internal tool calls',
  },
  sheets_analyze: {
    level: 'orchestrated',
    reason: 'AI sampling-powered analysis that benefits from iterative scout -> comprehensive flow',
  },
  sheets_fix: {
    level: 'orchestrated',
    reason: 'Cleaning pipelines that chain detect -> preview -> apply with user confirmation',
  },
  sheets_transaction: {
    level: 'orchestrated',
    reason: 'Queue -> commit -> verify pattern requires multi-step sequencing',
  },
  sheets_dependencies: {
    level: 'orchestrated',
    reason: 'Scenario modeling benefits from iterative what-if -> compare -> materialize flow',
  },
  sheets_confirm: {
    level: 'direct',
    reason: 'Single user interaction — confirmation or wizard step',
  },
  sheets_session: {
    level: 'direct',
    reason: 'Context management — single-call set/get operations',
  },
  sheets_auth: { level: 'direct', reason: 'Authentication — single-call status/login/callback' },
  sheets_compute: {
    level: 'direct',
    reason: 'Stateless computation — same input always produces same output',
  },
};

export function normalizeToolAuthPolicy(policy?: ToolAuthPolicyLike): ToolSurfaceAuthPolicy {
  const requiresAuth = policy?.requiresAuth ?? true;
  const exemptActions = [...(policy?.exemptActions ?? EMPTY_ACTION_LIST)];

  const note = !requiresAuth
    ? 'All actions available without Google auth'
    : exemptActions.length > 0
      ? `Auth-exempt actions: ${exemptActions.join(', ')}`
      : undefined;

  return {
    requiresAuth,
    exemptActions,
    hasAuthExemptActions: exemptActions.length > 0,
    ...(note ? { note } : {}),
  };
}

export function getToolSurfaceMetadata(
  toolName: string,
  options: {
    authPolicy?: ToolAuthPolicyLike;
    availability?: Record<string, unknown> | undefined;
  } = {}
): ToolSurfaceMetadata {
  const tierMeta = TOOL_TIERS[toolName];
  const scopeReqs = TOOL_SCOPE_REQUIREMENTS[toolName];
  const agencyHint = TOOL_AGENCY_HINTS[toolName];
  const availability = options.availability ?? getToolAvailabilityMetadata(toolName);

  return {
    ...(tierMeta
      ? { tier: tierMeta.tier, group: tierMeta.group, primaryVerbs: tierMeta.primaryVerbs }
      : {}),
    ...(agencyHint ? { agencyHint } : {}),
    ...(scopeReqs ? { requiredScopes: scopeReqs } : {}),
    ...(availability ? { availability } : {}),
    authPolicy: normalizeToolAuthPolicy(options.authPolicy),
  };
}
