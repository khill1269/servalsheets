# @serval/mcp-http

Generic HTTP transport bootstrap library for MCP servers.

## Purpose

Provides DI-based Express route registration for all HTTP-layer concerns: Streamable HTTP MCP transport, webhook ingestion, observability endpoints (metrics, traces, stats), rate limiting, CORS, helmet security headers, RBAC bootstrap, and GraphQL admin. Contains zero ServalSheets-specific imports — all product-specific services are injected via interfaces. ServalSheets-specific wiring lives in `src/http-server/`.

## Key Exports

- `registerHttpTransportRoutes` — mounts the Streamable HTTP MCP transport on an Express app; accepts injected session store, OAuth provider, event store, and logger via `RegisterHttpTransportRoutesDependencies`
- `registerHttpWebhookRoutes` — registers webhook ingestion routes
- `registerMiddleware` — applies CORS, helmet, compression, rate limiting, and request context to an Express app
- `bootstrapHttpTransportSessions` — initialises the session store used by the transport layer
- `createHttpServer` / `HttpServerOptions` — factory interface for composing a full HTTP server instance with `start()` / `stop()` lifecycle
- `bootstrapRateLimit` — wires per-IP rate limiting with configurable window and max
- `bootstrapRbac` — sets up role-based access control middleware
- `registerMetricsRoutes` / `registerObservabilityRoutes` / `registerTraceRoutes` / `registerStatsRoutes` — individual observability route families
- `registerOpenApiDocsRoutes` — serves auto-generated OpenAPI documentation
- `registerWebhookDashboardRoutes` — read-only dashboard for webhook event history
- `registerGraphqlAdmin` — GraphQL admin surface
- `applyProtocolVersionMiddleware` — validates and selects the MCP protocol version per request
- `applyRequestValidationMiddleware` — schema-level request body validation
- `HttpServerInstance`, `HttpServerOptions`, `CreateHttpServerRuntimeConfig` — shared config and instance types

## Usage

```typescript
import {
  registerMiddleware,
  registerHttpTransportRoutes,
  registerMetricsRoutes,
} from '@serval/mcp-http';
import express from 'express';

const app = express();

registerMiddleware(app, { corsOrigins: ['https://my-client.example.com'] });

registerHttpTransportRoutes(app, {
  sessionStore,
  oauthProvider,
  eventStore,
  log: logger,
  // ...other injected dependencies
});

registerMetricsRoutes(app, { registry: prometheusRegistry });
```

## Notes

This package is product-agnostic by design. It must not import from `src/` (ServalSheets source). Any ServalSheets-specific services (Google handler bundle, session context, SAML auth) are injected by the wiring layer in `src/http-server/`. This constraint is enforced by the dependency-cruiser rules.
