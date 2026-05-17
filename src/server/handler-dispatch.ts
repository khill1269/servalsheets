import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Handlers, HandlerContext } from '../handlers/index.js';
import type { AuthHandler } from '../handlers/auth.js';
import type { GoogleApiClient } from '../services/google-api.js';
import { STAGED_REGISTRATION } from '../config/constants.js';
import { toolStageManager } from '../mcp/registration/tool-stage-manager.js';
import { createToolHandlerMap, buildToolResponse } from '../mcp/registration/tool-handlers.js';
import { executeRoutedToolCall } from '../mcp/routed-tool-execution.js';
import { startKeepalive } from '../utils/keepalive.js';
import { checkRateLimit } from '../middleware/rate-limit-middleware.js';
import { detectMutationSafetyViolation } from '../middleware/mutation-safety-middleware.js';
import { getSessionContext } from '../services/session-context.js';
import { getRbacManager } from '../services/rbac-manager.js';
import { getEnv } from '../config/env.js';

type ServerToolHandler = (args: unknown, extra?: unknown) => Promise<unknown>;
type ServerToolHandlerMap = Record<string, ServerToolHandler>;

export interface DispatchServerToolCallParams {
  toolName: string;
  args: Record<string, unknown>;
  extra?: (Record<string, unknown> & { abortSignal?: AbortSignal }) | undefined;
  rawArgs: Record<string, unknown>;
  rawAction: string | undefined;
  handlers: Handlers;
  authHandler: AuthHandler | null;
  cachedHandlerMap: ServerToolHandlerMap | null;
  context: HandlerContext | null;
  googleClient: GoogleApiClient | null;
  requestId: string;
  costTrackingTenantId: string;
}

export type DispatchServerToolCallResult =
  | { kind: 'result'; result: unknown; handlerMap: ServerToolHandlerMap }
  | { kind: 'error'; response: CallToolResult; handlerMap: ServerToolHandlerMap | null };

export interface DispatchServerToolCallDependencies {
  executeRoutedToolCall?: typeof executeRoutedToolCall;
  checkRateLimitFn?: typeof checkRateLimit;
  detectMutationSafetyViolationFn?: typeof detectMutationSafetyViolation;
  getSessionContextFn?: typeof getSessionContext;
}

export async function dispatchServerToolCall(
  params: DispatchServerToolCallParams,
  dependencies: DispatchServerToolCallDependencies = {}
): Promise<DispatchServerToolCallResult> {
  const {
    toolName,
    args,
    extra,
    rawArgs,
    rawAction,
    handlers,
    authHandler,
    context,
    googleClient,
    requestId,
    costTrackingTenantId,
  } = params;

  if (STAGED_REGISTRATION) {
    if (
      toolStageManager.currentStage < 2 &&
      (rawAction === 'set_active' ||
        rawArgs['spreadsheetId'] ||
        (rawArgs['request'] as Record<string, unknown> | undefined)?.['spreadsheetId'])
    ) {
      toolStageManager.advanceToStage(2);
    }
    toolStageManager.ensureToolAvailable(toolName);
  }

  const handlerMap =
    params.cachedHandlerMap ??
    createToolHandlerMap(handlers, authHandler ?? undefined, googleClient ?? undefined);
  const handler = handlerMap[toolName];
  if (!handler) {
    return {
      kind: 'error',
      response: buildToolResponse({
        response: {
          success: false,
          error: {
            code: 'METHOD_NOT_FOUND',
            message: `Handler for ${toolName} not yet implemented`,
            retryable: false,
            suggestedFix: 'This tool is planned for a future release',
            alternatives: [
              {
                tool: 'sheets_data',
                action: 'read',
                description: 'Use sheets_data for basic read/write operations',
              },
            ],
          },
        },
      }),
      handlerMap,
    };
  }

  if (!context) {
    return {
      kind: 'error',
      response: buildToolResponse({
        response: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Server context not initialized',
            retryable: false,
          },
        },
      }),
      handlerMap,
    };
  }

  const { createMetadataCache } = await import('../services/metadata-cache.js');
  const metadataCache = googleClient?.sheets ? createMetadataCache(googleClient.sheets) : undefined;

  const perRequestContext: HandlerContext = {
    ...context,
    requestId,
    abortSignal: extra?.abortSignal,
    metadataCache,
  };

  // C9: Rate limit check (parity with HTTP path in tool-handlers.ts)
  const rateLimitFn = dependencies.checkRateLimitFn ?? checkRateLimit;
  const rateCheck = rateLimitFn(params.costTrackingTenantId);
  if (!rateCheck.allowed) {
    return {
      kind: 'error',
      response: buildToolResponse({
        response: {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded. Please slow down your requests.',
            retryable: true,
            retryAfterMs: rateCheck.retryAfterMs,
          },
        },
      }),
      handlerMap,
    };
  }

  // C9: Mutation safety check (parity with HTTP path in tool-handlers.ts)
  const mutationSafetyFn =
    dependencies.detectMutationSafetyViolationFn ?? detectMutationSafetyViolation;
  const mutationViolation = mutationSafetyFn(rawArgs);
  if (mutationViolation) {
    return {
      kind: 'error',
      response: buildToolResponse({
        response: {
          success: false,
          error: {
            code: 'FORMULA_INJECTION_BLOCKED',
            message: `Dangerous formula detected at ${mutationViolation.path}: ${mutationViolation.preview}`,
            retryable: false,
          },
        },
      }),
      handlerMap,
    };
  }

  // RBAC enforcement (parity with HTTP path in tool-handlers.ts:1229-1294)
  if (getEnv()['ENABLE_RBAC'])
    try {
      const rbacReq = rawArgs['request'] as Record<string, unknown> | undefined;
      const rbacActionName =
        (typeof rbacReq?.['action'] === 'string' ? rbacReq['action'] : null) ??
        (typeof rawArgs['action'] === 'string' ? rawArgs['action'] : null) ??
        undefined;
      const rbacResourceId =
        (typeof rbacReq?.['spreadsheetId'] === 'string' ? rbacReq['spreadsheetId'] : null) ??
        (typeof rawArgs['spreadsheetId'] === 'string' ? rawArgs['spreadsheetId'] : null) ??
        undefined;
      const rbacResult = await getRbacManager().checkPermission({
        userId: costTrackingTenantId,
        toolName,
        actionName: rbacActionName,
        resourceId: rbacResourceId,
      });
      if (!rbacResult.allowed) {
        return {
          kind: 'error',
          response: buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: rbacResult.reason ?? 'Permission denied',
                retryable: false,
              },
            },
          }),
          handlerMap,
        };
      }
    } catch (rbacError) {
      const strict = getEnv()['RBAC_STRICT'];
      if (strict) {
        return {
          kind: 'error',
          response: buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'PERMISSION_DENIED',
                message: 'RBAC authorization check failed. Access denied (RBAC_STRICT=true).',
                retryable: false,
              },
            },
          }),
          handlerMap,
        };
      }
    }

  const keepalive = startKeepalive({
    operationName: toolName,
    debug: process.env['DEBUG_KEEPALIVE'] === 'true',
  });
  const executeToolCall = dependencies.executeRoutedToolCall ?? executeRoutedToolCall;

  try {
    const result = await executeToolCall({
      toolName,
      transport: 'stdio',
      args,
      sessionContext: context.sessionContext,
      localExecute: () => handler(args, { ...extra, context: perRequestContext }),
    });

    // C7: autoRecord (parity with HTTP path in tool-execution-side-effects.ts)
    try {
      const getSessionContextFn = dependencies.getSessionContextFn ?? getSessionContext;
      const sessionCtx = getSessionContextFn();
      if (sessionCtx?.getPreferences().autoRecord) {
        const resultData = result as { response?: { spreadsheetId?: string } } | undefined;
        sessionCtx.recordOperation({
          tool: toolName,
          action: rawAction ?? 'unknown',
          spreadsheetId: resultData?.response?.spreadsheetId ?? '',
          description: `${toolName}.${rawAction ?? 'unknown'} completed successfully`,
          undoable: false,
        });
      }
    } catch {
      // autoRecord is non-critical — never block tool execution.
    }

    return { kind: 'result', result, handlerMap };
  } finally {
    keepalive.stop();
    metadataCache?.clear();
    perRequestContext.costTracker?.trackApiCall(costTrackingTenantId, 'sheets');
  }
}
