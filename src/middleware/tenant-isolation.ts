/**
 * Tenant Isolation Middleware
 *
 * Enforces tenant isolation for multi-tenant deployments.
 * Extracts tenant context from requests and validates access.
 */

import { Request, Response, NextFunction } from 'express';
import { tenantContextService, TenantContext } from '../services/tenant-context.js';
import { logger } from '../utils/logger.js';

/**
 * Extended request with tenant context
 */
export interface TenantRequest extends Request {
  tenantContext?: TenantContext;
}

/**
 * Extract tenant context from Authorization header
 *
 * Expected format: Bearer {apiKey}
 */
function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return match[1] ?? null;
}

/**
 * Tenant isolation middleware
 *
 * Extracts tenant context from API key and attaches to request.
 * Returns 401 if invalid or missing API key.
 */
export function tenantIsolationMiddleware() {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract API key
      const apiKey = extractApiKey(req);
      if (!apiKey) {
        logger.warn('Missing API key', { path: req.path });
        res.status(401).json({
          error: 'Unauthorized',
          message: 'API key required in Authorization header',
        });
        return;
      }

      // Extract tenant context
      const tenantContext = await tenantContextService.extractTenantContext(apiKey);
      if (!tenantContext) {
        logger.warn('Invalid API key', { apiKey: apiKey.substring(0, 8) + '...' });
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
        return;
      }

      // Attach tenant context to request
      req.tenantContext = tenantContext;

      // Record API call for quota tracking
      await tenantContextService.recordApiCall(tenantContext.tenantId);

      next();
    } catch (error) {
      logger.error('Tenant isolation middleware error', { error });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process tenant context',
      });
    }
  };
}

/**
 * Validate tenant has access to spreadsheet
 *
 * Must be used after tenantIsolationMiddleware.
 * Extracts spreadsheetId from request body and validates access.
 */
export function validateSpreadsheetAccess() {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check tenant context exists
      if (!req.tenantContext) {
        logger.error('Missing tenant context in validateSpreadsheetAccess');
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Tenant context not initialized',
        });
        return;
      }

      // Extract spreadsheetId from request
      const spreadsheetId = extractSpreadsheetId(req);
      if (!spreadsheetId) {
        // No spreadsheet ID in request, skip validation
        next();
        return;
      }

      // Validate access
      const hasAccess = await tenantContextService.validateSpreadsheetAccess(
        req.tenantContext.tenantId,
        spreadsheetId
      );

      if (!hasAccess) {
        logger.warn('Unauthorized spreadsheet access attempt', {
          tenantId: req.tenantContext.tenantId,
          spreadsheetId,
        });
        res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this spreadsheet',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Spreadsheet access validation error', { error });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to validate spreadsheet access',
      });
    }
  };
}

/**
 * Extract spreadsheet ID from request
 *
 * Checks multiple locations:
 * - req.body.spreadsheetId
 * - req.body.request.spreadsheetId
 * - req.params.spreadsheetId
 * - req.query.spreadsheetId
 */
function extractSpreadsheetId(req: Request): string | null {
  // Check body
  if (req.body?.['spreadsheetId']) {
    return String(req.body['spreadsheetId']);
  }

  // Check nested body (legacy envelope format)
  if (req.body?.['request']?.['spreadsheetId']) {
    return String(req.body['request']['spreadsheetId']);
  }

  // Check params
  if (req.params?.['spreadsheetId']) {
    return String(req.params['spreadsheetId']);
  }

  // Check query
  const querySpreadsheetId = req.query?.['spreadsheetId'];
  if (querySpreadsheetId && typeof querySpreadsheetId === 'string') {
    return querySpreadsheetId;
  }

  return null;
}

/**
 * Require tenant context
 *
 * Ensures tenant context exists on request.
 * Use after tenantIsolationMiddleware to ensure tenant is authenticated.
 */
export function requireTenantContext(req: TenantRequest): asserts req is Required<TenantRequest> {
  if (!req.tenantContext) {
    throw new Error('Tenant context required but not found');
  }
}
