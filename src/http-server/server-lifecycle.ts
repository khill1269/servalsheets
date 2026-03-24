import type { Application } from 'express';
import { ConfigError } from '../core/errors.js';
import { logger as defaultLogger } from '../utils/logger.js';

type HttpListeningServer = {
  once(event: 'error' | 'listening', listener: (error?: Error) => void): void;
  close(callback: (error?: Error | null) => void): void;
};

export interface CreateHttpServerLifecycleOptions<TMetricsExporter = unknown, TMetricsServer = unknown> {
  readonly app: Pick<Application, 'listen'>;
  readonly host: string;
  readonly port: number;
  readonly legacySseEnabled: boolean;
  readonly clearSessionCleanupInterval: () => void;
  readonly cleanupSessions: () => void;
  readonly getSessionCount: () => number;
  readonly ensureToolIntegrityVerified: { run: () => Promise<void> };
  readonly rateLimiterReady: Promise<void>;
  readonly initializeRbac: () => Promise<void>;
  readonly enableMetricsServer: boolean;
  readonly metricsPort: number;
  readonly metricsHost: string;
  readonly createMetricsExporter: () => TMetricsExporter;
  readonly startMetricsServer: (params: {
    port: number;
    host: string;
    exporter: TMetricsExporter;
  }) => Promise<TMetricsServer>;
  readonly stopMetricsServer: (server: TMetricsServer) => Promise<void>;
  readonly initTelemetry: () => Promise<void>;
  readonly onShutdown: (callback: () => Promise<void>) => void;
  readonly toolCount: number;
  readonly actionCount: number;
  readonly log?: typeof defaultLogger;
}

export function createHttpServerLifecycle<TMetricsExporter = unknown, TMetricsServer = unknown>(
  options: CreateHttpServerLifecycleOptions<TMetricsExporter, TMetricsServer>
): {
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const log = options.log ?? defaultLogger;
  let httpServer: HttpListeningServer | null = null;
  let dedicatedMetricsServer: TMetricsServer | null = null;

  const closeHttpServer = async (): Promise<void> => {
    if (!httpServer) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      httpServer!.close((error) => {
        if (error) {
          reject(error);
        } else {
          httpServer = null;
          resolve();
        }
      });
    });
  };

  options.onShutdown(async () => {
    if (!httpServer) {
      return;
    }

    log.info('Closing HTTP server...');
    try {
      await closeHttpServer();
      log.info('HTTP server closed');
    } catch (error) {
      log.error('Error closing HTTP server', { error });
      throw error;
    }
  });

  options.onShutdown(async () => {
    if (!dedicatedMetricsServer) {
      return;
    }

    log.info('Closing dedicated metrics server...');
    try {
      await options.stopMetricsServer(dedicatedMetricsServer);
      dedicatedMetricsServer = null;
    } catch (error) {
      log.error('Error closing dedicated metrics server', { error });
      throw error;
    }
  });

  options.onShutdown(async () => {
    options.clearSessionCleanupInterval();
  });

  options.onShutdown(async () => {
    log.info(`Closing ${options.getSessionCount()} active sessions...`);
    options.cleanupSessions();
    log.info('All sessions closed');
  });

  return {
    start: async () => {
      await options.initTelemetry();
      await options.ensureToolIntegrityVerified.run();
      await Promise.all([options.rateLimiterReady, options.initializeRbac()]);

      await new Promise<void>((resolve, reject) => {
        httpServer = options.app.listen(options.port, options.host) as HttpListeningServer;

        httpServer.once('error', (error) => {
          log.error('HTTP server failed to bind', { error, host: options.host, port: options.port });
          reject(error);
        });

        httpServer.once('listening', () => {
          log.info(`ServalSheets HTTP server listening on ${options.host}:${options.port}`);
          if (options.legacySseEnabled) {
            log.info(`SSE endpoint: http://${options.host}:${options.port}/sse`);
          } else {
            log.info('Legacy SSE endpoints disabled (use /mcp)');
          }
          log.info(`HTTP endpoint: http://${options.host}:${options.port}/mcp`);
          log.info(`Health check: http://${options.host}:${options.port}/health`);
          log.info(`Metrics: ${options.toolCount} tools, ${options.actionCount} actions`);
          resolve();
        });
      });

      if (!options.enableMetricsServer) {
        return;
      }

      if (options.metricsPort === options.port && options.metricsHost === options.host) {
        throw new ConfigError(
          'METRICS_PORT/METRICS_HOST cannot match main HTTP server bind address. Use a dedicated metrics port.',
          'METRICS_PORT'
        );
      }

      dedicatedMetricsServer = await options.startMetricsServer({
        port: options.metricsPort,
        host: options.metricsHost,
        exporter: options.createMetricsExporter(),
      });

      log.info('Dedicated metrics server enabled', {
        host: options.metricsHost,
        port: options.metricsPort,
      });
    },
    stop: async () => {
      options.clearSessionCleanupInterval();
      options.cleanupSessions();

      if (dedicatedMetricsServer) {
        await options.stopMetricsServer(dedicatedMetricsServer);
        dedicatedMetricsServer = null;
      }

      await closeHttpServer();
    },
  };
}
