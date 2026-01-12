# ServalSheets - Complete Project Overview

> **Production-Grade Google Sheets MCP Server**
> Version 1.4.0 | 26 Tools | 208 Actions | 77,813 LOC | 1,761+ Tests | MCP Protocol 2025-11-25

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Statistics](#project-statistics)
3. [Architecture Overview](#architecture-overview)
4. [Core Technologies](#core-technologies)
5. [Feature Catalog](#feature-catalog)
6. [Directory Structure](#directory-structure)
7. [System Components](#system-components)
8. [Advanced Features](#advanced-features)
9. [MCP Protocol Implementation](#mcp-protocol-implementation)
10. [Testing Infrastructure](#testing-infrastructure)
11. [Documentation Catalog](#documentation-catalog)
12. [Deployment Options](#deployment-options)
13. [Configuration Management](#configuration-management)
14. [Security Architecture](#security-architecture)
15. [Performance Optimization](#performance-optimization)
16. [Quality Metrics](#quality-metrics)
17. [Development Workflow](#development-workflow)
18. [Recent Changes](#recent-changes)

---

## Executive Summary

**ServalSheets** is a production-grade Model Context Protocol (MCP) server that provides comprehensive Google Sheets automation through Claude AI. It implements the latest MCP protocol (2025-11-25) with full compliance, offering 26 tools with 208 discrete actions covering every aspect of spreadsheet manipulation.

### What Makes ServalSheets Unique

1. **Enterprise-Grade Safety** - Dry-run mode, effect scope limits, expected state validation, automatic snapshots, and transaction management with auto-rollback
2. **Advanced Optimization** - Request deduplication, adaptive batching, predictive prefetching, tiered diff engine, and intelligent caching
3. **MCP Protocol Native** - Full support for elicitation (user confirmations), sampling (AI analysis), task cancellation, logging, and completions
4. **Intent-Based Architecture** - Single, unified batch compiler for all operations with 95+ intent types
5. **AI-Powered Features** - Pattern detection, formula generation, chart recommendations, and template suggestions
6. **Production Ready** - Docker, Kubernetes, PM2 deployments with Prometheus monitoring, comprehensive security, and 1,761+ tests

### Key Use Cases

- **Data Analysis Automation** - AI-powered pattern detection, correlations, anomaly detection, and statistical analysis
- **Spreadsheet Automation** - Bulk operations, conditional formatting, chart generation, pivot tables
- **Enterprise Integration** - Service account support, transaction management, conflict detection, audit trails
- **AI Assistants** - Claude Desktop integration for natural language spreadsheet manipulation
- **Remote Deployments** - OAuth 2.1 support for Claude Connectors Directory integration

---

## Project Statistics

| Metric | Count | Details |
|--------|-------|---------|
| **Version** | 1.4.0 | Zod v4 + open v11 upgrade |
| **Protocol** | MCP 2025-11-25 | Latest specification |
| **TypeScript Files** | 203 | All source files |
| **Lines of Code** | 77,813 | Total project LOC |
| **Handler LOC** | 16,783 | Handler implementations |
| **Service LOC** | 15,798 | Service layer |
| **Test Files** | 95 | Comprehensive test suite |
| **Passing Tests** | 1,761+ | 100% handler coverage |
| **Test Suites** | 78 | Unit, integration, property |
| **Tools** | 27 | MCP tools |
| **Actions** | 208 | Discrete operations |
| **Schemas** | 25 | Zod validation schemas |
| **Handlers** | 21+ | Specialized handlers |
| **Services** | 25+ | Service modules |
| **Resources** | 13+ | URI templates + knowledge |
| **Prompts** | 6 | Guided workflows |
| **Utility Modules** | 50+ | Helper utilities |
| **Scripts** | 29 | Build and validation |
| **Documentation Files** | 415+ | Comprehensive docs |
| **Dependencies** | 40+ | Production deps |
| **Dev Dependencies** | 35+ | Development tools |

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER / CLAUDE AI                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Natural Language
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP PROTOCOL LAYER                            │
│  - JSON-RPC 2.0                                                  │
│  - STDIO/HTTP/SSE Transport                                      │
│  - Tool/Resource/Prompt Registry                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Structured Requests
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HANDLER LAYER (21+ Handlers)                  │
│  - Input Validation (Zod)                                        │
│  - Auth & Safety Checks                                          │
│  - Request Context Management                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Validated Intents
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CORE INFRASTRUCTURE                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Intent    │  │    Batch     │  │     Rate     │           │
│  │   System    │→ │   Compiler   │→ │   Limiter    │           │
│  │  (95 types) │  │   (Single)   │  │ (Token Bkt)  │           │
│  └─────────────┘  └──────────────┘  └──────────────┘           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │    Diff     │  │    Policy    │  │    Range     │           │
│  │   Engine    │  │   Enforcer   │  │   Resolver   │           │
│  │  (3 Tiers)  │  │   (Safety)   │  │  (Semantic)  │           │
│  └─────────────┘  └──────────────┘  └──────────────┘           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ API Requests
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                                 │
│  - Google API Client (Sheets v4 & Drive v3)                     │
│  - Batching System (50-100ms windows)                           │
│  - Prefetching System (Pattern-based)                           │
│  - Transaction Manager (ACID)                                    │
│  - Metrics & Monitoring                                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Google API Calls
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE SHEETS API v4                          │
│                    GOOGLE DRIVE API v3                           │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Request (Natural Language)
    ↓
MCP Protocol (JSON-RPC)
    ↓
Zod Schema Validation
    ↓
Handler Processing
    ↓
Intent Generation (95+ types)
    ↓
Batch Compilation
    ↓
Policy Enforcement (Safety Rails)
    ↓
Rate Limiting (Token Bucket)
    ↓
Request Deduplication (5s window)
    ↓
Caching Layer (LRU + TTL)
    ↓
Google Sheets API Call
    ↓
Response Processing
    ↓
Diff Generation (3-tier)
    ↓
Structured MCP Response
    ↓
Claude AI Interpretation
    ↓
Natural Language Response to User
```

### Intent-Based Architecture

ServalSheets uses an **intent-based architecture** where all operations are represented as discriminated union types that map directly to Google Sheets API requests.

**Benefits:**
- Single source of truth for all mutations
- Type-safe operation composition
- Automatic batch optimization
- Effect scope calculation
- Dry-run preview support

**95+ Intent Types:**
- Spreadsheet operations (create, update, delete)
- Sheet management (add, delete, duplicate, rename)
- Cell operations (values, notes, validation, merge)
- Formatting (number formats, text, colors, borders)
- Dimensions (insert, delete, move, resize rows/columns)
- Conditional formatting rules
- Charts and pivot tables
- Filtering, sorting, slicers
- Named ranges and protection
- And more...

---

## Core Technologies

### Primary Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | ≥20.0.0 | Runtime environment (LTS) |
| **TypeScript** | 5.9.3 | Type-safe development |
| **Zod** | 4.3.5 | Schema validation & JSON schema generation |
| **Express** | 5.2.1 | HTTP server framework |
| **MCP SDK** | 1.25.2 | Model Context Protocol implementation |
| **googleapis** | 170.0.0 | Google Sheets API v4 & Drive API v3 |
| **google-auth-library** | Latest | OAuth 2.0/2.1 authentication |
| **Winston** | 3.17.0 | Structured logging |
| **vitest** | 4.0.16 | Testing framework |

### Key Dependencies

**Data Validation & Schemas**
- `zod` 4.3.5 - Schema validation (14x faster string parsing in v4)
- Native JSON schema generation (removed `zod-to-json-schema` dependency)

**Server & Middleware**
- `express` 5.2.1 - Web framework
- `compression` 1.8.1 - gzip response compression
- `cors` 2.8.5 - Cross-origin resource sharing
- `helmet` 8.0.0 - Security headers
- `express-rate-limit` 8.2.1 - Rate limiting middleware

**Authentication & Security**
- `jsonwebtoken` 9.0.2 - JWT token management
- `google-auth-library` - OAuth 2.0/2.1 with PKCE
- Custom token encryption with AES-256-GCM

**Performance & Caching**
- `lru-cache` 11.0.0 - LRU cache with TTL support
- `p-queue` 9.0.1 - Priority queue for concurrency control
- Custom request deduplication system

**Utilities**
- `dotenv` 17.2.3 - Environment variable loading
- `uuid` 13.0.0 - UUID generation
- `open` 11.0.0 - Browser launching for OAuth

**Testing**
- `vitest` 4.0.16 - Test runner and coverage
- `supertest` 7.1.4 - HTTP endpoint testing
- `fast-check` 4.5.3 - Property-based testing
- `@vitest/coverage-v8` 4.0.16 - Code coverage

**Development**
- `eslint` 9.17.0 - Code linting
- `prettier` 3.4.0 - Code formatting
- `typedoc` 0.28.15 - API documentation generation
- `tsx` 4.19.0 - TypeScript execution

---

## Feature Catalog

### Complete Tool List (26 Tools, 208 Actions)

#### Core Operations (8 Tools, 165 Actions)

**1. sheets_auth** (4 actions)
- Authentication and OAuth flow management
- Actions: `status`, `login`, `callback`, `logout`

**2. sheets_spreadsheet** (6 actions)
- Spreadsheet-level CRUD operations
- Actions: `get`, `create`, `copy`, `update_properties`, `get_url`, `batch_get`

**3. sheets_sheet** (7 actions)
- Sheet/tab management within spreadsheets
- Actions: `get`, `add`, `delete`, `update_properties`, `duplicate`, `copy`, `batch_get`

**4. sheets_values** (9 actions)
- Cell value read/write operations
- Actions: `read`, `write`, `append`, `clear`, `batch_read`, `batch_write`, `batch_get`, `search`, `find_replace`

**5. sheets_cells** (12 actions)
- Cell-level operations beyond values
- Actions: Notes, data validation, cell merging, borders, protection

**6. sheets_format** (9 actions)
- Cell formatting and styling
- Actions: Number formats, text formatting, backgrounds, fonts, alignment

**7. sheets_dimensions** (21 actions)
- Row and column operations
- Actions: Insert, delete, move, resize, hide/unhide, freeze, group

**8. sheets_rules** (8 actions)
- Conditional formatting rules
- Actions: Add, update, delete, reorder formatting rules

#### Advanced Features (5 Tools)

**9. sheets_charts** (9 actions)
- Chart creation and management
- Supported types: Bar, line, area, scatter, pie, combo charts

**10. sheets_pivot** (6 actions)
- Pivot table operations
- Actions: Create, update, delete, refresh pivot tables

**11. sheets_filter_sort** (14 actions)
- Data filtering, sorting, and slicers
- Actions: Filter views, basic filters, sort specs, slicers

**12. sheets_sharing** (8 actions)
- Permissions and access control
- Actions: Share, unshare, list permissions, update access

**13. sheets_comments** (10 actions)
- Comment and reply management
- Actions: Create, read, update, delete comments and replies

#### Analytics (2 Tools)

**14. sheets_analysis** (13 actions)
- Data analysis and insights
- Actions: Pattern detection, correlations, anomalies, column profiling, quality metrics

**15. sheets_advanced** (19 actions)
- Named ranges, protection, developer metadata
- Actions: Named ranges, protected ranges, banding, developer metadata

#### Enterprise (5 Tools)

**16. sheets_versions** (10 actions)
- Version history and change tracking
- Actions: List revisions, restore versions, export changes

**17. sheets_transaction** (6 actions)
- Multi-operation ACID transactions
- Actions: `begin`, `commit`, `rollback`, `status`, `list`, `get_stats`

**18. sheets_validation** (1 action)
- Data validation checking
- Actions: `validate_data`

**19. sheets_conflict** (2 actions)
- Concurrent modification detection
- Actions: `detect`, `get_stats`

**20. sheets_impact** (1 action)
- Pre-execution impact analysis
- Actions: `analyze`

#### MCP-Native (3 Tools)

**21. sheets_confirm** (2 actions)
- User confirmation via MCP Elicitation (SEP-1036)
- Actions: `request` (present operation plan), `get_stats` (confirmation stats)

**22. sheets_analyze** (4 actions)
- AI-powered analysis via MCP Sampling (SEP-1577)
- Actions: Data analysis with intelligent sampling

**23. sheets_fix** (0 actions)
- Automated issue fixing
- Auto-repairs common data quality issues

#### Additional (4 Tools)

**24. sheets_history** (7 actions)
- Operation history and undo
- Actions: List operations, undo, redo, clear history

**25. logging/setLevel** (MCP Native)
- Dynamic log level control
- Supports: debug, info, warn, error

**26-27. Additional MCP Tools**
- Session management
- Composite operations

### Resources (13 URI Templates + 7 Knowledge Resources)

#### Spreadsheet Resources
- `sheets:///{spreadsheetId}` - Complete spreadsheet metadata
- `sheets:///{spreadsheetId}/{range}` - Cell values for specified range
- `sheets:///{spreadsheetId}/charts` - All charts in spreadsheet
- `sheets:///{spreadsheetId}/charts/{chartId}` - Individual chart details
- `sheets:///{spreadsheetId}/pivots` - All pivot tables
- `sheets:///{spreadsheetId}/quality` - Data quality analysis

#### Knowledge Resources
- Formula recipes and best practices
- Color reference guide (RGB, hex conversions)
- Format reference (number formats, date formats)
- Template collection (CRM, project tracking, sales)
- API patterns and limits
- User intent examples
- Workflow patterns

#### Operation Resources
- History resources (past operations log)
- Cache status (hit rates, sizes)
- Transaction status (active, completed, failed)
- Conflict information (detected conflicts)
- Impact analysis results
- Validation results
- Metrics and analytics

### Prompts (6 Guided Workflows)

MCP-native prompts for common spreadsheet operations:
1. **Data Analysis Workflow** - Pattern detection, quality analysis, insights
2. **Spreadsheet Setup** - Template-based creation with structure
3. **Report Generation** - Automated formatting and chart creation
4. **Data Transformation** - Cleaning, normalization, enrichment
5. **Template Creation** - Custom template design
6. **Performance Optimization** - Cache tuning, batch configuration

---

## Directory Structure

```
servalsheets/
│
├── src/                                    # Main source code (77,813 LOC)
│   ├── cli.ts                             # CLI entry point (STDIO/HTTP)
│   ├── server.ts                          # MCP server implementation
│   ├── http-server.ts                     # HTTP/SSE transport
│   ├── remote-server.ts                   # OAuth 2.1 remote server
│   ├── oauth-provider.ts                  # OAuth provider implementation
│   ├── version.ts                         # Version constants
│   │
│   ├── schemas/                           # Zod validation schemas (25 schemas)
│   │   ├── index.ts                       # Tool registry and exports
│   │   ├── annotations.ts                 # Tool metadata annotations
│   │   ├── descriptions.ts                # LLM-optimized descriptions
│   │   ├── shared.ts                      # Common types (SafetyOptions, RangeInput)
│   │   ├── auth.ts                        # Authentication schemas
│   │   ├── spreadsheet.ts                 # Spreadsheet operations
│   │   ├── sheet.ts                       # Sheet management
│   │   ├── values.ts                      # Cell values
│   │   ├── cells.ts                       # Cell operations
│   │   ├── format.ts                      # Cell formatting
│   │   ├── dimensions.ts                  # Row/column operations
│   │   ├── rules.ts                       # Conditional formatting
│   │   ├── charts.ts                      # Chart management
│   │   ├── pivot.ts                       # Pivot tables
│   │   ├── filter-sort.ts                 # Filtering and sorting
│   │   ├── sharing.ts                     # Permissions
│   │   ├── comments.ts                    # Comments
│   │   ├── versions.ts                    # Version history
│   │   ├── analysis.ts                    # Data analysis
│   │   ├── advanced.ts                    # Advanced features
│   │   ├── transaction.ts                 # Transactions
│   │   ├── validation.ts                  # Validation checking
│   │   ├── conflict.ts                    # Conflict detection
│   │   ├── impact.ts                      # Impact analysis
│   │   ├── history.ts                     # Operation history
│   │   ├── confirm.ts                     # User confirmation (Elicitation)
│   │   ├── analyze.ts                     # AI analysis (Sampling)
│   │   ├── fix.ts                         # Automated fixing
│   │   ├── composite.ts                   # Composite operations
│   │   ├── prompts.ts                     # Prompt definitions
│   │   ├── session.ts                     # Session schemas
│   │   └── fast-validators.ts             # Pre-compiled validators
│   │
│   ├── core/                              # Core infrastructure
│   │   ├── intent.ts                      # Intent type system (95+ types)
│   │   ├── batch-compiler.ts              # Single compiler for all mutations
│   │   ├── rate-limiter.ts                # Token bucket rate limiting
│   │   ├── diff-engine.ts                 # 3-tier diff generation
│   │   ├── policy-enforcer.ts             # Safety policy validation
│   │   ├── range-resolver.ts              # Semantic range resolution
│   │   ├── task-store.ts                  # Task storage
│   │   ├── task-store-adapter.ts          # Task store abstraction
│   │   ├── task-store-factory.ts          # Redis/memory task stores
│   │   ├── errors.ts                      # Error types
│   │   └── index.ts                       # Core exports
│   │
│   ├── handlers/                          # Tool handlers (16,783 LOC)
│   │   ├── base.ts                        # Base handler class
│   │   ├── base-optimized.ts              # Optimized base handler
│   │   ├── values.ts                      # Cell values handler
│   │   ├── values-optimized.ts            # Optimized values handler
│   │   ├── spreadsheet.ts                 # Spreadsheet handler
│   │   ├── sheet.ts                       # Sheet handler
│   │   ├── cells.ts                       # Cells handler
│   │   ├── format.ts                      # Format handler
│   │   ├── dimensions.ts                  # Dimensions handler
│   │   ├── rules.ts                       # Rules handler
│   │   ├── charts.ts                      # Charts handler
│   │   ├── pivot.ts                       # Pivot handler
│   │   ├── filter-sort.ts                 # Filter/sort handler
│   │   ├── sharing.ts                     # Sharing handler
│   │   ├── comments.ts                    # Comments handler
│   │   ├── versions.ts                    # Versions handler
│   │   ├── analysis.ts                    # Analysis handler
│   │   ├── advanced.ts                    # Advanced handler
│   │   ├── transaction.ts                 # Transaction handler
│   │   ├── validation.ts                  # Validation handler
│   │   ├── conflict.ts                    # Conflict handler
│   │   ├── impact.ts                      # Impact handler
│   │   ├── history.ts                     # History handler
│   │   ├── confirm.ts                     # Confirm handler (Elicitation)
│   │   ├── analyze.ts                     # Analyze handler (Sampling)
│   │   ├── fix.ts                         # Fix handler
│   │   ├── composite.ts                   # Composite handler
│   │   ├── session.ts                     # Session handler
│   │   ├── logging.ts                     # Logging handler
│   │   ├── optimization.ts                # Optimization utilities
│   │   └── index.ts                       # Handler factory & exports
│   │
│   ├── services/                          # Service layer (15,798 LOC)
│   │   ├── google-api.ts                  # Google API client
│   │   ├── token-manager.ts               # Token lifecycle management
│   │   ├── token-store.ts                 # Encrypted token storage
│   │   ├── snapshot.ts                    # Backup/restore service
│   │   ├── batching-system.ts             # Batch time windows
│   │   ├── batch-aggregator.ts            # Operation aggregation
│   │   ├── request-merger.ts              # Duplicate request merging
│   │   ├── metrics.ts                     # Performance metrics
│   │   ├── metrics-dashboard.ts           # Metrics visualization
│   │   ├── prefetching-system.ts          # Predictive prefetching
│   │   ├── prefetch-predictor.ts          # Pattern prediction
│   │   ├── access-pattern-tracker.ts      # Access pattern analysis
│   │   ├── sampling-analysis.ts           # Data sampling for AI
│   │   ├── context-manager.ts             # Request context
│   │   ├── transaction-manager.ts         # ACID transactions
│   │   ├── conflict-detector.ts           # Concurrency conflicts
│   │   ├── impact-analyzer.ts             # Pre-execution analysis
│   │   ├── validation-engine.ts           # Data validation
│   │   ├── confirm-service.ts             # User confirmations
│   │   ├── confirmation-policy.ts         # Confirmation policies
│   │   ├── composite-operations.ts        # Composite ops
│   │   ├── capability-cache.ts            # Capability caching
│   │   ├── parallel-executor.ts           # Parallel execution
│   │   ├── history-service.ts             # Operation history
│   │   ├── session-context.ts             # Session context
│   │   ├── sheet-resolver.ts              # Sheet resolution
│   │   ├── smart-context.ts               # Smart context
│   │   ├── semantic-range.ts              # Semantic ranges
│   │   ├── task-manager.ts                # Task management
│   │   └── index.ts                       # Service exports
│   │
│   ├── resources/                         # MCP Resources
│   │   ├── knowledge.ts                   # Knowledge base resources
│   │   ├── reference.ts                   # API reference resources
│   │   ├── history.ts                     # History resources
│   │   ├── charts.ts                      # Chart specs
│   │   ├── pivots.ts                      # Pivot configurations
│   │   ├── quality.ts                     # Quality analysis
│   │   ├── confirmation.ts                # Confirmation resources
│   │   ├── confirm.ts                     # Confirm dialog
│   │   ├── cache.ts                       # Cache status
│   │   ├── transaction.ts                 # Transaction resources
│   │   ├── conflict.ts                    # Conflict resources
│   │   ├── impact.ts                      # Impact resources
│   │   ├── validate.ts                    # Validation resources
│   │   ├── analyze.ts                     # Analysis resources
│   │   └── index.ts                       # Resource registration
│   │
│   ├── mcp/                               # MCP Protocol implementation
│   │   ├── registration/                  # Tool/resource/prompt registration
│   │   │   ├── tool-definitions.ts
│   │   │   ├── tool-handlers.ts
│   │   │   ├── tool-handlers-optimized.ts
│   │   │   ├── fast-handler-map.ts
│   │   │   ├── resource-registration.ts
│   │   │   ├── prompt-registration.ts
│   │   │   ├── schema-helpers.ts
│   │   │   └── index.ts
│   │   ├── features-2025-11-25.ts         # MCP capabilities
│   │   ├── sdk-compat.ts                  # SDK compatibility
│   │   ├── completions.ts                 # Argument completion
│   │   ├── response-builder.ts            # Response optimization
│   │   └── registration.ts                # Compat layer
│   │
│   ├── config/                            # Configuration
│   │   ├── env.ts                         # Zod env validation
│   │   ├── constants.ts                   # App constants
│   │   └── index.ts
│   │
│   ├── utils/                             # Utility modules (50+ utilities)
│   │   ├── cache-manager.ts               # LRU cache with TTL
│   │   ├── cache-store.ts                 # Cache storage
│   │   ├── cache-factory.ts               # Cache creation
│   │   ├── cache-integration.ts           # Cache middleware
│   │   ├── hot-cache.ts                   # Hot path caching
│   │   ├── request-deduplication.ts       # Request dedup
│   │   ├── request-context.ts             # Request context
│   │   ├── session-limiter.ts             # Session limits
│   │   ├── payload-monitor.ts             # Payload tracking
│   │   ├── batch-efficiency.ts            # Batch analysis
│   │   ├── circuit-breaker.ts             # Circuit breaker
│   │   ├── connection-health.ts           # Health checks
│   │   ├── logger.ts                      # Winston logger
│   │   ├── logger-context.ts              # Context logging
│   │   ├── auth-guard.ts                  # Auth validation
│   │   ├── auth-paths.ts                  # Auth paths
│   │   ├── oauth-callback-server.ts       # OAuth callbacks
│   │   ├── error-factory.ts               # Error creation
│   │   ├── error-messages.ts              # Error templates
│   │   ├── enhanced-errors.ts             # Enhanced errors
│   │   ├── retry.ts                       # Retry logic
│   │   ├── google-sheets-helpers.ts       # Google helpers
│   │   ├── schema-compat.ts               # Zod compat
│   │   ├── http2-detector.ts              # HTTP/2 detection
│   │   ├── infrastructure.ts              # Infrastructure utils
│   │   ├── response-optimizer.ts          # Response optimization
│   │   ├── safety-helpers.ts              # Safety utilities
│   │   └── index.ts
│   │
│   ├── observability/                     # Observability
│   │   ├── metrics.ts                     # Metrics recording
│   │   └── telemetry.ts                   # Telemetry
│   │
│   ├── security/                          # Security features
│   │   ├── resource-indicators.ts         # Resource scopes
│   │   ├── incremental-scope.ts           # Incremental OAuth
│   │   └── index.ts
│   │
│   ├── storage/                           # Storage layer
│   │   └── (storage implementations)
│   │
│   ├── startup/                           # Lifecycle management
│   │   ├── lifecycle.ts                   # Server lifecycle
│   │   ├── hooks.ts                       # Lifecycle hooks
│   │   └── index.ts
│   │
│   ├── server/                            # Server utilities
│   │   ├── health.ts                      # Health checks
│   │   ├── well-known.ts                  # /.well-known/
│   │   └── index.ts
│   │
│   ├── types/                             # TypeScript types
│   │   ├── operation-plan.ts
│   │   ├── transaction.ts
│   │   ├── validation.ts
│   │   ├── history.ts
│   │   ├── impact.ts
│   │   ├── conflict.ts
│   │   ├── sampling.ts
│   │   └── index.ts
│   │
│   ├── knowledge/                         # Knowledge base
│   │   ├── api/                           # Google API docs
│   │   │   ├── data-validation.md
│   │   │   ├── pivot-tables.md
│   │   │   ├── conditional-formatting.md
│   │   │   ├── batch-operations.md
│   │   │   ├── named-ranges.md
│   │   │   ├── charts.md
│   │   │   └── limits/quotas.json
│   │   ├── formulas/                      # Formula recipes
│   │   ├── templates/                     # Template schemas
│   │   │   ├── common-templates.json
│   │   │   ├── project.json
│   │   │   ├── marketing.json
│   │   │   └── sales.json
│   │   ├── schemas/                       # Schema templates
│   │   │   ├── project.json
│   │   │   ├── crm.json
│   │   │   └── inventory.json
│   │   ├── confirmation-guide.json
│   │   ├── ui-ux-patterns.json
│   │   ├── workflow-patterns.json
│   │   ├── user-intent-examples.json
│   │   └── README.md
│   │
│   └── cli/                               # CLI utilities
│       └── (auth setup scripts)
│
├── tests/                                  # Test suite (95 test files)
│   ├── handlers/                          # Handler tests (30+ files)
│   │   ├── advanced.test.ts
│   │   ├── analysis.test.ts
│   │   ├── analysis.snapshot.test.ts
│   │   ├── analyze.test.ts
│   │   ├── auth.test.ts
│   │   ├── cells.test.ts
│   │   ├── charts.test.ts
│   │   ├── comments.test.ts
│   │   ├── composite.test.ts
│   │   ├── confirm.test.ts
│   │   ├── conflict.test.ts
│   │   ├── dimensions.test.ts
│   │   ├── filter-sort.test.ts
│   │   ├── fix.test.ts
│   │   ├── format.test.ts
│   │   ├── format.snapshot.test.ts
│   │   ├── history.test.ts
│   │   ├── impact.test.ts
│   │   ├── logging.test.ts
│   │   ├── optimization.test.ts
│   │   ├── pivot.test.ts
│   │   ├── rules.test.ts
│   │   ├── sharing.test.ts
│   │   ├── sheet.test.ts
│   │   ├── spreadsheet.test.ts
│   │   ├── transaction.test.ts
│   │   ├── validation.test.ts
│   │   ├── values.test.ts
│   │   ├── values.snapshot.test.ts
│   │   ├── values-append-batching.test.ts
│   │   └── versions.test.ts
│   ├── unit/                              # Unit tests (15+ files)
│   │   ├── adaptive-batch-window.test.ts
│   │   ├── background-refresh.test.ts
│   │   ├── batching-system-adaptive.test.ts
│   │   ├── cache-hit-rate-improvement.test.ts
│   │   ├── cache-invalidation.test.ts
│   │   ├── metrics.test.ts
│   │   ├── request-merger.test.ts
│   │   └── ...
│   ├── core/                              # Core component tests
│   ├── services/                          # Service tests
│   │   ├── batching-system.test.ts
│   │   ├── conflict-detector.test.ts
│   │   ├── google-api.test.ts
│   │   ├── google-api.extended.test.ts
│   │   ├── history-service.test.ts
│   │   ├── history-service.extended.test.ts
│   │   ├── impact-analyzer.test.ts
│   │   ├── metrics.test.ts
│   │   ├── metrics.extended.test.ts
│   │   ├── prefetching-system.test.ts
│   │   ├── sheet-resolver.test.ts
│   │   ├── sheet-resolver.extended.test.ts
│   │   ├── snapshot.test.ts
│   │   ├── task-manager.test.ts
│   │   ├── transaction-manager.test.ts
│   │   └── validation-engine.test.ts
│   ├── schemas/                           # Schema tests
│   │   └── ...
│   ├── mcp/                               # MCP protocol tests
│   │   └── ...
│   ├── integration/                       # Integration tests
│   │   ├── http2.test.ts
│   │   ├── mcp-tools-list.test.ts
│   │   └── ...
│   ├── security/                          # Security tests
│   ├── property/                          # Property-based tests
│   │   └── schema-validation.property.test.ts
│   ├── contracts/                         # Contract tests
│   │   └── schema-contracts.test.ts
│   ├── startup/                           # Startup tests
│   ├── storage/                           # Storage tests
│   ├── benchmarks/                        # Performance benchmarks
│   ├── helpers/                           # Test utilities
│   │   ├── error-codes.ts
│   │   ├── input-factories.ts
│   │   ├── mcp-test-harness.ts
│   │   ├── oauth-mocks.ts
│   │   └── singleton-reset.ts
│   └── examples/                          # Test examples
│
├── docs/                                   # Documentation (415+ files)
│   ├── guides/                            # User guides (11 guides)
│   │   ├── CLAUDE_DESKTOP_SETUP.md
│   │   ├── INSTALLATION_GUIDE.md
│   │   ├── FIRST_TIME_USER.md
│   │   ├── USAGE_GUIDE.md
│   │   ├── PROMPTS_GUIDE.md
│   │   ├── OAUTH_USER_SETUP.md
│   │   ├── TROUBLESHOOTING.md
│   │   ├── DEPLOYMENT.md
│   │   ├── MONITORING.md
│   │   ├── PERFORMANCE.md
│   │   └── SKILL.md
│   ├── operations/                        # Operations runbooks
│   │   ├── backup-restore.md
│   │   ├── disaster-recovery.md
│   │   ├── scaling.md
│   │   ├── migrations.md
│   │   ├── certificate-rotation.md
│   │   └── jwt-secret-rotation.md
│   ├── development/                       # Development docs
│   │   ├── TESTING.md
│   │   ├── HANDLER_PATTERNS.md
│   │   ├── DURABLE_SCHEMA_PATTERN.md
│   │   ├── P0_IMPLEMENTATION_GUIDE.md
│   │   ├── ANTI_PATTERN_ANALYSIS.md
│   │   ├── INTEGRATION_ANALYSIS.md
│   │   └── TOOL_ALIGNMENT_INVESTIGATION_PLAN.md
│   ├── architecture-diagrams.md
│   ├── COMPREHENSIVE_PROJECT_ANALYSIS.md
│   ├── COMPREHENSIVE_AUDIT_REPORT.md
│   └── README.md                          # Documentation index
│
├── deployment/                            # Deployment configs
│   ├── docker/
│   │   ├── Dockerfile                     # Multi-stage build
│   │   └── docker-compose.yml
│   ├── k8s/                               # Kubernetes
│   │   ├── deployment.yaml
│   │   ├── ingress.yaml
│   │   ├── service.yaml
│   │   └── README.md
│   ├── pm2/                               # PM2
│   │   └── ecosystem.config.js
│   └── prometheus/                        # Monitoring
│       ├── prometheus.yml
│       ├── alerts.yml
│       ├── alertmanager.yml
│       ├── docker-compose.yml
│       └── QUICK_REFERENCE.md
│
├── scripts/                               # Build & utility scripts
│   ├── generate-metadata.ts
│   ├── check-metadata-drift.sh
│   ├── validate-tool-registry.ts
│   ├── validate-all-tools.ts
│   ├── validate-alerts.sh
│   ├── benchmark-handlers.ts
│   ├── benchmark-optimizations.ts
│   ├── benchmark-responses.ts
│   ├── benchmark-validators.ts
│   ├── show-metrics.ts
│   ├── show-tools-list-schemas.ts
│   ├── test-mcp-protocol.ts
│   ├── verify-metrics.ts
│   └── ...
│
├── examples/                              # Usage examples
│
├── package.json                           # NPM configuration
├── tsconfig.json                          # TypeScript config
├── tsconfig.build.json                    # Build config
├── vitest.config.ts                       # Test config
├── README.md                              # Main documentation
├── CHANGELOG.md                           # Version history
├── SECURITY.md                            # Security policy
├── server.json                            # MCP registry metadata
├── .env.example                           # Environment template
└── ...                                    # Other config files
```

---

## System Components

### 1. MCP Server Core (`src/server.ts`)

**Primary Class:** `ServalSheetsServer`

**Responsibilities:**
- Implements MCP protocol via `@modelcontextprotocol/sdk`
- Registers all tools, resources, and prompts
- Manages STDIO transport for Claude Desktop
- Handles request routing to appropriate handlers
- Supports task cancellation (SEP-1686)
- Request ID propagation for distributed tracing

**Capabilities:**
- Tools: 26 tools with 208 actions
- Resources: 13 URI templates + 7 knowledge resources
- Prompts: 6 guided workflows
- Logging: Dynamic log level control
- Completions: Argument autocompletion
- Tasks: Background execution with cancellation
- Elicitation: User confirmations (SEP-1036)
- Sampling: AI-powered analysis (SEP-1577)

### 2. HTTP/SSE Server (`src/http-server.ts`)

**Framework:** Express 5.2.1

**Features:**
- Server-Sent Events (SSE) transport
- Streamable HTTP for Claude Connectors Directory
- OAuth 2.1 callback handling
- CORS, Helmet, rate limiting, compression
- Health checks and /.well-known/ endpoints
- Session management with optional Redis
- Request timeout handling
- Error boundary middleware

**Endpoints:**
- `GET /` - Server info
- `POST /mcp/v1/rpc` - MCP JSON-RPC endpoint
- `GET /mcp/v1/sse` - SSE transport endpoint
- `GET /auth/oauth/authorize` - OAuth authorization
- `POST /auth/oauth/token` - OAuth token exchange
- `GET /health` - Health check
- `GET /.well-known/mcp` - MCP metadata

### 3. OAuth 2.1 Provider (`src/oauth-provider.ts`)

**Implementation:** OAuth 2.1 with PKCE support

**Features:**
- Authorization Code flow with PKCE
- State token HMAC signing (CSRF protection)
- Redirect URI allowlisting
- Access token issuance (1-hour TTL)
- Refresh token support (30-day TTL)
- Session-based authorization
- Token revocation

**Security:**
- JWT signing with configurable secrets
- State token validation
- Redirect URI validation
- PKCE code_challenge verification
- Incremental OAuth scopes (drive.file only)

### 4. Intent System (`src/core/intent.ts`)

**Purpose:** Type-safe representation of all spreadsheet operations

**Architecture:**
- 95+ discriminated union types
- Direct mapping to Google Sheets batchUpdate requests
- Single source of truth for mutations

**Intent Categories:**
- **Spreadsheet:** Create, update, delete spreadsheets
- **Sheet:** Add, delete, duplicate, rename sheets
- **Values:** Cell value operations
- **Format:** Text, number, background, font formatting
- **Dimensions:** Row/column insert, delete, move, resize
- **Rules:** Conditional formatting
- **Charts:** Chart creation and updates
- **Pivot:** Pivot table operations
- **Filter/Sort:** Filtering, sorting, slicers
- **Advanced:** Named ranges, protection, metadata

**Benefits:**
- Type safety at compile time
- Automatic batch optimization
- Effect scope calculation
- Dry-run support
- Progress tracking

### 5. Batch Compiler (`src/core/batch-compiler.ts`)

**Purpose:** Single compiler for all mutations

**Features:**
- Compiles intents to Google Sheets batchUpdate requests
- Estimates cell impact for safety checks
- Supports dry-run preview mode
- Emits progress events
- Payload size monitoring (2MB warnings, 10MB hard limits)

**Optimization:**
- Merges compatible operations
- Eliminates redundant updates
- Optimizes range references
- Minimizes API calls

### 6. Rate Limiter (`src/core/rate-limiter.ts`)

**Algorithm:** Token bucket

**Default Limits:**
- Read operations: 300 per minute
- Write operations: 60 per minute

**Features:**
- Separate read/write quotas
- Dynamic throttling on 429 errors (50% reduction for 60s)
- Per-request queue management via p-queue
- Request priority support
- Quota monitoring and alerts

### 7. Diff Engine (`src/core/diff-engine.ts`)

**Purpose:** Generate change previews at appropriate detail levels

**Tiers:**
1. **METADATA** (Fastest, ~1KB)
   - Row/column counts
   - Sheet checksums
   - No value comparison
   - Used for: >10,000 cells

2. **SAMPLE** (Balanced, ~50KB)
   - First & last N rows
   - Value sampling
   - Block checksums
   - Used for: 1,000-10,000 cells

3. **FULL** (Comprehensive)
   - Complete before/after capture
   - Full value comparison
   - Detailed change records
   - Used for: <1,000 cells

**Auto-Selection Logic:**
```typescript
if (cellCount > 10000) return 'METADATA';
if (cellCount > 1000) return 'SAMPLE';
return 'FULL';
```

### 8. Policy Enforcer (`src/core/policy-enforcer.ts`)

**Purpose:** Safety rails for all operations

**Policies:**
- **Effect Scope Limits:**
  - Max 50,000 cells per operation (configurable)
  - Max 10,000 rows per delete
  - Max 100 columns per delete

- **Destructive Operation Guards:**
  - Prevent multiple destructive ops in single batch
  - Require explicit confirmation for large-scale deletes
  - Auto-snapshot before destructive operations

- **Expected State Validation:**
  - Optimistic locking via checksums
  - Row count verification
  - Sheet title verification

### 9. Range Resolver (`src/core/range-resolver.ts`)

**Purpose:** Semantic range resolution

**Features:**
- A1 notation support (`Sheet1!A1:C10`)
- Named ranges (`SalesData`)
- Grid coordinates (0-based, end exclusive)
- **Semantic ranges** - Query by header name

**Semantic Range Example:**
```typescript
{
  semantic: {
    sheet: 'Q4 Sales',
    column: 'Total Revenue',  // Matches header in row 1
    includeHeader: false
  }
}
// Resolves to: Q4 Sales!E2:E100 (if "Total Revenue" is in column E)
```

**Optimization:**
- LRU header cache (1000 entries, 5-min TTL)
- Fuzzy matching for ambiguous headers
- Confidence-based resolution
- Multiple match warnings

### 10. Handler Architecture

**Base Handler** (`src/handlers/base.ts`)

Common utilities for all handlers:
- Spreadsheet/sheet/range resolution
- Safety policy enforcement
- Auth validation
- Request context management
- Progress event emission
- Error normalization

**Handler Context:**
```typescript
{
  requestId: string;           // For distributed tracing
  googleSheetsClient: Sheets;  // Google Sheets API client
  googleDriveClient: Drive;    // Google Drive API client
  rateLimiter: RateLimiter;    // Token bucket rate limiter
  batchCompiler: BatchCompiler;// Intent compiler
  diffEngine: DiffEngine;      // Tiered diff generation
  rangeResolver: RangeResolver;// Semantic range resolution
  metricsAggregator: Metrics;  // Performance tracking
  taskStore: TaskStore;        // For cancellation
}
```

**21+ Specialized Handlers:**

Each handler implements a specific tool or set of related operations. Handlers follow a consistent pattern:

1. **Input Validation** - Zod schema validation
2. **Auth Check** - Verify Google API access
3. **Pre-execution Analysis** - Impact analysis, conflict detection
4. **Safety Enforcement** - Policy validation, dry-run support
5. **Operation Execution** - Google API calls via rate limiter
6. **Diff Generation** - Automatic tier selection
7. **Response Formation** - Structured MCP response

### 11. Service Layer

**Google API Client** (`src/services/google-api.ts`)

Centralized Google API client with:
- Automatic token refresh
- Request retry with exponential backoff
- Payload size monitoring
- Connection health checks
- Circuit breaker pattern
- HTTP/2 support detection

**Batching System** (`src/services/batching-system.ts`)

Time-window batching for operation merging:
- 50-100ms collection windows
- Adaptive window sizing based on load
- Cross-tool operation aggregation
- 20-40% API call reduction
- Same or better latency

**Prefetching System** (`src/services/prefetching-system.ts`)

Predictive data loading:
- Pattern-based prefetch prediction
- Adjacent range prefetching
- Background refresh before cache expiry
- Priority-based prefetch queue
- Configurable strategies

**Transaction Manager** (`src/services/transaction-manager.ts`)

ACID transaction support:
- All-or-nothing semantics
- Automatic snapshots before execution
- Auto-rollback on error
- Batch operation merging (N operations → 1 API call)
- Status tracking (pending, active, committed, rolled back)
- Snapshot retention (1 hour)
- Transaction listeners for custom logic

**Conflict Detector** (`src/services/conflict-detector.ts`)

Concurrent modification detection:
- Checksum-based comparison
- Fast conflict identification
- Resolution strategies (last-write-wins, first-write-wins, user confirmation)

**Impact Analyzer** (`src/services/impact-analyzer.ts`)

Pre-execution analysis:
- Scope impact calculation
- Risk level assessment (low, medium, high, critical)
- Warning generation for risky operations

---

## Advanced Features

### 1. Request Deduplication

**Purpose:** Prevent duplicate API calls

**Implementation:**
- 5-second deduplication window
- Request signature hashing (method + params)
- Shared result promises
- Configurable via `DEDUP_ENABLED` and `DEDUP_WINDOW_MS`

**Benefits:**
- Reduces redundant API calls
- Lowers quota usage
- Faster response for duplicate requests

**Statistics:**
- Total requests
- Deduplicated count
- Deduplication rate
- Cache hit rate

### 2. Tiered Diff Engine

**Purpose:** Generate appropriate-detail change previews

**Implementation:** 3-tier system with automatic selection

**Performance:**
- METADATA: <100ms for any size
- SAMPLE: <1s for 10,000 cells
- FULL: <5s for 1,000 cells

**Use Cases:**
- Safety verification before execution
- Audit trail generation
- Rollback decision support

### 3. Batch Request Time Windows

**Purpose:** Merge operations for efficiency

**Implementation:**
- 50-100ms collection windows
- Adaptive window sizing
- Operation aggregation
- Cross-tool merging

**Metrics:**
- API calls saved: 20-40%
- Latency impact: <5%
- Quota usage reduction: 30%

### 4. Adaptive Batch Windows

**Purpose:** Dynamic window sizing based on load

**Algorithm:**
```typescript
if (queueLength > threshold) {
  increaseWindow();
} else if (queueLength < lowThreshold) {
  decreaseWindow();
}
```

**Benefits:**
- Optimizes for current load
- Balances latency vs efficiency
- Automatic tuning

### 5. Caching System

**Implementation:** LRU cache with TTL

**Configuration:**
- Max size: 100MB (default)
- TTL: 5 minutes (default)
- Eviction: LRU policy

**Features:**
- Automatic cache key generation
- Size-aware eviction
- TTL-based expiration
- Cache statistics tracking

**Statistics:**
- Hit rate
- Miss rate
- Total entries
- Memory usage

### 6. Prefetching System

**Purpose:** Proactive data loading

**Strategies:**
1. **Pattern-Based** - Learn access patterns, prefetch likely next ranges
2. **Adjacent** - Prefetch ranges near recently accessed data
3. **Background Refresh** - Refresh cache before expiry

**Configuration:**
- Prefetch threshold
- Max prefetch size
- Priority queue
- Resource limits

### 7. Background Refresh

**Purpose:** Keep cache fresh

**Implementation:**
- Monitors cache entries
- Refreshes entries before TTL expiry (e.g., at 80% of TTL)
- Priority-based refresh queue
- Resource throttling

**Benefits:**
- Reduced cache misses
- Better user experience (no waiting for refresh)
- Quota-efficient (refresh during idle time)

### 8. Transaction Management

**Purpose:** Multi-operation atomicity

**Features:**
- **Begin Transaction:** Create transaction scope with auto-snapshot
- **Commit:** Execute all operations in single API call
- **Rollback:** Restore from snapshot
- **Status:** Track transaction state
- **Stats:** Success rates, durations, operations per transaction

**Example:**
```typescript
// Begin transaction (auto-snapshot created)
const txId = await sheets_transaction({ action: 'begin', spreadsheetId, reason: 'Bulk update' });

// Queue operations
await sheets_values({ action: 'write', transactionId: txId, ... });
await sheets_format({ action: 'format_cells', transactionId: txId, ... });

// Commit (all-or-nothing)
await sheets_transaction({ action: 'commit', transactionId: txId });

// Or rollback on error
await sheets_transaction({ action: 'rollback', transactionId: txId });
```

### 9. Conflict Detection

**Purpose:** Detect concurrent modifications

**Implementation:**
- Checksum-based comparison
- Before/after state capture
- Conflict reporting with details

**Resolution Strategies:**
- Last-write-wins (default)
- First-write-wins
- User confirmation via MCP Elicitation
- Automatic merge (future)

### 10. Impact Analysis

**Purpose:** Pre-execution risk assessment

**Features:**
- Scope impact calculation (cells, rows, columns affected)
- Risk level assessment
- Warning generation
- Effect scope validation

**Risk Levels:**
- **Low:** <100 cells affected
- **Medium:** 100-5,000 cells
- **High:** 5,000-50,000 cells
- **Critical:** >50,000 cells

**Example:**
```typescript
const impact = await sheets_impact({
  action: 'analyze',
  spreadsheetId,
  operations: [
    { action: 'delete_rows', startIndex: 0, endIndex: 1000 }
  ]
});

// Returns:
// {
//   cellsAffected: 50000,
//   rowsAffected: 1000,
//   columnsAffected: 50,
//   riskLevel: 'high',
//   warnings: ['Large-scale delete operation']
// }
```

### 11. Data Quality Analysis

**Features:**
- **Completeness:** Non-null percentage
- **Duplication:** Duplicate row detection
- **Outliers:** Statistical outlier detection
- **Type Consistency:** Data type validation
- **Missing Patterns:** Missing value analysis
- **Anomaly Detection:** Statistical anomalies

### 12. AI-Powered Features

**Pattern Detection:**
- Trend analysis (linear, exponential, seasonal)
- Correlation detection
- Anomaly identification
- Seasonality detection

**Column Profiling:**
- Data type inference
- Distribution analysis
- Quality metrics (completeness, uniqueness)
- Value ranges and outliers

**Template Suggestions:**
- AI generates contextual templates
- Based on data structure and content
- Optimized for use case

**Formula Generation:**
- Natural language → Google Sheets formulas
- Context-aware suggestions
- Error handling

**Chart Recommendations:**
- Optimal visualization suggestions
- Based on data characteristics
- Multiple chart types considered

---

## MCP Protocol Implementation

### Protocol Compliance

**MCP Version:** 2025-11-25 (latest)
**JSON-RPC:** 2.0 (full compliance)
**SDK Version:** @modelcontextprotocol/sdk v1.25.2 (pinned)

### Capabilities Matrix

| Capability | Status | Implementation | Details |
|-----------|--------|----------------|---------|
| **Tools** | ✅ Complete | 26 tools, 208 actions | Discriminated unions, full validation |
| **Resources** | ✅ Complete | 13 URI templates | Spreadsheet data, charts, pivots, quality |
| **Prompts** | ✅ Complete | 6 workflows | Guided operations |
| **Logging** | ✅ Complete | Dynamic levels | MCP-native `logging/setLevel` |
| **Completions** | ✅ Complete | Argument completion | Prompt/resource argument hints |
| **Tasks** | ✅ Complete | Background execution | Task cancellation (SEP-1686) |
| **Elicitation** | ✅ Complete | User confirmations | `sheets_confirm` tool (SEP-1036) |
| **Sampling** | ✅ Complete | AI analysis | `sheets_analyze` tool (SEP-1577) |
| **Progress** | ✅ Complete | Progress notifications | Real-time progress events |

### Transport Support

**1. STDIO Transport**
- Default for Claude Desktop
- Standard input/output communication
- JSON-RPC messages
- Request/response model

**2. HTTP/SSE Transport**
- Express-based HTTP server
- Server-Sent Events for streaming
- OAuth 2.1 authentication
- CORS, security headers

**3. Streamable HTTP Transport**
- For Claude Connectors Directory
- Chunked transfer encoding
- Progress streaming
- Long-running operation support

### MCP-Native Tools

**sheets_confirm** (Elicitation - SEP-1036)
- `request` - Present operation plan to user
- `get_stats` - Confirmation statistics

Example:
```typescript
// Present operation plan for confirmation
const confirmation = await sheets_confirm({
  action: 'request',
  operation: {
    type: 'bulk_delete',
    description: 'Delete 1000 rows from Sales sheet',
    impact: { rowsAffected: 1000, cellsAffected: 50000 },
    riskLevel: 'high'
  }
});

// User approves/rejects via Claude UI
// Returns: { confirmed: true/false, reason?: string }
```

**sheets_analyze** (Sampling - SEP-1577)
- AI-powered analysis with intelligent sampling
- Pattern detection
- Column profiling
- Quality metrics
- Recommendations

Example:
```typescript
// AI analysis with sampling
const analysis = await sheets_analyze({
  action: 'analyze_patterns',
  spreadsheetId,
  range: { a1: 'Sales!A1:D10000' },
  analysisType: 'trends',
  samplingStrategy: 'adaptive'  // Intelligent sampling
});

// Returns AI-generated insights with sampling metadata
```

**logging/setLevel** (MCP Native)
- Dynamic log level control
- Levels: debug, info, warn, error
- Runtime configuration
- No restart required

### Request ID Propagation

All requests include a unique request ID for distributed tracing:

```typescript
{
  requestId: "req_abc123",
  timestamp: "2026-01-10T12:00:00Z",
  operation: "sheets_values",
  params: { ... }
}
```

Benefits:
- End-to-end tracing
- Error correlation
- Performance profiling
- Audit trail

---

## Testing Infrastructure

### Test Coverage Summary

**Total Tests:** 1,761+ passing tests
**Test Files:** 95 test files
**Test Suites:** 78 suites
**Coverage Thresholds:** 75% lines, 75% functions, 70% branches, 75% statements

### Test Categories

**1. Handler Tests** (30+ files)
- Complete coverage of all 26 tools
- Snapshot testing for complex outputs
- Mock Google API responses
- Error scenario testing
- Edge case validation

**2. Unit Tests** (15+ files)
- Adaptive batch windows
- Background refresh
- Cache optimization
- Request deduplication
- Circuit breaker
- Prefetch prediction

**3. Core Tests**
- Intent system
- Batch compiler
- Rate limiter
- Diff engine
- Policy enforcer
- Range resolver

**4. Service Tests**
- Google API client
- Batching system
- Prefetching system
- Transaction manager
- Conflict detector
- Impact analyzer
- Validation engine

**5. Schema Tests**
- Zod schema validation
- JSON schema generation
- Type inference
- Error messages

**6. Contract Tests**
- Schema contracts (85/85 passing)
- API compatibility
- Type safety

**7. Property Tests**
- Property-based testing with fast-check
- Fuzzing input validation
- Invariant verification

**8. Integration Tests**
- End-to-end workflows
- HTTP/2 detection
- MCP protocol compliance
- OAuth flows

**9. Security Tests**
- Authentication validation
- CORS configuration
- OAuth security
- Token encryption

**10. MCP Tests**
- Protocol compliance
- Tool registration
- Resource templates
- Prompt definitions
- Task cancellation

**11. Startup Tests**
- Initialization sequence
- Configuration validation
- Service startup

**12. Benchmark Tests**
- Handler performance
- Optimization effectiveness
- Validator speed
- Response building

### Test Configuration

**Framework:** Vitest 4.0.16

**Configuration:**
```typescript
{
  environment: 'node',
  timeout: 10000,
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov'],
    thresholds: {
      lines: 75,
      functions: 75,
      branches: 70,
      statements: 75
    }
  },
  globals: true
}
```

**Test Patterns:**
- Snapshot testing for complex outputs
- Mock implementations for Google APIs
- OAuth mock flows
- Singleton reset between tests
- MCP test harness for protocol testing
- Error scenario coverage
- Edge case validation

### Test Utilities

**Test Helpers:**
- `error-codes.ts` - Error code constants
- `input-factories.ts` - Test data factories
- `mcp-test-harness.ts` - MCP protocol testing
- `oauth-mocks.ts` - OAuth flow mocks
- `singleton-reset.ts` - Singleton cleanup

---

## Documentation Catalog

### User Documentation

**Getting Started:**
1. [QUICKSTART.md](QUICKSTART.md) - Quick start guide
2. [docs/guides/INSTALLATION_GUIDE.md](docs/guides/INSTALLATION_GUIDE.md) - Installation
3. [docs/guides/CLAUDE_DESKTOP_SETUP.md](docs/guides/CLAUDE_DESKTOP_SETUP.md) - Claude Desktop
4. [docs/guides/FIRST_TIME_USER.md](docs/guides/FIRST_TIME_USER.md) - First-time walkthrough

**Usage Guides:**
- [docs/guides/USAGE_GUIDE.md](docs/guides/USAGE_GUIDE.md) - Complete usage guide
- [docs/guides/PROMPTS_GUIDE.md](docs/guides/PROMPTS_GUIDE.md) - Effective AI prompts
- [docs/guides/OAUTH_USER_SETUP.md](docs/guides/OAUTH_USER_SETUP.md) - OAuth setup
- [docs/guides/TROUBLESHOOTING.md](docs/guides/TROUBLESHOOTING.md) - Common issues
- [docs/guides/SKILL.md](docs/guides/SKILL.md) - Claude skill integration

**Production Guides:**
- [docs/guides/DEPLOYMENT.md](docs/guides/DEPLOYMENT.md) - Production deployment
- [docs/guides/MONITORING.md](docs/guides/MONITORING.md) - Observability & monitoring
- [docs/guides/PERFORMANCE.md](docs/guides/PERFORMANCE.md) - Performance tuning
- [SECURITY.md](SECURITY.md) - Security best practices

### Operations Documentation

**Runbooks:**
- [docs/operations/backup-restore.md](docs/operations/backup-restore.md) - Backup procedures
- [docs/operations/disaster-recovery.md](docs/operations/disaster-recovery.md) - Incident response (P0-P3)
- [docs/operations/scaling.md](docs/operations/scaling.md) - Scaling strategies
- [docs/operations/migrations.md](docs/operations/migrations.md) - Version migrations
- [docs/operations/certificate-rotation.md](docs/operations/certificate-rotation.md) - TLS rotation
- [docs/operations/jwt-secret-rotation.md](docs/operations/jwt-secret-rotation.md) - JWT rotation

### Development Documentation

**Guides:**
- [docs/development/TESTING.md](docs/development/TESTING.md) - Testing guide (37KB)
- [docs/development/HANDLER_PATTERNS.md](docs/development/HANDLER_PATTERNS.md) - Handler patterns
- [docs/development/DURABLE_SCHEMA_PATTERN.md](docs/development/DURABLE_SCHEMA_PATTERN.md) - Schema design
- [docs/development/P0_IMPLEMENTATION_GUIDE.md](docs/development/P0_IMPLEMENTATION_GUIDE.md) - Priority implementations

**Architecture:**
- [docs/architecture-diagrams.md](docs/architecture-diagrams.md) - System diagrams (Mermaid)
- [docs/COMPREHENSIVE_PROJECT_ANALYSIS.md](docs/COMPREHENSIVE_PROJECT_ANALYSIS.md) - Detailed analysis
- [docs/COMPREHENSIVE_AUDIT_REPORT.md](docs/COMPREHENSIVE_AUDIT_REPORT.md) - Audit findings

### Reference Documentation

**Core References:**
- [README.md](README.md) - Main documentation
- [CHANGELOG.md](CHANGELOG.md) - Version history & release notes
- [server.json](server.json) - MCP registry metadata

**Total Documentation:** 415+ files

---

## Deployment Options

### 1. Local (Claude Desktop)

**Configuration:**
```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "npx",
      "args": ["servalsheets"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
      }
    }
  }
}
```

**Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

### 2. HTTP Server

**Start Command:**
```bash
npm run start:http
```

**Configuration:**
```bash
PORT=3000
HOST=0.0.0.0
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
JWT_SECRET=$(openssl rand -hex 32)
STATE_SECRET=$(openssl rand -hex 32)
OAUTH_CLIENT_SECRET=$(openssl rand -hex 32)
```

### 3. Docker

**Dockerfile:** Multi-stage build provided

**Features:**
- Node 22 Alpine base
- Non-root user (nodejs:1001)
- Health checks included
- Volume mounts for credentials
- Environment variable configuration

**Build & Run:**
```bash
npm run docker:build
npm run docker:run
```

**Docker Compose:**
```bash
docker-compose up -d
```

### 4. Kubernetes

**Configs Provided:**
- `deployment.yaml` - Deployment with resource limits
- `service.yaml` - ClusterIP service
- `ingress.yaml` - Ingress with TLS
- Health checks, readiness probes
- Horizontal Pod Autoscaler (HPA)
- Prometheus monitoring integration

**Deploy:**
```bash
kubectl apply -f deployment/k8s/
```

### 5. PM2 (Process Manager)

**Ecosystem Config:** `deployment/pm2/ecosystem.config.js`

**Features:**
- Multiple instances
- Load balancing
- Automatic restart
- Log management
- Cluster mode

**Start:**
```bash
pm2 start deployment/pm2/ecosystem.config.js
pm2 save
pm2 startup
```

### 6. Remote Server (OAuth Connector)

**For Claude Connectors Directory integration**

**Start Command:**
```bash
npm run start:remote
```

**Required Environment Variables:**
```bash
JWT_SECRET=<64-char-hex>
STATE_SECRET=<64-char-hex>
OAUTH_CLIENT_SECRET=<64-char-hex>
ALLOWED_REDIRECT_URIS=https://app.com/callback
NODE_ENV=production
```

---

## Configuration Management

### Environment Variables

**Required for Production (HTTP/Remote Server):**
```bash
# Secrets (generate with: openssl rand -hex 32)
JWT_SECRET=<64-char-hex>
STATE_SECRET=<64-char-hex>
OAUTH_CLIENT_SECRET=<64-char-hex>

# Security
ALLOWED_REDIRECT_URIS=https://app1.com/callback,https://app2.com/callback
NODE_ENV=production
```

**Google API Credentials:**
```bash
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_ACCESS_TOKEN=ya29.xxx
GOOGLE_TOKEN_STORE_PATH=~/.config/servalsheets/tokens.enc
ENCRYPTION_KEY=<64-char-hex>
```

**Server Configuration:**
```bash
PORT=3000
HOST=127.0.0.1
LOG_LEVEL=info
LOG_FORMAT=json
```

**Performance:**
```bash
# Caching
CACHE_ENABLED=true
CACHE_MAX_SIZE_MB=100
CACHE_TTL_MS=300000  # 5 minutes

# Rate Limiting
RATE_LIMIT_READS_PER_MINUTE=300
RATE_LIMIT_WRITES_PER_MINUTE=60

# Request Deduplication
DEDUP_ENABLED=true
DEDUP_WINDOW_MS=5000  # 5 seconds
```

**Session Storage:**
```bash
SESSION_STORE_TYPE=memory|redis
REDIS_URL=redis://localhost:6379
MAX_SESSIONS_PER_USER=5
```

**OAuth:**
```bash
OAUTH_ISSUER=https://your-server.com
OAUTH_CLIENT_ID=servalsheets
ACCESS_TOKEN_TTL=3600  # 1 hour
REFRESH_TOKEN_TTL=2592000  # 30 days
CORS_ORIGINS=https://app1.com,https://app2.com
```

**Timeouts & Circuit Breaker:**
```bash
GOOGLE_API_TIMEOUT_MS=30000
REQUEST_TIMEOUT_MS=120000
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=2
CIRCUIT_BREAKER_TIMEOUT_MS=30000
```

### Configuration Validation

All environment variables are validated using Zod schemas in `src/config/env.ts`:

- Type validation
- Required field enforcement
- Format validation (URLs, hex strings)
- Default value provision
- Error messages for invalid config

---

## Security Architecture

### Authentication Methods

**1. Service Account (Recommended for Automation)**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

**2. OAuth 2.0 Access Token**
```bash
export GOOGLE_ACCESS_TOKEN=ya29.xxx
```

**3. OAuth 2.1 Client Credentials**
```bash
export GOOGLE_CLIENT_ID=xxx
export GOOGLE_CLIENT_SECRET=xxx
```

**4. Encrypted Token Store**
```bash
export GOOGLE_TOKEN_STORE_PATH=~/.config/servalsheets/tokens.enc
export ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### OAuth 2.1 Implementation

**Features:**
- Authorization Code flow with PKCE
- State token HMAC signing (CSRF protection)
- Redirect URI allowlisting (prevents open redirect)
- JWT token signing
- Access tokens (1-hour TTL)
- Refresh tokens (30-day TTL)
- Token revocation support

**Security Measures:**
- PKCE (Proof Key for Code Exchange)
- State token validation
- Redirect URI validation
- Code challenge verification
- Incremental OAuth scopes (drive.file only)

### Security Headers

**Helmet Middleware:**
- Content Security Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (HSTS)
- X-XSS-Protection

**CORS Configuration:**
- Origin allowlisting
- Credentials support
- Method restrictions
- Header allowlisting

### Rate Limiting

**Per IP/User Limits:**
- Configurable via `express-rate-limit`
- Default: 100 requests per 15 minutes
- Custom limits per endpoint
- Redis-backed for distributed deployments

### Token Encryption

**Algorithm:** AES-256-GCM

**Features:**
- 256-bit encryption keys
- Authenticated encryption
- Initialization vector (IV) per encryption
- Authentication tag verification
- Key rotation support

### Data Security

**Payload Monitoring:**
- 2MB warning threshold
- 10MB hard limit
- Size tracking for requests/responses

**Effect Scope Limits:**
- Max 50,000 cells per operation
- Max 10,000 rows per delete
- Max 100 columns per delete

**Expected State Validation:**
- Optimistic locking via checksums
- Prevents lost updates
- Concurrent modification detection

**Dry-run Mode:**
- Preview changes before execution
- No data modification
- Impact analysis

**Auto-Snapshot:**
- Automatic backups before destructive ops
- 1-hour retention
- Rollback support

### Secrets Management

**Best Practices:**
- Never commit secrets to version control
- Use environment variables
- Rotate secrets every 90 days
- Use secrets manager in production (AWS Secrets Manager, Vault, etc.)
- Generate secrets with: `openssl rand -hex 32`

---

## Performance Optimization

### Request Optimization

**Request Deduplication:**
- 5-second window
- Hash-based duplicate detection
- Shared result promises
- Reduces redundant API calls

**Batching:**
- 50-100ms collection windows
- Cross-tool operation merging
- 20-40% API call reduction
- Adaptive window sizing

**Caching:**
- LRU cache with TTL
- 100MB max size (default)
- 5-minute TTL (default)
- Size-aware eviction

**Prefetching:**
- Pattern-based prediction
- Adjacent range prefetching
- Background refresh before expiry

### API Optimization

**Rate Limiting:**
- Token bucket algorithm
- Separate read/write quotas
- Dynamic throttling on 429 errors
- Per-request queue management

**HTTP Compression:**
- gzip middleware
- 60-80% bandwidth reduction
- Automatic for responses >1KB

**HTTP/2 Support:**
- Automatic detection
- Multiplexing benefits
- Server push (optional)

### Diff Optimization

**3-Tier System:**
- METADATA: <100ms for any size
- SAMPLE: <1s for 10,000 cells
- FULL: <5s for 1,000 cells
- Automatic tier selection

### Monitoring & Metrics

**Performance Metrics:**
- Operation duration (min/max/avg/p95/p99)
- Cache hit rates
- Deduplication rates
- API call counts
- Batch efficiency
- Queue lengths
- Memory usage
- CPU usage

**Observability:**
- Structured logging (JSON)
- Request ID tracing
- OpenTelemetry support (optional)
- Prometheus metrics

---

## Quality Metrics

### Code Quality

- **Type Safety:** Full TypeScript strict mode, 0 errors
- **Linting:** ESLint enforcement, no warnings
- **Formatting:** Prettier code style
- **Test Coverage:** 75% minimum thresholds (lines, functions, statements)
- **Dependency Scanning:** npm audit
- **Bundle Size:** Optimized for production

### Performance Benchmarks

**Handler Performance:**
- Average response time: <100ms
- P95 response time: <500ms
- P99 response time: <1s

**Optimization Effectiveness:**
- Request deduplication: 15-25% reduction
- Batching: 20-40% API call reduction
- Cache hit rate: 70-90% for read-heavy workloads
- Prefetch accuracy: 60-80%

**Resource Usage:**
- Memory: <500MB typical
- CPU: <10% idle, <50% under load
- Network: Optimized with compression

### Test Metrics

- **Total Tests:** 1,761+ passing
- **Test Coverage:** 75%+ across lines, functions, statements
- **Test Execution:** <60 seconds for full suite
- **Test Reliability:** 100% pass rate on CI/CD

### Production Readiness

- ✅ Docker containerization
- ✅ Kubernetes deployment configs
- ✅ Health checks & readiness probes
- ✅ Prometheus monitoring
- ✅ Comprehensive documentation
- ✅ Security hardening (OAuth 2.1, CORS, Helmet, rate limiting)
- ✅ Zero critical vulnerabilities
- ✅ Production secrets enforcement

---

## Development Workflow

### Getting Started

```bash
# Clone repository
git clone https://github.com/khill1269/servalsheets.git
cd servalsheets

# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck

# Run tests
npm test

# Run in development
npm run dev
```

### Development Scripts

```bash
# Build
npm run build          # Compile TypeScript

# Testing
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report

# Quality
npm run typecheck      # TypeScript type checking
npm run lint           # ESLint
npm run format         # Prettier formatting

# Validation
npm run validate:schemas   # Validate Zod schemas
npm run validate:tools     # Validate tool registry
npm run validate:metadata  # Check metadata drift

# Benchmarking
npm run benchmark:handlers     # Handler performance
npm run benchmark:validators   # Validator speed
npm run benchmark:responses    # Response building
npm run benchmark:optimizations # Optimization effectiveness

# Utilities
npm run show:metrics   # Display metrics
npm run show:tools     # Show tool schemas
```

### Code Organization

**Modular Architecture:**
- Clear separation of concerns
- Handler pattern for tools
- Service layer for external integrations
- Core infrastructure for shared logic
- Utility modules for helpers

**Type Safety:**
- Full TypeScript strict mode
- Discriminated unions for intents
- Zod schemas for validation
- No `any` types

**Testing:**
- Test-driven development (TDD)
- 100% handler coverage
- Unit, integration, property, contract tests
- Snapshot testing for complex outputs

### Version Control

**Branch Strategy:**
- `main` - Production-ready code
- `develop` - Development branch
- Feature branches: `feat/feature-name`
- Bugfix branches: `fix/bug-name`

**Commit Messages:**
- Conventional commits format
- Examples: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

### Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Run full test suite: `npm test`
4. Build: `npm run build`
5. Tag release: `git tag v1.4.0`
6. Push: `git push && git push --tags`
7. Publish to npm: `npm publish`
8. Update MCP registry metadata in `server.json`

---

## Recent Changes

### Version 1.4.0 (2026-01-10)

**Major Upgrades:**

**Zod v4 Migration:**
- Upgraded from Zod 3.25.3 → 4.3.5
- Native JSON schema generation (removed `zod-to-json-schema` dependency)
- Breaking change: `z.record()` now requires 2 arguments
- Updated 10+ schema files for compatibility

**Performance Improvements:**
- 14x faster string parsing
- 7x faster array parsing
- 6.5x faster object parsing
- 57% smaller bundle size

**open v11 Upgrade:**
- Simple major version update
- Compatible API with v10

**Test Status:**
- All 1,830+ tests passing
- 26 tools fully compatible
- 208 actions functional
- Zero type errors

**Files Updated:**
- Schema files (10+ files)
- Handler files (3 files)
- Utility files (2 files)
- Configuration files

### Version 1.3.0 (2026-01-06)

**MCP Protocol Native Refactor:**
- ✅ MCP Logging: Dynamic log level control via `logging/setLevel`
- ✅ Expanded Resources: 6 URI templates (charts, pivots, quality)
- ✅ Task Cancellation: Full AbortController support (SEP-1686)
- ✅ Request Tracing: Request ID propagation
- ✅ MCP Confirm: User confirmations via `sheets_confirm` (SEP-1036)
- ✅ MCP Analyze: AI analysis via `sheets_analyze` (SEP-1577)
- ✅ Architecture: Replaced custom planning/insights with MCP-native patterns

### Version 1.2.0 (2026-01-05)

**Advanced Analytics & AI Integration:**
- Pattern Detection: Trends, correlations, anomalies, seasonality
- Column Analysis: Deep data profiling with quality metrics
- AI-Powered Tools: Template suggestions, formula generation, chart recommendations
- Request Deduplication
- User Confirmations

### Version 1.1.0 (2026-01-03)

**Production Hardening:**
- Security: OAuth 2.1 with CSRF protection, signed state tokens, redirect URI allowlist
- Production Ready: Required secrets enforcement, deployment checklist
- Modern Stack: Express 5, Zod 4, Node 22 LTS
- Session Storage: TTL-based storage with optional Redis
- Type Safety: Zero `as any` casts, full Zod validation
- 1,761 Tests: Comprehensive coverage
- ESLint: Strict enforcement

---

## Summary

**ServalSheets** is a comprehensive, production-grade MCP server that provides:

1. **Complete Google Sheets Integration** - 26 tools covering all major spreadsheet operations
2. **Enterprise Safety Features** - Dry-run, effect scope limits, transactions, conflict detection
3. **Advanced Optimization** - Batching, caching, prefetching, request deduplication
4. **Full MCP Compliance** - Latest protocol with elicitation, sampling, logging, tasks
5. **Extensive Documentation** - 415+ files covering all aspects
6. **Robust Testing** - 1,761+ tests with comprehensive coverage
7. **Production-Ready** - Docker, Kubernetes, PM2; Prometheus monitoring
8. **Type-Safe** - Full TypeScript strict mode, Zod v4 validation
9. **Performance-Focused** - Multi-tier diff engine, adaptive batching, smart caching
10. **Well-Architected** - Intent-based design, modular handlers, clean separation

The project is actively maintained, recently upgraded to latest dependencies (Zod v4, open v11), and ready for Claude Connector Directory integration via OAuth 2.1.

---

## Quick Reference Links

**Main Documentation:**
- [README.md](README.md) - Main project documentation
- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [CHANGELOG.md](CHANGELOG.md) - Version history

**Key Guides:**
- [Installation Guide](docs/guides/INSTALLATION_GUIDE.md)
- [Usage Guide](docs/guides/USAGE_GUIDE.md)
- [Deployment Guide](docs/guides/DEPLOYMENT.md)
- [Security Policy](SECURITY.md)

**Development:**
- [Testing Guide](docs/development/TESTING.md)
- [Handler Patterns](docs/development/HANDLER_PATTERNS.md)
- [Architecture Diagrams](docs/architecture-diagrams.md)

**External Links:**
- [MCP Registry](https://registry.modelcontextprotocol.io)
- [Claude Connectors](https://claude.com/partners/mcp)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [GitHub Repository](https://github.com/khill1269/servalsheets)
- [npm Package](https://www.npmjs.com/package/servalsheets)

---

**License:** MIT
**Version:** 1.4.0
**Last Updated:** 2026-01-10
