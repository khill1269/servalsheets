import { ACTION_ANNOTATIONS, TOOL_ACTIONS, type ActionAnnotation } from '../schemas/index.js';
import type {
  PlannerActionCatalogEntry,
  PlannerToolCatalogEntry,
} from '../services/agent/types.js';
import {
  filterAvailableActions,
  getToolAvailabilityMetadata,
  isToolFullyUnavailable,
} from './tool-availability.js';
import { getToolSurfaceMetadata, type ToolAuthPolicyLike } from './tool-surface-metadata.js';

export interface PlannerToolDefinitionSource {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly authPolicy?: ToolAuthPolicyLike;
}

function getActionAnnotation(toolName: string, actionName: string): ActionAnnotation | undefined {
  return ACTION_ANNOTATIONS[`${toolName}.${actionName}`];
}

function buildPlannerActionEntry(
  toolName: string,
  actionName: string,
  authPolicy: ReturnType<typeof getToolSurfaceMetadata>['authPolicy']
): PlannerActionCatalogEntry {
  const annotation = getActionAnnotation(toolName, actionName);
  return {
    action: actionName,
    ...(annotation?.whenToUse ? { whenToUse: annotation.whenToUse } : {}),
    ...(annotation?.whenNotToUse ? { whenNotToUse: annotation.whenNotToUse } : {}),
    ...(annotation?.prerequisites ? { prerequisites: [...annotation.prerequisites] } : {}),
    ...(annotation?.commonMistakes ? { commonMistakes: [...annotation.commonMistakes] } : {}),
    ...(annotation?.apiCalls !== undefined ? { apiCalls: annotation.apiCalls } : {}),
    ...(annotation?.idempotent !== undefined ? { idempotent: annotation.idempotent } : {}),
    requiresAuth: authPolicy.requiresAuth && !authPolicy.exemptActions.includes(actionName),
  };
}

export function buildPlannerToolCatalog(
  toolDefinitions: readonly PlannerToolDefinitionSource[]
): PlannerToolCatalogEntry[] {
  return toolDefinitions
    .filter((tool) => !isToolFullyUnavailable(tool.name))
    .map((tool) => {
      const availability = getToolAvailabilityMetadata(tool.name);
      const surfaceMetadata = getToolSurfaceMetadata(tool.name, {
        authPolicy: tool.authPolicy,
        availability,
      });
      const actions = filterAvailableActions(tool.name, TOOL_ACTIONS[tool.name] ?? []).map(
        (action) => buildPlannerActionEntry(tool.name, action, surfaceMetadata.authPolicy)
      );

      return {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        actionCount: actions.length,
        actions,
        ...(surfaceMetadata.tier ? { tier: surfaceMetadata.tier } : {}),
        ...(surfaceMetadata.group ? { group: surfaceMetadata.group } : {}),
        ...(surfaceMetadata.primaryVerbs
          ? { primaryVerbs: [...surfaceMetadata.primaryVerbs] }
          : {}),
        ...(surfaceMetadata.agencyHint ? { agencyHint: surfaceMetadata.agencyHint } : {}),
        ...(surfaceMetadata.requiredScopes
          ? { requiredScopes: surfaceMetadata.requiredScopes }
          : {}),
        ...(surfaceMetadata.availability ? { availability: surfaceMetadata.availability } : {}),
        authPolicy: surfaceMetadata.authPolicy,
      };
    })
    .filter((tool) => tool.actions.length > 0);
}
