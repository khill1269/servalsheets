/**
 * Tests for Well-Known Discovery Endpoints
 *
 * Tests .well-known endpoints for MCP and OAuth discovery.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import {
  handleMcpConfiguration,
  handleOAuthAuthorizationServer,
  handleOAuthProtectedResource,
  buildMcpConfiguration,
  buildOAuthAuthorizationServerMetadata,
  buildOAuthProtectedResourceMetadata,
} from "../../src/server/well-known.js";

// Mock version
vi.mock("../../src/version.js", () => ({
  VERSION: "1.4.0",
  SERVER_INFO: {
    name: "servalsheets",
    version: "1.4.0",
    protocolVersion: "2025-11-25",
  },
  SERVER_ICONS: [],
  MCP_PROTOCOL_VERSION: "2025-11-25",
}));

// Mock schemas
vi.mock("../../src/schemas/index.js", () => ({
  TOOL_COUNT: 26,
  ACTION_COUNT: 208,
}));

// Mock google-api
vi.mock("../../src/services/google-api.js", () => ({
  DEFAULT_SCOPES: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
  ],
  ELEVATED_SCOPES: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
  READONLY_SCOPES: [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
  ],
}));

// Mock logger
vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockRequest(url: string = "/"): Request {
  return {
    protocol: "https",
    secure: true,
    headers: {
      host: "api.example.com",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "api.example.com",
    },
    get: vi.fn((header: string) => {
      if (header === "host") return "api.example.com";
      return undefined;
    }),
    originalUrl: url,
    baseUrl: "",
    path: url,
  } as unknown as Request;
}

function createMockResponse(): Response {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe("buildMcpConfiguration", () => {
  it("should build MCP configuration object", () => {
    const config = buildMcpConfiguration();

    expect(config.name).toBe("servalsheets");
    expect(config.version).toBe("1.4.0");
    expect(config.protocol_version).toBeDefined();
    expect(config.capabilities).toBeDefined();
    expect(config.capabilities.tools.count).toBe(26);
    expect(config.capabilities.tools.actions).toBe(208);
    expect(config.transports).toContain("stdio");
  });

  it("should include resource capabilities", () => {
    const config = buildMcpConfiguration();

    expect(config.capabilities.resources.supported).toBe(true);
    expect(config.capabilities.resources.templates).toBe(true);
    expect(config.capabilities.resources.subscriptions).toBe(false); // Not yet supported
  });

  it("should include prompt capabilities", () => {
    const config = buildMcpConfiguration();

    expect(config.capabilities.prompts.supported).toBe(true);
    expect(config.capabilities.prompts.count).toBeGreaterThan(0);
  });

  it("should include task capabilities", () => {
    const config = buildMcpConfiguration();

    expect(config.capabilities.tasks.supported).toBe(true);
  });

  it("should include authentication info", () => {
    const config = buildMcpConfiguration();

    expect(config.authentication.type).toBe("oauth2");
    expect(config.authentication.pkce_required).toBe(true);
    expect(config.authentication.flows).toContain("authorization_code");
  });
});

describe("buildOAuthAuthorizationServerMetadata", () => {
  it("should build OAuth AS metadata", () => {
    const issuer = "https://api.example.com";
    const metadata = buildOAuthAuthorizationServerMetadata(issuer);

    expect(metadata.issuer).toBe(issuer);
    expect(metadata.authorization_endpoint).toContain("/oauth/authorize");
    expect(metadata.token_endpoint).toContain("/oauth/token");
    expect(metadata.response_types_supported).toContain("code");
    expect(metadata.code_challenge_methods_supported).toContain("S256");
  });

  it("should include supported scopes", () => {
    const metadata = buildOAuthAuthorizationServerMetadata("https://example.com");

    expect(metadata.scopes_supported).toBeDefined();
    expect(metadata.scopes_supported?.length).toBeGreaterThan(0);
  });

  it("should support PKCE", () => {
    const metadata = buildOAuthAuthorizationServerMetadata("https://example.com");

    expect(metadata.code_challenge_methods_supported).toContain("S256");
  });
});

describe("buildOAuthProtectedResourceMetadata", () => {
  it("should build protected resource metadata", () => {
    const resource = "https://api.example.com/mcp";
    const authServer = "https://accounts.google.com";
    const metadata = buildOAuthProtectedResourceMetadata(resource, authServer);

    expect(metadata.resource).toBe(resource);
    expect(metadata.authorization_servers).toContain(authServer);
    expect(metadata.scopes_supported).toBeDefined();
  });

  it("should include bearer token methods", () => {
    const metadata = buildOAuthProtectedResourceMetadata(
      "https://example.com/mcp",
      "https://auth.example.com"
    );

    expect(metadata.bearer_methods_supported).toContain("header");
  });
});

describe("handleMcpConfiguration", () => {
  it("should respond with MCP configuration JSON", () => {
    const req = createMockRequest("/.well-known/mcp-configuration");
    const res = createMockResponse();

    handleMcpConfiguration(req, res);

    expect(res.set).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(res.json).toHaveBeenCalled();
    
    const [jsonArg] = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(jsonArg.name).toBe("servalsheets");
    expect(jsonArg.capabilities).toBeDefined();
  });

  it("should set cache headers", () => {
    const req = createMockRequest();
    const res = createMockResponse();

    handleMcpConfiguration(req, res);

    expect(res.set).toHaveBeenCalledWith(
      "Cache-Control",
      expect.stringContaining("max-age")
    );
  });
});

describe("handleOAuthAuthorizationServer", () => {
  it("should respond with OAuth AS metadata", () => {
    const req = createMockRequest("/.well-known/oauth-authorization-server");
    const res = createMockResponse();

    handleOAuthAuthorizationServer(req, res);

    expect(res.set).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(res.json).toHaveBeenCalled();

    const [jsonArg] = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(jsonArg.issuer).toBeDefined();
    expect(jsonArg.authorization_endpoint).toBeDefined();
    expect(jsonArg.token_endpoint).toBeDefined();
  });
});

describe("handleOAuthProtectedResource", () => {
  it("should respond with protected resource metadata", () => {
    const req = createMockRequest("/.well-known/oauth-protected-resource");
    const res = createMockResponse();

    handleOAuthProtectedResource(req, res);

    expect(res.set).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(res.json).toHaveBeenCalled();

    const [jsonArg] = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(jsonArg.resource).toBeDefined();
    expect(jsonArg.authorization_servers).toBeDefined();
  });
});
