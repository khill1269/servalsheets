# ServalSheets Documentation

## 📚 Documentation Structure

### User Guides (`./guides/`)
Documentation for end users and system administrators:

- **[QUICKSTART.md](../QUICKSTART.md)** - Quick start guide (root level for visibility)
- **[CLAUDE_DESKTOP_SETUP.md](./guides/CLAUDE_DESKTOP_SETUP.md)** - Claude Desktop integration
- **[INSTALLATION_GUIDE.md](./guides/INSTALLATION_GUIDE.md)** - Installation instructions
- **[OAUTH_USER_SETUP.md](./guides/OAUTH_USER_SETUP.md)** - OAuth authentication setup
- **[USAGE_GUIDE.md](./guides/USAGE_GUIDE.md)** - How to use ServalSheets
- **[PROMPTS_GUIDE.md](./guides/PROMPTS_GUIDE.md)** - Effective prompts for AI
- **[TROUBLESHOOTING.md](./guides/TROUBLESHOOTING.md)** - Common issues and solutions
- **[DEPLOYMENT.md](./guides/DEPLOYMENT.md)** - Production deployment guide
- **[MONITORING.md](./guides/MONITORING.md)** - Monitoring and observability
- **[PERFORMANCE.md](./guides/PERFORMANCE.md)** - Performance optimization
- **[SKILL.md](./guides/SKILL.md)** - Claude skill integration
- **[FIRST_TIME_USER.md](./guides/FIRST_TIME_USER.md)** - First-time user walkthrough

### Operations Runbooks (`./operations/`)
Production operations and maintenance procedures:

- **[backup-restore.md](./operations/backup-restore.md)** - Backup and restore procedures
  - Configuration backups, Redis snapshots, token store backups
  - Disaster recovery (RTO: 1 hour, RPO: 24 hours)
  - Automated backup scripts and GPG encryption
- **[disaster-recovery.md](./operations/disaster-recovery.md)** - Incident response runbook
  - Incident severity levels (P0-P3)
  - 5 common disaster scenarios with recovery steps
  - Escalation paths and communication plan
- **[scaling.md](./operations/scaling.md)** - Horizontal and vertical scaling
  - Docker Compose, Kubernetes, and Cloud VM scaling
  - Load balancer configuration (nginx/Kubernetes/AWS ALB)
  - Auto-scaling with HPA and AWS Auto Scaling
- **[migrations.md](./operations/migrations.md)** - Version migration guide
  - Breaking changes and compatibility matrix
  - Zero-downtime migration strategies
  - Rollback procedures
- **[certificate-rotation.md](./operations/certificate-rotation.md)** - TLS/SSL certificate rotation
  - Let's Encrypt automation with certbot
  - Commercial CA rotation procedures
  - Zero-downtime certificate updates
- **[jwt-secret-rotation.md](./operations/jwt-secret-rotation.md)** - JWT secret rotation
  - Multi-secret support for zero-downtime rotation
  - Automated and emergency rotation procedures

### Development Documentation (`./development/`)
Internal development and architecture documentation:

**Core Development Guides:**
- **[TESTING.md](./development/TESTING.md)** - Comprehensive testing guide (37KB)
- **[HANDLER_PATTERNS.md](./development/HANDLER_PATTERNS.md)** - Handler implementation patterns (19KB)
- **[DURABLE_SCHEMA_PATTERN.md](./development/DURABLE_SCHEMA_PATTERN.md)** - Schema design patterns
- **[P0_IMPLEMENTATION_GUIDE.md](./development/P0_IMPLEMENTATION_GUIDE.md)** - Priority 0 implementation

**Analysis & Planning:**
- **[ANTI_PATTERN_ANALYSIS.md](./development/ANTI_PATTERN_ANALYSIS.md)** - Anti-pattern analysis
- **[ANTP_IMPLEMENTATION_PLAN.md](./development/ANTP_IMPLEMENTATION_PLAN.md)** - Implementation plan
- **[COMPARISON_ANALYSIS.md](./development/COMPARISON_ANALYSIS.md)** - Competitive analysis
- **[INTEGRATION_ANALYSIS.md](./development/INTEGRATION_ANALYSIS.md)** - Integration analysis
- **[TOOL_ALIGNMENT_INVESTIGATION_PLAN.md](./development/TOOL_ALIGNMENT_INVESTIGATION_PLAN.md)** - Tool alignment

### Architecture & Design (`./`)
System architecture and design documentation:

- **[architecture-diagrams.md](./architecture-diagrams.md)** - **NEW** Comprehensive architecture diagrams
  - System architecture overview
  - MCP protocol flow
  - Request processing pipeline
  - Handler architecture
  - OAuth authentication flow
  - Data flow diagrams
  - Task system architecture
  - Deployment architectures (single server, load balanced, Kubernetes)
  - Error handling flow
  - Component interactions
  - All diagrams in Mermaid format for easy updates

### Examples (`./examples/`)
Complete request/response examples for all tools and workflows:

**Tool Examples (15 tools, 156+ actions):**
- **[spreadsheet-examples.json](./examples/spreadsheet-examples.json)** - Spreadsheet operations (get, create, copy, update)
- **[sheet-examples.json](./examples/sheet-examples.json)** - Sheet operations (add, delete, duplicate, update, list)
- **[values-examples.json](./examples/values-examples.json)** - Cell values (read, write, append, clear, find, replace, batch)
- **[format-examples.json](./examples/format-examples.json)** - Formatting (text format, colors, borders, number formats, presets)
- **[cells-examples.json](./examples/cells-examples.json)** - Cell features (notes, validation, hyperlinks, merge)
- **[dimensions-examples.json](./examples/dimensions-examples.json)** - Rows/columns (insert, delete, resize, freeze, group, move)
- **[rules-examples.json](./examples/rules-examples.json)** - Conditional formatting and data validation
- **[pivot-examples.json](./examples/pivot-examples.json)** - Pivot tables (create, update, calculated fields, refresh)
- **[filter-sort-examples.json](./examples/filter-sort-examples.json)** - Filtering and sorting operations
- **[sharing-examples.json](./examples/sharing-examples.json)** - Permissions and sharing (add/update/remove, link sharing, ownership)
- **[comments-examples.json](./examples/comments-examples.json)** - Comments and discussions (add, reply, resolve, list)
- **[versions-examples.json](./examples/versions-examples.json)** - Version control (revisions, snapshots, restore, compare, export)
- **[advanced-examples.json](./examples/advanced-examples.json)** - Advanced features (named ranges, protected ranges, metadata)
- **[charts-examples.json](./examples/charts-examples.json)** - Charts (create, update, move, export, delete)
- **[analysis-examples.json](./examples/analysis-examples.json)** - Data analysis (quality, formula audit, statistics, patterns)

**Workflow Examples:**
- **[oauth-flow-examples.json](./examples/oauth-flow-examples.json)** - Complete OAuth 2.1 flow with PKCE
  - 5-step authentication flow
  - Error scenarios (invalid PKCE, expired codes, state mismatch)
  - Best practices and security considerations
- **[error-handling-examples.json](./examples/error-handling-examples.json)** - Error handling patterns
  - Structured error responses
  - 6 error categories with resolution steps
  - Retry strategies and logging patterns

**Response Examples (MCP format):**
- **[response-examples/values-responses.json](./examples/response-examples/values-responses.json)** - Value reads/writes and batch responses
- **[response-examples/format-responses.json](./examples/response-examples/format-responses.json)** - Formatting responses with structured content
- **[response-examples/error-responses.json](./examples/response-examples/error-responses.json)** - Error shapes and retry metadata
- **[response-examples/charts-analysis-responses.json](./examples/response-examples/charts-analysis-responses.json)** - Chart/analysis response payloads

**Legacy Examples (Archived):**
- **[archived-response-examples/](./examples/archived-response-examples/)** - Earlier response examples (superseded by tool examples above)
  - values-responses.json, format-responses.json, error-responses.json, charts-analysis-responses.json

### Knowledge Base (`../src/knowledge/`)
AI-driven knowledge base powering smart suggestions and templates:

**API References:**
- **[api/charts.md](../src/knowledge/api/charts.md)** - Complete chart types, styling, axes configuration (30KB)
- **[api/pivot-tables.md](../src/knowledge/api/pivot-tables.md)** - Pivot table creation, grouping, aggregations (21KB)
- **[api/conditional-formatting.md](../src/knowledge/api/conditional-formatting.md)** - Boolean conditions, gradients, custom formulas (25KB)
- **[api/data-validation.md](../src/knowledge/api/data-validation.md)** - 25+ validation types, form patterns, dropdowns (21KB)
- **[api/batch-operations.md](../src/knowledge/api/batch-operations.md)** - Request batching, optimization, error handling (21KB)
- **[api/named-ranges.md](../src/knowledge/api/named-ranges.md)** - Named ranges, protection, permissions (17KB)

**Formula References:**
- **[formulas/functions-reference.md](../src/knowledge/formulas/functions-reference.md)** - 100+ formula functions with examples (16KB)
  - Categories: Lookup & Reference, Text, Math & Statistics, Date & Time, Logical, Array, Financial, Data Manipulation, Error Handling
- **[formulas/financial.json](../src/knowledge/formulas/financial.json)** - 12 essential financial calculations
- **[formulas/lookup.json](../src/knowledge/formulas/lookup.json)** - 8 lookup and reference patterns
- **[formulas/key-formulas.json](../src/knowledge/formulas/key-formulas.json)** - Key formula patterns

**Templates:**
- **[templates/common-templates.json](../src/knowledge/templates/common-templates.json)** - Pre-built spreadsheet templates
  - Financial models, budget trackers, project trackers, sales pipelines, inventory management, employee directories, campaign trackers

**Knowledge Base Documentation:**
- **[README.md](../src/knowledge/README.md)** - Complete knowledge base overview and AI integration guide

### Release Notes & History (`./releases/`)
Version history and development tracking:

- **[RELEASE_NOTES_v1.1.1.md](./releases/RELEASE_NOTES_v1.1.1.md)** - Current release notes (v1.1.1)
  - Comprehensive feature overview
  - Breaking changes and migration guide
  - Performance impact and testing verification
- **[archive/](./releases/archive/)** - Historical phase completion reports
  - Phase 1-8 completion reports
  - Production readiness reports
  - Security fix summaries
  - Quick wins implementation notes

### Development History & Planning (`./`)
Project development chronicles and future roadmap:

- **[DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md)** - **NEW** Complete development history
  - Version history (v1.1.0 → v1.1.1)
  - Phase 1: Critical Security Fixes
  - Phase 2: Infrastructure & Type Safety
  - Phase 3: Configuration & Standards
  - Phase 4: Performance Optimization
  - Phase 5-7: Production Readiness
  - Phase 8: Final Production Deployment
  - Quick Wins & AI-Native Features
  - Production Security Audit (35 issues resolved)
  - Lessons learned and best practices

- **[ENHANCEMENT_PLAN.md](./ENHANCEMENT_PLAN.md)** - **NEW** Future enhancement roadmap
  - Comprehensive audit findings (10 high-impact opportunities)
  - Documentation vs implementation gap analysis
  - AI integration enhancements (templates, formulas, charts)
  - MCP protocol feature completion
  - Performance and consistency improvements
  - 4-phase implementation roadmap (28-36 hours)

## 🚀 Quick Navigation

### For New Users
1. **Start Here:** [QUICKSTART.md](../QUICKSTART.md) - Get up and running in 5 minutes
2. **Setup:** [CLAUDE_DESKTOP_SETUP.md](./guides/CLAUDE_DESKTOP_SETUP.md) - Configure Claude Desktop
3. **Learn:** [USAGE_GUIDE.md](./guides/USAGE_GUIDE.md) - Master ServalSheets
4. **Examples:** [examples/](./examples/) - See 15+ tools in action with complete request/response pairs

### For Developers
1. **Overview:** [README.md](../README.md) - Project overview and architecture
2. **Testing:** [development/TESTING.md](./development/TESTING.md) - Comprehensive testing guide
3. **Architecture:** [architecture-diagrams.md](./architecture-diagrams.md) - System design and flow diagrams
4. **Patterns:** [development/HANDLER_PATTERNS.md](./development/HANDLER_PATTERNS.md) - Implementation patterns
5. **History:** [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md) - Development journey and lessons learned
6. **Roadmap:** [ENHANCEMENT_PLAN.md](./ENHANCEMENT_PLAN.md) - Future enhancements and implementation plan

### For Production Deployment
1. **Deploy:** [DEPLOYMENT.md](./guides/DEPLOYMENT.md) - Production deployment guide
2. **Operations:** [operations/](./operations/) - 6 comprehensive operational runbooks
   - Backup/restore, disaster recovery, scaling, migrations, certificates, JWT rotation
3. **Monitor:** [MONITORING.md](./guides/MONITORING.md) - Observability and metrics
4. **Secure:** [SECURITY.md](../SECURITY.md) - Security best practices
5. **Troubleshoot:** [TROUBLESHOOTING.md](./guides/TROUBLESHOOTING.md) - Issue resolution

### For System Administrators
1. **Backup:** [operations/backup-restore.md](./operations/backup-restore.md) - Backup procedures and disaster recovery
2. **Scale:** [operations/scaling.md](./operations/scaling.md) - Horizontal and vertical scaling strategies
3. **Migrate:** [operations/migrations.md](./operations/migrations.md) - Zero-downtime version migrations
4. **Certificates:** [operations/certificate-rotation.md](./operations/certificate-rotation.md) - TLS certificate management
5. **Incident Response:** [operations/disaster-recovery.md](./operations/disaster-recovery.md) - P0-P3 incident handling

## 📝 Other Important Files

**Root Level Documentation:**
- **[README.md](../README.md)** - Project overview, features, quick start
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history (Keep a Changelog format)
- **[SECURITY.md](../SECURITY.md)** - Security policy and vulnerability reporting
- **[LICENSE](../LICENSE)** - MIT License

## 🔧 Configuration Examples

**Environment Configuration:**
- **[.env.example](../.env.example)** - Complete environment variable reference
  - Required vs optional variables
  - Production security requirements
  - OAuth configuration
  - Session/task storage (Redis)
  - Rate limiting and performance tuning
- **[.env.oauth.example](../.env.oauth.example)** - OAuth-specific configuration

**Claude Desktop Integration:**
- **[claude_desktop_config.example.json](../claude_desktop_config.example.json)** - Basic configuration
- **[claude_desktop_config_examples.json](../claude_desktop_config_examples.json)** - Advanced configurations
  - HTTP transport vs stdio
  - OAuth authentication
  - Custom environment variables
  - Multiple server configurations

## 📊 Documentation Highlights

### Comprehensive Tool Examples
All 15 tools have complete request/response examples with:
- ✅ Success scenarios with real data
- ✅ Error scenarios with resolution steps
- ✅ Edge cases and validation examples
- ✅ Dry-run and preview modes
- ✅ Task-based async operations

### Production-Ready Operations
6 detailed runbooks covering:
- ✅ Backup/restore with GPG encryption
- ✅ Disaster recovery (RTO: 1hr, RPO: 24hr)
- ✅ Horizontal scaling with Redis and load balancers
- ✅ Zero-downtime migrations and rollbacks
- ✅ Automated certificate rotation
- ✅ JWT secret rotation without downtime

### Architecture Documentation
11 comprehensive diagrams covering:
- ✅ System architecture and component interactions
- ✅ MCP protocol flow and request processing
- ✅ OAuth 2.1 authentication with PKCE
- ✅ Data flow and handler architecture
- ✅ Task system and async operations
- ✅ Deployment topologies (single server, load balanced, Kubernetes)
- ✅ Error handling and recovery flows

### Development History
Complete chronicle of 8 development phases:
- ✅ Critical security fixes (OAuth hardening, secrets management)
- ✅ Infrastructure improvements (session storage, type safety)
- ✅ Performance optimization (84% improvement)
- ✅ Production readiness (observability, error handling, testing)
- ✅ Security audit resolution (35/35 issues fixed)
- ✅ Lessons learned and best practices

## 🔍 Finding What You Need

### By Task
- **First-time setup:** [QUICKSTART.md](../QUICKSTART.md)
- **Tool usage:** [examples/](./examples/) + [USAGE_GUIDE.md](./guides/USAGE_GUIDE.md)
- **Production deploy:** [DEPLOYMENT.md](./guides/DEPLOYMENT.md) + [operations/](./operations/)
- **Troubleshooting:** [TROUBLESHOOTING.md](./guides/TROUBLESHOOTING.md) + [examples/error-handling-examples.json](./examples/error-handling-examples.json)
- **Architecture understanding:** [architecture-diagrams.md](./architecture-diagrams.md)
- **Contributing:** [development/](./development/) + [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md)

### By Role
- **End User:** guides/ + examples/ + QUICKSTART
- **Developer:** development/ + architecture-diagrams + DEVELOPMENT_LOG
- **DevOps/SRE:** operations/ + DEPLOYMENT + MONITORING
- **Security Auditor:** SECURITY + operations/ + DEVELOPMENT_LOG (Phase 1)

### By Phase
- **Evaluation:** README + QUICKSTART + examples/
- **Development:** development/ + architecture-diagrams
- **Testing:** development/TESTING + examples/
- **Deployment:** DEPLOYMENT + operations/
- **Operations:** operations/ + MONITORING + TROUBLESHOOTING

---

**Documentation Version:** 2.2 (Updated 2026-01-04)
**Total Files:** 100+ documentation files
**Examples:** 21 example files (17 tool/workflow + 4 response examples)
**Runbooks:** 6 production-ready operational runbooks
**Diagrams:** 11 architecture diagrams in Mermaid format
**Knowledge Base:** 6 API references + 100+ formula functions + templates
**Enhancement Plan:** 10 high-impact opportunities identified (28-36 hour roadmap)
**Status:** ✅ Production-grade documentation complete + Future roadmap ready
