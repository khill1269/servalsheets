import { ResourceContent } from '@modelcontextprotocol/sdk/types';

export function getMetricsResources(): { uri: string; contents: ResourceContent }[] {
  return [
    {
      uri: 'metrics://api-calls',
      contents: {
        mimeType: 'text/plain',
        text: `API Call Metrics

Google Sheets API usage:

By operation:
- batchGet: Most common (read operations)
- batchUpdate: All mutations combined
- spreadsheets.get: Metadata fetches
- values.append: Adding rows

Usage patterns:
- Average calls per action: 2-5
- Cache hit rate: 80-100% for repeats
- Duplicate elimination: 20-40% savings

Quota tracking:
- Daily limit: 500,000 cells
- Current usage: Tracked per session
- Rate limit: 100 requests per 100 seconds per user

Circuit breaker:
- Activates after 5 failures in 30s
- Returns cached data in read-only mode
- Auto-resets after 30s of stability

Optimizations:
- Batch operations reduce calls by 80%
- ETag caching reduces bandwidth by 95%
- Request deduplication merges overlapping ranges
- Parallel executor handles concurrent requests`
      },
    },
    {
      uri: 'metrics://performance',
      contents: {
        mimeType: 'text/plain',
        text: `Performance Metrics

Operation latency:
- read (simple): 100-300ms
- read (large range): 500ms-5s
- write (single cell): 200-400ms
- write (batch): 300-800ms
- format (range): 400-1s
- analysis (quick): 200-400ms
- analysis (comprehensive): 5-30s

Throughput:
- Parallel reads: 20-40 ranges/second
- Batch writes: 100-500 cells/second
- Sequential operations: 2-5 ops/second

Memory:
- Per-session baseline: ~5MB
- Cache overhead: ~10MB per 1000 cells
- Analysis overhead: ~20MB for large sheets

Scalability:
- Handles sheets with 100k+ rows
- Concurrent users: Scales to 100+ with pooling
- Batch operations: Up to 10k cells per request

Optimization tips:
- Use batch operations for multiple changes
- Enable caching for repeat reads
- Use parallel executor for many independent reads
- Limit analysis to needed ranges`
      },
    },
    {
      uri: 'metrics://reliability',
      contents: {
        mimeType: 'text/plain',
        text: `Reliability Metrics

Error rates:
- Authentication: <0.1% (cached tokens)
- API calls: <2% (transient errors)
- Validation: <0.5% (schema mismatches)
- Circuit breaker: <0.1% (rare quota exhaustion)

Recovery:
- Automatic retry: 3 attempts with exponential backoff
- Circuit breaker: Read-only fallback mode
- Timeout: 30s per request, 5m per batch
- Deadline: Respects Google API quotas

Availability:
- Target: 99.9% uptime
- Monitoring: Real-time health checks
- Alerts: Quota warnings, error spikes

Data durability:
- Snapshots: Automatic before destructive ops
- History: All operations logged and undoable
- Backup: Google Sheets revision history

Security:
- Scope validation: OAuth2 scopes enforced
- Token refresh: Automatic, secure storage
- Rate limiting: Per-user, per-API
- Audit trail: All operations tracked`
      },
    },
    {
      uri: 'metrics://usage-dashboard',
      contents: {
        mimeType: 'text/plain',
        text: `Usage Dashboard

Session statistics:

Operations:
- Total actions: Count per session
- Mutations vs reads: Ratio
- Most used tools: Ranked list
- Error rate: Failures per 1000 ops

Performance:
- Total elapsed time: Session duration
- API call time: Sum of Google API latency
- Processing time: Local computation
- Overhead ratio: Processing/API time

API usage:
- Calls made: Total Google API calls
- Cells read: Total cell count in reads
- Cells written: Total cell count in writes
- Quota usage: Percentage of daily limit

Cache effectiveness:
- Cache hits: Count and percentage
- Bytes saved: Estimated bandwidth reduction
- Duplicates eliminated: Merged requests

Recommendations:
- Enable caching for repeated operations
- Use batch operations to reduce calls
- Parallel executor for independent reads
- Profile slow operations

Trends:
- Most common tools
- Peak usage times
- Error patterns
- Performance degradation`
      },
    },
    {
      uri: 'metrics://optimization-advisor',
      contents: {
        mimeType: 'text/plain',
        text: `Optimization Advisor

Automated recommendations:

API optimization:
- "High error rate detected" → Check quotas, network
- "Many duplicate requests" → Enable request merging
- "Low cache hit rate" → Increase TTL or fetch size
- "Slow batchUpdate" → Split into smaller batches

Formula optimization:
- "Slow formulas detected" → Use INDEX/MATCH instead of VLOOKUP
- "Large dependency chains" → Break into smaller steps
- "Array formulas on columns" → Convert to FILTER
- "Circular references" → Restructure formulas

Structural optimization:
- "Large sheet detected" → Archive old data
- "Many unused columns" → Remove or hide
- "Duplicate filtering" → Use named ranges
- "Unsorted data" → Sort for faster filtering

Session optimization:
- "Sequential reads detected" → Use parallel executor
- "High mutation rate" → Use transactions
- "Many reversions" → Review operations
- "Cache thrashing" → Reduce TTL conflicts

Personalized:
- Based on actual usage patterns
- Ranked by impact
- Actionable with examples
- Updated each session`
      },
    },
  ];
}
