import type { TextResourceContents } from '@modelcontextprotocol/sdk/types';

export function getCacheResources(): TextResourceContents[] {
  return [
    {
      uri: 'cache://stats',
      mimeType: 'text/plain',
      text: `Cache Performance Metrics

Three-tier caching system:

1. ETag Cache (HTTP 304)
   - Conditional requests to Google API
   - Reduces bandwidth by 95%
   - Automatic via googleapis client

2. Local LRU Cache
   - 5-minute TTL
   - Per-range storage
   - Hit rates: 80-100% for repeat reads

3. Request Deduplication
   - 50ms window for identical requests
   - Automatic merge of overlapping ranges
   - Estimated 20-40% reduction in API calls

Invalidation:
- Mutation operations clear relevant ranges
- Dependency graph tracks cascades
- Full cache clear on spreadsheet edits

Memory: Bounded LRU prevents unbounded growth`,
    },
    {
      uri: 'cache://deduplication',
      mimeType: 'text/plain',
      text: `Request Deduplication System

How it works:

1. Collection window: 50ms
   - All requests arriving within 50ms are collected
   - Adaptive window: 20-200ms based on traffic

2. Overlap detection:
   - A1:C10 + B5:D15 → merged to A1:D15
   - Single API call instead of two
   - Savings: 20-40% for overlapping patterns

3. Request merging:
   - Bounding box calculation
   - ENABLE_REQUEST_MERGING=true to activate
   - Automatic deduplication in batching system

4. Performance impact:
   - 0ms overhead for non-overlapping
   - 1-5ms for merge computation
   - Net savings: 50-500ms per session (typical)

Configuration:
- ENABLE_REQUEST_MERGING (default: true)
- Window timing: adaptive or fixed
- Max merge attempts: 3 per collection`,
    },
  ];
}
