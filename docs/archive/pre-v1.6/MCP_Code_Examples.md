# MCP Best Practices - Code Examples

This document provides practical code examples demonstrating MCP best practices across different scenarios.

---

## 1. TypeScript/Node.js Examples

### 1.1 Complete MCP Server with Best Practices

```typescript
import { McpServer, StdioServerTransport } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequest, Tool } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";

const server = new McpServer({
  name: "filesystem-server",
  version: "1.0.0"
});

// ============== SECURITY: Path Validation ==============
function validatePath(userPath: string, allowedRoot: string): string {
  // Normalize and resolve the path
  const normalizedPath = path.normalize(userPath);
  const resolvedPath = path.resolve(allowedRoot, normalizedPath);

  // Ensure the resolved path is within allowed root
  if (!resolvedPath.startsWith(path.resolve(allowedRoot))) {
    throw new Error(`Access denied: path outside allowed directory`);
  }

  return resolvedPath;
}

// ============== LOGGING: Structured Logging ==============
interface LogContext {
  correlationId: string;
  userId?: string;
  toolName: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
}

function logEvent(context: LogContext, message: string, extra?: Record<string, unknown>): void {
  const logEntry = {
    ...context,
    message,
    ...extra
  };
  console.error(JSON.stringify(logEntry));
}

// ============== TOOL: Read File with Error Handling ==============
server.tool(
  "read_file",
  {
    description: "Read a text file and return its contents. Supports .txt, .md, .json, .csv files only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the file to read (relative to allowed root)"
        }
      },
      required: ["path"]
    }
  },
  async (request: CallToolRequest) => {
    const correlationId = `req_${Date.now()}`;
    const startTime = Date.now();

    try {
      const filePath = request.params.arguments.path as string;

      // Security: Validate path
      const validatedPath = validatePath(filePath, process.cwd());

      // Security: Check file extension
      const allowedExtensions = [".txt", ".md", ".json", ".csv"];
      const extension = path.extname(validatedPath).toLowerCase();
      if (!allowedExtensions.includes(extension)) {
        throw new Error(`File type not allowed: ${extension}`);
      }

      // Read file
      const content = await fs.readFile(validatedPath, "utf-8");

      // Performance: Check output size
      const sizeInKB = content.length / 1024;
      if (sizeInKB > 1000) {
        logEvent(
          {
            correlationId,
            toolName: "read_file",
            timestamp: new Date().toISOString(),
            level: "WARN"
          },
          "Large file read",
          { sizeInKB }
        );
      }

      // Success response
      logEvent(
        {
          correlationId,
          toolName: "read_file",
          timestamp: new Date().toISOString(),
          level: "INFO"
        },
        "File read successfully",
        {
          durationMs: Date.now() - startTime,
          sizeInBytes: content.length
        }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: content
          }
        ],
        isError: false
      };
    } catch (error) {
      // Error response - structured, no sensitive data
      const errorMessage = error instanceof Error ? error.message : String(error);

      logEvent(
        {
          correlationId,
          toolName: "read_file",
          timestamp: new Date().toISOString(),
          level: "ERROR"
        },
        "File read failed",
        {
          durationMs: Date.now() - startTime,
          errorType: error instanceof Error ? error.constructor.name : "Unknown"
        }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to read file: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }
);

// ============== TOOL: Query Database Example ==============
server.tool(
  "execute_query",
  {
    description: "Execute a SELECT query on the database (read-only)",
    inputSchema: {
      type: "object" as const,
      properties: {
        sql: {
          type: "string",
          description: "SELECT SQL query to execute",
          minLength: 1,
          maxLength: 5000
        },
        limit: {
          type: "integer",
          description: "Maximum rows to return",
          minimum: 1,
          maximum: 1000,
          default: 100
        },
        timeout_seconds: {
          type: "integer",
          description: "Query timeout in seconds",
          minimum: 1,
          maximum: 300,
          default: 30
        }
      },
      required: ["sql"]
    }
  },
  async (request: CallToolRequest) => {
    const correlationId = `req_${Date.now()}`;
    const startTime = Date.now();

    try {
      const { sql, limit = 100, timeout_seconds = 30 } = request.params.arguments as {
        sql: string;
        limit?: number;
        timeout_seconds?: number;
      };

      // Security: Validate query is SELECT only
      if (!sql.trim().toUpperCase().startsWith("SELECT")) {
        throw new Error("Only SELECT queries are allowed");
      }

      // Execute query with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout_seconds * 1000);

      // Simulated query execution
      const result = await simulateQuery(sql, limit, controller.signal);
      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;

      logEvent(
        {
          correlationId,
          toolName: "execute_query",
          timestamp: new Date().toISOString(),
          level: "INFO"
        },
        "Query executed",
        {
          durationMs,
          rowCount: result.length,
          queryLength: sql.length
        }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: false
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logEvent(
        {
          correlationId,
          toolName: "execute_query",
          timestamp: new Date().toISOString(),
          level: "ERROR"
        },
        "Query failed",
        {
          durationMs,
          errorType: error instanceof Error ? error.constructor.name : "Unknown"
        }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Query failed: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }
);

// ============== RESOURCES: With Caching ==============
interface CachedResource {
  content: string;
  timestamp: number;
  ttl: number;
}

const resourceCache = new Map<string, CachedResource>();

function isCacheValid(resource: CachedResource): boolean {
  return Date.now() - resource.timestamp < resource.ttl;
}

server.resource(
  "config://app-settings",
  {
    description: "Application settings and configuration",
    mimeType: "application/json"
  },
  async () => {
    const cacheKey = "app-settings";
    const cached = resourceCache.get(cacheKey);

    if (cached && isCacheValid(cached)) {
      logEvent(
        {
          correlationId: `cache_hit_${Date.now()}`,
          toolName: "config://app-settings",
          timestamp: new Date().toISOString(),
          level: "INFO"
        },
        "Cache hit"
      );
      return cached.content;
    }

    // Fetch fresh config
    const settings = {
      version: "1.0.0",
      features: ["feature_a", "feature_b"],
      limits: {
        max_queries_per_minute: 100,
        max_file_size_mb: 100
      }
    };

    const content = JSON.stringify(settings, null, 2);

    // Cache for 5 minutes
    resourceCache.set(cacheKey, {
      content,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000
    });

    return content;
  }
);

// ============== RESOURCES: Templates with Parameters ==============
server.resourceTemplate(
  "user://{user_id}",
  {
    description: "Get user information by ID",
    mimeType: "application/json"
  },
  async (uri: string) => {
    // Extract user_id from URI
    const match = uri.match(/^user:\/\/(.+)$/);
    if (!match) {
      throw new Error("Invalid user URI");
    }

    const userId = match[1];

    // Security: Validate user_id format (alphanumeric)
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      throw new Error("Invalid user ID format");
    }

    // Fetch user data
    const user = {
      id: userId,
      name: `User ${userId}`,
      email: `user_${userId}@example.com`,
      created_at: new Date().toISOString()
    };

    return JSON.stringify(user, null, 2);
  }
);

// ============== SERVER STARTUP ==============
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on stdio transport");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// ============== HELPER FUNCTIONS ==============
async function simulateQuery(sql: string, limit: number, signal: AbortSignal): Promise<unknown[]> {
  // Simulated database query
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Query timeout"));
    }, 5000);

    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new Error("Query cancelled"));
    });

    // Simulate processing
    setTimeout(() => {
      clearTimeout(timeout);
      resolve(Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
        id: i + 1,
        data: `row_${i + 1}`
      })));
    }, 100);
  });
}
```

---

## 2. Python Examples with FastMCP

### 2.1 Complete FastMCP Server

```python
import os
import json
from pathlib import Path
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field

from fastmcp import FastMCP

# ============== CONFIGURATION ==============
class Config:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///app.db")
    API_KEY = os.getenv("API_KEY")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL", "3600"))
    MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "100"))
    ALLOWED_FILE_TYPES = {".txt", ".md", ".json", ".csv"}

# ============== LOGGING ==============
def log_event(
    event_type: str,
    tool_name: str,
    correlation_id: str,
    status: str,
    **extra
) -> None:
    """Structured logging with correlation ID"""
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "tool_name": tool_name,
        "correlation_id": correlation_id,
        "status": status,
        "level": "INFO" if status == "success" else "ERROR",
        **extra
    }
    print(json.dumps(log_entry), flush=True)

# ============== DATA MODELS ==============
class FileOperationParams(BaseModel):
    path: str = Field(..., description="File path relative to allowed root")
    encoding: str = Field(default="utf-8", description="File encoding")

class QueryParams(BaseModel):
    sql: str = Field(..., description="SQL SELECT query", max_length=5000)
    limit: int = Field(default=100, ge=1, le=1000, description="Max rows to return")
    timeout_seconds: int = Field(
        default=30,
        ge=1,
        le=300,
        description="Query timeout in seconds"
    )

class TaskUpdate(BaseModel):
    task_id: str = Field(..., description="Task ID to update")
    title: Optional[str] = Field(None, description="New task title")
    status: Optional[str] = Field(
        None,
        enum=["pending", "in_progress", "completed", "failed"],
        description="New task status"
    )
    priority: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="Priority level (1-5)"
    )
    description: Optional[str] = Field(None, description="Task description")

# ============== INITIALIZE MCP SERVER ==============
mcp = FastMCP(name="production-server", version="1.0.0")

# ============== CACHING ==============
cache_store = {}

def get_cached(key: str) -> Optional[dict]:
    """Get value from cache if not expired"""
    if key not in cache_store:
        return None

    cached = cache_store[key]
    if datetime.utcnow() > cached["expires_at"]:
        del cache_store[key]
        return None

    return cached["value"]

def set_cache(key: str, value: dict, ttl_seconds: Optional[int] = None) -> None:
    """Store value in cache with TTL"""
    ttl = ttl_seconds or Config.CACHE_TTL_SECONDS
    cache_store[key] = {
        "value": value,
        "expires_at": datetime.utcnow() + timedelta(seconds=ttl)
    }

# ============== SECURITY: INPUT VALIDATION ==============
def validate_file_path(user_path: str, allowed_root: str = ".") -> Path:
    """
    Validate file path to prevent directory traversal attacks.
    Raises ValueError if path is outside allowed root.
    """
    # Normalize and resolve
    normalized = Path(user_path).resolve()
    root = Path(allowed_root).resolve()

    # Check if within root
    try:
        normalized.relative_to(root)
    except ValueError:
        raise ValueError(f"Access denied: path outside allowed directory")

    return normalized

def validate_file_type(file_path: Path) -> None:
    """Validate file extension against allowlist"""
    if file_path.suffix.lower() not in Config.ALLOWED_FILE_TYPES:
        raise ValueError(f"File type not allowed: {file_path.suffix}")

# ============== TOOL: Read File ==============
@mcp.tool
def read_file(params: FileOperationParams) -> str:
    """
    Read and return file contents.
    Supports: .txt, .md, .json, .csv

    Security features:
    - Path validation prevents directory traversal
    - File type allowlisting
    - Size limits enforced
    """
    correlation_id = f"req_{datetime.utcnow().timestamp()}"
    start_time = datetime.utcnow()

    try:
        # Validate path
        file_path = validate_file_path(params.path)

        # Validate file type
        validate_file_type(file_path)

        # Check if file exists
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Check file size
        file_size_mb = file_path.stat().st_size / (1024 * 1024)
        if file_size_mb > Config.MAX_FILE_SIZE_MB:
            raise ValueError(f"File too large: {file_size_mb}MB")

        # Read file
        content = file_path.read_text(encoding=params.encoding)

        duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        log_event(
            "file_read",
            "read_file",
            correlation_id,
            "success",
            duration_ms=duration_ms,
            file_size_bytes=len(content)
        )

        return content

    except Exception as e:
        duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        log_event(
            "file_read",
            "read_file",
            correlation_id,
            "error",
            duration_ms=duration_ms,
            error_type=type(e).__name__
        )
        raise

# ============== TOOL: Workflow-Oriented Task Management ==============
@mcp.tool
def manage_task(update: TaskUpdate) -> dict:
    """
    Comprehensive task management supporting get, update, and status changes.

    This is an example of workflow-oriented tool design where a single tool
    handles multiple related operations instead of exposing granular API endpoints.

    Operations:
    - Load existing task
    - Update any combination of title, status, priority, description
    - Return complete updated task state
    """
    correlation_id = f"req_{datetime.utcnow().timestamp()}"
    start_time = datetime.utcnow()

    try:
        # Load task from database
        task = load_task_from_db(update.task_id)

        if not task:
            raise ValueError(f"Task not found: {update.task_id}")

        # Apply updates (any combination)
        if update.title:
            task["title"] = update.title

        if update.status:
            task["status"] = update.status
            task["status_changed_at"] = datetime.utcnow().isoformat()

        if update.priority is not None:
            task["priority"] = update.priority

        if update.description is not None:
            task["description"] = update.description

        # Mark as updated
        task["updated_at"] = datetime.utcnow().isoformat()

        # Save to database
        save_task_to_db(task)

        duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        log_event(
            "task_update",
            "manage_task",
            correlation_id,
            "success",
            duration_ms=duration_ms,
            task_id=update.task_id,
            fields_updated=sum([
                1 for v in [update.title, update.status, update.priority, update.description]
                if v is not None
            ])
        )

        return task

    except Exception as e:
        duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        log_event(
            "task_update",
            "manage_task",
            correlation_id,
            "error",
            duration_ms=duration_ms,
            error_type=type(e).__name__,
            task_id=update.task_id
        )
        raise

# ============== TOOL: Database Query ==============
@mcp.tool
def execute_query(params: QueryParams) -> str:
    """
    Execute a SELECT query on the database (read-only).

    Security features:
    - Only SELECT queries allowed (prevents accidental writes)
    - Timeout protection against long-running queries
    - Response size limits
    """
    correlation_id = f"req_{datetime.utcnow().timestamp()}"
    start_time = datetime.utcnow()

    try:
        # Security: Validate SELECT only
        sql_upper = params.sql.strip().upper()
        if not sql_upper.startswith("SELECT"):
            raise ValueError("Only SELECT queries are allowed")

        # Try cache first
        cache_key = f"query:{hash(params.sql)}"
        cached_result = get_cached(cache_key)

        if cached_result:
            log_event(
                "query_execute",
                "execute_query",
                correlation_id,
                "cache_hit"
            )
            return json.dumps(cached_result, indent=2)

        # Execute query with timeout
        result = execute_query_with_timeout(
            params.sql,
            params.limit,
            params.timeout_seconds
        )

        # Cache result
        set_cache(cache_key, result)

        duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        log_event(
            "query_execute",
            "execute_query",
            correlation_id,
            "success",
            duration_ms=duration_ms,
            row_count=len(result)
        )

        return json.dumps(result, indent=2)

    except Exception as e:
        duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        log_event(
            "query_execute",
            "execute_query",
            correlation_id,
            "error",
            duration_ms=duration_ms,
            error_type=type(e).__name__
        )
        raise

# ============== RESOURCES WITH CACHING ==============
@mcp.resource
def get_server_config() -> str:
    """
    Get application configuration (cached).

    This resource is cached to reduce repeated reads of static configuration.
    """
    cache_key = "server_config"

    # Check cache
    cached = get_cached(cache_key)
    if cached:
        return json.dumps(cached, indent=2)

    # Fetch fresh config
    config_data = {
        "version": "1.0.0",
        "features": ["auth", "api", "webhooks"],
        "limits": {
            "max_requests_per_minute": 1000,
            "max_file_size_mb": Config.MAX_FILE_SIZE_MB,
            "query_timeout_seconds": 30
        },
        "generated_at": datetime.utcnow().isoformat()
    }

    # Cache for 1 hour
    set_cache(cache_key, config_data, ttl_seconds=3600)

    return json.dumps(config_data, indent=2)

# ============== RESOURCE TEMPLATES ==============
@mcp.resource
def get_user_profile(user_id: str) -> str:
    """
    Get user profile information by ID.

    This is a resource template that generates resources dynamically
    based on the user_id parameter.

    URI format: user://{user_id}
    """
    # Validate user_id format
    if not user_id.replace("-", "").replace("_", "").isalnum():
        raise ValueError(f"Invalid user ID format: {user_id}")

    # Try cache
    cache_key = f"user_profile:{user_id}"
    cached = get_cached(cache_key)

    if cached:
        return json.dumps(cached, indent=2)

    # Fetch user data
    user_data = {
        "id": user_id,
        "name": f"User {user_id}",
        "email": f"user_{user_id}@example.com",
        "created_at": datetime.utcnow().isoformat(),
        "status": "active"
    }

    # Cache per-user profile for 5 minutes
    set_cache(cache_key, user_data, ttl_seconds=300)

    return json.dumps(user_data, indent=2)

# ============== HELPER FUNCTIONS (SIMULATED) ==============
def load_task_from_db(task_id: str) -> Optional[dict]:
    """Load task from database (simulated)"""
    return {
        "id": task_id,
        "title": "Sample Task",
        "status": "pending",
        "priority": 3,
        "description": "This is a sample task",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }

def save_task_to_db(task: dict) -> None:
    """Save task to database (simulated)"""
    pass

def execute_query_with_timeout(sql: str, limit: int, timeout: int) -> list:
    """Execute query with timeout protection (simulated)"""
    import time
    time.sleep(0.1)  # Simulate query execution
    return [{"id": i, "value": f"row_{i}"} for i in range(min(limit, 10))]

# ============== MAIN ==============
if __name__ == "__main__":
    import uvicorn

    # Run the MCP server
    # For production, use: mcp run app:mcp
    print("FastMCP Server initialized with tools and resources")
    print(f"Config: DATABASE_URL={Config.DATABASE_URL}")
    print(f"Log level: {Config.LOG_LEVEL}")
```

---

## 3. Error Handling Examples

### 3.1 Comprehensive Error Pattern (TypeScript)

```typescript
interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
}

async function callToolWithErrorHandling(
  toolName: string,
  params: unknown
): Promise<ToolResponse> {
  const correlationId = `${toolName}_${Date.now()}`;

  try {
    // Validate inputs
    validateToolParams(toolName, params);

    // Execute tool
    const result = await executeTool(toolName, params);

    // Log success
    console.error(JSON.stringify({
      event: "tool_success",
      tool: toolName,
      correlationId,
      duration_ms: Date.now(),
      status: "success"
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: false
    };

  } catch (error) {
    // Categorize error
    let errorMessage = "An error occurred";

    if (error instanceof ValidationError) {
      errorMessage = `Invalid input: ${error.message}`;
    } else if (error instanceof TimeoutError) {
      errorMessage = "Request timeout - please try again";
    } else if (error instanceof AuthenticationError) {
      // Never expose auth failure details
      errorMessage = "Authentication failed";
    } else if (error instanceof ExternalServiceError) {
      errorMessage = `Service unavailable - please try again later`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Log error
    console.error(JSON.stringify({
      event: "tool_error",
      tool: toolName,
      correlationId,
      error_type: error?.constructor.name,
      status: "error"
    }));

    return {
      content: [{ type: "text", text: errorMessage }],
      isError: true
    };
  }
}
```

---

## 4. Testing Examples

### 4.1 MCP Inspector Usage

```bash
# Start MCP Inspector for local testing
npx @modelcontextprotocol/inspector build/index.js

# CLI mode for automated testing
npx @modelcontextprotocol/inspector build/index.js \
  --test-tool "read_file" \
  --params '{"path": "test.txt"}'
```

### 4.2 Python Testing with FastMCP

```python
import pytest
from fastmcp import FastMCP

def test_read_file():
    """Test file reading with various scenarios"""
    # Create test file
    test_file = Path("test.txt")
    test_file.write_text("Hello World")

    # Test successful read
    result = read_file(FileOperationParams(path=str(test_file)))
    assert result == "Hello World"

    # Test invalid file type
    with pytest.raises(ValueError):
        read_file(FileOperationParams(path="test.exe"))

    # Test path traversal prevention
    with pytest.raises(ValueError):
        read_file(FileOperationParams(path="../../../../etc/passwd"))

    # Cleanup
    test_file.unlink()

def test_manage_task():
    """Test workflow-oriented task management"""
    # Test partial updates
    result = manage_task(TaskUpdate(
        task_id="task_1",
        title="New Title"
    ))
    assert result["title"] == "New Title"

    # Test status change
    result = manage_task(TaskUpdate(
        task_id="task_1",
        status="in_progress"
    ))
    assert result["status"] == "in_progress"
    assert "status_changed_at" in result

    # Test multiple updates
    result = manage_task(TaskUpdate(
        task_id="task_1",
        title="Updated",
        status="completed",
        priority=1
    ))
    assert result["title"] == "Updated"
    assert result["status"] == "completed"
    assert result["priority"] == 1
```

---

## 5. Schema Examples

### 5.1 Complex Tool Schema

```json
{
  "name": "search_documents",
  "description": "Search documents with advanced filtering and pagination",
  "inputSchema": {
    "type": "object",
    "title": "Search Parameters",
    "description": "Parameters for advanced document search",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query string (supports AND, OR, NOT operators)",
        "minLength": 1,
        "maxLength": 1000,
        "examples": ["license AND agreement", "privacy NOT policy"]
      },
      "document_type": {
        "type": "string",
        "enum": ["contract", "policy", "regulation", "guide"],
        "description": "Filter by document type",
        "default": "contract"
      },
      "status": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["draft", "published", "archived"]
        },
        "description": "Filter by document status (multi-select)",
        "default": ["published"]
      },
      "date_range": {
        "type": "object",
        "description": "Filter by document date range",
        "properties": {
          "start_date": {
            "type": "string",
            "format": "date",
            "description": "Start date (YYYY-MM-DD)"
          },
          "end_date": {
            "type": "string",
            "format": "date",
            "description": "End date (YYYY-MM-DD)"
          }
        }
      },
      "pagination": {
        "type": "object",
        "description": "Pagination settings",
        "properties": {
          "page": {
            "type": "integer",
            "minimum": 1,
            "default": 1,
            "description": "Page number"
          },
          "per_page": {
            "type": "integer",
            "minimum": 10,
            "maximum": 100,
            "default": 20,
            "description": "Results per page"
          }
        }
      },
      "sort_by": {
        "type": "string",
        "enum": ["relevance", "date_created", "date_modified", "title"],
        "default": "relevance",
        "description": "Sort results by this field"
      }
    },
    "required": ["query"],
    "additionalProperties": false
  }
}
```

---

This document provides production-ready code examples demonstrating MCP best practices.
