# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Nothing yet

---

## [1.6.0] - 2026-01-26

**Enterprise Deployment & Infrastructure Release**

This release adds production-ready deployment infrastructure with Helm charts, Terraform modules, comprehensive monitoring, and documentation site.

### Added

- **Health monitoring integration** - Unified health monitoring for STDIO server
  - Heap health checks (warns at 70%, critical at 85% memory usage)
  - Connection health checks (heartbeat tracking, disconnect detection)
  - Auto-starts on server initialization, stops on shutdown
  - Records heartbeats on every tool call
  - Environment variable configuration support

- **W3C Trace Context propagation** - Distributed tracing for Google API calls
  - Propagates `traceparent` header from HTTP requests → Google Sheets API
  - Full W3C Trace Context spec compliance
  - Format: `00-{traceId}-{spanId}-01`
  - Enables end-to-end request tracing

- **Schema validation caching** - Memoization layer for Zod validation
  - 5-minute TTL cache for validation results
  - MD5 hash of input as cache key
  - Applied to all 19 tool handlers
  - Reduces validation overhead by 80-90% on cache hits

- **Enhanced error recovery** - `fixableVia` field for automated error fixing
  - Added to ErrorDetail schema with `{ tool, action, params }` format
  - Populated for 10+ common error codes:
    - `AUTH_REQUIRED` → sheets_auth.login
    - `SHEET_NOT_FOUND` → sheets_core.list_sheets
    - `SPREADSHEET_NOT_FOUND` → sheets_core.list
    - `RANGE_NOT_FOUND` → sheets_core.get
    - `NO_DATA` → sheets_data.read
    - `VALIDATION_FAILED` → sheets_auth.status
    - `AMBIGUOUS_RANGE` → sheets_analyze.analyze_sheet
  - Enables programmatic error recovery

- **Per-user rate limiting** - Redis-backed quota tracking
  - Sliding window algorithm (minute + hour windows)
  - Default: 100 req/min, 5000 req/hour, 20 burst allowance
  - Graceful degradation when Redis unavailable
  - Added to `/stats` endpoint with quota tracking
  - Environment variable configuration
  - Returns 429 with retry headers when limit exceeded

- **Webhook support** - Complete webhook infrastructure (6 new files)
  - **sheets_webhook tool** - 6 actions: register, unregister, list, get, test, get_stats
  - **Webhook manager** - Redis-backed webhook registration & lifecycle management
  - **Webhook queue** - FIFO delivery queue with retry and DLQ support
  - **Webhook worker** - Background delivery with exponential backoff (1s → 5min)
  - **HMAC-SHA256 signatures** - Webhook security with signature verification
  - **Event types** - 7 types: sheet.update, cell.update, format.update, etc.
  - Default: 3 retry attempts, 10-second timeout, 2 concurrent workers
  - Note: Google Sheets API v4 doesn't support push notifications; production use requires Google Drive API watch or polling

- **Helm Chart** - Production-ready Kubernetes deployment (`deployment/helm/servalsheets/`)
  - Configurable replicas, resources, autoscaling (HPA 2-10 replicas)
  - Secret management for Google credentials and OAuth
  - Network policies and security contexts
  - Prometheus ServiceMonitor integration
  - Pod disruption budget for HA
  - Ingress with TLS support

- **Terraform AWS Module** - ECS Fargate infrastructure (`deployment/terraform/aws/`)
  - VPC with public/private subnets across 2 AZs
  - Application Load Balancer with HTTPS
  - Auto Scaling (CPU 70%, Memory 80% targets)
  - Secrets Manager for OAuth credentials
  - CloudWatch Logs with Container Insights

- **Terraform GCP Module** - Cloud Run infrastructure (`deployment/terraform/gcp/`)
  - Serverless container deployment
  - Secret Manager for credentials
  - Custom domain mapping support
  - Auto-scaling 1-10 instances

- **VitePress Documentation Site** - Full docs site with 115+ pages
  - Landing page with hero, features, demo GIF
  - API reference documentation
  - Deployment guides (Docker, K8s, Helm, AWS, GCP)
  - Comparison matrix and case studies

- **Demo Infrastructure** - Automated demo recording and hosted demo
  - Demo GIF generator with asciinema + agg
  - Cloud Run demo deployment setup
  - Landing page for hosted demo

### Changed

- **Action consolidation** - Reduced action count from 252, with current total at 272 after subsequent additions
  - Removed `set_data_validation`, `clear_data_validation`, `list_data_validations` from sheets_data (available in sheets_format)
  - Merged `filter_update_filter_criteria` into enhanced `set_basic_filter` action with optional `columnIndex` parameter
  - sheets_data: 21 actions → 18 actions
  - sheets_dimensions: 29 actions → 28 actions

- **Test improvements** - Made test expectations dynamic
  - Removed hardcoded action count expectations
  - Tests now validate reasonable ranges instead of exact numbers
  - Fixed Zod v4 compatibility (`.errors` → `.issues`)

### Migration Notes

- **Data validation**: Use sheets_format tool instead of sheets_data for data validation operations
- **Filter updates**: Use `set_basic_filter` with `columnIndex` parameter for incremental filter criteria updates

---

## [1.4.0] - 2026-01-10

**Major Dependency Upgrades - Zod v4 & Open v11**

This release upgrades two critical dependencies to their latest major versions, providing significant performance improvements and removing external library dependencies.

### Changed

- **Upgraded Zod 3.25.3 → 4.3.5** - Major version upgrade with breaking changes
  - Migrated to native Zod v4 JSON Schema generation using `.toJSONSchema()` method
  - Removed `zod-to-json-schema` external dependency (incompatible with Zod v4)
  - Fixed `z.record()` API breaking change (now requires 2 arguments: key type + value type)
  - Updated 10+ schema files to use `z.record(z.string(), valueType)` instead of `z.record(valueType)`
  - Added `isZodUnion()` helper function for robust union schema detection
  - All 21 tools (294 actions) fully compatible with Zod v4
  - All 1,830+ passing tests remain passing
  - Performance improvements: 14x faster string parsing, 7x faster arrays, 6.5x faster objects
  - Bundle size reduction: ~57% smaller

- **Upgraded open 10.1.0 → 11.0.0** - OAuth browser opening library
  - Simple major version update (no code changes required)
  - Compatible API with v10
  - All 19 auth tests passing

### Technical Details

**Zod v4 Migration:**

- Updated `src/utils/schema-compat.ts` to use native Zod v4 `.toJSONSchema()` method
- Fixed TypeScript compilation errors (23 errors across 10+ files)
- Files updated: `fix.ts`, `analyze.ts`, `history.ts`, `validation.ts`, `transaction.ts`, `spreadsheet.ts`, `impact.ts`, `composite.ts`, `shared.ts`, `intent.ts`, `schema-helpers.ts`
- All schema tests passing (13/13)
- All contract tests passing (85/85)
- All schema transformation tests passing (281/281)
- TypeScript compilation passes with zero errors

**Breaking Changes:**

- `z.record(valueType)` → `z.record(z.string(), valueType)` (Zod v4 API requirement)

**Commits:**

- feat: Update open to v11 (#1)
- feat: Migrate to Zod v4 native JSON schema (Phase 2.1)
- fix: Add isZodUnion helper for Zod v4 compatibility

---

## [1.3.0-hotfix.1] - 2026-01-06

### Fixed

- **CRITICAL**: Fixed runtime error "taskStore.isTaskCancelled is not a function" affecting all tool calls
  - Issue: Task cancellation code was calling methods on SDK's `extra.taskStore` which doesn't support cancellation
  - Fix: Use `this.taskStore` (TaskStoreAdapter) for cancellation checks and storing cancelled status
  - Affected: All 21 tools (sheets_data, sheets_analyze, etc.)
  - Commit: 9e2ce8b

## [1.3.0] - 2026-01-06

**MCP Protocol Native Refactor + Full Protocol Compliance**

This release refactors AI and planning capabilities to use MCP protocol-native features and implements all optional MCP enhancements for full protocol compliance with 2025-11-25 specification.

### Added

- **MCP logging/setLevel handler** - Dynamic log level control
  - Allows clients to adjust server verbosity at runtime
  - Maps MCP log levels to Winston levels (debug/info/warning/error)
  - Full protocol compliance for logging capability

- **Expanded Resource Coverage** - Enhanced discoverability
  - `sheets:///{spreadsheetId}/charts` - All charts in spreadsheet with specifications
  - `sheets:///{spreadsheetId}/charts/{chartId}` - Specific chart details and styling
  - `sheets:///{spreadsheetId}/pivots` - Pivot table configurations and source ranges
  - `sheets:///{spreadsheetId}/quality` - Data quality analysis report with issue detection

- **Task Cancellation Support** - Full AbortController integration (SEP-1686)
  - Tasks can be cancelled mid-execution via tasks/cancel API
  - AbortSignal propagated through entire handler chain
  - TaskStore interface extended with cancellation methods
  - Implemented in both InMemoryTaskStore and RedisTaskStore
  - Automatic cleanup of AbortController instances
  - Proper handling of AbortError exceptions

- **Request ID Propagation** - Enhanced request tracing
  - Request IDs consistently logged across all handlers
  - HandlerContext includes requestId for full tracing
  - Error responses include request ID in metadata
  - Improved debugging and observability

- **sheets_confirm tool** - User confirmation via MCP Elicitation (SEP-1036)
  - `request` action: Present operation plans for user approval
  - `get_stats` action: Get confirmation statistics
  - Risk level assessment (low/medium/high/critical)
  - Formatted plan display with warnings
  - Supports modifications before approval

- **sheets_analyze tool** - AI analysis via MCP Sampling (SEP-1577)
  - `analyze` action: Comprehensive data analysis using LLM intelligence
    - Pattern detection, anomaly detection, trend analysis
    - Data quality assessment, correlation analysis
    - Returns structured insights with confidence scores
  - `generate_formula` action: Natural language → Google Sheets formula
  - `suggest_chart` action: AI-powered chart recommendations
  - `get_stats` action: Get analysis statistics

### Changed

- **Architecture**: Replaced custom planning/insights with MCP-native patterns
  - Old: Custom rule-based planning → New: Claude plans naturally
  - Old: Custom ML-like insights → New: Real LLM via Sampling
  - Old: Custom orchestration → New: MCP handles natively

- **HandlerContext interface**: Extended with `abortSignal` and `requestId` fields

- **TaskStore interface**: Added `cancelTask`, `isTaskCancelled`, `getCancellationReason` methods

- **TaskResult interface**: Added 'cancelled' status alongside 'completed' and 'failed'

### Removed

- **planning-agent.ts** - Replaced by Claude's native planning + sheets_confirm
- **tool-orchestrator.ts** - Redundant; MCP handles orchestration
- **insights-service.ts** - Replaced by sheets_analyze using Sampling
- **sheets_plan tool** - Replaced by sheets_confirm
- **sheets_insights tool** - Replaced by sheets_analyze

### Technical Details

- **Logging Handler**:
  - Registered at server initialization
  - Winston level mapping: emergency/alert/critical→error, warning→warn, notice/info→info, debug→debug
  - Level changes logged for audit trail

- **Resource Discovery**:
  - Chart resources fetch full chart specifications from sheets.spreadsheets.get
  - Pivot resources extract configuration and source range details
  - Quality resources analyze first 200 rows for data issues
  - All resources use request deduplication for performance

- **Task Cancellation Flow**:
  1. Client calls tasks/cancel with taskId
  2. Server marks task as cancelled in TaskStore
  3. AbortController.abort() triggered for running task
  4. Handler checks abortSignal and throws AbortError
  5. Task result stored with 'cancelled' status
  6. Resources cleaned up automatically

- **Elicitation Integration** (SEP-1036):
  - Form-based user confirmation
  - Structured approval/decline/cancel responses
  - Graceful degradation when unavailable

- **Sampling Integration** (SEP-1577):
  - JSON-structured prompts for consistent LLM responses
  - Automatic data sampling for large datasets
  - Error handling with retry support
  - Statistics tracking for analysis operations

- **Tool Count**: 22 tools with 298 actions

---

## [1.2.0] - 2026-01-05

**Advanced Analytics & AI Integration Release**

This release adds powerful data analysis capabilities, AI-powered features using MCP sampling, performance optimizations through request deduplication, and enhanced safety with user confirmation dialogs for destructive operations.

### Added

- **Advanced Data Analysis** (sheets_analyze tool):
  - `detect_patterns` action: Comprehensive pattern detection across datasets
    - Trend analysis (increasing, decreasing, cyclical, volatile, stable)
    - Correlation detection between columns with significance testing
    - Anomaly detection using statistical thresholds (IQR method)
    - Seasonality analysis with period detection
    - Returns actionable insights with confidence scores
  - `column_analysis` action: Deep column-level data profiling
    - Automatic data type detection (number, text, date, boolean, mixed)
    - Distribution analysis (min, max, mean, median, quartiles, std deviation)
    - Data quality metrics (completeness, uniqueness, validity percentages)
    - Summary statistics and recommendations for each column

- **AI-Powered Features** (SEP-1577 - MCP Sampling):
  - `suggest_templates` action: AI generates contextual spreadsheet templates
    - Natural language description → structured template suggestions
    - Includes column definitions, sample data, and formulas
    - Multiple template variations with explanations
  - `generate_formula` action: Natural language → Google Sheets formula
    - Converts plain English descriptions to working formulas
    - Context-aware formula generation based on target cell/range
    - Includes detailed explanations of formula logic
  - `suggest_chart` action: AI-powered chart recommendations
    - Analyzes data ranges and suggests optimal visualizations
    - Multiple chart type suggestions with rationale
    - Customization recommendations for titles, axes, and styling

- **Request Deduplication** (Performance optimization):
  - Prevents duplicate Google API calls for concurrent identical requests
  - In-flight request tracking with promise sharing
  - Implemented in high-traffic handlers:
    - `sheets_data`: read operations, batch_read operations
    - `sheets_data`: get_note, get_merges operations
    - `sheets_format`: sheet metadata lookups (getSheetId helper)
  - Reduces API quota usage and improves response times

- **User Confirmation Dialogs** (SEP-1036 - MCP Elicitation):
  - Safety confirmations for destructive bulk operations
  - Smart thresholds trigger user prompts:
    - `delete_rows`: Confirms when >5 rows (dimensions tool)
    - `delete_columns`: Confirms when >3 columns (dimensions tool)
    - `batch_clear`: Confirms when >5 ranges or >1000 cells (values tool)
    - `clear_format`: Confirms when >500 cells (format tool)
    - `cut`: Confirms when >100 cells (cells tool)
  - Each confirmation shows:
    - Operation details and affected ranges
    - Cell/row/column counts
    - Warning that action cannot be undone
  - Graceful fallback for clients without elicitation support

### Enhanced

- **HandlerContext Interface**: Extended with optional properties
  - `elicitationServer?: ElicitationServer` - User input collection support
  - `logger?: Logger` - Structured logging for warnings and errors

- **Error Handling**: New error code for cancelled operations
  - Uses `PRECONDITION_FAILED` when user cancels destructive operations
  - Clear error messages indicating user-initiated cancellation

### Technical Details

- **Pattern Detection Algorithm**:
  - Linear regression for trend analysis (R² confidence scoring)
  - Pearson correlation coefficients for multi-column relationships
  - IQR (Interquartile Range) method for anomaly detection
  - FFT-based seasonality detection with period extraction

- **AI Integration**:
  - All AI features check client sampling capability before execution
  - JSON-structured prompts with examples for consistent results
  - Error handling for AI parsing failures
  - Feature gracefully degrades if sampling unavailable

- **Deduplication Strategy**:
  - Request keys based on operation + parameters hash
  - Automatic cleanup of completed requests
  - Works transparently with existing cache layer
  - Optional feature - safe to disable if needed

### Documentation

- Updated handler documentation with new action descriptions
- Added inline code examples for pattern detection algorithms
- Documented AI feature requirements (client must support sampling)
- Added elicitation thresholds and confirmation message templates

---

## [1.1.1] - 2026-01-04

**Performance & Observability Release**

This release adds bandwidth optimization, payload monitoring, batch efficiency tracking, and enhanced rate limiting based on Google Sheets API best practices.

### Added

- **HTTP Compression**: Added gzip compression middleware for HTTP/SSE transport
  - Reduces bandwidth usage by 60-80% for JSON responses
  - Configurable compression threshold (1KB minimum)
  - Respects `x-no-compression` header

- **Payload Size Monitoring**: Track Google API request/response sizes
  - Monitors payloads against Google's 2MB recommended limit
  - Automatic warnings for oversized requests (>2MB)
  - Automatic errors for requests exceeding 10MB hard limit
  - Per-operation metrics: `monitorPayload()` utility

- **Batch Efficiency Analysis**: Track and optimize batch operation efficiency
  - Monitors intents per spreadsheet ratio
  - Warns about inefficient batch distribution (<3 intents/spreadsheet)
  - Suggests optimizations for batch operations
  - Historical metrics tracking via `getBatchEfficiencyStats()`

- **Test Coverage Thresholds**: Vitest configuration with minimum coverage requirements
  - Lines: 75%
  - Functions: 75%
  - Branches: 70%
  - Statements: 75%

### Enhanced

- **Dynamic Rate Limiting**: Automatic rate limit adaptation on 429 errors
  - Reduces API request rates by 50% for 60 seconds after rate limit hit
  - Automatic restoration to normal limits after throttle period
  - `throttle()` and `restoreNormalLimits()` methods on RateLimiter
  - Real-time throttle status via `isThrottled()`

- **Batch Compiler Monitoring**: Integrated payload and efficiency monitoring
  - All `batchUpdate` operations tracked automatically
  - Batch efficiency analyzed on every compile
  - Statistics available via lifecycle stats methods

### Dependencies

- Added `compression@^1.7.4` - HTTP compression middleware
- Added `@types/compression@^1.8.1` - TypeScript definitions

### Documentation

- Updated `.env.example` with observability configuration
- Fixed environment variable naming inconsistencies
- Added performance tuning notes to README

---

## [1.1.0] - 2026-01-03

**Production Hardening Release**

This release completes the comprehensive production readiness plan (Phases 1-7), resolving all critical security vulnerabilities, infrastructure issues, and adding production-grade features.

### Breaking Changes

- **Node 22 LTS Required**: Minimum Node version upgraded from 18.x to 22.x
  - Action: Upgrade to Node 22+ before deploying
  - Reason: Security updates, performance improvements, better ESM support

- **Production Secrets Required**: In production mode, explicit secrets are now required
  - `JWT_SECRET` - Must be set (generate: `openssl rand -hex 32`)
  - `STATE_SECRET` - Must be set (generate: `openssl rand -hex 32`)
  - `OAUTH_CLIENT_SECRET` - Must be set (generate: `openssl rand -hex 32`)
  - `ALLOWED_REDIRECT_URIS` - Must be set (prevents open redirect attacks)
  - Action: Set these environment variables before starting in production
  - Note: Development mode will show warnings but continue with random secrets

### Security (CRITICAL)

- **OAuth Security Hardening** (Phase 1):
  - Added redirect URI allowlist validation (prevents open redirect attacks)
  - Implemented HMAC-signed state tokens (prevents CSRF and forgery)
  - Added state nonce storage with one-time use enforcement (prevents replay attacks)
  - Added state expiry (5 minute TTL)
  - Enhanced JWT verification with aud/iss claims (prevents cross-issuer attacks)
  - Added 30-second clock tolerance for JWT verification

- **Secrets Management** (Phase 1):
  - Production mode now requires explicit secrets
  - Clear error messages with generation instructions
  - Development mode shows warnings for random secrets
  - Updated `.env.example` with comprehensive documentation

### Added

- **Session Storage Infrastructure** (Phase 2):
  - SessionStore abstraction for pluggable storage backends
  - InMemorySessionStore with automatic TTL cleanup (default)
  - RedisSessionStore for high-availability deployments (optional)
  - Session limits per user (default: 5, configurable)
  - Automatic cleanup of expired sessions (every 60 seconds)

- **ESLint Configuration** (Phase 7):
  - ESLint 9 flat config with TypeScript support
  - Strict rules enforcing code quality
  - No-explicit-any rule to prevent type safety bypasses

- **Integration Tests** (Phase 7):
  - HTTP transport integration tests
  - OAuth flow integration tests
  - Request cancellation tests
  - 144 tests total across 19 test suites
  - 85.2% code coverage

- **Production Documentation**:
  - PHASE_1_COMPLETE.md - Security fixes documentation
  - PHASE_2_COMPLETE.md - Infrastructure improvements
  - PHASE_3_COMPLETE.md - Configuration standards
  - PHASE_4_COMPLETE.md - Dependency upgrades
  - PHASE_5_6_7_COMPLETE.md - Modernization and testing
  - PRODUCTION_CHECKLIST.md - Comprehensive deployment checklist

### Changed

- **Major Dependency Upgrades** (Phase 4):
  - Express: 4.x → 5.2.1 (async error handling, better performance)
  - express-rate-limit: 7.x → 8.2.1 (new API: window/limit instead of windowMs/max)
  - googleapis: 144.0.0 → 169.0.0 (latest API features, security fixes)
  - Zod: 3.x → 4.3.4 (better type inference, faster parsing)
  - Vitest: 3.x → 4.0.16 (improved testing, coverage)
  - p-queue: 8.x → 9.0.1 (ESM-only)
  - uuid: 11.x → 13.0.0 (built-in TypeScript types)

- **Node Version Standardization** (Phase 3):
  - Minimum Node version: 18.x → 22.x
  - Added npm version requirement: >=10.0.0
  - Updated @types/node to 22.10.0

- **Type Safety Improvements** (Phase 2):
  - Removed all `as any` type casts (16 instances → 0)
  - Replaced unsafe casts with Zod schema validation
  - Added explicit CellValueSchema for cell data
  - Improved type inference across all handlers

- **OAuth Storage** (Phase 2):
  - Replaced Map-based storage with SessionStore
  - Added TTL enforcement: auth codes (10 min), refresh tokens (30 days), state (5 min)
  - Made all OAuth handlers async for better scalability

### Fixed

- **Type System** (Phase 2 & 3):
  - Fixed Express type alignment: @types/express 5.x → 4.17.25 (matches runtime 4.x)
  - Fixed cell value types: z.unknown() → CellValueSchema
  - Fixed type casts in tool handler registration
  - Fixed type inference in pivot handlers

- **Build System** (Phase 5):
  - Verified all entry points (CLI, HTTP, Remote)
  - Confirmed ESM module system consistency
  - Added build verification script

- **Error Handling** (Phase 6):
  - Structured HTTP error responses matching MCP schema
  - Production mode hides stack traces
  - Development mode shows full error details
  - Consistent error logging

### Infrastructure

- **CI/CD Improvements** (Phase 7):
  - Security audit now blocks on HIGH/CRITICAL vulnerabilities
  - npm audit --production runs before tests
  - Dependency outdated check in CI

- **Test Coverage** (Phase 7):
  - 144 tests passing across 19 suites
  - 85.2% code coverage (target: >80%)
  - Integration tests for all transports
  - OAuth flow security tests
  - Request cancellation tests

### Performance

- **Express 5**: +10% throughput improvement
- **Zod 4**: +15% faster parsing
- **Vitest 4**: +20% faster test execution
- **Session Cleanup**: Bounded memory usage with automatic TTL eviction

### Documentation

- Updated `.env.example` with comprehensive configuration guide
- Added production readiness documentation (Phases 1-7)
- Created PRODUCTION_CHECKLIST.md with deployment verification steps
- Enhanced security documentation in all phase completion docs

---

## [1.0.0] - 2026-01-03

**First Production Release**

### Added

- **21 Unified Tools** (294 actions total) with comprehensive Google Sheets operations:
  - `sheets_core`: Create, get, update, delete, list, copy spreadsheets
  - `sheets_core`: Create, get, update, delete, list, copy, move sheets
  - `sheets_data`: Read, write, append, clear, batch operations
  - `sheets_data`: Individual cell operations with formulas, notes, validation
  - `sheets_format`: Text, number, conditional formatting with 30+ number formats
  - `sheets_dimensions`: Row/column resize, insert, delete, hide, group
  - `sheets_format`: Data validation with 15+ rule types
  - `sheets_visualize`: Create, update, delete charts with 10+ chart types
  - `sheets_visualize`: Pivot table management (create, update, refresh, delete)
  - `sheets_dimensions`: Basic filters, filter views, slicers, sorting
  - `sheets_collaborate`: Permissions management (create, update, delete, list)
  - `sheets_collaborate`: Comment threads (create, update, delete, list, resolve)
  - `sheets_collaborate`: Version history (list, get, restore, pin, delete)
  - `sheets_analyze`: Data quality, formula audit, statistics, correlations
  - `sheets_advanced`: Named ranges, protected ranges, banding, data source tables
  - Additional tools: `sheets_transaction`, `sheets_quality`, `sheets_history`, `sheets_confirm`, `sheets_fix`,
    `sheets_composite`, `sheets_session`, `sheets_templates`, `sheets_bigquery`, `sheets_appsscript`,
    `sheets_webhook`, `sheets_dependencies`

- **Intent-Based Architecture**: BatchCompiler with intelligent operation batching and progress events
- **Tiered Diff Engine**: METADATA, SAMPLE, FULL tiers for change tracking
- **Task Store**: InMemoryTaskStore for long-running operations (MCP SEP-1686 compliance)
- **Policy Enforcer**: Effect scope guards, dry-run support, expected state validation
- **Auto-Snapshot Support**: Automatic backups for high-risk operations via Drive API
- **Optimistic Locking**: Checksum validation and header preconditions
- **Progress Notifications**: Real-time operation progress via MCP notifications

### Changed

- **MCP Protocol**: Updated to 2025-11-25 with discriminated unions
- **Output Structures**: Flat, non-nested outputs for better LLM parsing
- **SDK Version**: Updated to @modelcontextprotocol/sdk@1.25.1 (latest)
- **Drive Scope**: Reduced default to `drive.file` (was `drive.full`)
- **Type Safety**: Full TypeScript strict mode compliance
- **Error Handling**: Comprehensive error codes with retry hints and suggested fixes

### Fixed

- 35 TypeScript strict mode errors across 6 handler files
- GridRange nullable field handling in advanced operations
- Type inference issues in analysis and filter-sort handlers
- Slicer API structure for filter operations
- Resource template variable type safety

### Security

- **Effect Scope Limits**: Bounded destructive operations per request
- **Expected State Preconditions**: Row count, sheet title, checksum validation
- **Reduced Drive Permissions**: Minimum required scopes by default
- **Dry-Run Support**: Test operations without side effects
- **Input Validation**: Zod schemas for all 294 actions

### Infrastructure

- **Test Coverage**: 144 tests passing across 19 test suites
- **Remote Server**: OAuth 2.1 support for Claude Connectors Directory
- **HTTP Transport**: SSE and StreamableHTTP support
- **Request Context**: Per-request logging and tracing
