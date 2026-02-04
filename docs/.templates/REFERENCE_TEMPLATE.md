---
title: [API/Tool/Feature Reference]
description: [Complete technical reference for X]
category: reference
type: [api|tool|configuration|schema]
version: 1.6.0
last_updated: 2026-01-31
stability: [stable|beta|experimental]
related_docs:
  - [/docs/reference/related.md]
tags: [api, reference, technical]
---

# [Feature/API Name] Reference

> **Status:** [Stable|Beta|Experimental] | **Since:** v1.x.0

## Overview

[Brief technical description of what this is and its primary use case]

**Key capabilities:**

- [Capability 1]
- [Capability 2]
- [Capability 3]

## Syntax

```typescript
// Function signature or usage pattern
functionName(param1: Type, param2: Type): ReturnType
```

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `param1` | `string` | Yes | - | [Detailed description] |
| `param2` | `number` | No | `0` | [Detailed description] |
| `options` | `Options` | No | `{}` | [Configuration object] |

### Options Object

```typescript
interface Options {
  option1: string;  // Description
  option2: boolean; // Description
}
```

## Return Value

**Type:** `ReturnType`

```typescript
{
  success: boolean;
  data: DataType;
  error?: ErrorType;
}
```

## Examples

### Basic Usage

```typescript
import { functionName } from '@servalsheets/core';

const result = await functionName('value', 42);
console.log(result);
```

**Output:**

```json
{
  "success": true,
  "data": { ... }
}
```

### Advanced Usage

```typescript
// More complex example with options
const result = await functionName('value', 42, {
  option1: 'custom',
  option2: true
});
```

### Error Handling

```typescript
try {
  const result = await functionName('value', 42);
} catch (error) {
  if (error.code === 'SPECIFIC_ERROR') {
    // Handle specific error
  }
}
```

## Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `ERROR_CODE_1` | [What causes this] | [How to fix] |
| `ERROR_CODE_2` | [What causes this] | [How to fix] |

## Performance Considerations

- **Complexity:** O(n) where n is [description]
- **Rate Limits:** [If applicable]
- **Caching:** [Behavior if applicable]
- **Best Practices:** [Performance tips]

## Type Definitions

```typescript
// Complete TypeScript definitions
type DataType = {
  field1: string;
  field2: number;
};

type ErrorType = {
  code: string;
  message: string;
  details?: unknown;
};
```

## Related APIs

- [`relatedFunction()`](/docs/reference/related.md) - Related functionality
- [`anotherFunction()`](/docs/reference/another.md) - Alternative approach

## Changelog

- **v1.6.0** - [Changes in this version]
- **v1.5.0** - [Changes in previous version]

## See Also

- [User Guide](/docs/guides/related-guide.md)
- [API Overview](/docs/reference/api-overview.md)
- [Source Code](../src/path/to/file.ts:123)

---

**Last updated:** 2026-01-31 | **ServalSheets v1.6.0**
