**Status:** Implemented (P3-1) ✅
**Priority:** Nice-to-have
**Complexity:** High
**Implementation:** Complete with Apollo Server v5

---

# GraphQL API

ServalSheets provides a comprehensive GraphQL API as an alternative to the REST/MCP interfaces. The GraphQL API offers type-safe queries and mutations for all 24 tools with 305 actions.

## Overview

The GraphQL API provides:

- **Type-Safe Schema** - Auto-generated from Zod schemas
- **Single Endpoint** - `/graphql` for all operations
- **GraphQL Playground** - Interactive API explorer (development)
- **24 Tools** - Complete coverage of ServalSheets functionality
- **Unified Interface** - Queries for reads, Mutations for writes
- **Authentication** - Bearer token and OAuth 2.0 support

## Quick Start

### 1. Enable GraphQL Endpoint

GraphQL is automatically enabled when running the HTTP server:

```bash
npm run start:http
```

The GraphQL endpoint will be available at:

```
http://localhost:3000/graphql
```

### 2. Access GraphQL Playground

In development mode, open your browser to:

```
http://localhost:3000/graphql
```

This provides an interactive GraphQL IDE with:

- Schema exploration
- Query/mutation building
- Auto-completion
- Documentation sidebar

### 3. Make Your First Query

```graphql
query ReadSpreadsheet {
  data(
    input: { action: "read_range", spreadsheetId: "YOUR_SPREADSHEET_ID", range: "Sheet1!A1:B10" }
  ) {
    success
    action
    data
    error {
      code
      message
    }
  }
}
```

### 4. Execute a Mutation

```graphql
mutation WriteData {
  dataWrite(
    input: {
      action: "write_range"
      spreadsheetId: "YOUR_SPREADSHEET_ID"
      range: "Sheet1!A1:B2"
      values: [["A1", "B1"], ["A2", "B2"]]
    }
  ) {
    success
    action
    data
  }
}
```

## API Structure

### Queries (Read Operations)

GraphQL queries map to read-only operations:

| Query          | Tool                | Description           |
| -------------- | ------------------- | --------------------- |
| `auth`         | sheets_auth         | Authentication status |
| `core`         | sheets_core         | Spreadsheet metadata  |
| `data`         | sheets_data         | Cell data reads       |
| `format`       | sheets_format       | Format queries        |
| `dimensions`   | sheets_dimensions   | Row/column info       |
| `visualize`    | sheets_visualize    | Charts/pivots         |
| `collaborate`  | sheets_collaborate  | Sharing info          |
| `advanced`     | sheets_advanced     | Named ranges, etc.    |
| `transaction`  | sheets_transaction  | Transaction status    |
| `quality`      | sheets_quality      | Data quality          |
| `history`      | sheets_history      | Operation history     |
| `analyze`      | sheets_analyze      | AI analysis           |
| `session`      | sheets_session      | Session context       |
| `templates`    | sheets_templates    | Template catalog      |
| `bigquery`     | sheets_bigquery     | BigQuery queries      |
| `appsscript`   | sheets_appsscript   | Apps Script info      |
| `webhook`      | sheets_webhook      | Webhook config        |
| `dependencies` | sheets_dependencies | Formula deps          |
| `federation`   | sheets_federation   | Federated servers     |

### Mutations (Write Operations)

GraphQL mutations map to write operations:

| Mutation             | Tool               | Description                |
| -------------------- | ------------------ | -------------------------- |
| `coreWrite`          | sheets_core        | Create/update spreadsheets |
| `dataWrite`          | sheets_data        | Write cell data            |
| `formatWrite`        | sheets_format      | Apply formatting           |
| `dimensionsWrite`    | sheets_dimensions  | Modify rows/columns        |
| `visualizeWrite`     | sheets_visualize   | Create charts              |
| `collaborateWrite`   | sheets_collaborate | Share/comment              |
| `advancedWrite`      | sheets_advanced    | Named ranges               |
| `transactionExecute` | sheets_transaction | Execute transactions       |
| `qualityWrite`       | sheets_quality     | Apply validation           |
| `confirm`            | sheets_confirm     | User confirmations         |
| `fix`                | sheets_fix         | Auto-fix issues            |
| `composite`          | sheets_composite   | Multi-step ops             |
| `sessionWrite`       | sheets_session     | Update session             |
| `templatesWrite`     | sheets_templates   | Apply templates            |
| `bigqueryWrite`      | sheets_bigquery    | BigQuery operations        |
| `appsscriptWrite`    | sheets_appsscript  | Execute scripts            |
| `webhookWrite`       | sheets_webhook     | Configure webhooks         |
| `federationWrite`    | sheets_federation  | Federation ops             |

### Response Format

All operations return a standardized `Response` type:

```graphql
type Response {
  success: Boolean!
  action: String
  data: JSON
  error: Error
}

type Error {
  code: String!
  message: String!
  details: JSON
  retryable: Boolean
}
```

## Authentication

### Bearer Token

Include authentication token in HTTP header:

```
Authorization: Bearer YOUR_TOKEN
```

### GraphQL Request

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { data(input: { action: \"read_range\", spreadsheetId: \"...\", range: \"A1:B10\" }) { success data } }"
  }'
```

## Examples

### Read Range

```graphql
query ReadRange {
  data(input: { action: "read_range", spreadsheetId: "1abc...", range: "Sheet1!A1:B10" }) {
    success
    data
    error {
      code
      message
    }
  }
}
```

### Write Range

```graphql
mutation WriteRange {
  dataWrite(
    input: {
      action: "write_range"
      spreadsheetId: "1abc..."
      range: "Sheet1!A1:C3"
      values: [
        ["Name", "Age", "Email"]
        ["Alice", 30, "alice@example.com"]
        ["Bob", 25, "bob@example.com"]
      ]
    }
  ) {
    success
    action
    data
  }
}
```

### Create Spreadsheet

```graphql
mutation CreateSpreadsheet {
  coreWrite(
    input: {
      action: "create_spreadsheet"
      title: "My New Spreadsheet"
      properties: { locale: "en_US", timeZone: "America/New_York" }
    }
  ) {
    success
    data
  }
}
```

### Apply Formatting

```graphql
mutation FormatCells {
  formatWrite(
    input: {
      action: "format_range"
      spreadsheetId: "1abc..."
      range: "Sheet1!A1:A10"
      format: {
        backgroundColor: { red: 1.0, green: 0.9, blue: 0.9 }
        textFormat: { bold: true, fontSize: 12 }
      }
    }
  ) {
    success
    action
  }
}
```

### Create Chart

```graphql
mutation CreateChart {
  visualizeWrite(
    input: {
      action: "create_chart"
      spreadsheetId: "1abc..."
      sheetId: 0
      chartSpec: {
        title: "Sales by Region"
        chartType: "COLUMN"
        basicChart: {
          chartType: "COLUMN"
          domains: [
            { sourceRange: { sources: [{ sheetId: 0, startRowIndex: 0, endRowIndex: 10 }] } }
          ]
        }
      }
    }
  ) {
    success
    data
  }
}
```

### Analyze Data

```graphql
query AnalyzeData {
  analyze(
    input: {
      action: "comprehensive"
      spreadsheetId: "1abc..."
      range: "Sheet1!A1:Z1000"
      options: { includePatterns: true, includeQuality: true, includeStatistics: true }
    }
  ) {
    success
    data
  }
}
```

### Execute Transaction

```graphql
mutation ExecuteTransaction {
  transactionExecute(
    input: {
      action: "begin"
      description: "Update sales data"
      operations: [
        { type: "write_range", range: "A1:A10", values: [[1], [2], [3]] }
        { type: "format_range", range: "A1:A10", format: { bold: true } }
      ]
    }
  ) {
    success
    data
  }
}
```

## Client Libraries

### JavaScript/TypeScript

```typescript
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:3000/graphql',
  cache: new InMemoryCache(),
  headers: {
    authorization: `Bearer ${token}`,
  },
});

const READ_RANGE = gql`
  query ReadRange($input: SheetsDataInput!) {
    data(input: $input) {
      success
      data
      error {
        code
        message
      }
    }
  }
`;

const { data } = await client.query({
  query: READ_RANGE,
  variables: {
    input: {
      action: 'read_range',
      spreadsheetId: '1abc...',
      range: 'Sheet1!A1:B10',
    },
  },
});
```

### Python (with gql)

```python
from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport

transport = RequestsHTTPTransport(
    url='http://localhost:3000/graphql',
    headers={'Authorization': f'Bearer {token}'}
)

client = Client(transport=transport, fetch_schema_from_transport=True)

query = gql('''
    query ReadRange($input: SheetsDataInput!) {
        data(input: $input) {
            success
            data
        }
    }
''')

result = client.execute(query, variable_values={
    'input': {
        'action': 'read_range',
        'spreadsheetId': '1abc...',
        'range': 'Sheet1!A1:B10'
    }
})
```

### curl

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "query": "query ReadRange($input: SheetsDataInput!) { data(input: $input) { success data } }",
  "variables": {
    "input": {
      "action": "read_range",
      "spreadsheetId": "1abc...",
      "range": "Sheet1!A1:B10"
    }
  }
}
EOF
```

## Configuration

### Environment Variables

```bash
# Enable/disable GraphQL
GRAPHQL_ENABLED=true

# GraphQL Playground (development only)
GRAPHQL_PLAYGROUND=true

# Introspection (disable in production)
GRAPHQL_INTROSPECTION=false

# Request body limit
GRAPHQL_BODY_LIMIT=10mb
```

### Programmatic Configuration

```typescript
import { ServalSheetsGraphQLServer } from './graphql';

const graphqlServer = new ServalSheetsGraphQLServer({
  playground: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
  cors: true,
  bodyLimit: '10mb',
});

await graphqlServer.register(app, googleClient, handlerContext);
```

## Schema Introspection

### Get Full Schema

```graphql
query IntrospectionQuery {
  __schema {
    types {
      name
      description
      fields {
        name
        description
        type {
          name
          kind
        }
      }
    }
  }
}
```

### List Available Operations

```graphql
query {
  __schema {
    queryType {
      fields {
        name
        description
      }
    }
    mutationType {
      fields {
        name
        description
      }
    }
  }
}
```

## Performance

### Query Optimization

**Use specific fields:**

```graphql
# Good - Request only needed fields
query {
  data(input: {...}) {
    success
    data
  }
}

# Bad - Request all fields including errors unnecessarily
query {
  data(input: {...}) {
    success
    action
    data
    error {
      code
      message
      details
      retryable
    }
  }
}
```

### Batch Operations

Use `composite` for multiple operations:

```graphql
mutation BatchOperations {
  composite(
    input: {
      action: "batch"
      spreadsheetId: "1abc..."
      operations: [
        { type: "write", range: "A1:A10", values: [[1], [2]] }
        { type: "format", range: "A1:A10", format: { bold: true } }
      ]
    }
  ) {
    success
    data
  }
}
```

## Error Handling

GraphQL errors follow this structure:

```json
{
  "errors": [
    {
      "message": "Operation failed",
      "extensions": {
        "code": "INVALID_RANGE",
        "toolName": "data",
        "action": "read_range"
      },
      "path": ["data"]
    }
  ],
  "data": null
}
```

### Common Error Codes

| Code                    | Description            | Retryable |
| ----------------------- | ---------------------- | --------- |
| `UNAUTHENTICATED`       | Missing/invalid auth   | No        |
| `HANDLER_NOT_FOUND`     | Unknown tool           | No        |
| `INVALID_RANGE`         | Bad range format       | No        |
| `SPREADSHEET_NOT_FOUND` | Spreadsheet ID invalid | No        |
| `RATE_LIMIT_EXCEEDED`   | Too many requests      | Yes       |
| `INTERNAL_ERROR`        | Server error           | Yes       |

## Monitoring

### GraphQL Info Endpoint

```bash
curl http://localhost:3000/graphql/info
```

Returns:

```json
{
  "endpoint": "http://localhost:3000/graphql",
  "playground": "http://localhost:3000/graphql",
  "introspection": true,
  "tools": 24,
  "actions": 299,
  "protocol": "GraphQL",
  "examples": {
    "query": "...",
    "mutation": "..."
  }
}
```

## Troubleshooting

### GraphQL Playground Not Loading

**Problem:** Playground shows blank page

**Solution:**

```bash
# Ensure not in production mode
export NODE_ENV=development
npm run start:http
```

### Authentication Errors

**Problem:** `UNAUTHENTICATED: Missing authorization header`

**Solution:**

```graphql
# Add HTTP header in Playground:
{
  "Authorization": "Bearer YOUR_TOKEN"
}
```

### Schema Not Found

**Problem:** `Cannot query field "data" on type "Query"`

**Solution:**

```bash
# Rebuild and restart
npm run build
npm run start:http
```

## Architecture

### GraphQL → MCP Bridge

```
GraphQL Request
  ↓
Apollo Server (src/graphql/server.ts)
  ↓
Resolver (src/graphql/resolvers.ts)
  ↓
Handler (src/handlers/*.ts)
  ↓
Google Sheets API
  ↓
GraphQL Response
```

### Type System

GraphQL schema is generated from Zod schemas:

1. **Zod Schema** (`src/schemas/*.ts`) - Source of truth
2. **Tool Definitions** (`src/mcp/registration/tool-definitions.ts`) - MCP metadata
3. **GraphQL Schema** (`src/graphql/schema.ts`) - GraphQL types
4. **Resolvers** (`src/graphql/resolvers.ts`) - Execution layer

## Comparison with REST/MCP

| Feature                 | GraphQL           | REST             | MCP       |
| ----------------------- | ----------------- | ---------------- | --------- |
| **Endpoint**            | Single `/graphql` | Multiple `/v1/*` | STDIO/SSE |
| **Schema**              | Introspectable    | OpenAPI          | JSON-RPC  |
| **Type Safety**         | Strong            | Moderate         | Strong    |
| **Over/Under-fetching** | No                | Yes              | No        |
| **Batching**            | Native            | Manual           | Protocol  |
| **Real-time**           | Subscriptions\*   | SSE              | Streaming |
| **Learning Curve**      | Moderate          | Low              | High      |
| **Tooling**             | Excellent         | Good             | Limited   |

\*Note: Subscriptions not yet implemented

## Roadmap

### Phase 1 (Complete) ✅

- [x] GraphQL schema generation
- [x] Query/Mutation resolvers
- [x] Apollo Server integration
- [x] Authentication
- [x] GraphQL Playground

### Phase 2 (Future)

- [ ] GraphQL Subscriptions for real-time updates
- [ ] DataLoader for batching/caching
- [ ] Federation support
- [ ] Persisted queries
- [ ] Rate limiting per operation
- [ ] Custom scalar types
- [ ] Input validation directives

## Additional Resources

- [GraphQL Official Docs](https://graphql.org/learn/)
- [Apollo Server Docs](https://www.apollographql.com/docs/apollo-server/)
- [ServalSheets MCP Protocol](./MCP_PROTOCOL.md)
- [OpenAPI Documentation](./OPENAPI_DOCUMENTATION.md)

## Contributing

When adding new GraphQL features:

1. **Update Schema** - Modify `src/graphql/schema.ts`
2. **Update Resolvers** - Add resolver in `src/graphql/resolvers.ts`
3. **Add Tests** - Create integration tests
4. **Update Docs** - Document new queries/mutations

## License

GraphQL API implementation is part of ServalSheets and licensed under MIT.
