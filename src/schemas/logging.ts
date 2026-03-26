/**
 * Logging configuration and schemas
 */

import { z } from 'zod';

export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const LogConfigSchema = z.object({
  level: LogLevelSchema.default('info'),
  format: z.enum(['json', 'text']).default('json'),
  destination: z.enum(['stdout', 'stderr', 'file']).default('stdout'),
});

export type LogConfig = z.infer<typeof LogConfigSchema>;
