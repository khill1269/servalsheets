# MCP Best Practices - Quick Reference Checklist

Use this checklist when building and reviewing MCP servers to ensure compliance with best practices.

---

## Design & Architecture

### Tool Design
- [ ] Each tool has a single, clear purpose (one user intent)
- [ ] Tool designed around workflows, not individual API endpoints
- [ ] Combine multiple internal API calls into single high-level tools
- [ ] Tool name follows snake_case convention
- [ ] Tool name is 1-128 characters, descriptive, no abbreviations
- [ ] Tool description is clear and helpful to LLMs (treated as prompt)
- [ ] Tool examples provided in documentation if complex

### Parameter Design
- [ ] Input schema is as flat as possible (avoid deep nesting)
- [ ] Each parameter has clear description
- [ ] Parameter types are explicitly defined (string, integer, boolean, array)
- [ ] Constraints documented (min, max, length, format)
- [ ] Enums used instead of free-form strings where possible
- [ ] Required vs optional parameters clearly distinguished
- [ ] Default values provided where appropriate
- [ ] No deeply nested objects (use discriminated unions if needed)

### Response Design
- [ ] Responses are formatted consistently
- [ ] Error responses use `isError: true` flag
- [ ] Output size is managed (no context overflow)
- [ ] Large results support pagination
- [ ] Sensitive data never in responses (logs separately)

### Server Architecture
- [ ] Server has single, well-defined purpose
- [ ] Stateless design (or state externalized)
- [ ] Designed for horizontal scaling
- [ ] Zero-downtime deployment considered
- [ ] Appropriate transport chosen (stdio for local, Streamable HTTP for remote)

---

## Error Handling

### Protocol-Level Errors
- [ ] Malformed requests return appropriate JSON-RPC errors
- [ ] Invalid methods return `method not found`
- [ ] Invalid parameters return `invalid params`
- [ ] Parse errors return `parse error`

### Application-Level Errors
- [ ] All exceptions caught and converted to `isError: true` responses
- [ ] Error messages are user-friendly and actionable
- [ ] Error messages don't expose sensitive information
- [ ] Authentication failures never reveal reason for failure
- [ ] Errors are classified (CLIENT_ERROR, SERVER_ERROR, EXTERNAL_ERROR)

### Error Classification
- [ ] Input validation errors return clear messages
- [ ] Timeout errors handled gracefully
- [ ] External service failures distinguished from internal errors
- [ ] Rate limiting errors include retry-after information
- [ ] Circuit breaker implemented for external dependencies

---

## Security

### Input Validation
- [ ] All user inputs validated against schema
- [ ] File paths validated to prevent directory traversal
- [ ] SQL queries validated (SELECT-only for read tools)
- [ ] Enums enforced (no arbitrary values accepted)
- [ ] Length/size limits enforced
- [ ] Data type validation at runtime

### File Operations
- [ ] File type allowlisting in place (whitelist, not blacklist)
- [ ] Path normalization and resolution done correctly
- [ ] Symlinks resolved to prevent escape
- [ ] Paths resolved relative to allowed root directory
- [ ] File size limits enforced
- [ ] Directory traversal attacks prevented

### Authentication & Authorization
- [ ] OAuth 2.1 used for remote authentication
- [ ] Sensitive credentials stored in platform keyring
- [ ] Tokens have expiration dates
- [ ] Token rotation implemented
- [ ] Scope-based access control enforced
- [ ] Insufficient scope returns 403 with WWW-Authenticate header
- [ ] STDIO transport uses environment variables for auth
- [ ] HTTP transport serves auth endpoints over HTTPS

### Data Protection
- [ ] No API keys in logs or error messages
- [ ] No passwords in logs or error messages
- [ ] No PII in logs or responses
- [ ] Sensitive request/response bodies not logged in full
- [ ] Secrets stored in environment variables, not files
- [ ] Database credentials externalized

### Rate Limiting & Resilience
- [ ] Rate limiting implemented for expensive operations
- [ ] Circuit breaker pattern for external services
- [ ] Gradual backoff for retries
- [ ] Timeout protection for all external calls
- [ ] Connection pooling for database connections
- [ ] Resource limits enforced (max output size, etc.)

---

## Performance

### Caching
- [ ] Caching strategy defined (what, when, how long)
- [ ] Read operations cached, write operations not
- [ ] Cache TTL appropriate for data volatility
- [ ] Cache invalidation strategy documented
- [ ] Stale data acceptable or rejected based on requirements
- [ ] Cache key generation prevents collisions
- [ ] Resource usage of cache monitored

### Optimization
- [ ] Output size managed (byte/token count checked)
- [ ] Streaming used for large responses
- [ ] Pagination implemented for result sets
- [ ] Database queries optimized (indexes, etc.)
- [ ] N+1 query problems prevented
- [ ] Connection reuse for external services
- [ ] Unnecessary allocations avoided

### Transport
- [ ] Appropriate transport selected for deployment model
- [ ] STDIO for local, Streamable HTTP for remote
- [ ] HTTP/SSE transport properly configured
- [ ] Keep-alive enabled where appropriate
- [ ] Timeouts set appropriately

---

## Logging & Observability

### Structured Logging
- [ ] All events logged in JSON format
- [ ] Correlation IDs included in every log entry
- [ ] Timestamps in ISO 8601 format
- [ ] Log levels used correctly (INFO, WARN, ERROR)
- [ ] Sensitive data excluded from logs
- [ ] Tool name, user, and action included in logs
- [ ] Duration/latency tracked for operations

### Metrics & Monitoring
- [ ] Success/failure rates tracked
- [ ] Latency distribution monitored
- [ ] Error types categorized and counted
- [ ] Resource usage monitored (memory, CPU, connections)
- [ ] Tool call frequency tracked
- [ ] Cache hit rates measured
- [ ] External service dependency health tracked

### Alerting
- [ ] High error rate triggers alerts
- [ ] Performance degradation triggers alerts
- [ ] Security events trigger alerts
- [ ] Integration with incident management system
- [ ] Alert includes context (logs, traces, reproducible data)
- [ ] On-call rotation documented
- [ ] Alert severity levels defined

### Logging Best Practices
- [ ] Logs are retrievable outside the session
- [ ] Logs can be aggregated by session, user, tool, error type
- [ ] Logs can be correlated across multiple services
- [ ] Logs include abundant metadata
- [ ] Log retention policy defined
- [ ] Log access control implemented

---

## Testing & Debugging

### Testing
- [ ] Unit tests for tools with complex logic
- [ ] Integration tests for external dependencies
- [ ] Error path testing (negative cases)
- [ ] Schema validation testing
- [ ] Input validation testing
- [ ] Performance testing for expensive operations
- [ ] Security testing (path traversal, SQL injection, etc.)

### Debugging
- [ ] MCP Inspector configured and working
- [ ] Debug logging can be enabled (MCP_DEBUG=true)
- [ ] Error messages include actionable information
- [ ] Request/response logging available
- [ ] Trace IDs propagated for debugging
- [ ] Test fixtures and example data available

### Documentation
- [ ] Tool purpose and use cases documented
- [ ] Parameter documentation complete with examples
- [ ] Error codes documented
- [ ] Authentication requirements documented
- [ ] Rate limiting documented
- [ ] Resource requirements documented
- [ ] Examples provided for complex tools

---

## Configuration & Deployment

### Configuration Management
- [ ] All configuration externalized
- [ ] Sensitive config in environment variables
- [ ] Non-sensitive config in files (with defaults)
- [ ] Environment-specific overrides supported
- [ ] Config validation on startup
- [ ] Defaults are safe (least privilege)

### Production Readiness
- [ ] Health check endpoint available
- [ ] Graceful shutdown handling
- [ ] Startup checks pass
- [ ] Error handling comprehensive
- [ ] Timeouts set appropriately
- [ ] Resource limits enforced
- [ ] Monitoring active before production

### Deployment
- [ ] CI/CD pipeline in place
- [ ] Automated tests run on every commit
- [ ] Code review required before deployment
- [ ] Rollback plan documented
- [ ] Database migrations handled
- [ ] Zero-downtime deployment possible
- [ ] Deployment checklist documented

---

## Code Quality

### Implementation
- [ ] Code is well-organized and readable
- [ ] Functions are small and focused
- [ ] No hardcoded values or secrets
- [ ] Type safety utilized (TypeScript types, Python type hints)
- [ ] Constants defined at module level
- [ ] Error messages helpful to LLMs
- [ ] Code follows project conventions

### Dependencies
- [ ] Minimal dependencies used
- [ ] Dependencies kept up to date
- [ ] Security vulnerabilities scanned regularly
- [ ] License compliance checked
- [ ] Unnecessary dependencies removed
- [ ] Version pinning used appropriately

### Documentation
- [ ] README.md included
- [ ] Installation instructions clear
- [ ] Configuration documented
- [ ] Tool descriptions complete
- [ ] Examples provided
- [ ] Troubleshooting guide included
- [ ] API reference available

---

## Specific Tool Types

### Database Query Tools
- [ ] SQL injection prevented (parameterized queries)
- [ ] SELECT-only enforcement
- [ ] Query timeout protection
- [ ] Result size limits
- [ ] Connection pooling used
- [ ] Slow queries logged
- [ ] Query plans analyzed

### File Operation Tools
- [ ] Path validation prevents traversal
- [ ] File type allowlisting
- [ ] Size limits enforced
- [ ] Recursive operations limited
- [ ] Permissions checked
- [ ] Symlinks handled safely
- [ ] Atomic operations where possible

### API Integration Tools
- [ ] API authentication secure
- [ ] Rate limiting respected
- [ ] Retries with backoff
- [ ] Timeouts enforced
- [ ] Error responses mapped
- [ ] API schema documented
- [ ] Mock data for testing

### Async/Long-Running Tools
- [ ] Task tracking implemented
- [ ] Progress updates available
- [ ] Cancellation supported
- [ ] Results persisted
- [ ] Cleanup on failure
- [ ] Timeout prevents orphaned tasks

---

## Enterprise Considerations

### Scalability
- [ ] Horizontal scaling possible
- [ ] Load balancing configured
- [ ] Database scaling strategy
- [ ] Cache distribution strategy
- [ ] Connection pool sizing

### Multi-Tenancy (if applicable)
- [ ] Tenant isolation enforced
- [ ] Data segregation verified
- [ ] Quota enforcement per tenant
- [ ] Rate limiting per tenant
- [ ] Audit trails per tenant

### Compliance
- [ ] Data retention policy enforced
- [ ] GDPR compliance (if applicable)
- [ ] SOC 2 requirements met
- [ ] Encryption at rest (if sensitive data)
- [ ] Encryption in transit (TLS)
- [ ] Audit logging comprehensive

### Disaster Recovery
- [ ] Backup strategy documented
- [ ] Recovery time objective (RTO) defined
- [ ] Recovery point objective (RPO) defined
- [ ] Failover mechanisms tested
- [ ] Data consistency verified after recovery

---

## Maintenance

### Monitoring
- [ ] Health checks configured
- [ ] Key metrics dashboarded
- [ ] Alerts configured for anomalies
- [ ] On-call rotation established
- [ ] Runbooks documented

### Updates & Patches
- [ ] Security patches applied promptly
- [ ] Dependency updates tested before deployment
- [ ] Breaking changes managed
- [ ] Deprecation warnings documented

### Issue Tracking
- [ ] Issues documented and tracked
- [ ] Bug reports include reproduction steps
- [ ] Feature requests tracked separately
- [ ] Priority levels assigned
- [ ] Sprint planning done regularly

---

## Performance Benchmarking

### Baseline Metrics
- [ ] Latency (p50, p95, p99) established
- [ ] Throughput measured
- [ ] Resource usage profiled
- [ ] Error rates baseline
- [ ] Cache hit rates measured

### Regression Testing
- [ ] Performance regressions detected
- [ ] Benchmarks run before/after changes
- [ ] Results compared automatically
- [ ] Alerts triggered on degradation

---

## Quick Score Calculation

Count items checked in each section:

| Section | Total Items | Checked | Score |
|---------|-----------|---------|-------|
| Design & Architecture | 20 | ___ | __% |
| Error Handling | 17 | ___ | __% |
| Security | 34 | ___ | __% |
| Performance | 13 | ___ | __% |
| Logging & Observability | 19 | ___ | __% |
| Testing & Debugging | 14 | ___ | __% |
| Configuration & Deployment | 18 | ___ | __% |
| Code Quality | 16 | ___ | __% |
| **TOTAL** | **151** | **___** | **__%** |

**Scoring Guidelines:**
- 80-100%: Production-Ready
- 60-79%: Review and Improve
- 40-59%: Significant Work Needed
- 0-39%: Development Phase

---

## Quick Reference by Use Case

### Building a Simple Tool
Must-haves:
1. ✓ Single purpose with clear name
2. ✓ Schema with flat properties
3. ✓ Error handling with isError
4. ✓ Input validation
5. ✓ Structured logging

### Enterprise Production Server
Must-haves:
1. ✓ Comprehensive security (auth, validation, rate limiting)
2. ✓ Caching strategy
3. ✓ Structured observability (logging, metrics, alerts)
4. ✓ Configuration management
5. ✓ Testing & monitoring
6. ✓ Disaster recovery plan
7. ✓ Incident response procedure

### Public/Community Server
Must-haves:
1. ✓ Excellent documentation
2. ✓ Clear examples
3. ✓ Version compatibility promise
4. ✓ Security best practices
5. ✓ Community feedback mechanism
6. ✓ Maintenance commitment

---

## Common Pitfalls to Avoid

- ❌ Creating too many fine-grained tools (instead: workflow-oriented)
- ❌ Deeply nested parameter schemas (instead: flat structures)
- ❌ Exposing raw API endpoints directly (instead: abstract to user intent)
- ❌ No error handling (instead: comprehensive isError responses)
- ❌ Secrets in logs (instead: sanitize all logs)
- ❌ No path validation (instead: strict validation prevents traversal)
- ❌ Direct authentication at tool level (instead: server-level auth)
- ❌ No caching strategy (instead: plan for reads vs writes)
- ❌ Missing timeout protection (instead: set on all external calls)
- ❌ Inadequate testing (instead: test error paths too)
- ❌ Poor documentation (instead: treat descriptions as LLM prompts)
- ❌ No observability (instead: structured logging from the start)

---

## Additional Resources

- **Official Specification**: https://modelcontextprotocol.io/specification/2025-11-25
- **MCP Inspector**: https://modelcontextprotocol.io/docs/tools/inspector
- **TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **Python SDK**: https://github.com/modelcontextprotocol/python-sdk
- **Reference Servers**: https://github.com/modelcontextprotocol/servers
- **FastMCP Framework**: https://gofastmcp.com/
- **Block's Playbook**: https://engineering.block.xyz/blog/blocks-playbook-for-designing-mcp-servers

---

**Version**: 1.0
**Last Updated**: February 2025
**MCP Spec Version**: November 2025
