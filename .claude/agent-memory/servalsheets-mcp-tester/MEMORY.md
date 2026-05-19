# ServalSheets MCP Tester — Agent Memory

## Test Run History

No protocol test runs recorded yet.

## Known Failures

None recorded yet. After each test run, log:
- Date, total actions tested, pass/fail count
- Specific action failures with error codes
- Whether failures are infrastructure vs logic vs schema issues

## Test Infrastructure

- Primary command: `npm run test:mcp:protocol`
- JSON output: `npm run test:mcp:protocol -- --json`
- Server: `node dist/cli.js --stdio`
- Protocol: MCP 2025-11-25 via JSON-RPC over STDIO
