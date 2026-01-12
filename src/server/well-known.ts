/**
 * ServalSheets - .well-known Discovery Endpoints
 *
 * Implements RFC 8615 well-known URIs for server discovery:
 * - /.well-known/mcp-configuration: MCP server capabilities
 * - /.well-known/oauth-authorization-server: OAuth 2.0 metadata (RFC 8414)
 * - /.well-known/oauth-protected-resource: Resource server metadata (RFC 9728)
 *
 * These endpoints allow clients and registries to discover server
 * capabilities without establishing an MCP connection.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8615 - Well-Known URIs
 * @see https://www.rfc-editor.org/rfc/rfc8414 - OAuth 2.0 Authorization Server Metadata
 * @see https://www.rfc-editor.org/rfc/rfc9728 - OAuth 2.0 Protected Resource Metadata
 */

import type { Request, Response } from "express";
import type { Icon } from "@modelcontextprotocol/sdk/types.js";
import { VERSION, SERVER_INFO, SERVER_ICONS } from "../version.js";
import { TOOL_COUNT, ACTION_COUNT } from "../schemas/index.js";
import {
  DEFAULT_SCOPES,
  ELEVATED_SCOPES,
  READONLY_SCOPES,
} from "../services/google-api.js";

/**
 * MCP Server Configuration
 * Describes server capabilities for discovery
 */
export interface McpServerConfiguration {
  /** Server name (package name) */
  name: string;
  /** Server version (semver) */
  version: string;
  /** Human-readable description */
  description: string;
  /** Optional server icon set */
  icons?: Icon[];
  /** MCP protocol version supported */
  protocol_version: string;
  /** Server capabilities */
  capabilities: {
    tools: {
      count: number;
      actions: number;
    };
    resources: {
      supported: boolean;
      templates: boolean;
      subscriptions: boolean;
    };
    prompts: {
      supported: boolean;
      count: number;
    };
    tasks: {
      supported: boolean;
    };
    sampling: {
      supported: boolean;
    };
    elicitation: {
      form: boolean;
      url: boolean;
    };
    completions: {
      supported: boolean;
    };
    logging: {
      supported: boolean;
    };
  };
  /** Supported transports */
  transports: ("stdio" | "sse" | "streamable-http")[];
  /** Authentication requirements */
  authentication: {
    type: "oauth2";
    flows: ("authorization_code" | "client_credentials")[];
    pkce_required: boolean;
    default_scopes: string[];
    elevated_scopes: string[];
    readonly_scopes: string[];
  };
  /** External links */
  links: {
    documentation?: string;
    repository?: string;
    issues?: string;
    homepage?: string;
    registry_entry?: string;
  };
}

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 */
export interface OAuthAuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint?: string;
  jwks_uri?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
}

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 */
export interface OAuthProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_documentation?: string;
}

/**
 * Get MCP server configuration for discovery
 */
export function getMcpConfiguration(): McpServerConfiguration {
  return {
    name: SERVER_INFO.name,
    version: VERSION,
    description:
      "Production-grade Google Sheets MCP server with AI-powered analytics, transactions, and enterprise features",
    icons: SERVER_ICONS,
    protocol_version: SERVER_INFO.protocolVersion,
    capabilities: {
      tools: {
        count: TOOL_COUNT,
        actions: ACTION_COUNT,
      },
      resources: {
        supported: true,
        templates: true,
        subscriptions: false,
      },
      prompts: {
        supported: true,
        count: 17,
      },
      tasks: {
        supported: true,
      },
      sampling: {
        supported: true,
      },
      elicitation: {
        form: true,
        url: true,
      },
      completions: {
        supported: true,
      },
      logging: {
        supported: true,
      },
    },
    transports: ["stdio", "sse", "streamable-http"],
    authentication: {
      type: "oauth2",
      flows: ["authorization_code"],
      pkce_required: true,
      default_scopes: DEFAULT_SCOPES,
      elevated_scopes: ELEVATED_SCOPES,
      readonly_scopes: READONLY_SCOPES,
    },
    links: {
      documentation: "https://github.com/khill1269/servalsheets#readme",
      repository: "https://github.com/khill1269/servalsheets",
      issues: "https://github.com/khill1269/servalsheets/issues",
      homepage: "https://github.com/khill1269/servalsheets",
    },
  };
}

/**
 * Get OAuth Authorization Server Metadata
 * Points to Google's OAuth server or custom issuer
 */
export function getOAuthAuthorizationServerMetadata(
  issuer?: string,
): OAuthAuthorizationServerMetadata {
  const serverIssuer = issuer || "https://accounts.google.com";

  // Use Google endpoints if no issuer provided or if issuer is Google
  const isGoogleIssuer =
    !issuer ||
    issuer.includes("google.com") ||
    issuer.includes("accounts.google.com");

  if (isGoogleIssuer) {
    return {
      issuer: "https://accounts.google.com",
      authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      token_endpoint: "https://oauth2.googleapis.com/token",
      revocation_endpoint: "https://oauth2.googleapis.com/revoke",
      jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
      scopes_supported: [
        ...DEFAULT_SCOPES,
        ...ELEVATED_SCOPES,
        ...READONLY_SCOPES,
      ].filter((v, i, a) => a.indexOf(v) === i), // Deduplicate
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: [
        "client_secret_post",
        "client_secret_basic",
      ],
      code_challenge_methods_supported: ["S256"],
    };
  }

  // Custom issuer - build endpoints based on issuer URL
  return {
    issuer: serverIssuer,
    authorization_endpoint: `${serverIssuer}/oauth/authorize`,
    token_endpoint: `${serverIssuer}/oauth/token`,
    revocation_endpoint: `${serverIssuer}/oauth/revoke`,
    jwks_uri: `${serverIssuer}/.well-known/jwks.json`,
    scopes_supported: [
      ...DEFAULT_SCOPES,
      ...ELEVATED_SCOPES,
      ...READONLY_SCOPES,
    ].filter((v, i, a) => a.indexOf(v) === i),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: [
      "client_secret_post",
      "client_secret_basic",
    ],
    code_challenge_methods_supported: ["S256"],
  };
}

/**
 * Get OAuth Protected Resource Metadata
 * Describes this server as an OAuth-protected resource
 */
export function getOAuthProtectedResourceMetadata(
  serverUrl: string,
): OAuthProtectedResourceMetadata {
  return {
    resource: serverUrl,
    authorization_servers: ["https://accounts.google.com"],
    scopes_supported: [
      ...DEFAULT_SCOPES,
      ...ELEVATED_SCOPES,
      ...READONLY_SCOPES,
    ].filter((v, i, a) => a.indexOf(v) === i),
    bearer_methods_supported: ["header"],
    resource_documentation: "https://github.com/khill1269/servalsheets#readme",
  };
}

/**
 * Express handler for /.well-known/mcp-configuration
 */
export function mcpConfigurationHandler(_req: Request, res: Response): void {
  res.set("Content-Type", "application/json");
  res.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
  res.set("Access-Control-Allow-Origin", "*"); // Allow discovery from any origin
  res.json(getMcpConfiguration());
}

/**
 * Express handler for /.well-known/oauth-authorization-server
 */
export function oauthAuthorizationServerHandler(
  _req: Request,
  res: Response,
): void {
  res.set("Content-Type", "application/json");
  res.set("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
  res.set("Access-Control-Allow-Origin", "*");
  res.json(getOAuthAuthorizationServerMetadata());
}

/**
 * Express handler for /.well-known/oauth-protected-resource
 */
export function oauthProtectedResourceHandler(
  req: Request,
  res: Response,
): void {
  // Determine server URL from request
  const protocol =
    req.secure || req.headers["x-forwarded-proto"] === "https"
      ? "https"
      : "http";
  const host =
    req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  const serverUrl = `${protocol}://${host}`;

  res.set("Content-Type", "application/json");
  res.set("Cache-Control", "public, max-age=86400");
  res.set("Access-Control-Allow-Origin", "*");
  res.json(getOAuthProtectedResourceMetadata(serverUrl));
}

/**
 * Register all well-known handlers with an Express app
 */
export function registerWellKnownHandlers(app: {
  get: (path: string, handler: (req: Request, res: Response) => void) => void;
}): void {
  app.get("/.well-known/mcp-configuration", mcpConfigurationHandler);
  app.get(
    "/.well-known/oauth-authorization-server",
    oauthAuthorizationServerHandler,
  );
  app.get(
    "/.well-known/oauth-protected-resource",
    oauthProtectedResourceHandler,
  );
}

// Aliases for backward compatibility with tests
/** @deprecated Use getMcpConfiguration instead */
export const buildMcpConfiguration = getMcpConfiguration;

/** @deprecated Use getOAuthAuthorizationServerMetadata instead */
export const buildOAuthAuthorizationServerMetadata =
  getOAuthAuthorizationServerMetadata;

/** @deprecated Use getOAuthProtectedResourceMetadata instead */
export const buildOAuthProtectedResourceMetadata =
  getOAuthProtectedResourceMetadata;

/** @deprecated Use mcpConfigurationHandler instead */
export const handleMcpConfiguration = mcpConfigurationHandler;

/** @deprecated Use oauthAuthorizationServerHandler instead */
export const handleOAuthAuthorizationServer = oauthAuthorizationServerHandler;

/** @deprecated Use oauthProtectedResourceHandler instead */
export const handleOAuthProtectedResource = oauthProtectedResourceHandler;
