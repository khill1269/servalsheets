# Apps Script Integration Analysis for ServalSheets

## Executive Summary

After analyzing both the existing mohalmah/google-appscript-mcp-server and official Google documentation, I recommend a **Hybrid Approach** that builds a TypeScript-native implementation while leveraging proven patterns from the existing server.

**Timeline Estimate: 2-3 days** (down from 3-4 days original estimate)

---

## Part 1: Official Google Apps Script API Structure

### API Endpoint
```
Base URL: https://script.googleapis.com/v1
```

### Resources Overview

| Resource | Operations | Description |
|----------|------------|-------------|
| `projects` | create, get, getContent, getMetrics, updateContent | Script project management |
| `projects.deployments` | create, delete, get, list, update | Deployment management |
| `projects.versions` | create, get, list | Version control |
| `scripts` | run | Execute script functions |
| `processes` | list, listScriptProcesses | Execution monitoring |

### Key API Endpoints

#### 1. Script Execution (`scripts.run`)
```
POST https://script.googleapis.com/v1/scripts/{deploymentId}:run

Request Body:
{
  "function": "myFunction",       // Function name (no parentheses)
  "parameters": [value, ...],     // Primitive types only
  "devMode": boolean              // Run latest saved (owner only)
}

Response:
{
  "done": boolean,
  "response": { "result": any },  // On success
  "error": { "code": int, ... }   // On failure
}
```

#### 2. Project Management
```
# Create project
POST /v1/projects
{ "title": "My Script" }

# Get project content
GET /v1/projects/{scriptId}/content

# Update content
PUT /v1/projects/{scriptId}/content
{ "files": [{ "name": "Code", "type": "SERVER_JS", "source": "..." }] }
```

#### 3. Deployments
```
# Create deployment
POST /v1/projects/{scriptId}/deployments
{
  "versionNumber": 1,
  "manifestFileName": "appsscript",
  "description": "API deployment"
}

# List deployments
GET /v1/projects/{scriptId}/deployments
```

#### 4. Versions
```
# Create version (immutable snapshot)
POST /v1/projects/{scriptId}/versions
{ "description": "Version description" }

# List versions
GET /v1/projects/{scriptId}/versions
```

### Required OAuth Scopes

For ServalSheets integration, we need these scopes:
```typescript
const APPS_SCRIPT_SCOPES = [
  'https://www.googleapis.com/auth/script.projects',      // Manage projects
  'https://www.googleapis.com/auth/script.deployments',   // Manage deployments
  'https://www.googleapis.com/auth/script.processes',     // Monitor processes
  'https://www.googleapis.com/auth/spreadsheets',         // For Sheets-bound scripts
  'https://www.googleapis.com/auth/drive.file'            // File access
];
```

### Critical Limitations

1. **No Service Account Support**: Apps Script API does NOT work with service accounts
2. **Shared Cloud Project Required**: Calling app must share Cloud Platform project with script
3. **Parameter Restrictions**: Only primitive types (string, number, array, object, boolean)
4. **No Script-Specific Objects**: Can't pass Document, Calendar, etc. as parameters
5. **Execution Timeout**: Subject to Apps Script quotas (6 min for consumer, 30 min for Workspace)

---

## Part 2: mohalmah Implementation Analysis

### What They Built Well

#### OAuth Flow (Reusable Pattern)
```javascript
// Their approach - OS keychain storage
const keytar = require('keytar');
const SERVICE_NAME = 'google-appscript-mcp-server';

async function storeTokens(tokens) {
  await keytar.setPassword(SERVICE_NAME, 'access_token', tokens.access_token);
  await keytar.setPassword(SERVICE_NAME, 'refresh_token', tokens.refresh_token);
}
```

**ServalSheets Adaptation**: We already have encrypted token storage - we can extend it.

#### Token Refresh with Exponential Backoff
```javascript
async function refreshAccessToken(retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(TOKEN_URL, {
        method: 'POST',
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });
      return response.json();
    } catch (error) {
      await sleep(delay * Math.pow(2, i));
    }
  }
  throw new Error('Token refresh failed');
}
```

**ServalSheets Adaptation**: Same pattern, but TypeScript with proper types.

#### Tool Structure (17 Tools)
```
Project Management:
- projects-create       ✓ Reuse logic
- projects-get          ✓ Reuse logic
- projects-get-content  ✓ Reuse logic
- projects-update-content ✓ Reuse logic

Versions:
- versions-create       ✓ Reuse logic
- versions-get          ✓ Reuse logic
- versions-list         ✓ Reuse logic

Deployments:
- deployments-create    ✓ Reuse logic
- deployments-get       ✓ Reuse logic
- deployments-list      ✓ Reuse logic
- deployments-update    ✓ Reuse logic
- deployments-delete    ✓ Reuse logic

Execution:
- scripts-run           ✓ Critical - reuse logic

Monitoring:
- processes-list        ✓ Reuse logic
- metrics-get           ✓ Reuse logic
```

### What We Need to Change

1. **JavaScript → TypeScript**: Type-safe implementation
2. **Separate OAuth → Unified OAuth**: Integrate with existing ServalSheets OAuth flow
3. **17 Tools → 1-3 Action-Based Tools**: Match ServalSheets v4 pattern
4. **Node-fetch → Built-in fetch**: Modern Node.js

---

## Part 3: Recommended Tool Structure

### Option A: Single Unified Tool (Preferred)
```typescript
// One tool with action discriminator
const AppsScriptSchema = z.object({
  action: z.enum([
    // Projects
    'project_create', 'project_get', 'project_get_content', 'project_update_content',
    // Versions
    'version_create', 'version_get', 'version_list',
    // Deployments
    'deploy_create', 'deploy_get', 'deploy_list', 'deploy_update', 'deploy_delete',
    // Execution
    'script_run',
    // Monitoring
    'process_list', 'metrics_get'
  ]),
  // Action-specific fields...
});

// Tool registration
mcp.registerTool('sheets_appscript', {
  description: 'Manage and execute Google Apps Script projects',
  inputSchema: zodToJsonSchema(AppsScriptSchema),
  annotations: {
    title: 'Apps Script Management',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true
  }
}, handleAppsScript);
```

### Option B: Three Focused Tools
```typescript
// 1. Project management
mcp.registerTool('sheets_appscript_project', ...);  // create, get, content, update

// 2. Deployment management  
mcp.registerTool('sheets_appscript_deploy', ...);   // create, list, update, delete

// 3. Execution & monitoring
mcp.registerTool('sheets_appscript_exec', ...);     // run, processes, metrics
```

### Recommendation: Option A
Single tool aligns with ServalSheets v4 consolidation pattern, reduces context window overhead.

---

## Part 4: Implementation Plan

### Day 1: Core Infrastructure (4-5 hours)

#### 1.1 OAuth Scope Extension
```typescript
// src/auth/scopes.ts
export const SERVALSHEETS_SCOPES = [
  // Existing Sheets scopes
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  
  // NEW: Apps Script scopes
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments', 
  'https://www.googleapis.com/auth/script.processes',
  'https://www.googleapis.com/auth/script.scriptapp'
];
```

#### 1.2 Apps Script API Client
```typescript
// src/services/appscript-client.ts
import { google } from 'googleapis';

export class AppsScriptClient {
  private script: script_v1.Script;
  
  constructor(auth: OAuth2Client) {
    this.script = google.script({ version: 'v1', auth });
  }
  
  // Project methods
  async createProject(title: string, parentId?: string): Promise<Project> {
    const res = await this.script.projects.create({
      requestBody: { title, parentId }
    });
    return res.data;
  }
  
  async getProject(scriptId: string): Promise<Project> {
    const res = await this.script.projects.get({ scriptId });
    return res.data;
  }
  
  async getContent(scriptId: string): Promise<Content> {
    const res = await this.script.projects.getContent({ scriptId });
    return res.data;
  }
  
  async updateContent(scriptId: string, files: File[]): Promise<Content> {
    const res = await this.script.projects.updateContent({
      scriptId,
      requestBody: { files }
    });
    return res.data;
  }
  
  // Execution methods
  async runScript(scriptId: string, functionName: string, parameters?: any[]): Promise<any> {
    const res = await this.script.scripts.run({
      scriptId,
      requestBody: {
        function: functionName,
        parameters: parameters || [],
        devMode: false
      }
    });
    
    if (res.data.error) {
      throw new AppsScriptExecutionError(res.data.error);
    }
    
    return res.data.response?.result;
  }
  
  // Deployment methods
  async createDeployment(scriptId: string, versionNumber: number, description?: string) {
    const res = await this.script.projects.deployments.create({
      scriptId,
      requestBody: {
        versionNumber,
        manifestFileName: 'appsscript',
        description
      }
    });
    return res.data;
  }
  
  async listDeployments(scriptId: string) {
    const res = await this.script.projects.deployments.list({ scriptId });
    return res.data.deployments || [];
  }
  
  // Version methods
  async createVersion(scriptId: string, description?: string) {
    const res = await this.script.projects.versions.create({
      scriptId,
      requestBody: { description }
    });
    return res.data;
  }
  
  async listVersions(scriptId: string) {
    const res = await this.script.projects.versions.list({ scriptId });
    return res.data.versions || [];
  }
  
  // Process monitoring
  async listProcesses(userProcessFilter?: ProcessFilter) {
    const res = await this.script.processes.list({
      userProcessFilter
    });
    return res.data.processes || [];
  }
}
```

### Day 2: Tool Handler Implementation (4-5 hours)

#### 2.1 Schema Definition
```typescript
// src/schemas/appscript.ts
import { z } from 'zod';

// Base schemas
const ScriptIdSchema = z.string().min(1).describe('Apps Script project ID');

// Action-specific request schemas
const ProjectCreateRequest = z.object({
  action: z.literal('project_create'),
  title: z.string().min(1),
  parentId: z.string().optional().describe('Drive folder or document ID to bind script')
});

const ProjectGetRequest = z.object({
  action: z.literal('project_get'),
  scriptId: ScriptIdSchema
});

const ScriptRunRequest = z.object({
  action: z.literal('script_run'),
  scriptId: ScriptIdSchema,
  functionName: z.string().min(1),
  parameters: z.array(z.any()).optional(),
  devMode: z.boolean().optional().default(false)
});

const DeploymentCreateRequest = z.object({
  action: z.literal('deploy_create'),
  scriptId: ScriptIdSchema,
  versionNumber: z.number().int().positive(),
  description: z.string().optional()
});

// Union schema
export const AppsScriptRequestSchema = z.discriminatedUnion('action', [
  ProjectCreateRequest,
  ProjectGetRequest,
  // ... other actions
  ScriptRunRequest,
  DeploymentCreateRequest,
  // ... other actions
]);
```

#### 2.2 Handler Implementation
```typescript
// src/handlers/appscript.handler.ts
import { AppsScriptClient } from '../services/appscript-client';
import { buildToolResponse } from '../utils/response';

export async function handleAppsScript(
  request: z.infer<typeof AppsScriptRequestSchema>,
  context: HandlerContext
): Promise<ToolResponse> {
  const client = new AppsScriptClient(context.auth);
  
  switch (request.action) {
    case 'project_create': {
      const project = await client.createProject(request.title, request.parentId);
      return buildToolResponse({
        content: `Created Apps Script project "${request.title}" (${project.scriptId})`,
        structuredContent: {
          scriptId: project.scriptId,
          title: project.title,
          createTime: project.createTime
        }
      });
    }
    
    case 'script_run': {
      try {
        const result = await client.runScript(
          request.scriptId,
          request.functionName,
          request.parameters
        );
        return buildToolResponse({
          content: `Executed ${request.functionName}() successfully`,
          structuredContent: {
            success: true,
            result,
            functionName: request.functionName
          }
        });
      } catch (error) {
        if (error instanceof AppsScriptExecutionError) {
          return buildToolResponse({
            content: `Script execution failed: ${error.message}`,
            structuredContent: {
              success: false,
              error: error.details,
              functionName: request.functionName
            },
            isError: true
          });
        }
        throw error;
      }
    }
    
    // ... other cases
  }
}
```

### Day 3: Integration & Testing (3-4 hours)

#### 3.1 ServalSheets Integration
```typescript
// Add to sheets_appscript tool in main handler registry
handlers.set('sheets_appscript', {
  schema: AppsScriptRequestSchema,
  handler: handleAppsScript,
  annotations: {
    title: 'Apps Script Management',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true
  }
});
```

#### 3.2 Sheets-to-Script Workflows
```typescript
// Example: Create script bound to spreadsheet
async function createBoundScript(spreadsheetId: string, scriptContent: string) {
  // 1. Create script project bound to spreadsheet
  const project = await client.createProject('Automation Script', spreadsheetId);
  
  // 2. Update with custom code
  await client.updateContent(project.scriptId, [{
    name: 'Code',
    type: 'SERVER_JS',
    source: scriptContent
  }]);
  
  // 3. Create version
  const version = await client.createVersion(project.scriptId, 'Initial version');
  
  // 4. Deploy for execution
  const deployment = await client.createDeployment(
    project.scriptId,
    version.versionNumber,
    'API Executable'
  );
  
  return { project, version, deployment };
}
```

---

## Part 5: Key Differences from mohalmah

| Aspect | mohalmah | ServalSheets |
|--------|----------|--------------|
| Language | JavaScript | TypeScript (strict) |
| Tools | 17 separate tools | 1 action-based tool |
| OAuth | Separate keychain storage | Unified encrypted storage |
| Schemas | JSON manually defined | Zod with JSON Schema conversion |
| Response format | Text content only | content + structuredContent |
| Error handling | Basic try/catch | Typed errors with recovery hints |
| Dependencies | node-fetch, keytar | googleapis official client |

---

## Part 6: What to Reuse from mohalmah

### 1. Logic Patterns (Adapt, Don't Copy)
- Token refresh with exponential backoff
- API call structure and parameter handling
- Error categorization approach

### 2. Don't Reuse
- JavaScript code directly
- OAuth implementation (we have better)
- Tool definitions (different architecture)
- Error messages (need agent-actionable format)

---

## Part 7: ServalSheets-Specific Enhancements

### 1. Spreadsheet-Bound Script Creation
```typescript
// Convenience action for Sheets users
case 'create_bound_script': {
  const { spreadsheetId, scriptName, code } = request;
  
  // Create project bound to spreadsheet
  const project = await client.createProject(scriptName, spreadsheetId);
  
  // Add code
  await client.updateContent(project.scriptId, [{
    name: 'Code',
    type: 'SERVER_JS',
    source: code || DEFAULT_SHEETS_SCRIPT
  }]);
  
  return buildToolResponse({
    content: `Created script "${scriptName}" bound to spreadsheet`,
    structuredContent: {
      scriptId: project.scriptId,
      spreadsheetId,
      status: 'created'
    }
  });
}
```

### 2. Script Templates
```typescript
const SCRIPT_TEMPLATES = {
  sheets_automation: `
function onEdit(e) {
  // Trigger on cell edit
  const range = e.range;
  const sheet = range.getSheet();
  // Custom logic here
}

function processData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  // Process data
  return data;
}
  `,
  
  data_validation: `
function validateData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Data');
  // Validation logic
}
  `,
  
  scheduled_report: `
function generateReport() {
  // Generate and email report
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Report logic
}

function setupTrigger() {
  ScriptApp.newTrigger('generateReport')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
}
  `
};
```

### 3. Execution Monitoring Integration
```typescript
// Link script execution to spreadsheet operations
case 'run_with_context': {
  const { scriptId, functionName, spreadsheetId, parameters } = request;
  
  // Execute script
  const startTime = Date.now();
  const result = await client.runScript(scriptId, functionName, parameters);
  const duration = Date.now() - startTime;
  
  // Log to spreadsheet (optional)
  if (request.logToSheet) {
    await sheetsClient.appendValues(spreadsheetId, 'ExecutionLog!A:E', [[
      new Date().toISOString(),
      functionName,
      'SUCCESS',
      duration,
      JSON.stringify(result).slice(0, 500)
    ]]);
  }
  
  return buildToolResponse({
    content: `Executed ${functionName} in ${duration}ms`,
    structuredContent: { result, duration, logged: !!request.logToSheet }
  });
}
```

---

## Conclusion

**Recommended Approach: Build from official Google APIs with mohalmah as reference**

**Rationale:**
1. Official googleapis client is better maintained than raw fetch
2. ServalSheets already has superior OAuth infrastructure
3. TypeScript-native provides better type safety
4. Action-based consolidation aligns with v4 architecture
5. Official API documentation is authoritative

**Implementation Priority:**
1. Core client (Day 1) - Foundation for all operations
2. Script execution (Day 2) - Most valuable feature
3. Project/deployment management (Day 2) - Enable automation
4. Templates & workflows (Day 3) - ServalSheets differentiation

**Risk Mitigation:**
- Use official googleapis client (not raw HTTP)
- Test with real Cloud Platform project
- Verify OAuth scope requirements early
- Handle script execution timeouts gracefully
