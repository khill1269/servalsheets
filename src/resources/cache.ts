/**
 * ServalSheets - Cache Resources
 *
 * Exposes cache statistics as MCP resources for monitoring and optimization.
 * Phase 1, Task 1.5
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { cacheManager } from '../utils/cache-manager.js';

/**
 * Register cache resources with the MCP server
 */
export function registerCacheResources(server: McpServer): number {
  // Resource: cache://stats - Cache statistics
  server.registerResource(
    'Cache Statistics',
    'cache://stats',
    {
      description: 'Cache performance metrics: hit rate, size, entries, and namespace breakdown',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const stats = cacheManager.getStats();

        // Convert byte sizes to human-readable format
        const totalSizeMB = (stats.totalSize / 1024 / 1024).toFixed(2);
        const totalSizeKB = (stats.totalSize / 1024).toFixed(2);
        const displaySize = stats.totalSize > 1024 * 1024
          ? `${totalSizeMB} MB`
          : `${totalSizeKB} KB`;

        // Calculate additional metrics
        const totalRequests = stats.hits + stats.misses;
        const avgEntrySize = stats.totalEntries > 0
          ? (stats.totalSize / stats.totalEntries / 1024).toFixed(2)
          : '0';

        // Format timestamps
        const oldestEntryDate = stats.oldestEntry
          ? new Date(stats.oldestEntry).toISOString()
          : null;
        const newestEntryDate = stats.newestEntry
          ? new Date(stats.newestEntry).toISOString()
          : null;

        return {
          contents: [{
            uri: typeof uri === 'string' ? uri : uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({
              stats: {
                // Core metrics
                totalEntries: stats.totalEntries,
                totalSize: stats.totalSize,
                totalSizeFormatted: displaySize,
                avgEntrySizeKB: avgEntrySize,

                // Hit rate metrics
                hits: stats.hits,
                misses: stats.misses,
                totalRequests,
                hitRate: `${stats.hitRate.toFixed(2)}%`,
                hitRateNumeric: stats.hitRate,

                // Time metrics
                oldestEntry: oldestEntryDate,
                newestEntry: newestEntryDate,

                // Namespace breakdown
                byNamespace: stats.byNamespace,
                namespaceCount: Object.keys(stats.byNamespace).length,
              },

              // Performance assessment
              performance: {
                rating: stats.hitRate >= 80 ? 'excellent' :
                       stats.hitRate >= 60 ? 'good' :
                       stats.hitRate >= 40 ? 'fair' : 'poor',
                recommendations: generateRecommendations(stats),
              },

              // Metadata
              timestamp: new Date().toISOString(),
              note: 'Cache statistics are cumulative since server start. Use cache manager resetStats() to reset.',
            }, null, 2),
          }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          contents: [{
            uri: typeof uri === 'string' ? uri : uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({
              error: 'Failed to fetch cache statistics',
              message: errorMessage,
            }, null, 2),
          }],
        };
      }
    }
  );

  console.error('[ServalSheets] Registered 1 cache resource:');
  console.error('  - cache://stats (performance metrics)');

  return 1;
}

/**
 * Generate performance recommendations based on cache stats
 */
function generateRecommendations(stats: {
  hitRate: number;
  totalEntries: number;
  totalSize: number;
}): string[] {
  const recommendations: string[] = [];

  // Hit rate recommendations
  if (stats.hitRate < 40) {
    recommendations.push('Cache hit rate is low (<40%). Consider increasing cache TTL or reviewing cache key strategy.');
  } else if (stats.hitRate < 60) {
    recommendations.push('Cache hit rate is moderate (40-60%). Review frequently accessed data for better caching opportunities.');
  } else if (stats.hitRate >= 80) {
    recommendations.push('Cache hit rate is excellent (≥80%). Cache is working effectively.');
  }

  // Size recommendations
  const sizeMB = stats.totalSize / 1024 / 1024;
  if (sizeMB > 80) {
    recommendations.push('Cache size is approaching limit (>80MB). Consider reducing TTL or max size.');
  } else if (sizeMB < 10 && stats.totalEntries < 50) {
    recommendations.push('Cache is underutilized. Consider caching more frequently accessed data.');
  }

  // Entry count recommendations
  if (stats.totalEntries === 0) {
    recommendations.push('Cache is empty. Ensure caching is enabled and operations are creating cache entries.');
  } else if (stats.totalEntries > 1000) {
    recommendations.push('High entry count (>1000). Review cache cleanup frequency.');
  }

  return recommendations;
}
