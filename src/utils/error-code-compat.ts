import { ErrorCodeSchema } from '../schemas/shared.js';

export type KnownErrorCode = (typeof ErrorCodeSchema.options)[number];

export function isKnownErrorCode(code: unknown): code is KnownErrorCode {
  return typeof code === 'string' && ErrorCodeSchema.options.includes(code);
}