import type { Application, NextFunction, Request, Response } from 'express';

export interface HttpErrorHandlerLogger {
  error(message: string, meta?: unknown): void;
}

export interface RegisterHttpErrorHandlerOptions {
  readonly isProduction?: boolean;
  readonly log?: HttpErrorHandlerLogger;
}

const defaultLogger: HttpErrorHandlerLogger = {
  error(message: string, meta?: unknown) {
    console.error(message, meta);
  },
};

export function registerHttpErrorHandler(
  app: Pick<Application, 'use'>,
  options: RegisterHttpErrorHandlerOptions = {}
): void {
  const { isProduction = process.env['NODE_ENV'] === 'production', log = defaultLogger } = options;

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    log.error('HTTP server error', {
      error: err,
      request: {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      stack: err.stack,
    });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: isProduction ? undefined : err.message,
      },
    });
  });
}
