# ServalSheets - Natural Language Excellence Guide

## What Makes an MCP Server Excellent for Claude

Claude relies on several key components to understand and execute natural language requests effectively:

### 1. Tool Descriptions (✅ Strong - ~1000 lines)
ServalSheets has comprehensive LLM-optimized descriptions with:
- When to use guidance
- Quick examples (copy-paste ready)
- Performance tips
- Error recovery
- Related tools

### 2. MCP Prompts (✅ Good - ~2400 lines)
Pre-built guided workflows for common operations.

### 3. MCP Resources (✅ Basic)
URI-based data access for spreadsheets and ranges.

### 4. Knowledge Base (✅ Good)
Templates, formulas, patterns, user intent examples.

### 5. SKILL.md (✅ Good)
Orchestration patterns for complex operations.

---

## What's Missing for True Natural Language Excellence

### 🔴 Critical Gap: Dynamic Context Injection

Claude needs context BEFORE making tool calls. Currently, Claude must guess or ask.

**Solution: Context Resource**
A resource that returns relevant context based on the user's intent:

```
sheets:///context/{intent}
```

Example: User says "make me a CRM"
Claude fetches: `sheets:///context/create-crm`
Returns: Template structure, best practices, typical fields

### 🔴 Critical Gap: Conversation Memory

Claude forgets which spreadsheet we're working with between turns.

**Solution: Session State Tool**
```json
{
  "tool": "sheets_session",
  "actions": ["set_context", "get_context", "clear_context"]
}
```

Stores: Current spreadsheetId, active sheet, last operation, user preferences.

### 🟡 Improvement: Natural Language Parser

User: "Add a column for email validation status after the email column"

Claude needs to:
1. Find the email column
2. Insert column after it
3. Name it "Email Status"
4. Add validation

**Solution: Intent Parser Resource**
Pre-analyze complex requests and return a plan.

### 🟡 Improvement: Semantic Range Resolution

User: "Update the totals row"

Claude doesn't know which row is "totals". 

**Solution: Semantic Range Finder**
```json
{
  "action": "find_semantic_range",
  "semantic": "totals_row",
  "spreadsheetId": "..."
}
```

### 🟡 Improvement: Undo/History Context

User: "Undo that"

Claude needs to know what "that" was.

**Solution: Operation History in Session**

---

## Implementation Plan

### Phase 1: Session Context Tool

New tool: `sheets_session` for conversation state management.

### Phase 2: Smart Context Resource

Dynamic context injection based on detected intent.

### Phase 3: Semantic Range Resolution

Intelligent range finding based on natural language.

### Phase 4: Operation History

Track recent operations for undo/redo context.

### Phase 5: Intent Classification

Pre-classify user intent to optimize tool selection.
