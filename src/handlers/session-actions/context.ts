/**
 * Session context action handlers.
 * Covers: set_active, get_active, get_context, record_operation, get_last_operation
 */

import { extractRangeA1Optional } from '../../utils/range-helpers.js';
import type { SheetsSessionOutput } from '../../schemas/session.js';
import type {
  SessionContextManager,
  SpreadsheetContext,
} from '../../services/session-context.js';
import { getHistoryService } from '../../services/history-service.js';
import { getPrefetchingSystem } from '../../services/prefetching-system.js';
import { ValidationError } from '../../core/errors.js';
import { logger } from '../../utils/logger.js';
import { connectorManager } from '../../resources/connectors-runtime.js';

export async function handleSetActive(
  session: SessionContextManager,
  req: {
    action: 'set_active';
    spreadsheetId: string;
    title?: string;
    sheetNames?: string[];
  }
): Promise<SheetsSessionOutput> {
  const { spreadsheetId, title, sheetNames } = req;
  if (typeof spreadsheetId !== 'string' || spreadsheetId.trim().length === 0) {
    throw new ValidationError('Missing required parameter: spreadsheetId', 'spreadsheetId');
  }
  // Title is optional - use spreadsheetId as fallback if not provided
  // This allows LLMs to quickly set active without knowing the title
  const resolvedTitle = title ?? `Spreadsheet ${spreadsheetId.slice(0, 8)}...`;
  const context: SpreadsheetContext = {
    spreadsheetId,
    title: resolvedTitle,
    sheetNames: sheetNames ?? [],
    activatedAt: Date.now(),
  };
  session.setActiveSpreadsheet(context);
  const prefetchingSystem = getPrefetchingSystem();
  if (prefetchingSystem) {
    void prefetchingSystem.prefetchOnOpen(spreadsheetId).catch((error: unknown) => {
      logger.debug('set_active prefetch warmup failed', {
        spreadsheetId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  } else {
    logger.debug('set_active: session context updated, no prefetch system available', {
      spreadsheetId,
    });
  }
  return {
    response: {
      success: true,
      action: 'set_active',
      spreadsheet: context,
      summary: session.getContextSummary(),
      ...(title === undefined && {
        message:
          'Title was auto-generated from spreadsheetId. Provide title for better natural language references.',
      }),
    },
  };
}

export function handleGetActive(session: SessionContextManager): SheetsSessionOutput {
  return {
    response: {
      success: true,
      action: 'get_active',
      spreadsheet: session.getActiveSpreadsheet(),
      recentSpreadsheets: session.getRecentSpreadsheets(),
      summary: session.getContextSummary(),
    },
  };
}

export function handleGetContext(session: SessionContextManager): SheetsSessionOutput {
  // session.getPendingOperation() context field is `Record<string, unknown>`,
  // while PendingOperationSchema expects a more specific value union. The runtime
  // value is always compatible — cast the whole return as the output type.

  // Enrich context with connector readiness so LLM sees available integrations
  const connectorCatalog = connectorManager.listConnectors().connectors;
  const zeroAuthConnectors = connectorCatalog
    .filter((c) => c.authType === 'none' && !c.configured)
    .map((c) => ({ id: c.id, name: c.name }));
  const apiKeyConnectors = connectorCatalog
    .filter((c) => c.authType === 'api_key' && !c.configured)
    .map((c) => ({ id: c.id, name: c.name }));
  const oauthReadyConnectors = connectorCatalog
    .filter((c) => c.authType === 'oauth2' && !c.configured)
    .map((c) => ({ id: c.id, name: c.name }));
  const configuredConnectors = connectorCatalog
    .filter((c) => c.configured)
    .map((c) => ({ id: c.id, name: c.name }));

  const operationHistory = session.getOperationHistory(1);
  const autoRecordHint =
    operationHistory.length === 0
      ? 'No operations recorded this session. Call record_operation after each major write/format/structural change, or enable autoRecord via update_preferences.'
      : undefined;

  // Build connector onboarding block when unconfigured connectors exist.
  // Provides structured next-call guidance so the LLM (or user via elicitation)
  // can decide which connectors to set up.
  const hasUnconfigured =
    zeroAuthConnectors.length > 0 ||
    apiKeyConnectors.length > 0 ||
    oauthReadyConnectors.length > 0;
  const connectorOnboarding = hasUnconfigured
    ? {
        message:
          `${connectorCatalog.length} connectors available, ${configuredConnectors.length} configured. ` +
          'Ask the user which connectors they want to enable before auto-configuring.',
        immediateSetup: zeroAuthConnectors.map((c) => ({
          ...c,
          authType: 'none' as const,
          action: `sheets_connectors action:"configure" connectorId:"${c.id}"`,
          note: 'No credentials needed — configure immediately',
        })),
        apiKeySetup: apiKeyConnectors.map((c) => ({
          ...c,
          authType: 'api_key' as const,
          action: `sheets_connectors action:"configure" connectorId:"${c.id}"`,
          note: 'Requires API key — will open secure local setup page via URL elicitation',
        })),
        oauthSetup: oauthReadyConnectors.map((c) => ({
          ...c,
          authType: 'oauth2' as const,
          action: `sheets_connectors action:"configure" connectorId:"${c.id}"`,
          note: 'OAuth2 — will open secure local setup page via URL elicitation',
        })),
        wizardAvailable:
          'For multi-connector setup: use sheets_confirm action:"wizard_start" with steps for each connector the user wants to enable.',
      }
    : undefined;

  return {
    response: {
      success: true,
      action: 'get_context',
      summary: session.getContextSummary(),
      activeSpreadsheet: session.getActiveSpreadsheet(),
      lastOperation: session.getLastOperation(),
      pendingOperation: session.getPendingOperation(),
      suggestedActions: session.suggestNextActions(),
      connectors: {
        available: connectorCatalog.length,
        configured: configuredConnectors,
        zeroAuth: zeroAuthConnectors,
        apiKey: apiKeyConnectors,
        oauthReady: oauthReadyConnectors,
      },
      ...(connectorOnboarding ? { connectorOnboarding } : {}),
      ...(autoRecordHint ? { autoRecordHint } : {}),
    },
  } as SheetsSessionOutput;
}

export function handleRecordOperation(
  session: SessionContextManager,
  req: {
    action: 'record_operation';
    tool?: string;
    toolAction?: string;
    spreadsheetId?: string;
    range?: string | { a1?: string; namedRange?: string; semantic?: object; grid?: object };
    description?: string;
    undoable?: boolean;
    snapshotId?: string;
    cellsAffected?: number;
  }
): SheetsSessionOutput {
  const { tool, toolAction, spreadsheetId, range, description, undoable, snapshotId, cellsAffected } = req;

  // Type assertion: refine() validates required fields are defined for record_operation action
  const operationId = session.recordOperation({
    tool: tool!,
    action: toolAction!,
    spreadsheetId: spreadsheetId!,
    range: extractRangeA1Optional(range as Parameters<typeof extractRangeA1Optional>[0]),
    description: description!,
    undoable: undoable!,
    snapshotId,
    cellsAffected,
  });

  // Sync operation to HistoryService so sheets_history:get can find it
  const historyService = getHistoryService();
  historyService.record({
    id: operationId,
    timestamp: new Date().toISOString(),
    tool: tool!,
    action: toolAction!,
    params: {
      range,
      description,
      undoable,
    },
    result: 'success',
    duration: 0,
    spreadsheetId: spreadsheetId!,
    cellsAffected,
    snapshotId,
  });

  return {
    response: {
      success: true,
      action: 'record_operation',
      operationId,
    },
  };
}

export function handleGetLastOperation(session: SessionContextManager): SheetsSessionOutput {
  return {
    response: {
      success: true,
      action: 'get_last_operation',
      operation: session.getLastOperation(),
    },
  };
}
