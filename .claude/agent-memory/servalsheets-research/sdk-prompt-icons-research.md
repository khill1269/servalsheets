---
name: SDK Prompt Icons Gap Research
description: Investigation of SDK 1.29.0 registerPrompt icons support gap vs MCP 2025-11-25 spec
type: reference
---

# SDK Prompt Icons Research

**Date:** 2026-05-12  
**SDK Version:** @modelcontextprotocol/sdk@1.29.0  
**MCP Spec:** 2025-11-25

## Summary

The SDK's `registerPrompt()` method has a **TypeScript-level gap**: the config object type does NOT include `icons` field, yet:
1. The MCP spec defines `Prompt extends BaseMetadata, Icons`
2. The spec includes Icons interface with `{data: Record<string, {mimeType, data}>}`
3. SDK v1.29.0 wire-level listPrompts response only serializes `{name, title, description, arguments}` (line 412-417 in mcp.js)
4. The internal `_registeredPrompts[name]` object has NO `icons` field at all

## Research Results

### Path A: Type Assertion Workaround
**Can we use type assertion to force icons through?**

❌ NO. Even with type assertion like `config as any`, the icons would be:
- Destructured and lost at line 731: `const { title, description, argsSchema } = config;`
- Not passed to `_createRegisteredPrompt()`
- Not stored in the registeredPrompt object (lines 564-591 only stores title, description, argsSchema, callback, enabled, update methods)
- Not included in the wire response (lines 412-417 only serialize name, title, description, arguments)

### Path B: Lower-level Registration API
**Is there a way to access underlying prompt list handler?**

✅ PARTIAL. The underlying `server` property is exposed:

```typescript
public readonly server: Server;
```

But the prompt handler is set via `setPromptRequestHandlers()` (called at lines 720, 733), which is a private method. The server's `setRequestHandler()` method (used at line 408-419 for ListPromptsRequestSchema) IS public but:
- You'd need to re-register the entire handler
- You'd lose SDK convenience methods (enable/disable/update)
- You'd need to re-implement the SchemaValidator wrapping

This is not a practical workaround for one-off icon additions.

### Path C: Changelog Analysis
**SDK changelog for icons support:**

- No CHANGELOG.md in SDK node_modules distribution
- SDK version 1.29.0 was built from commit 35fa160caf287a9c48696e3ae452c0645c713669
- spec.types.d.ts (line 924) shows `Prompt extends BaseMetadata, Icons` — this IS in the spec types
- But Icons have **never been wired through registerPrompt config** in the SDK

### Path D: Wire-Level Analysis
**What happens if we manually add icons to the returned registeredPrompt object?**

Theoretically possible but fragile:

```typescript
const prompt = server.registerPrompt('myPrompt', { title: 'Test' }, handler);
(prompt as any).icons = { /* ... */ };  // This works temporarily
```

BUT:
- `update()` method (line 573-590) does NOT preserve icons — it only handles {name, title, description, argsSchema, callback, enabled}
- Icons are lost on any `.update()` call
- The wire response builder (lines 412-417) doesn't serialize icons at all
- Serial `sendPromptListChanged()` (line 589) won't help — the ListPromptsRequestSchema handler still only sends {name, title, description, arguments}

## Spec vs Implementation Gap

| Feature | Spec | SDK 1.29.0 | Gap |
|---------|------|-----------|-----|
| `Prompt extends Icons` | ✅ Yes (spec.types line 924) | ❌ No wire support | registerPrompt config + wire response |
| BaseMetadata (name, title) | ✅ Yes | ✅ Yes | None |
| Icons interface | ✅ Defined (spec.types line 493-505) | ❌ Not used | registerPrompt config ignores it |
| ListPromptsRequest response | ✅ Should include icons | ❌ {name, title, description, arguments} only | Lines 412-417 in mcp.js hardcode 4 fields |
| RegisteredPrompt.update() | ✅ Spec implies extensibility | ❌ Whitelist only {name, title, description, argsSchema, callback, enabled} | Lines 579-588 hardcode allowed fields |

## Recommendation

**For ServalSheets:**

1. **DO NOT use type assertion workaround** — it silently fails at wire level
2. **DO NOT try to mutate registeredPrompt.icons** — lost on update() and not serialized
3. **DO extend underlying server handler directly** if icons are critical:
   ```typescript
   const promptsWithIcons = new Map<string, Prompt>();
   server.setRequestHandler(ListPromptsRequestSchema, () => ({
     prompts: Array.from(promptsWithIcons.values())
   }));
   ```
4. **PREFERRED: Open issue with SDK** — icons are in spec, should be in registerPrompt config
5. **For now:** Omit icons from prompts in ServalSheets or wait for SDK v1.30+ to add icons support

## SDK Gap Issue Template

```markdown
**Title:** registerPrompt config missing icons field (spec gap)

**Description:**
MCP 2025-11-25 spec defines `Prompt extends Icons`, but `McpServer.registerPrompt()` config type only accepts `{title?, description?, argsSchema?}`.

**Impact:** Servers cannot add visual icons to prompts via the standard API.

**Current behavior:**
- Spec: `Prompt extends BaseMetadata, Icons` (spec.types line 924)
- SDK: `registerPrompt(name, {title?, description?, argsSchema?}, cb)` (mcp.d.ts line 181-185)
- Wire response: `{name, title, description, arguments}` only (mcp.js line 412-417)

**Expected behavior:**
```typescript
server.registerPrompt('analyze_data', {
  title: 'Analyze Data',
  description: 'Analyze sheet data',
  icons: {
    'image/png': { mimeType: 'image/png', data: '...' }
  }
}, handler);
```

**Workarounds:** None that preserve SDK convenience methods.
```

