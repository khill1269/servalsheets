# ServalSheets Plugin System

Secure JavaScript plugin system with sandboxing, hot-reload, and marketplace support.

## Features

- **Sandboxed Execution**: Plugins run in isolated VM contexts with no access to Node.js APIs by default
- **Resource Limits**: Memory, CPU time, and API quota enforcement per plugin
- **Hot-Reload**: Automatic plugin reloading without server restart
- **Permission System**: Allowlist-based API access (sheets, drive, network, storage)
- **Lifecycle Hooks**: `onLoad`, `onUnload`, `onConfigUpdate` for proper initialization
- **Type Safety**: Full TypeScript support for plugin development
- **Marketplace Ready**: Plugin manifest format for distribution

## Quick Start

### 1. Create a Plugin

Create a file in the `plugins/` directory:

```javascript
// plugins/my-plugin.js
export default {
  name: 'my-plugin',
  version: '1.0.0',
  author: 'Your Name',
  description: 'My awesome plugin',

  // Request permissions
  permissions: ['sheets.read', 'sheets.write'],

  // Define tools
  tools: [{
    name: 'my_tool',
    description: 'Does something useful',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string' },
        message: { type: 'string' }
      },
      required: ['spreadsheetId']
    },

    async handler(params, context) {
      // Access granted APIs via context
      const data = await context.sheets.get(params.spreadsheetId, 'A1:B10');

      context.logger.info('Processing data', { rows: data.values.length });

      return {
        success: true,
        message: `Processed ${data.values.length} rows`
      };
    }
  }],

  // Lifecycle hooks
  async onLoad(context) {
    context.logger.info('Plugin loaded');
  }
};
```

### 2. Load the Plugin

```typescript
import { PluginRuntime } from './plugins/runtime.js';

const runtime = new PluginRuntime({
  pluginDir: './plugins',
  memoryLimitMB: 50,
  cpuLimitMs: 2000,
  enableHotReload: true,
  apiQuota: { requestsPerMinute: 60 }
});

// Load plugin
const plugin = await runtime.loadPlugin('./plugins/my-plugin.js');

// Execute tool
const result = await runtime.executeToolHandler(
  'my-plugin',
  'my_tool',
  { spreadsheetId: '123', message: 'Hello' }
);
```

## Plugin Structure

### Required Fields

```typescript
{
  name: string;        // Unique identifier (kebab-case)
  version: string;     // Semver (e.g., "1.0.0")
  author: string;      // Author name
}
```

### Optional Fields

```typescript
{
  description?: string;
  homepage?: string;
  license?: string;
  minServalVersion?: string;
  dependencies?: PluginDependency[];
  permissions?: PluginPermission[];
  configSchema?: object;
}
```

## Permissions

Plugins must explicitly request permissions:

| Permission | Description |
|------------|-------------|
| `sheets.read` | Read data from spreadsheets |
| `sheets.write` | Modify spreadsheet data |
| `sheets.create` | Create new spreadsheets |
| `drive.read` | Read Drive files |
| `drive.write` | Modify Drive files |
| `network.fetch` | Make HTTP requests |
| `storage.read` | Read plugin storage |
| `storage.write` | Write plugin storage |

Example:
```javascript
permissions: ['sheets.read', 'sheets.write', 'storage.read']
```

## Plugin Context API

The `context` object provides APIs based on granted permissions:

### Logger
```javascript
context.logger.info('Message', { data: 'value' });
context.logger.warn('Warning');
context.logger.error('Error', { error });
```

### Sheets API (if granted)
```javascript
// Read range
const data = await context.sheets.get(spreadsheetId, 'A1:B10');

// Update range
await context.sheets.update(spreadsheetId, 'A1:B10', values);

// Create spreadsheet
const result = await context.sheets.create('New Sheet');

// Batch operations
await context.sheets.batchGet(spreadsheetId, ranges);
await context.sheets.batchUpdate(spreadsheetId, requests);
```

### Drive API (if granted)
```javascript
// Get file
const file = await context.drive.get(fileId);

// List files
const files = await context.drive.list('mimeType="application/vnd.google-apps.spreadsheet"');

// Create file
await context.drive.create(metadata, content);

// Update file
await context.drive.update(fileId, metadata, content);

// Delete file
await context.drive.delete(fileId);
```

### Storage API (always available)
```javascript
// Store plugin data
await context.storage.set('key', { data: 'value' });

// Read plugin data
const data = await context.storage.get('key');

// List keys
const keys = await context.storage.list();

// Delete key
await context.storage.delete('key');

// Clear all
await context.storage.clear();
```

### Fetch API (if granted)
```javascript
const response = await context.fetch('https://api.example.com/data');
const json = await response.json();
```

## Security

### Sandbox Restrictions

Plugins cannot access:
- Node.js modules (`require`, `import`)
- File system (`fs`, `path`)
- Child processes (`child_process`)
- Environment variables (`process.env`)
- Global scope (`global`, `globalThis`)
- Network without permission (`http`, `https`)

### Resource Limits

Default limits per plugin:
- **Memory**: 50MB
- **CPU Time**: 2000ms per execution
- **API Quota**: 60 requests/minute

Configure limits:
```typescript
const runtime = new PluginRuntime({
  memoryLimitMB: 100,    // 100MB
  cpuLimitMs: 5000,      // 5 seconds
  apiQuota: { requestsPerMinute: 120 }
});
```

### Code Validation

The sandbox automatically blocks:
- `eval()` usage
- `Function` constructor
- Dynamic `import()`
- Prototype pollution attempts
- Constructor escape attempts

## Lifecycle Hooks

### onLoad

Called when plugin is loaded:
```javascript
async onLoad(context) {
  // Initialize plugin state
  await context.storage.set('initialized', true);
  context.logger.info('Plugin ready');
}
```

### onUnload

Called when plugin is unloaded:
```javascript
async onUnload() {
  // Cleanup resources
  // Close connections, clear timers, etc.
}
```

### onConfigUpdate

Called when plugin configuration changes:
```javascript
async onConfigUpdate(config) {
  // React to config changes
  this.maxRetries = config.maxRetries || 3;
}
```

## Hot-Reload

Enable automatic reloading when plugin files change:

```typescript
const runtime = new PluginRuntime({
  pluginDir: './plugins',
  enableHotReload: true
});

// Plugin will automatically reload on file changes
// Old version stays active if reload fails
```

### Debouncing

Hot-reload debounces rapid changes (100ms default):
```typescript
const hotReload = new HotReloadManager({
  pluginDir: './plugins',
  debounceMs: 200  // Wait 200ms before reloading
});
```

## Resources and Prompts

### Resources

Expose static or dynamic content:
```javascript
resources: [{
  uri: 'plugin://my-plugin/templates',
  name: 'Templates',
  description: 'Available templates',
  mimeType: 'application/json',

  async provider(uri) {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(templates)
    };
  }
}]
```

### Prompts

Provide AI prompt templates:
```javascript
prompts: [{
  name: 'analyze_data',
  description: 'Analyze spreadsheet data',

  async generator(args) {
    return {
      messages: [{
        role: 'system',
        content: 'You are a data analyst...'
      }, {
        role: 'user',
        content: `Analyze this data: ${args.data}`
      }]
    };
  }
}]
```

## Example Plugins

See `examples/plugins/` for complete examples:

- **excel-import.js**: Import Excel files to Sheets
- **chart-templates.js**: Pre-built chart templates

## Plugin Distribution

### Manifest Format

For marketplace distribution, use `plugin.json`:
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Plugin description",
  "homepage": "https://github.com/user/plugin",
  "repository": "https://github.com/user/plugin",
  "license": "MIT",
  "keywords": ["sheets", "automation"],
  "permissions": ["sheets.read", "sheets.write"],
  "main": "index.js",
  "checksum": "sha256:..."
}
```

### Installation

Users can install from:
1. **Local file**: `runtime.loadPlugin('./my-plugin.js')`
2. **URL**: `runtime.loadPlugin('https://example.com/plugin.js')`
3. **Marketplace**: `runtime.installFromMarketplace('my-plugin@1.0.0')`

## Best Practices

### 1. Error Handling

Always wrap operations in try-catch:
```javascript
async handler(params, context) {
  try {
    const data = await context.sheets.get(params.spreadsheetId);
    return { success: true, data };
  } catch (error) {
    context.logger.error('Operation failed', { error: error.message });
    throw new Error(`Failed to fetch data: ${error.message}`);
  }
}
```

### 2. Input Validation

Validate all input parameters:
```javascript
inputSchema: {
  type: 'object',
  properties: {
    spreadsheetId: {
      type: 'string',
      pattern: '^[a-zA-Z0-9-_]+$'
    },
    range: {
      type: 'string',
      pattern: '^[A-Z]+\\d+:[A-Z]+\\d+$'
    }
  },
  required: ['spreadsheetId', 'range']
}
```

### 3. Logging

Use structured logging:
```javascript
context.logger.info('Processing started', {
  spreadsheetId: params.spreadsheetId,
  rowCount: data.length
});
```

### 4. Storage

Use plugin storage for state:
```javascript
// Track usage
const count = (await context.storage.get('execCount')) || 0;
await context.storage.set('execCount', count + 1);
```

### 5. Quota Management

Be mindful of API quotas:
```javascript
// Batch operations when possible
const ranges = ['A1:A10', 'B1:B10', 'C1:C10'];
const results = await context.sheets.batchGet(spreadsheetId, ranges);
```

## Troubleshooting

### Plugin Won't Load

Check:
- Required fields present (`name`, `version`, `author`)
- Valid semver version
- No syntax errors in code
- Dependencies installed

### Permission Denied Errors

Ensure plugin requests necessary permissions:
```javascript
permissions: ['sheets.read']  // Add missing permission
```

### Timeout Errors

Increase CPU limit or optimize code:
```typescript
const runtime = new PluginRuntime({
  cpuLimitMs: 5000  // Increase from default 2000ms
});
```

### Memory Errors

Reduce data processing or increase limit:
```typescript
const runtime = new PluginRuntime({
  memoryLimitMB: 100  // Increase from default 50MB
});
```

## API Reference

See TypeScript definitions in `src/plugins/types.ts` for complete API reference.

## Security Considerations

1. **Never trust plugin input**: Always validate and sanitize
2. **Limit permissions**: Only grant what's needed
3. **Review plugin code**: Before installing third-party plugins
4. **Monitor resource usage**: Check plugin stats regularly
5. **Use allowlist**: In production, allowlist known-good plugins

## Performance Tips

1. **Batch operations**: Use batchGet/batchUpdate when possible
2. **Cache results**: Store frequently accessed data
3. **Async operations**: Don't block on I/O
4. **Minimize iterations**: Process data efficiently
5. **Profile plugins**: Check execution stats

## Future Enhancements

Planned features:
- Plugin marketplace UI
- Automatic updates with user approval
- Plugin dependency resolution
- Code signing and verification
- WebAssembly plugin support
- Enhanced debugging tools
