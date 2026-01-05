/**
 * Tool 0: sheets_auth
 * Authentication management for OAuth-based usage.
 */

import { z } from 'zod';
import {
  ErrorDetailSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

const AuthActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('status'),
  }),
  z.object({
    action: z.literal('login'),
    scopes: z.array(z.string()).optional()
      .describe('Optional additional OAuth scopes to request'),
  }),
  z.object({
    action: z.literal('callback'),
    code: z.string().min(1).describe('Authorization code returned by Google'),
  }),
  z.object({
    action: z.literal('logout'),
  }),
]);

export const SheetsAuthInputSchema = z.object({
  request: AuthActionSchema,
});

const AuthResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    authenticated: z.boolean().optional(),
    authType: z.string().optional(),
    authUrl: z.string().url().optional(),
    message: z.string().optional(),
    instructions: z.array(z.string()).optional(),
    email: z.string().optional(),
    scopes: z.array(z.string()).optional(),
    hasAccessToken: z.boolean().optional(),
    hasRefreshToken: z.boolean().optional(),
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
export type AuthAction = z.infer<typeof AuthActionSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
