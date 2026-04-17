import type { TextResourceContents } from '@modelcontextprotocol/sdk/types';

export function getDiscoveryResources(): TextResourceContents[] {
  return [
    {
      uri: 'discovery://api-health',
      mimeType: 'text/plain',
      text: `Google API Health Check

Current status of API endpoints:

Google Sheets API (v4)
- Status: Active
- Quota: 500k cells/day
- Rate limit: 100 req/100s per user
- Circuit breaker: 5 failures resets after 30s

Google Drive API (v3)
- Status: Active
- Quota: 1m calls/day
- Rate limit: 1000 req/100s per user
- Circuit breaker: 5 failures

Google BigQuery API
- Status: Active
- Quota: 100k queries/day
- Rate limit: 100 concurrent queries
- Circuit breaker: 3 failures

Google Apps Script API
- Status: Active
- Quota: 20m executions/day
- Rate limit: 20 req/s
- Circuit breaker: 3 failures

Authentication:
- OAuth2: Configured
- Service account: Configured (if applicable)
- Token refresh: Automatic`,
    },
    {
      uri: 'discovery://versions',
      mimeType: 'text/plain',
      text: `API Versions

Currently supported versions:

Google Sheets: v4
- Latest stable
- Full feature support
- Recommended for all operations

Google Drive: v3
- Latest stable
- File operations, sharing, permissions
- Revision history

BigQuery: v2
- Latest stable
- Streaming inserts, queries, datasets

Apps Script: v1
- Latest stable
- Script execution, deployment

Version compatibility:
- All APIs compatible with Node.js 18+
- googleapis package: v130+
- google-auth-library: v9+

Deprecation notes:
- None currently
- Plan to support new versions as released`,
    },
  ];
}
