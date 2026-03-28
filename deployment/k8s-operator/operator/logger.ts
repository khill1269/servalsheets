type LogMetadata = Record<string, unknown> | undefined;

function write(level: 'info' | 'error', message: string, metadata?: LogMetadata): void {
  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  if (metadata && Object.keys(metadata).length > 0) {
    console[level](prefix, metadata);
    return;
  }

  console[level](prefix);
}

export const logger = {
  info(message: string, metadata?: LogMetadata): void {
    write('info', message, metadata);
  },
  error(message: string, metadata?: LogMetadata): void {
    write('error', message, metadata);
  },
};
