import { STAGED_REGISTRATION } from '../config/constants.js';
import { ConfigError } from '../core/errors.js';
import { logger } from '../utils/logger.js';
import {
  ACTIVE_TOOL_DEFINITIONS,
  TOOL_DEFINITIONS,
  getLazyToolDefinitions,
} from './registration/tool-definitions.js';
import {
  getToolRoutingSummary,
  validateToolRouteManifest,
  type ToolRouteManifestValidation,
  type ToolRoutingSummary,
} from './tool-routing.js';
import { TOOL_ACTIONS } from './completions.js';

export interface ToolCatalogDiagnostics {
  totalToolCount: number;
  activeToolCount: number;
  lazyToolCount: number;
  totalActionCount: number;
  configuredActionCount: number;
  stagedRegistration: boolean;
  routeManifest: ToolRouteManifestValidation;
  routingSummary: ToolRoutingSummary;
}

function countActions(toolNames: readonly string[]): number {
  return toolNames.reduce((sum, toolName) => sum + (TOOL_ACTIONS[toolName]?.length ?? 0), 0);
}

export function getConfiguredToolNames(): string[] {
  return ACTIVE_TOOL_DEFINITIONS.map((tool) => tool.name);
}

export function getConfiguredToolCount(): number {
  return getConfiguredToolNames().length;
}

export function getConfiguredActionCount(): number {
  return countActions(getConfiguredToolNames());
}

export function getToolCatalogDiagnostics(): ToolCatalogDiagnostics {
  const configuredToolNames = getConfiguredToolNames();
  const lazyToolNames = getLazyToolDefinitions().map((tool) => tool.name);
  const allToolNames = TOOL_DEFINITIONS.map((tool) => tool.name);

  return {
    totalToolCount: TOOL_DEFINITIONS.length,
    activeToolCount: configuredToolNames.length,
    lazyToolCount: lazyToolNames.length,
    totalActionCount: countActions(allToolNames),
    configuredActionCount: countActions(configuredToolNames),
    stagedRegistration: STAGED_REGISTRATION,
    routeManifest: validateToolRouteManifest(allToolNames),
    routingSummary: getToolRoutingSummary(allToolNames),
  };
}

export function validateToolCatalogConfiguration(): ToolCatalogDiagnostics {
  const diagnostics = getToolCatalogDiagnostics();
  const hasLazyLoadedTools = diagnostics.lazyToolCount > 0;
  const countsMatch =
    diagnostics.totalToolCount === diagnostics.activeToolCount &&
    diagnostics.totalActionCount === diagnostics.configuredActionCount;

  if (!diagnostics.routeManifest.valid) {
    throw new ConfigError(
      `Tool route manifest mismatch: missing [${diagnostics.routeManifest.missingToolNames.join(', ')}], ` +
        `extra [${diagnostics.routeManifest.extraToolNames.join(', ')}].`,
      'TOOL_CATALOG'
    );
  }

  if (!countsMatch && !diagnostics.stagedRegistration && !hasLazyLoadedTools) {
    throw new ConfigError(
      `Tool catalog mismatch: ${diagnostics.activeToolCount}/${diagnostics.totalToolCount} tools and ` +
        `${diagnostics.configuredActionCount}/${diagnostics.totalActionCount} actions are configured ` +
        'without staged registration or lazy loading enabled.',
      'TOOL_CATALOG'
    );
  }

  if (!countsMatch || diagnostics.stagedRegistration) {
    logger.info('Tool catalog configuration resolved', diagnostics);
  }

  return diagnostics;
}
