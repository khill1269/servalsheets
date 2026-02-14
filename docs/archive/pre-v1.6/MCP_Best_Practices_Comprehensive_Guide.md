# Comprehensive MCP (Model Context Protocol) Best Practices Guide

## Executive Summary

This guide consolidates official MCP specifications, design principles, and best practices from Anthropic's Model Context Protocol documentation, community implementations, and production deployments. MCP is an open protocol that enables seamless integration between LLM applications and external data sources/tools while maintaining security and performance standards.

---

## 1. Official MCP Specification and Design Principles

### Core Design Philosophy

The MCP protocol is built around solving the **"AI Integration Paradox"**—how to give AI systems rich, secure access to external resources without creating security nightmares or integration complexity.

**Key Design Principles:**
- **AI-First Design**: Dynamic resource discovery where AI doesn't know what it needs until it needs it
- **Rich Context Exchange**: Not just data, but metadata, relationships, and capabilities
- **Secure Sandboxing**: AI can't be trusted with direct system access
- **Bidirectional Communication**: AI needs to ask questions, not just consume data
- **Transport Agnostic**: Works over stdio, Server-Sent Events (SSE), or Streamable HTTP

### November 2025 Specification Highlights

The latest MCP specification represents a significant evolution:

#### Tasks Primitive
Tasks provide a new abstraction for tracking work performed by an MCP server. Any request can be augmented with a task that allows clients to:
- Query task status
- Retrieve results up to a server-defined duration after task creation
- Track long-running, asynchronous operations

#### Enhanced Authorization (OAuth 2.1)
- Protected Resource Metadata discovery
- OpenID Connect for authorization server resolution
- Incremental scope negotiation (permissions granted only when needed)
- Zero trust principles alignment
- Reduces privilege bloat compared to single approval workflows

#### Extensions System
Extensions operate outside the core specification, providing:
- Flexible, scenario-specific additions following MCP conventions
- Experimentation capability without full protocol integration
- Focused, stable core with specialized use case support

### Community Philosophy
- **Pragmatic & Use-Case Oriented**: Focus on not overcomplicating the specification
- **Design by Need, Not Ahead of Time**: Solutions emerge from real-world requirements

---

## 2. Tool Design Best Practices

### 2.1 Fundamental Principles

**One Tool Per User Intent**
- Each tool should map to what users/agents actually want to do
- Example: `list_tasks`, `update_task` (not `GET /user`, `GET /file`)
- Tools handle entire workflows instead of exposing individual API operations

**Design Top-Down from Workflows**
- Start with the workflow that needs automation
- Work backwards to define tools supporting that flow with minimal steps
- Combine multiple internal API calls into single high-level tools

**Agent-Centric Design**
- Remember: agents/LLMs use the tool, not end users
- Tool names, descriptions, and parameters are prompts for the LLM—get them right!
- Error handling should help agents decide what to do next, not just flag what went wrong

### 2.2 Naming Conventions

**Requirements:**
- Length: 1-128 characters (inclusive)
- Style: snake_case preferred (GPT-4o tokenization understands this best)
- Clarity: No abbreviations or ambiguous terms
- Uniqueness: Must be unique within the server

**Recommended Examples:**
```
list_tasks              # Clear action + entity
create_project         # User intent focused
search_knowledge_base  # Domain-specific, descriptive
```

### 2.3 Parameter Design Best Practices

**Schema Principles:**
- **Keep Schemas Flat**: Avoid deeply nested structures
  - Reduces token count and cognitive load for LLMs
  - Decreases latency and parsing errors

**Type Definition:**
- Specify type for each parameter: string, integer, boolean, array, object
- Use JSON Schema standard for inputSchema

**Required vs Optional:**
- Distinguish carefully in the `required` field (array of property names)
- Required parameters signal to the model to prioritize finding/generating values
- Optional parameters reduce "hallucination" of unnecessary values

**Enum Values:**
- Use enums when possible to restrict parameter values
- Example: `status: {type: "string", enum: ["pending", "completed", "failed"]}`
- Helps prevent LLM generating invalid values

**Example Tool Schema:**
```json
{
  "name": "execute_query",
  "description": "Execute a database query and return results",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "SQL query to execute"
      },
      "limit": {
        "type": "integer",
        "description": "Maximum results to return",
        "default": 100
      },
      "timeout": {
        "type": "integer",
        "description": "Query timeout in seconds",
        "default": 30
      }
    },
    "required": ["query"]
  }
}
```

### 2.4 Response Design

**Output Management:**
- Implement checks inside tools to guard against output overflows
- Check byte size, character count, or estimate token count before returning
- Prevent context window exhaustion from verbose responses

**Pagination for Large Results:**
- Return results in chunks with continuation tokens
- Example: Handle directories with thousands of files efficiently
- Allows progressive disclosure of data

---

## 3. Error Handling Patterns

### 3.1 Three-Tier Error Model

MCP servers operate on a three-tier error model:

**Transport-Level Errors**
- Occur during connection establishment or data transmission
- Examples: network timeouts, broken pipes, authentication failures
- Handled by transport layer (stdio, HTTP, SSE) before MCP protocol engagement

**Protocol-Level Errors**
- JSON-RPC 2.0 violations
- Malformed JSON, non-existent methods, invalid parameters
- Server responds with standardized error codes
- Examples: parse error, invalid request, method not found

**Application-Level Errors**
- Occur within tool implementations
- Use structured error responses with `isError` flag
- Return meaningful messages to guide LLM decision-making

### 3.2 Structured Error Responses Pattern

**Core Pattern - isError Flag:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Failed to fetch data: API key invalid"
      }
    ],
    "isError": true
  }
}
```

**Key Characteristics:**
- Protocol returns success HTTP 200 (request processed correctly)
- Application layer uses `isError: true` to signal tool failure
- Separates protocol errors from application errors
- LLM can see and potentially handle the error
- Prevents server crashes from cascading

**Implementation Pattern (TypeScript):**
```typescript
try {
  // Tool logic
  const result = await executeOperation(params);
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    isError: false
  };
} catch (error) {
  return {
    content: [{ type: "text", text: `Error: ${error.message}` }],
    isError: true
  };
}
```

### 3.3 Error Classification

**Error Categories:**
- **CLIENT_ERROR (4xx)**: Invalid input, missing parameters, permission denied
- **SERVER_ERROR (5xx)**: Internal errors, service unavailable
- **EXTERNAL_ERROR (502/503)**: Upstream service failures

### 3.4 Security in Error Handling

**Never Expose Why Authentication Failed:**
- Generic message: "Authentication failed"
- NOT: "User not found" (reveals valid usernames)
- NOT: "Invalid password" (reveals valid accounts)

**Sensitive Data Protection:**
- Never include sensitive info in error messages (API keys, tokens, PII)
- Log detailed errors internally for debugging
- Return sanitized messages to clients

---

## 4. Schema and Type Definition Best Practices

### 4.1 JSON Schema Standards

**Leverage JSON Schema Features:**
- Standard format for defining tool inputSchemas
- Full validation support for LLM safety
- Clear type definitions prevent invalid parameter passing

**Schema Metadata:**
```json
{
  "type": "object",
  "title": "Query Tool",
  "description": "Execute database queries",
  "properties": {
    "sql": {
      "type": "string",
      "description": "SQL query (SELECT only)",
      "minLength": 1,
      "maxLength": 10000
    },
    "timeout": {
      "type": "integer",
      "minimum": 1,
      "maximum": 300,
      "default": 30
    }
  },
  "required": ["sql"],
  "additionalProperties": false
}
```

### 4.2 Using Pydantic Models (Python)

**Benefits:**
- Type safety with runtime validation
- Automatic JSON Schema generation
- Support for field descriptions
- Clean, readable code

**Example:**
```python
from pydantic import BaseModel, Field

class QueryParams(BaseModel):
    sql: str = Field(..., description="SQL query", max_length=10000)
    timeout: int = Field(default=30, ge=1, le=300)
    format: str = Field(default="json", enum=["json", "csv"])

@mcp.tool
async def execute_query(params: QueryParams):
    """Execute a database query"""
    # Pydantic automatically validates and generates schema
```

### 4.3 Discriminated Unions

**Pattern for Complex Types:**
```json
{
  "type": "object",
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "type": { "const": "file" },
        "path": { "type": "string" }
      },
      "required": ["type", "path"]
    },
    {
      "type": "object",
      "properties": {
        "type": { "const": "url" },
        "url": { "type": "string" }
      },
      "required": ["type", "url"]
    }
  ]
}
```

### 4.4 Type Documentation

**Clear Descriptions:**
- Write descriptions for every parameter
- Include constraints (min, max, allowed values)
- Provide examples when helpful
- Document edge cases and limitations

---

## 5. Authentication and Authorization Patterns

### 5.1 OAuth 2.0 Best Practices

**Recommended Flow:**
- **Authorization Code Grant**: Preferred for all authentication scenarios
- More secure than direct credential entry or legacy API keys

**Token Management:**
- Store sensitive credentials in platform-provided keyring/credential manager
  - macOS: Keychain (native)
  - Windows: Credential Locker
  - Python: `keyring` library
  - Never store in plaintext files

**Token Lifecycle:**
- Enforce token expiration
- Implement token rotation policies
- Refresh tokens before expiration
- Revoke tokens on logout/deauth

### 5.2 Scope-Based Access Control

**Principle of Least Privilege:**
- Request only scopes necessary for intended operations
- Avoid over-privileging at install time

**Incremental Scope Negotiation:**
- Grant permissions only when workflow requires them
- Separate approval steps for different scope levels
- Aligns with zero trust principles

### 5.3 HTTP Status Codes for Authorization

**403 Forbidden - Insufficient Scope:**
```http
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer realm="api", scope="admin:write", error="insufficient_scope"

{
  "error": "insufficient_scope",
  "message": "This operation requires admin:write scope"
}
```

### 5.4 Deployment Options

**Option 1: Embedded Authentication**
- MCP server acts as both Resource Server and Identity Provider
- Handles login, consent, token issuance
- Simpler deployment, full control
- Use cases: Internal tools, single-organization deployments

**Option 2: External Identity Provider**
- Delegate to company's existing OAuth stack or third-party IdP
- Better for multi-organization scenarios
- Leverage existing auth infrastructure
- Reduces operational burden

**Both approaches are valid—choose based on your use case.**

### 5.5 Authorization for STDIO vs HTTP Transport

**STDIO Transport (Local):**
- SHOULD NOT follow MCP authorization spec
- Instead: Retrieve credentials from environment variables
- Example: `MCP_AUTH_TOKEN`, `MCP_API_KEY`
- Simpler for local development and testing

**HTTP Transport (Remote):**
- SHOULD conform to authorization specification
- Use OAuth 2.1 flows
- Serve all authorization endpoints over HTTPS
- Implement proper token validation

---

## 6. Performance Optimization

### 6.1 Caching Strategies

**What to Cache:**
- Read-heavy operations: resources/list, prompts/list
- Static resources and metadata
- Frequently requested data

**What NOT to Cache:**
- Side-effect calls (tools that modify state)
- Real-time data (stock prices, sensor readings within critical windows)
- User-specific data that changes frequently

**Caching Patterns:**
```
Stock prices:      Cache every 5 minutes
Financial data:    Cache daily
SEC filings:       Cache weekly
Static resources:  Cache indefinitely (with versioning)
User data:         Cache per-session or per-request
```

**Cache Invalidation:**
- Use versioning or ETags to detect changes
- Avoid blind timeouts for critical data
- Set short TTL (Time To Live) for volatile data
- Implement refresh-on-write patterns

**Performance Impact:**
- Can reduce response times from seconds to milliseconds
- Decrease database hits by up to 90% for read-heavy operations
- Reduces token consumption for repeated analyses

### 6.2 Transport Selection

**STDIO Transport:**
- Best for: Local servers alongside client
- Advantages: No network overhead, optimal performance
- Use case: CLI tools, local AI IDE integration

**Streamable HTTP:**
- Best for: Remote deployments, modern infrastructure
- Advantages: Handles both streaming and request/response patterns
- Recommended for: Horizontally scaled deployments, zero-downtime upgrades
- Better than plain HTTP for long-running operations

### 6.3 Horizontal Scaling and Architecture

**Design Principles:**
- Build for horizontal scaling from the start
- Enable zero-downtime deployments
- Use stateless server design
- Externalize session/state management

**Load Balancing Considerations:**
- Route based on server capacity
- Implement circuit breakers for failing downstream services
- Use connection pooling for databases
- Cache at application level, not just database

### 6.4 Output Management

**Preventing Context Overflow:**
- Check output byte size before returning
- Estimate token count and apply limits
- Truncate verbose responses gracefully
- Use pagination for large datasets

---

## 7. Logging and Observability

### 7.1 Three-Tier Observability Model

**Logging:**
- Fully-searchable, persistent logs outside the session
- Show MCP server, tools called, user/system that triggered call, timestamp, duration

**Dashboards & Reports:**
- Aggregate metrics by session, user, server, tool, error type
- Track success rates, latency distributions, error frequencies
- Monitor resource usage and performance trends

**Alerting:**
- Automated alerts for errors, performance degradation, security events
- Integration with incident management (Slack, GitHub, Jira)
- Include deep links to traces/logs for quick diagnosis

### 7.2 Structured Logging Best Practices

**Required Log Properties:**

| Property | Purpose | Example |
|----------|---------|---------|
| timestamp | When did the event occur? | 2025-01-15T14:30:00Z |
| level | Severity | INFO, WARN, ERROR |
| server_id | Which MCP server? | ai-api-server-prod-1 |
| session_id | User session | sess_abc123 |
| correlation_id | Trace ID across services | trace_xyz789 |
| tool_name | Which tool called? | execute_query |
| user_id | Who triggered it? | user_123 |
| duration_ms | How long did it take? | 245 |
| status | Success or failure? | success, error |
| error_type | What kind of error? | timeout, validation_error |

**Exclusions:**
- NO sensitive data (API keys, tokens, passwords, PII)
- NO personally identifiable information
- NO full request/response bodies if they contain secrets

**Aggregation Capability:**
- By session, user, server, tool, error type, event type
- Time-series analysis: hourly, daily, weekly trends
- Correlation: Link related events across services

### 7.3 Implementation Approach (Phased)

**Phase 1: Local Logging**
- File-based or console logs with structured format (JSON)
- Track basic metrics: tool calls, durations, errors

**Phase 2: Log Forwarding**
- Ship logs to observability backend (DataDog, New Relic, Splunk)
- Structured log forwarding with full context

**Phase 3: Dashboards & Queries**
- Create dashboards for key metrics
- Build alert rules for anomalies
- Enable historical analysis

**Phase 4: Access Control**
- Restrict log access by role/team
- Audit log access itself
- Compliance with data retention policies

**Phase 5: Multi-Server Environments**
- Correlate logs across multiple MCP servers
- Track distributed transactions
- Service dependency mapping

### 7.4 Example: DataDog Integration

```python
import logging
from ddtrace import tracer

logger = logging.getLogger(__name__)

@mcp.tool
async def execute_query(sql: str):
    with tracer.trace("tool.execute_query") as span:
        span.set_tag("user_id", current_user.id)
        span.set_tag("query_length", len(sql))

        start_time = time.time()
        try:
            result = await db.execute(sql)
            duration_ms = (time.time() - start_time) * 1000

            logger.info(
                "query_executed",
                extra={
                    "correlation_id": get_correlation_id(),
                    "tool_name": "execute_query",
                    "user_id": current_user.id,
                    "duration_ms": duration_ms,
                    "status": "success",
                    "row_count": len(result)
                }
            )
            return result
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(
                "query_failed",
                extra={
                    "correlation_id": get_correlation_id(),
                    "tool_name": "execute_query",
                    "error_type": type(e).__name__,
                    "duration_ms": duration_ms,
                    "status": "error"
                }
            )
            raise
```

### 7.5 Alerting Integration Example

Using Zapier or similar:
```
Trigger: Error in MCP logs →
  1. Send to Slack channel with deep link to trace
  2. Create GitHub issue with reproducible payload
  3. Notify on-call engineer
```

---

## 8. Examples from Well-Built MCP Servers

### 8.1 Anthropic Official Reference Servers

Anthropic maintains open-source example servers demonstrating best practices:

**GitHub Location:** https://github.com/modelcontextprotocol/servers

#### Memory Server
**Purpose:** Knowledge graph-based persistent memory system

**Key Features:**
- Basic persistent memory using local knowledge graph
- Allows Claude to remember information across chats
- Demonstrates resource templates and caching

**Best Practices Exemplified:**
- State management patterns
- Resource definition and templating
- Knowledge representation

#### Filesystem Server
**Purpose:** Safe file operations for AI assistants

**Key Features:**
- Flexible directory access control
- Path validation to prevent directory traversal
- Read, write, list operations with safety checks

**Best Practices Exemplified:**
- Security-first design (path validation)
- Access control mechanisms
- Resource URI design

**Code Example:**
```typescript
const server = new McpServer({
  name: "filesystem",
  version: "1.0.0"
});

// Tool with proper path validation
server.tool("read_file", {
  description: "Read a file's contents",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The file path to read"
      }
    },
    required: ["path"]
  },
  handler: async (request: Tool.Request) => {
    const path = request.params.arguments.path as string;

    // Security: Validate path is within allowed directories
    const normalizedPath = normalizePath(path);
    if (!isPathAllowed(normalizedPath)) {
      return {
        content: [{
          type: "text",
          text: `Access denied: ${path}`
        }],
        isError: true
      };
    }

    try {
      const content = await fs.readFile(normalizedPath, 'utf-8');
      return {
        content: [{
          type: "text",
          text: content
        }],
        isError: false
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to read file: ${error.message}`
        }],
        isError: true
      };
    }
  }
});
```

#### Git Server
**Purpose:** Read, search, and manipulate Git repositories

**Key Features:**
- Repository operations (clone, commit, diff)
- Search and analysis capabilities
- Information extraction from commits

#### GitHub Server
**Purpose:** Interact with GitHub APIs

**Key Features:**
- Personal access token authentication
- Issue, PR, and repository operations
- OAuth configuration

### 8.2 Block Engineering's MCP Design Playbook

Block has developed 60+ MCP servers and published their design patterns.

**Reference:** https://engineering.block.xyz/blog/blocks-playbook-for-designing-mcp-servers

**Key Principles from Block:**

1. **Linear MCP Example (GraphQL Approach)**
   - Exposed two high-level tools: `execute_readonly_query` and `execute_mutation_query`
   - Each tool takes raw GraphQL queries
   - Included GraphQL schema and examples as model instructions
   - Consolidated from 20+ granular endpoints to 2 powerful tools

   **Evolution:**
   ```
   Before: 20+ fine-grained tools (getUser, updateUser, createTask, etc.)
   After: 2 high-level tools (readonly_query, mutation_query) + schema
   Result: Better LLM performance, fewer hallucinations
   ```

2. **Use Pydantic Models for Complex Parameters**
   - Supports model and field descriptions
   - Automatic JSON Schema serialization
   - Type safety at runtime

3. **Tool Names as Prompts**
   - Names, descriptions, parameters are LLM prompts
   - Spend time getting them right
   - Clear names prevent misuse and hallucinations

4. **Combine API Calls into Workflows**
   - Instead of single API calls, design around user workflows
   - Single tool should accomplish entire task
   - Reduces round-trip interactions with LLM

**Example: Before and After**

**Before (Fine-Grained Tools):**
```python
@mcp.tool
def get_task(task_id: str) -> Task:
    """Get a single task"""
    pass

@mcp.tool
def update_task_title(task_id: str, title: str) -> Task:
    """Update task title"""
    pass

@mcp.tool
def update_task_status(task_id: str, status: str) -> Task:
    """Update task status"""
    pass

@mcp.tool
def add_task_comment(task_id: str, comment: str) -> Comment:
    """Add a comment"""
    pass
```

**After (Workflow-Oriented):**
```python
from pydantic import BaseModel, Field

class TaskUpdate(BaseModel):
    task_id: str = Field(..., description="Task identifier")
    title: Optional[str] = Field(None, description="New title if updating")
    status: Optional[str] = Field(None, description="New status if updating", enum=["todo", "in_progress", "done"])
    comment: Optional[str] = Field(None, description="Comment to add")

@mcp.tool
def manage_task(update: TaskUpdate) -> Dict:
    """
    Comprehensive task management: get, update, and comment in one operation.
    Supports any combination of updates.
    """
    # Load task
    task = db.get_task(update.task_id)

    # Apply updates
    if update.title:
        task.title = update.title
    if update.status:
        task.status = update.status

    # Save
    db.save(task)

    # Add comment if provided
    if update.comment:
        db.add_comment(task.task_id, update.comment)

    return task.dict()
```

---

## 9. Development and Testing Best Practices

### 9.1 Using MCP Inspector

**What It Is:**
- Interactive visual testing tool for MCP servers
- React-based web UI + Node.js proxy bridge
- "Postman for MCP"—test without production clients

**Getting Started:**
```bash
npx @modelcontextprotocol/inspector build/index.js
```
- Opens UI at `http://localhost:6274`
- Test tools, resources, prompts interactively
- Inspect OAuth flows without deployment

**Key Features:**
- Interactive tool testing
- Resource and prompt exploration
- Request/response inspection
- Error handling verification
- OAuth flow testing

### 9.2 FastMCP Framework

**For Python Developers:**

The FastMCP framework simplifies MCP server development:

```bash
pip install fastmcp
```

**Tool Definition:**
```python
from fastmcp import FastMCP

mcp = FastMCP(name="my-server", version="1.0.0")

@mcp.tool
def calculate_sum(numbers: list[int], prefix: str = "") -> str:
    """
    Calculate the sum of numbers.

    Args:
        numbers: List of numbers to sum
        prefix: Optional prefix for the result
    """
    total = sum(numbers)
    return f"{prefix}{total}" if prefix else str(total)

@mcp.resource
def get_readme() -> str:
    """Get the server readme"""
    return "# My MCP Server"
```

**Resource Templates:**
```python
@mcp.resource
def get_user_info(user_id: str):
    """Get info for a specific user"""
    # user_id comes from resource URI: user://{user_id}
    return fetch_user(user_id)
```

### 9.3 Debugging Strategies

**Local Logging:**
```bash
MCP_DEBUG=true mcp dev
```

**Error-Driven Development:**
1. Write clear error messages
2. Test error paths first
3. Ensure LLM can understand failures
4. Verify recovery mechanisms

**Type Safety:**
- Use strict typing (TypeScript, Python type hints)
- Validate inputs at schema and implementation level
- Catch type errors early in development

### 9.4 Configuration Best Practices

**Externalize All Configuration:**
- Environment variables for secrets and endpoints
- Configuration files for non-sensitive settings
- Support environment-specific overrides

**Example:**
```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    DATABASE_URL = os.getenv("DATABASE_URL")
    API_KEY = os.getenv("API_KEY")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    CACHE_TTL = int(os.getenv("CACHE_TTL", "3600"))

mcp = FastMCP(...)
```

---

## 10. Security Best Practices

### 10.1 Input Validation

**Path Validation (Critical):**
```python
def validate_file_path(user_path: str, allowed_root: str) -> str:
    """Prevent directory traversal attacks"""
    # Normalize path
    normalized = os.path.normpath(user_path)

    # Resolve symlinks
    resolved = os.path.realpath(os.path.join(allowed_root, normalized))

    # Verify within allowed directory
    if not resolved.startswith(os.path.realpath(allowed_root)):
        raise ValueError(f"Access denied: {user_path}")

    return resolved
```

**SQL Injection Prevention:**
- Always use parameterized queries
- Never concatenate user input into SQL
- Use ORM when possible

**Data Type Validation:**
- Use JSON Schema with strict type checking
- Validate enum values against allowlist
- Validate range constraints (min, max, length)

### 10.2 Resource Protection

**File Type Allowlisting:**
```python
ALLOWED_TYPES = {'.txt', '.md', '.json', '.csv'}

def validate_file_type(path: str) -> bool:
    _, ext = os.path.splitext(path)
    return ext.lower() in ALLOWED_TYPES
```

**Rate Limiting:**
```python
from slowapi import Limiter

limiter = Limiter(key_func=get_user_id)

@mcp.tool
@limiter.limit("10/minute")
def expensive_operation(query: str):
    return process(query)
```

**Circuit Breaker Pattern:**
```python
from pybreaker import CircuitBreaker

api_breaker = CircuitBreaker(fail_max=5, reset_timeout=60)

def call_external_api(endpoint: str):
    return api_breaker.call(requests.get, endpoint)
```

### 10.3 Dependency Management

**Regular Updates:**
- Monitor dependencies for vulnerabilities
- Use tools like `npm audit`, `pip-audit`
- Update regularly, test before deploying

**Minimal Dependencies:**
- Only include necessary libraries
- Reduces attack surface
- Easier to audit code

---

## 11. Production Deployment Checklist

- [ ] **Error Handling**: All edge cases handled with isError responses
- [ ] **Logging**: Structured, traceable logs with correlation IDs
- [ ] **Authentication**: OAuth 2.1 or environment-based credentials
- [ ] **Security**: Input validation, path checks, rate limiting
- [ ] **Performance**: Caching strategy defined, timeouts set
- [ ] **Observability**: Metrics collected, dashboards created, alerts configured
- [ ] **Testing**: MCP Inspector verified, all tools tested
- [ ] **Configuration**: All config externalized, environment-specific
- [ ] **Documentation**: Clear tool descriptions, schema examples, error codes documented
- [ ] **Monitoring**: Real-time monitoring active, incident response plan ready

---

## 12. Summary of Key Recommendations

| Category | Key Recommendation |
|----------|-------------------|
| **Tool Design** | One tool per user intent; design workflows top-down |
| **Naming** | Use snake_case; be descriptive, avoid abbreviations |
| **Parameters** | Keep schemas flat; use enums; distinguish required vs optional |
| **Errors** | Use isError flag; never expose auth failure reasons |
| **Schema** | Leverage JSON Schema; use Pydantic in Python |
| **Auth** | Prefer OAuth 2.1; use platform keyrings; implement scope negotiation |
| **Performance** | Cache reads not writes; use Streamable HTTP for remote; design for horizontal scaling |
| **Logging** | Structured logs with correlation IDs; exclude sensitive data |
| **Observability** | Three-tier model: logging, dashboards, alerting |
| **Security** | Validate paths; allowlist file types; rate limit; use circuit breakers |
| **Testing** | Use MCP Inspector; test error paths first; enable debug logging |
| **Configuration** | Externalize all config; support environment-specific overrides |

---

## Sources and References

This guide consolidates information from:

1. **Official MCP Specification & Documentation**
   - [Specification - Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25)
   - [Build an MCP server - Model Context Protocol](https://modelcontextprotocol.io/docs/develop/build-server)
   - [MCP Best Practices Guide](https://modelcontextprotocol.info/docs/best-practices/)
   - [Authorization - Model Context Protocol](https://modelcontextprotocol.io/specification/draft/basic/authorization)

2. **Official SDKs & Reference Implementations**
   - [TypeScript SDK - GitHub](https://github.com/modelcontextprotocol/typescript-sdk)
   - [Python SDK - GitHub](https://github.com/modelcontextprotocol/python-sdk)
   - [Official Reference Servers - GitHub](https://github.com/modelcontextprotocol/servers)

3. **Production Best Practices**
   - [Block Engineering's Playbook](https://engineering.block.xyz/blog/blocks-playbook-for-designing-mcp-servers)
   - [Docker MCP Best Practices](https://www.docker.com/blog/mcp-server-best-practices/)
   - [The New Stack - 15 Best Practices](https://thenewstack.io/15-best-practices-for-building-mcp-servers-in-production/)
   - [Snyk - 5 Best Practices](https://snyk.io/articles/5-best-practices-for-building-mcp-servers/)

4. **Specialized Topics**
   - [Error Handling in MCP Servers](https://mcpcat.io/guides/error-handling-custom-mcp-servers/)
   - [MCP Observability Guide](https://www.merge.dev/blog/mcp-observability)
   - [MCP Server Logging](https://mcpmanager.ai/blog/mcp-logging/)
   - [MCP Caching Strategies](https://medium.com/@parichay2406/advanced-caching-strategies-for-mcp-servers-from-theory-to-production-1ff82a594177)
   - [MCP Tool Schema Design](https://www.merge.dev/blog/mcp-tool-schema)
   - [MCP Inspector - Visual Testing](https://modelcontextprotocol.io/docs/tools/inspector)
   - [FastMCP Framework](https://gofastmcp.com/tutorials/create-mcp-server)

5. **Authentication & Authorization**
   - [Auth0 MCP Authentication Guide](https://auth0.com/blog/MCP-authentication-and-authorization-guide/)
   - [Stytch MCP Implementation Guide](https://stytch.com/blog/MCP-authentication-and-authorization-guide/)
   - [InfraCloud Security Guide](https://www.infracloud.io/blogs/securing-mcp-servers/)

6. **Community Resources**
   - [MCP Manager - Learning Resources](https://mcpmanager.ai/)
   - [Awesome MCP Servers](https://github.com/ever-works/awesome-mcp-servers)
   - [FreeCodeCamp - MCP TypeScript Handbook](https://www.freecodecamp.org/news/how-to-build-a-custom-mcp-server-with-typescript-a-handbook-for-developers/)
   - [DigitalOcean - Python MCP Tutorial](https://www.digitalocean.com/community/tutorials/mcp-server-python)

---

**Last Updated:** February 2025
**MCP Specification Version:** November 2025
**Guide Scope:** Comprehensive best practices across all aspects of MCP server development
