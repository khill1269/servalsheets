# @serval/serval-core

Platform-agnostic infrastructure for spreadsheet operations.

## Purpose

Provides shared safety patterns, error types, history tracking, observability hooks, logging, caching utilities, and multi-LLM exporters used across all ServalSheets packages. Also defines the `SpreadsheetBackend` interface that platform adapters (Google Sheets, Excel Online, Notion, Airtable) implement. Contains no Google API or MCP transport imports — safe to depend on from any layer.

## Key Exports

**Safety**
- `CircuitBreaker`, `CircuitBreakerError`, `FallbackStrategies` — circuit breaker with configurable failure threshold and reset timeout
- `executeWithRetry`, `isRetryableError`, `DEFAULT_RETRY_CONFIG` — exponential backoff retry with global budget
- `requiresConfirmation`, `generateSafetyWarnings`, `createSnapshotIfNeeded` — destructive operation safety rail helpers

**Errors**
- `ServalError`, `ServiceError`, `ConfigError`, `ValidationError`, `NotFoundError`, `AuthenticationError`, `DataError`, `HandlerLoadError`, `QuotaExceededError`, `ApiTimeoutError`, `SyncError`, `BatchCompilationError` — typed error hierarchy with structured `ErrorCode`

**History**
- `HistoryService`, `getHistoryService`, `setHistoryService` — operation history tracking with filtering

**Observability**
- `updateCircuitBreakerMetric`, `recordCircuitBreakerTransition`, `recordRetryAttempt`, `recordRateLimitHit`, `recordHttp2Error` — Prometheus metric helpers

**Utilities**
- `createLogger`, `createChildLogger`, `defaultLogger`, `ServalLogger` — structured logger factory
- `BoundedCache` — size-capped LRU cache
- `redactString`, `redactObject`, `redact` — PII redaction for logs

**Multi-LLM Exporters**
- `toOpenAIFunction`, `toOpenAITool`, `toOpenAITools` — export tool definitions as OpenAI function specs
- `toLangChainTool`, `toLangChainTools`, `generateLangChainCode` — LangChain tool definitions
- `toRESTEndpoint`, `toRESTApiSpec`, `toOpenAPI` — OpenAPI / REST spec generation

**Backend Interface**
- `SpreadsheetBackend` — platform adapter interface (read, write, batch, metadata, Drive, revisions)
- `SpreadsheetPlatform`, `CellValue`, `ValueRange`, `BatchMutationRequest` — shared value types

## Usage

```typescript
import { executeWithRetry, CircuitBreaker, createLogger } from '@serval/serval-core';

const log = createLogger({ name: 'my-service' });
const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30_000 });

const result = await executeWithRetry(
  () => breaker.execute(() => api.call()),
  { maxRetries: 3, baseDelay: 100 }
);
```

## Notes

Internal use only — published as `@serval/core` v0.1.0 within the monorepo. The `SpreadsheetBackend` interface in `src/interfaces/backend.ts` is the contract all platform adapters must satisfy. Google Sheets is the only production adapter; Excel Online, Notion, and Airtable are scaffolded for future implementation.
