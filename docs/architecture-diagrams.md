# ServalSheets Architecture Diagrams

This document contains comprehensive architecture diagrams for ServalSheets using Mermaid syntax.

---

## System Architecture Overview

High-level overview of ServalSheets components and their relationships.

```mermaid
graph TB
    subgraph "Client Layer"
        CLI[Claude Code CLI]
        Desktop[Claude Desktop]
        Custom[Custom Client]
    end

    subgraph "Transport Layer"
        HTTP[HTTP Server<br/>:3000]
        STDIO[STDIO Transport]
        SSE[Server-Sent Events]
    end

    subgraph "ServalSheets Core"
        direction TB
        MCP[MCP Server<br/>Protocol 2025-11-25]

        subgraph "Handlers"
            H1[Spreadsheet Handler]
            H2[Sheet Handler]
            H3[Values Handler]
            H4[Format Handler]
            H5[... 11 more handlers]
        end

        subgraph "Services"
            GoogleAPI[Google API Client]
            OAuth[OAuth Provider]
            Tasks[Task Store]
            Session[Session Store]
        end

        subgraph "Core Utilities"
            RateLimit[Rate Limiter]
            Retry[Retry Logic]
            Batch[Batch Compiler]
            Range[Range Resolver]
        end
    end

    subgraph "External Services"
        Google[Google Sheets API]
        Drive[Google Drive API]
        GAuth[Google OAuth 2.0]
    end

    subgraph "Storage"
        Redis[(Redis<br/>Sessions & Tasks)]
        Tokens[(Token Store<br/>Encrypted)]
    end

    CLI --> STDIO
    Desktop --> HTTP
    Custom --> HTTP

    STDIO --> MCP
    HTTP --> MCP
    SSE --> MCP

    MCP --> H1 & H2 & H3 & H4 & H5
    H1 & H2 & H3 & H4 & H5 --> GoogleAPI
    H1 & H2 & H3 & H4 & H5 --> RateLimit & Retry & Batch & Range

    GoogleAPI --> Google & Drive
    OAuth --> GAuth
    OAuth --> Session
    Session --> Redis
    Tasks --> Redis
    GoogleAPI --> Tokens

    MCP --> OAuth
    MCP --> Tasks

    style MCP fill:#e1f5ff
    style GoogleAPI fill:#fff4e6
    style OAuth fill:#f3e5f5
    style Redis fill:#ffebee
```

---

## MCP Protocol Flow

How MCP protocol requests flow through the system.

```mermaid
sequenceDiagram
    actor Client
    participant Transport as Transport Layer
    participant MCP as MCP Server
    participant Handler
    participant Google as Google API

    Client->>Transport: JSON-RPC 2.0 Request
    activate Transport
    Transport->>MCP: Parse & Route
    activate MCP

    alt tools/list
        MCP-->>Transport: Tool Definitions
        Transport-->>Client: 15 Tools, 156 Actions

    else tools/call
        MCP->>Handler: Execute Tool
        activate Handler

        Handler->>Handler: Validate Input
        Handler->>Handler: Resolve Range
        Handler->>Google: Google API Call
        activate Google
        Google-->>Handler: API Response
        deactivate Google

        Handler->>Handler: Build Structured Response
        Handler-->>MCP: CallToolResult
        deactivate Handler

        MCP-->>Transport: JSON-RPC Response

    else tasks/get
        MCP->>MCP: Query Task Store
        MCP-->>Transport: Task Status

    else resources/read
        MCP->>Google: Fetch Spreadsheet Metadata
        Google-->>MCP: Metadata
        MCP-->>Transport: Resource Content
    end

    deactivate MCP
    Transport-->>Client: Response
    deactivate Transport
```

---

## Request Processing Pipeline

Detailed request processing flow including middleware, validation, and error handling.

```mermaid
flowchart TD
    Start[Client Request] --> Transport{Transport Type}

    Transport -->|HTTP| HTTP[HTTP Server]
    Transport -->|STDIO| STDIO[STDIO Transport]
    Transport -->|SSE| SSE[SSE Stream]

    HTTP --> Auth{Authenticated?}
    SSE --> Auth
    STDIO --> Parser

    Auth -->|No| OAuth[OAuth Flow]
    Auth -->|Yes| Parser[Parse JSON-RPC]

    OAuth --> OAuthFlow[Authorization Code Flow<br/>with PKCE]
    OAuthFlow --> Token[Exchange for Tokens]
    Token --> Parser

    Parser --> Validate{Valid Request?}
    Validate -->|No| Error1[Validation Error]
    Validate -->|Yes| Route{Route Method}

    Route -->|initialize| Init[Server Initialization]
    Route -->|tools/list| ListTools[List 15 Tools]
    Route -->|tools/call| CallTool[Call Tool Handler]
    Route -->|resources/read| ReadResource[Read Spreadsheet Resource]
    Route -->|tasks/*| TaskOp[Task Operation]

    CallTool --> HandlerFactory[Handler Factory]
    HandlerFactory --> LoadHandler[Lazy Load Handler]
    LoadHandler --> ValidateInput[Validate Input Schema]

    ValidateInput -->|Invalid| Error2[Schema Validation Error]
    ValidateInput -->|Valid| TaskCheck{Task Mode?}

    TaskCheck -->|Yes| CreateTask[Create Task]
    TaskCheck -->|No| ExecuteSync[Execute Synchronously]

    CreateTask --> TaskStore[Store in Task Store]
    TaskStore --> Background[Execute in Background]
    Background --> UpdateStatus[Update Task Status]

    ExecuteSync --> RangeResolve[Resolve Range]
    RangeResolve --> RateCheck{Rate Limit OK?}

    RateCheck -->|No| Error3[Rate Limit Error]
    RateCheck -->|Yes| BatchCheck{Batch Operation?}

    BatchCheck -->|Yes| BatchCompile[Batch Compiler]
    BatchCheck -->|No| GoogleCall[Google API Call]
    BatchCompile --> GoogleCall

    GoogleCall --> RetryLogic{API Success?}
    RetryLogic -->|Transient Error| Retry[Exponential Backoff Retry]
    RetryLogic -->|Permanent Error| Error4[API Error]
    RetryLogic -->|Success| BuildResponse[Build Structured Response]

    Retry --> GoogleCall

    BuildResponse --> Response[CallToolResult]
    UpdateStatus --> Response
    ListTools --> Response
    ReadResource --> Response
    TaskOp --> Response
    Init --> Response

    Response --> Transport2[Transport Layer]
    Transport2 --> Client[Return to Client]

    Error1 --> ErrorHandler[Error Handler]
    Error2 --> ErrorHandler
    Error3 --> ErrorHandler
    Error4 --> ErrorHandler
    ErrorHandler --> ErrorResponse[Structured Error]
    ErrorResponse --> Transport2

    style Start fill:#e1f5ff
    style Response fill:#c8e6c9
    style ErrorResponse fill:#ffcdd2
    style GoogleCall fill:#fff4e6
    style OAuth fill:#f3e5f5
```

---

## Handler Architecture

How handlers are structured and loaded dynamically.

```mermaid
classDiagram
    class BaseHandler {
        <<abstract>>
        +context: HandlerContext
        +handle(input): Promise~Output~
        #success(result): SuccessResponse
        #error(error): ErrorResponse
        #requiresAuth(): boolean
    }

    class HandlerContext {
        +googleApi: GoogleApiClient
        +requestId: string
        +userId: string
        +taskStore?: TaskStore
        +sessionStore?: SessionStore
    }

    class SpreadsheetHandler {
        +handle(input): Promise~Output~
        -handleGet()
        -handleCreate()
        -handleCopy()
        -handleUpdate()
    }

    class ValuesHandler {
        +handle(input): Promise~Output~
        -handleRead()
        -handleWrite()
        -handleAppend()
        -handleClear()
        -handleFind()
        -handleReplace()
        -handleBatchRead()
        -handleBatchWrite()
    }

    class AnalysisHandler {
        +handle(input): Promise~Output~
        +shouldCreateTask(): boolean
        -executeAnalysisTask()
        -handleDataQuality()
        -handleFormulaAudit()
        -handleStatistics()
        -handleStructureAnalysis()
    }

    class HandlerFactory {
        +handlers: Map~string, Handler~
        +loaders: Map~string, Function~
        +get(name): Handler
        -lazyLoad(name): Handler
    }

    BaseHandler <|-- SpreadsheetHandler
    BaseHandler <|-- ValuesHandler
    BaseHandler <|-- AnalysisHandler
    BaseHandler o-- HandlerContext
    HandlerFactory o-- BaseHandler : manages

    note for HandlerFactory "Lazy loads handlers on first use\nReduces startup time\nMinimizes memory footprint"

    note for AnalysisHandler "Task support for long-running\noperations (data quality,\nformula audit)"
```

---

## OAuth Authentication Flow

Complete OAuth 2.1 flow with PKCE.

```mermaid
sequenceDiagram
    actor User
    participant Client
    participant ServalSheets as ServalSheets OAuth Provider
    participant Google as Google OAuth 2.0

    User->>Client: Initiate Authentication

    Client->>Client: Generate code_verifier (random)
    Client->>Client: Calculate code_challenge = SHA256(code_verifier)

    Client->>ServalSheets: GET /oauth/authorize<br/>?code_challenge=...&code_challenge_method=S256

    ServalSheets->>ServalSheets: Validate PKCE parameters
    ServalSheets->>ServalSheets: Store code_challenge

    ServalSheets->>Google: Redirect to Google OAuth
    Google->>User: Show Consent Screen
    User->>Google: Grant Permissions

    Google->>ServalSheets: Redirect with authorization code
    ServalSheets->>Client: Redirect to callback with code

    Client->>ServalSheets: POST /oauth/token<br/>code + code_verifier

    ServalSheets->>ServalSheets: Verify PKCE:<br/>SHA256(code_verifier) == code_challenge

    alt PKCE Valid
        ServalSheets->>Google: Exchange code for tokens
        Google-->>ServalSheets: access_token + refresh_token
        ServalSheets->>ServalSheets: Store tokens (encrypted)
        ServalSheets-->>Client: access_token + refresh_token

        Client->>Client: Store tokens securely
        Client->>ServalSheets: API Request with Bearer token
        ServalSheets->>Google: Google API call
        Google-->>ServalSheets: API Response
        ServalSheets-->>Client: Response
    else PKCE Invalid
        ServalSheets-->>Client: Error: invalid_grant
        Client->>User: Show error, restart flow
    end

    Note over Client,ServalSheets: Token expires after 1 hour

    Client->>ServalSheets: POST /oauth/token<br/>grant_type=refresh_token
    ServalSheets->>Google: Exchange refresh token
    Google-->>ServalSheets: New access_token
    ServalSheets-->>Client: New access_token
    Client->>ServalSheets: Continue API requests
```

---

## Data Flow Diagram

How data flows through ServalSheets when processing a spreadsheet operation.

```mermaid
flowchart LR
    subgraph Input
        User[User Input]
        Schema[Zod Schema]
    end

    subgraph Validation
        Parse[Parse Request]
        Validate[Validate Schema]
        Transform[Transform Data]
    end

    subgraph Processing
        Range[Range Resolver]
        Batch[Batch Compiler]
        Rate[Rate Limiter]
    end

    subgraph External
        GoogleAPI[Google Sheets API]
        Cache[Response Cache]
    end

    subgraph Output
        Format[Format Response]
        Structure[Structured Content]
        Error[Error Handler]
    end

    User --> Parse
    Schema --> Validate
    Parse --> Validate

    Validate -->|Valid| Transform
    Validate -->|Invalid| Error

    Transform --> Range
    Range --> Batch
    Batch --> Rate

    Rate -->|Allowed| GoogleAPI
    Rate -->|Denied| Error

    GoogleAPI -->|Success| Cache
    GoogleAPI -->|Error| Error

    Cache --> Format
    Format --> Structure
    Structure --> User
    Error --> Structure

    style User fill:#e1f5ff
    style Structure fill:#c8e6c9
    style Error fill:#ffcdd2
    style GoogleAPI fill:#fff4e6
```

---

## Task System Architecture

How long-running operations are handled via task system.

```mermaid
stateDiagram-v2
    [*] --> Created: tools/call with task param

    Created --> Working: Background execution starts
    Working --> Working: Progress updates

    Working --> Completed: Operation succeeds
    Working --> Failed: Operation fails
    Working --> InputRequired: Needs user input (elicitation)
    Working --> Cancelled: User cancels

    InputRequired --> Working: User provides input

    Completed --> [*]
    Failed --> [*]
    Cancelled --> [*]

    note right of Created
        Task created with TTL
        taskId returned to client
        Client polls with tasks/get
    end note

    note right of Working
        Status updates via
        updateTaskStatus()
        Supports progress messages
    end note

    note right of InputRequired
        SEP-1036: Elicitation
        Server requests user input
        Client provides via tasks/input
    end note

    note right of Completed
        Result stored in task store
        Retrieved via tasks/result
        Auto-cleanup after TTL
    end note
```

```mermaid
sequenceDiagram
    actor Client
    participant MCP as MCP Server
    participant TaskStore
    participant Handler
    participant Google as Google API

    Client->>MCP: tools/call with task param
    MCP->>TaskStore: createTask(ttl: 300000)
    TaskStore-->>MCP: taskId + status: working
    MCP-->>Client: Return task object

    par Background Execution
        MCP->>Handler: Execute in background
        Handler->>TaskStore: updateTaskStatus(working, "Step 1/4")
        Handler->>Google: API Call 1
        Handler->>TaskStore: updateTaskStatus(working, "Step 2/4")
        Handler->>Google: API Call 2
        Handler->>TaskStore: updateTaskStatus(working, "Step 3/4")
        Handler->>Google: API Call 3
        Handler->>TaskStore: updateTaskStatus(working, "Step 4/4")
        Handler->>TaskStore: storeTaskResult(result)
        Handler->>TaskStore: updateTaskStatus(completed)
    end

    loop Polling
        Client->>MCP: tasks/get(taskId)
        MCP->>TaskStore: getTask(taskId)
        TaskStore-->>MCP: Task with current status
        MCP-->>Client: Task status + progress

        alt Task Completed
            Client->>MCP: tasks/result(taskId)
            MCP->>TaskStore: getTaskResult(taskId)
            TaskStore-->>MCP: Result data
            MCP-->>Client: CallToolResult
        else Task Still Working
            Client->>Client: Wait pollInterval (5s)
        end
    end
```

---

## Deployment Architecture Options

### Option 1: Single Server Deployment

```mermaid
graph TB
    subgraph "Single Server"
        App[ServalSheets Server<br/>:3000]
        Redis[(Redis<br/>:6379)]
        Tokens[Token Store<br/>Encrypted File]
    end

    subgraph "Clients"
        CLI1[Claude CLI 1]
        CLI2[Claude CLI 2]
        Desktop[Claude Desktop]
    end

    subgraph "External"
        Google[Google APIs]
    end

    CLI1 & CLI2 & Desktop --> App
    App --> Redis
    App --> Tokens
    App --> Google

    style App fill:#e1f5ff
    style Redis fill:#ffebee
    style Tokens fill:#fff4e6
```

### Option 2: Load Balanced Deployment

```mermaid
graph TB
    subgraph "Clients"
        CLI1[Claude CLI]
        Desktop[Claude Desktop]
        Custom[Custom Clients]
    end

    subgraph "Load Balancer"
        LB[nginx / ALB<br/>:443 HTTPS]
    end

    subgraph "Application Tier"
        App1[ServalSheets<br/>Instance 1]
        App2[ServalSheets<br/>Instance 2]
        App3[ServalSheets<br/>Instance 3]
    end

    subgraph "Shared Storage"
        Redis[(Redis Cluster<br/>Sessions & Tasks)]
    end

    subgraph "External Services"
        Google[Google APIs]
    end

    CLI1 & Desktop & Custom --> LB
    LB --> App1 & App2 & App3
    App1 & App2 & App3 --> Redis
    App1 & App2 & App3 --> Google

    style LB fill:#b39ddb
    style Redis fill:#ffebee
    style App1 fill:#e1f5ff
    style App2 fill:#e1f5ff
    style App3 fill:#e1f5ff
```

### Option 3: Kubernetes Deployment

```mermaid
graph TB
    subgraph "Kubernetes Cluster"
        subgraph "Ingress"
            Ingress[Ingress Controller<br/>cert-manager for TLS]
        end

        subgraph "Application Namespace"
            Deployment[Deployment<br/>ServalSheets<br/>replicas: 3-20]
            HPA[HorizontalPodAutoscaler<br/>CPU/Memory based]
            Service[Service<br/>ClusterIP]
        end

        subgraph "Storage"
            Redis[(Redis StatefulSet<br/>or External Redis)]
            PVC[PersistentVolumeClaim<br/>for configs]
        end

        subgraph "Secrets"
            TLS[TLS Certificate]
            Creds[OAuth Credentials]
            TokenKey[Token Store Key]
        end
    end

    subgraph "External"
        Users[Clients]
        Google[Google APIs]
    end

    Users --> Ingress
    Ingress --> Service
    Service --> Deployment
    HPA --> Deployment
    Deployment --> Redis
    Deployment --> PVC
    Deployment --> Creds & TokenKey
    Deployment --> Google
    Ingress --> TLS

    style Ingress fill:#b39ddb
    style Deployment fill:#e1f5ff
    style Redis fill:#ffebee
    style HPA fill:#c5e1a5
```

---

## Error Handling Flow

How errors are caught, structured, and returned to clients.

```mermaid
flowchart TD
    Start[Operation Execution] --> Try{Try}

    Try -->|Success| Success[Build Success Response]
    Try -->|Error| Catch[Catch Error]

    Catch --> ErrorType{Error Type?}

    ErrorType -->|ServalSheetsError| Structured[Already Structured]
    ErrorType -->|Google API Error| MapGoogle[Map Google Error]
    ErrorType -->|Validation Error| MapValidation[Map Validation Error]
    ErrorType -->|Unknown Error| MapUnknown[Map to Internal Error]

    MapGoogle --> BuildError[Build Error Response]
    MapValidation --> BuildError
    MapUnknown --> BuildError
    Structured --> BuildError

    BuildError --> AddContext[Add Context]
    AddContext --> AddResolution[Add Resolution Steps]
    AddResolution --> DetermineRetry{Retryable?}

    DetermineRetry -->|Yes| AddRetryInfo[Add Retry Strategy]
    DetermineRetry -->|No| AddFix[Add Fix Guidance]

    AddRetryInfo --> LogError[Log Error]
    AddFix --> LogError

    LogError --> ReturnError[Return Error Response]
    Success --> ReturnSuccess[Return Success Response]

    ReturnError --> Client[Client Receives]
    ReturnSuccess --> Client

    Client --> ClientCheck{Retryable?}
    ClientCheck -->|Yes| Retry[Implement Retry Logic]
    ClientCheck -->|No| ShowUser[Show Error to User]

    Retry --> Backoff[Exponential Backoff]
    Backoff --> Start

    style Start fill:#e1f5ff
    style ReturnSuccess fill:#c8e6c9
    style ReturnError fill:#ffcdd2
    style Retry fill:#fff9c4
```

---

## Component Interaction Matrix

Summary of how major components interact.

```mermaid
graph LR
    subgraph "Entry Points"
        HTTP[HTTP Server]
        STDIO[STDIO Transport]
    end

    subgraph "Core"
        MCP[MCP Server]
        Handlers[Handler Layer]
    end

    subgraph "Services"
        Google[Google API Client]
        OAuth[OAuth Provider]
        Tasks[Task Store]
    end

    subgraph "Utilities"
        RateLimit[Rate Limiter]
        Batch[Batch Compiler]
        Range[Range Resolver]
    end

    HTTP --> MCP
    STDIO --> MCP

    MCP --> Handlers
    MCP --> OAuth
    MCP --> Tasks

    Handlers --> Google
    Handlers --> RateLimit
    Handlers --> Batch
    Handlers --> Range

    OAuth --> Tasks
    Google --> RateLimit

    style MCP fill:#e1f5ff
    style Google fill:#fff4e6
    style OAuth fill:#f3e5f5
```

---

## Notes

All diagrams are rendered using Mermaid syntax and can be viewed in:
- GitHub (native support)
- GitLab (native support)
- VS Code (with Mermaid extension)
- Documentation sites (Docsify, MkDocs, etc.)
- Mermaid Live Editor: https://mermaid.live

To update diagrams, edit the Mermaid code blocks and the rendered output will update automatically in supported viewers.
