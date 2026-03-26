/**
 * ServalSheets - Apps Script Handler
 *
 * Handles 19 Apps Script-related actions including script execution,
 * deployment, versioning, and metrics.
 */

import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsAppsScriptInput, SheetsAppsScriptOutput } from '../schemas/appsscript.js';
import { ValidationError, ServiceError } from '../core/errors.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { executeWithRetry } from '../utils/retry.js';
import { mapStandaloneError } from './helpers/error-mapping.js';
import { logger } from '../utils/logger.js';

const BOUND_SCRIPT_CACHE = new Map<string, { scriptId: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const appsScriptCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000,
  name: 'apps-script',
});

export class SheetsAppsScriptHandler extends BaseHandler<SheetsAppsScriptInput, SheetsAppsScriptOutput> {
  constructor(context: HandlerContext) {
    super('sheets_appsscript', context);
  }

  async handle(input: SheetsAppsScriptInput): Promise<SheetsAppsScriptOutput> {
    try {
      const req = unwrapRequest<SheetsAppsScriptInput['request']>(input);
      this.checkOperationScopes(`${this.toolName}.${req.action}`);

      let response: Record<string, unknown>;

      switch (req.action) {
        case 'get':
          response = await this.handleGet(req);
          break;
        case 'get_content':
          response = await this.handleGetContent(req);
          break;
        case 'run':
          response = await this.handleRun(req);
          break;
        default:
          throw new ValidationError(
            `Unknown action: ${(req as { action: string }).action}`,
            'action',
            'get | get_content | run | ...'
          );
      }

      return { response: { success: true, action: req.action, ...response } } as SheetsAppsScriptOutput;
    } catch (error) {
      logger.error('Apps Script handler error', { error });
      return {
        response: {
          success: false,
          error: mapStandaloneError(error),
        },
      } as SheetsAppsScriptOutput;
    }
  }

  protected createIntents(input: SheetsAppsScriptInput): Intent[] {
    const req = unwrapRequest<SheetsAppsScriptInput['request']>(input);
    if (req.action === 'run') {
      return [
        {
          type: 'SET_VALUES' as const,
          target: { spreadsheetId: req.spreadsheetId },
          payload: { action: 'run' },
          metadata: {
            sourceTool: 'sheets_appsscript',
            sourceAction: 'run',
            priority: 1,
            destructive: false,
          },
        },
      ];
    }
    return [];
  }

  private async handleGet(req: { scriptId?: string; spreadsheetId?: string }): Promise<Record<string, unknown>> {
    const scriptId = req.scriptId || (await this.getOrCreateScriptId(req.spreadsheetId));
    if (!scriptId) {
      throw new ValidationError('scriptId or spreadsheetId is required', 'scriptId');
    }

    return executeWithRetry(
      () => this.apiRequest(`https://script.googleapis.com/v1/projects/${scriptId}`, 'GET'),
      { maxRetries: 3 }
    );
  }

  private async handleGetContent(req: { scriptId?: string; spreadsheetId?: string }): Promise<Record<string, unknown>> {
    const scriptId = req.scriptId || (await this.getOrCreateScriptId(req.spreadsheetId));
    if (!scriptId) {
      throw new ValidationError('scriptId or spreadsheetId is required', 'scriptId');
    }

    return executeWithRetry(
      () => this.apiRequest(`https://script.googleapis.com/v1/projects/${scriptId}/content`, 'GET'),
      { maxRetries: 3 }
    );
  }

  private async handleRun(req: { scriptId?: string; spreadsheetId?: string; functionName?: string }): Promise<Record<string, unknown>> {
    const scriptId = req.scriptId || (await this.getOrCreateScriptId(req.spreadsheetId));
    if (!scriptId) {
      throw new ValidationError('scriptId or spreadsheetId is required', 'scriptId');
    }

    const functionName = req.functionName || 'onOpen';

    return executeWithRetry(
      () =>
        this.apiRequest(`https://script.googleapis.com/v1/projects/${scriptId}:runScript`, 'POST', {
          function: functionName,
        }),
      { maxRetries: 3 }
    );
  }

  private async getOrCreateScriptId(spreadsheetId?: string): Promise<string | undefined> {
    if (!spreadsheetId) return undefined;

    // Check cache
    const cached = BOUND_SCRIPT_CACHE.get(spreadsheetId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.scriptId;
    }

    // Resolve bound script via Drive API
    try {
      const file = await this.context.googleClient.drive.files.get({
        fileId: spreadsheetId,
        fields: 'appProperties',
      });

      const scriptId = (file.data.appProperties as Record<string, string>)?.['scriptId'];
      if (scriptId) {
        BOUND_SCRIPT_CACHE.set(spreadsheetId, { scriptId, expiresAt: Date.now() + CACHE_TTL_MS });
        return scriptId;
      }
    } catch (error) {
      logger.warn('Failed to resolve bound script', { spreadsheetId, error });
    }

    return undefined;
  }

  private async apiRequest(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<Record<string, unknown>> {
    return appsScriptCircuitBreaker.execute(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.context.requestContext?.timeoutMs ?? 30000);

      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${this.context.googleClient.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 401) {
            throw new ServiceError('Unauthorized', 'UNAUTHORIZED', 'appsscript');
          } else if (response.status === 403) {
            throw new ServiceError('Forbidden', 'FORBIDDEN', 'appsscript');
          } else if (response.status === 404) {
            throw new ServiceError('Not found', 'NOT_FOUND', 'appsscript');
          } else if (response.status === 429) {
            throw new ServiceError('Rate limited', 'RATE_LIMITED', 'appsscript');
          }
          throw new ServiceError(errorData.error?.message || 'API error', 'API_ERROR', 'appsscript');
        }

        return await response.json();
      } finally {
        clearTimeout(timeout);
      }
    });
  }
}
