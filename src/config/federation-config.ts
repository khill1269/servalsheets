/**
 * ServalSheets - Federation Configuration
 *
 * Configuration parsing and validation for MCP server federation.
 * Handles environment variable parsing and Zod schema validation.
 *
 * @category Config
 * @module config/federation-config
 */

import { z } from 'zod';

/**
 * Zod schema for federation server configuration
 */
const FederationServerSchema = z.object({
  /** Server identifier (unique name) */
  name: z.string().min(1, 'Server name cannot be empty'),
  /** Server URL (HTTP) or command (STDIO) */
  url: z.string().url('Server URL must be a valid URL'),
  /** Transport type (default: http) */
  transport: z.enum(['http', 'stdio']).default('http'),
  /** Optional authentication configuration */
  auth: z
    .object({
      /** Authentication type */
      type: z.enum(['bearer', 'api-key']),
      /** Authentication token/key */
      token: z.string().optional(),
    })
    .optional(),
  /** Optional timeout override in milliseconds */
  timeoutMs: z.coerce.number().positive().optional(),
});

/**
 * Federation server configuration type
 */
export type FederationServerConfig = z.infer<typeof FederationServerSchema>;

/**
 * Parse federation servers from JSON string
 *
 * Expects a JSON string containing either:
 * - A single server object: `{ "name": "...", "url": "..." }`
 * - An array of server objects: `[{ "name": "...", "url": "..." }, ...]`
 *
 * Example:
 * ```json
 * [
 *   {
 *     "name": "weather-api",
 *     "url": "http://localhost:3001",
 *     "auth": {"type": "bearer", "token": "sk-..."}
 *   },
 *   {
 *     "name": "ml-server",
 *     "url": "http://localhost:3002"
 *   }
 * ]
 * ```
 *
 * @param jsonString - JSON string to parse
 * @returns Array of validated server configurations (empty if parsing fails)
 */
export function parseFederationServers(jsonString: string | undefined): FederationServerConfig[] {
  if (!jsonString) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonString);

    // Handle both single object and array
    const serversArray = Array.isArray(parsed) ? parsed : [parsed];

    // Validate each server config
    return serversArray.map((server) => FederationServerSchema.parse(server));
  } catch (error) {
    console.error('Failed to parse MCP_FEDERATION_SERVERS:', error);
    return [];
  }
}

/**
 * Validate a single federation server configuration
 *
 * @param config - Server configuration object
 * @returns Validated configuration or null if invalid
 */
export function validateServerConfig(config: unknown): FederationServerConfig | null {
  try {
    return FederationServerSchema.parse(config);
  } catch (error) {
    console.error('Invalid federation server config:', error);
    return null;
  }
}
