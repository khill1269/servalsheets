const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        HeadingLevel, BorderStyle, WidthType, ShadingType, AlignmentType,
        LevelFormat, PageBreak } = require('docx');
const fs = require('fs');

// Define borders
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

// Create document
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1a365d" },
        paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2c5282" },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "2d3748" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [
      // Title
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "ServalSheets MCP Server", bold: true, size: 48, color: "1a365d" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: "Comprehensive Testing Infrastructure Analysis", size: 32, color: "4a5568" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: "January 2026", size: 24, italics: true, color: "718096" })]
      }),

      // Executive Summary
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Executive Summary")] }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("This analysis examines the testing infrastructure of ServalSheets, a production-grade Google Sheets MCP server with 21 tools and 281 actions. The project demonstrates a mature testing approach with 99.8% pass rate (3,870/3,876 tests), but opportunities exist for optimization aligned with latest MCP protocol specifications and Google API best practices.")]
      }),

      // Key Statistics Table
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Current State Overview")] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [4680, 4680],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "2c5282", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "Metric", bold: true, color: "FFFFFF" })] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "2c5282", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "Value", bold: true, color: "FFFFFF" })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("Source Files")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("272 TypeScript files")] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("Test Files")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("177 test files")] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("Test Pass Rate")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("99.8% (3,870/3,876)")] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("Coverage Thresholds")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("75% lines/functions, 70% branches")] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("Test Categories")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("30 distinct test directories")] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("MCP Protocol Version")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("2025-11-25")] })] }),
            ]
          }),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // MCP Protocol Analysis
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("MCP Protocol Compliance Analysis")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Current Strengths")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "Protocol Version Compliance: ", bold: true }), new TextRun("Implements MCP 2025-11-25 specification with proper version negotiation")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "Structured Tool Output: ", bold: true }), new TextRun("Returns both structuredContent and content arrays per specification")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "Comprehensive Error Codes: ", bold: true }), new TextRun("71 error codes with JSON-RPC 2.0 compliance")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "MCP Test Harness: ", bold: true }), new TextRun("Custom test harness for protocol compliance testing")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "Prompt and Resource Support: ", bold: true }), new TextRun("Full implementation of MCP prompts and resources")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Recommended Improvements")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "Add MCP Conformance Testing: ", bold: true }), new TextRun("Integrate the official @modelcontextprotocol/conformance package for automated protocol validation")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "Implement Inspector Integration: ", bold: true }), new TextRun("Add CI job using npx @modelcontextprotocol/inspector for interactive protocol testing")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "OAuth 2.1 Resource Server Testing: ", bold: true }), new TextRun("Add tests for RFC 8707 Resource Indicators per MCP 2025-06-18+ requirements")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "Elicitation Support Tests: ", bold: true }), new TextRun("Test multi-turn human-in-the-loop interactions (sheets_confirm already implements this)")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "Transport-Specific Tests: ", bold: true }), new TextRun("Add dedicated test suites for STDIO and Streamable HTTP transports with connection pool monitoring")] }),

      new Paragraph({ children: [new PageBreak()] }),

      // Google API Testing Analysis
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Google Sheets API Testing Analysis")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Current Implementation Strengths")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "Comprehensive Mock Factory: ", bold: true }), new TextRun("google-api-mocks.ts provides realistic Sheets and Drive API mocks")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "Live API Test Suite: ", bold: true }), new TextRun("21 tool-specific live test files for real API validation")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "Test Spreadsheet Manager: ", bold: true }), new TextRun("Centralized spreadsheet lifecycle management with cleanup")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "Credential Loader: ", bold: true }), new TextRun("Secure test credential handling with environment isolation")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "Metrics Tracking: ", bold: true }), new TextRun("API call metrics collection during live tests")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Critical Optimizations Needed")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("1. Quota Management (HIGH PRIORITY)")] }),
      new Paragraph({
        children: [new TextRun("Google Sheets API has strict quotas: 300 read requests/minute, 60 write requests/minute. Current tests create 378 spreadsheets per full run, potentially exceeding daily limits.")]
      }),
      new Paragraph({
        spacing: { before: 100 },
        children: [new TextRun({ text: "Recommendations:", bold: true })]
      }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Implement spreadsheet reuse (reset data instead of recreate) for 92% reduction in API calls")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Add rate limiting infrastructure with exponential backoff")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Use batch operations to consolidate multiple requests")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Monitor quotas via Service Usage API during test runs")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("2. Mock Enhancement")] }),
      new Paragraph({
        children: [new TextRun("The current mock factory is functional but could be enhanced to better simulate Google API behavior.")]
      }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Add HttpMockSequence equivalent for multi-step API interactions")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Implement quota exceeded simulation in mocks")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Add network timeout and partial failure scenarios")] }),

      new Paragraph({ children: [new PageBreak()] }),

      // Test Infrastructure Analysis
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Test Infrastructure Analysis")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Directory Structure (30 Categories)")] }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("The test suite is well-organized with clear separation of concerns:")]
      }),

      // Test Categories Table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3120, 3120, 3120],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "2c5282", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "Category", bold: true, color: "FFFFFF" })] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "2c5282", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "Purpose", bold: true, color: "FFFFFF" })] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "2c5282", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true, color: "FFFFFF" })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("unit/")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("Core business logic")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: "Excellent", color: "38A169" })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("compliance/")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("MCP protocol compliance")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "Good", color: "38A169" })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("contracts/")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("API contracts and schemas")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: "Excellent", color: "38A169" })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("property/")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("Property-based testing")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "Good", color: "38A169" })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("live-api/")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("Real API integration")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: "Needs Optimization", color: "DD6B20" })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("benchmarks/")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("Performance testing")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "Good", color: "38A169" })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("safety/")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("Security and effect scope")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: "Good", color: "38A169" })] })] }),
            ]
          }),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // CI/CD Analysis
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("CI/CD Pipeline Analysis")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Current Workflows (10 files)")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "ci.yml: ", bold: true }), new TextRun("4-way sharded test execution with Turbo caching")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "coverage.yml: ", bold: true }), new TextRun("Coverage reporting and badge generation")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "benchmark.yml: ", bold: true }), new TextRun("Performance regression tracking")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "security.yml: ", bold: true }), new TextRun("Security audit automation")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({ text: "schema-check.yml: ", bold: true }), new TextRun("Schema validation and drift detection")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Pipeline Optimization Opportunities")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "Add Nightly Live API Tests: ", bold: true }), new TextRun("Run live-api tests on schedule to avoid quota issues during development")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "Implement Test Batching: ", bold: true }), new TextRun("Group live API tests into batches with rate limiting between groups")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "Add MCP Conformance Job: ", bold: true }), new TextRun("Integrate official MCP conformance tests in CI")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "Enable Mutation Testing: ", bold: true }), new TextRun("Add Stryker.js for mutation testing to validate test quality")] }),

      new Paragraph({ children: [new PageBreak()] }),

      // Priority Recommendations
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Priority Recommendations")] }),

      // High Priority
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("High Priority (Week 1-2)")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("1. Fix Turbo Verify Loop")] }),
      new Paragraph({
        children: [new TextRun("The verify script creates a recursive loop. Change from \"turbo run verify\" to explicit npm-run-all command.")]
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("2. Add afterEach Cleanup Hooks")] }),
      new Paragraph({
        children: [new TextRun("Currently 176 afterEach vs 281 beforeEach hooks. Add vi.clearAllMocks() to prevent test pollution.")]
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("3. Implement Rate Limiting for Live Tests")] }),
      new Paragraph({
        children: [new TextRun("Add LiveApiRateLimiter class to prevent quota exceeded errors during test runs.")]
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("4. Add MCP Conformance Tests")] }),
      new Paragraph({
        children: [new TextRun("Integrate @modelcontextprotocol/conformance for automated protocol compliance validation.")]
      }),

      // Medium Priority
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Medium Priority (Week 3-4)")] }),

      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "Spreadsheet Reuse: ", bold: true }), new TextRun("Implement TestSpreadsheetManager.getOrCreateShared() for 92% API call reduction")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "Error Path Coverage: ", bold: true }), new TextRun("Add 7 error tests per handler (147 new tests): 401, 403, 404, 429, 500, timeout, malformed")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "Strengthen Assertions: ", bold: true }), new TextRun("Replace weak toBeDefined() with toMatchObject() patterns")] }),
      new Paragraph({ numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: "Transport-Specific Tests: ", bold: true }), new TextRun("Add dedicated STDIO and HTTP transport test suites")] }),

      // Lower Priority
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Lower Priority (Week 5+)")] }),

      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Increase coverage thresholds to 80% (currently 75%)")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Add mutation testing with Stryker.js")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Create test metrics dashboard for monitoring trends")] }),
      new Paragraph({ numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Document LLM compatibility test limitations (6 chart schema failures)")] }),

      new Paragraph({ children: [new PageBreak()] }),

      // Best Practices Checklist
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Best Practices Compliance Checklist")] }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [6240, 1560, 1560],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "2c5282", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "Best Practice", bold: true, color: "FFFFFF" })] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "2c5282", type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MCP", bold: true, color: "FFFFFF" })] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "2c5282", type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Google", bold: true, color: "FFFFFF" })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("Input validation with robust schemas (Zod)")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "✓", color: "38A169", bold: true })] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "✓", color: "38A169", bold: true })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("Standardized error codes with resolution steps")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "✓", color: "38A169", bold: true })] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "✓", color: "38A169", bold: true })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("Lifecycle testing (init, operation, shutdown)")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "✓", color: "38A169", bold: true })] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("-")] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("Rate limiting / quota management")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "○", color: "DD6B20", bold: true })] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "○", color: "DD6B20", bold: true })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("Batch operations for efficiency")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "✓", color: "38A169", bold: true })] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "✓", color: "38A169", bold: true })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("Official conformance/mock tooling")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "○", color: "DD6B20", bold: true })] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("-")] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun("80%+ test coverage")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("-")] })] }),
              new TableCell({ borders, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "○", color: "DD6B20", bold: true })] })] }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun("W3C Trace Context / observability")] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "✓", color: "38A169", bold: true })] })] }),
              new TableCell({ borders, margins: cellMargins, shading: { fill: "F7FAFC", type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("-")] })] }),
            ]
          }),
        ]
      }),
      new Paragraph({
        spacing: { before: 100 },
        children: [new TextRun({ text: "Legend: ✓ Implemented  ○ Partial/Needs Work  - Not Applicable", italics: true, size: 20 })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // Conclusion
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Conclusion")] }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("ServalSheets demonstrates a mature and comprehensive testing infrastructure with excellent coverage of MCP protocol compliance and Google Sheets API integration. The 99.8% pass rate and 30 distinct test categories indicate strong engineering practices.")]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun("The primary optimization opportunities center around quota management for live API tests and integration of official MCP conformance tooling. Implementing the high-priority recommendations should take approximately 2 weeks and will significantly improve test reliability and maintainability.")]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "Estimated effort for full implementation: 125 hours (~3 weeks full-time)", bold: true })]
      }),

      // Footer
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        children: [new TextRun({ text: "Generated by Claude Analysis", italics: true, size: 20, color: "718096" })]
      }),
    ]
  }]
});

// Generate document
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/sessions/eloquent-vigilant-sagan/mnt/servalsheets 2/TESTING_INFRASTRUCTURE_ANALYSIS.docx", buffer);
  console.log("Document generated successfully!");
});
