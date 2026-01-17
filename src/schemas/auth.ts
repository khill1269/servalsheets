/**
 * Tool 0: sheets_auth
 * Authentication management for OAuth-based usage.
 */

import { z } from 'zod';
import { URL_REGEX } from '../config/google-limits.js';
import { ErrorDetailSchema, ResponseMetaSchema, type ToolAnnotations } from './shared.js';

// INPUT SCHEMA: Discriminated union (4 actions)
const StatusActionSchema = z.object({
  action: z.literal('status').describe('Check current authentication status'),
});

const LoginActionSchema = z.object({
  action: z.literal('login').describe('Initiate OAuth login flow'),
  scopes: z
    .array(z.string().min(1, 'Scope cannot be empty').max(256, 'Scope URL exceeds 256 characters'))
    .min(1, 'At least one scope required if scopes provided')
    .max(50, 'Cannot request more than 50 scopes')
    .optional()
    .describe('Additional OAuth scopes to request (max 50)'),
});

const CallbackActionSchema = z.object({
  action: z.literal('callback').describe('Handle OAuth callback with authorization code'),
  code: z.string().min(1).describe('Authorization code from Google'),
});

const LogoutActionSchema = z.object({
  action: z.literal('logout').describe('Revoke authentication and clear tokens'),
});

export const SheetsAuthInputSchema = z.discriminatedUnion('action', [
  StatusActionSchema,
  LoginActionSchema,
  CallbackActionSchema,
  LogoutActionSchema,
]);

const AuthResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    authenticated: z.boolean().optional(),
    authType: z.string().optional(),
    authUrl: z.string().regex(URL_REGEX, 'Invalid URL format').optional(),
    message: z.string().optional(),
    instructions: z.array(z.string()).optional(),
    email: z.string().optional(),
    scopes: z.array(z.string()).optional(),
    hasAccessToken: z.boolean().optional(),
    hasRefreshToken: z.boolean().optional(),
    tokenValid: z
      .boolean()
      .optional()
      .describe(
        'Whether existing tokens are valid (undefined if no tokens, false if invalid, true if valid)'
      ),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsAuthOutputSchema = z.object({
  response: AuthResponseSchema,
});

export const SHEETS_AUTH_ANNOTATIONS: ToolAnnotations = {
  title: 'Authentication',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsAuthInput = z.infer<typeof SheetsAuthInputSchema>;
export type SheetsAuthOutput = z.infer<typeof SheetsAuthOutputSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// Type narrowing helpers for handler methods
export type AuthStatusInput = SheetsAuthInput & { action: 'status' };
export type AuthLoginInput = SheetsAuthInput & { action: 'login' };
export type AuthCallbackInput = SheetsAuthInput & {
  action: 'callback';
  code: string;
};
export type AuthLogoutInput = SheetsAuthInput & { action: 'logout' };
