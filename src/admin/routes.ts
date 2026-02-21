/**
 * Admin Dashboard API Routes
 *
 * Provides REST API endpoints for the admin dashboard.
 */

import type { Express, Request, Response } from 'express';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { timingSafeEqual } from 'crypto';
import { VERSION, MCP_PROTOCOL_VERSION } from '../version.js';
import { TOOL_COUNT, ACTION_COUNT } from '../schemas/action-counts.js';
import { circuitBreakerRegistry } from '../services/circuit-breaker-registry.js';
import { requestDeduplicator } from '../utils/request-deduplication.js';
import { getRequestRecorder } from '../services/request-recorder.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Session management interface
 */
export interface AdminSessionManager {
  getAllSessions(): Array<{
    id: string;
    clientName?: string;
    clientVersion?: string;
    createdAt: number;
  }>;
  getSessionCount(): number;
  getTotalRequests(): number;
}

/**
 * Admin authentication middleware.
 * Mutation endpoints (POST, DELETE) require ADMIN_SECRET to be set and
 * the caller to present a matching Bearer token.  When ADMIN_SECRET is
 * not configured, mutations are disabled (403).
 */
export function requireAdminAuth(req: Request, res: Response, next: () => void): void {
  const adminSecret = process.env['ADMIN_SECRET'];

  if (!adminSecret) {
    res.status(403).json({
      error: 'Admin mutations disabled',
      message: 'Set ADMIN_SECRET environment variable to enable admin mutations',
    });
    return;
  }

  const token = req.headers.authorization?.replace('Bearer ', '') ?? '';

  // Use constant-time comparison to prevent timing attacks (OWASP recommendation)
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(adminSecret);
  if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

/**
 * Add admin routes to Express app
 */
export function addAdminRoutes(app: Express, sessionManager?: AdminSessionManager): void {
  // Serve admin dashboard HTML
  app.get('/admin', requireAdminAuth, (_req: Request, res: Response) => {
    res.sendFile(resolve(__dirname, 'dashboard.html'));
  });

  // Serve admin static assets
  app.get('/admin/styles.css', requireAdminAuth, (_req: Request, res: Response) => {
    res.sendFile(resolve(__dirname, 'styles.css'));
  });

  app.get('/admin/dashboard.js', requireAdminAuth, (_req: Request, res: Response) => {
    res.sendFile(resolve(__dirname, 'dashboard.js'));
  });

  // API: Server info
  app.get('/admin/api/server-info', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({
      version: VERSION,
      protocolVersion: MCP_PROTOCOL_VERSION,
      toolCount: TOOL_COUNT,
      actionCount: ACTION_COUNT,
      activeSessions: sessionManager?.getSessionCount() || 0,
      totalRequests: sessionManager?.getTotalRequests() || 0,
      uptime: process.uptime(),
      status: 'operational',
    });
  });

  // API: Deduplication stats
  app.get('/admin/api/deduplication-stats', (_req: Request, res: Response) => {
    const stats = requestDeduplicator.getStats();
    res.json(stats);
  });

  // API: Active sessions
  app.get('/admin/api/sessions', requireAdminAuth, (_req: Request, res: Response) => {
    if (!sessionManager) {
      res.json([]);
      return;
    }

    const sessions = sessionManager.getAllSessions();
    res.json(sessions);
  });

  // API: Request logs
  app.get('/admin/api/request-logs', requireAdminAuth, (req: Request, res: Response) => {
    const rawLimit = Number.parseInt(req.query['limit'] as string) || 50;
    const limit = Math.min(Math.max(rawLimit, 1), 1000);
    const recorder = getRequestRecorder();

    try {
      const logs = recorder.query({ limit });
      res.json(logs);
    } catch (error) {
      logger.error('Failed to fetch request logs', { error });
      res.status(500).json({
        error: 'Failed to fetch request logs',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // API: Clear request logs
  app.delete('/admin/api/request-logs', requireAdminAuth, (_req: Request, res: Response) => {
    const recorder = getRequestRecorder();

    try {
      // Clear all logs by deleting old records (1ms ago = everything)
      const deleted = recorder.cleanup(1);
      res.json({ success: true, deleted });
    } catch (error) {
      logger.error('Failed to clear request logs', { error });
      res.status(500).json({
        error: 'Failed to clear request logs',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // API: Reset circuit breakers
  app.post(
    '/admin/api/circuit-breakers/reset',
    requireAdminAuth,
    (_req: Request, res: Response) => {
      try {
        const breakers = circuitBreakerRegistry.getAll();
        let resetCount = 0;

        for (const { breaker } of breakers) {
          breaker.reset();
          resetCount++;
        }

        logger.info('Circuit breakers reset', { count: resetCount });
        res.json({ success: true, resetCount });
      } catch (error) {
        logger.error('Failed to reset circuit breakers', { error });
        res.status(500).json({
          error: 'Failed to reset circuit breakers',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // API: Clear deduplication cache
  app.post('/admin/api/deduplication/clear', requireAdminAuth, (_req: Request, res: Response) => {
    try {
      requestDeduplicator.clear();
      requestDeduplicator.resetMetrics();
      logger.info('Deduplication cache cleared');
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to clear deduplication cache', { error });
      res.status(500).json({
        error: 'Failed to clear deduplication cache',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // API: Shutdown server
  app.post('/admin/api/shutdown', requireAdminAuth, (_req: Request, res: Response) => {
    logger.warn('Server shutdown requested from admin dashboard');

    res.json({ success: true, message: 'Server shutting down...' });

    // Shutdown after sending response
    setTimeout(() => {
      logger.info('Shutting down server...');
      process.exit(0);
    }, 1000);
  });

  logger.info('Admin dashboard routes registered', {
    dashboardUrl: '/admin',
    apiPrefix: '/admin/api',
  });
}
